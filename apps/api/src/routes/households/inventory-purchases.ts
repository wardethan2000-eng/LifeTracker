import type { PrismaExecutor } from "../../lib/prisma-types.js";
﻿import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createQuickRestockSchema,
  updateInventoryPurchaseBodySchema,
  updateInventoryPurchaseLineSchema
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import {
  applyInventoryTransaction,
  calculateInventoryDeficit,
  getHouseholdInventoryItem,
  isInventoryLowStock
} from "../../lib/inventory.js";
import { syncProjectDerivedStatuses } from "../../lib/project-status.js";
import {
  toInventoryPurchaseResponse,
  toInventoryShoppingListResponse
} from "../../lib/serializers/index.js";
import { notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const purchaseLineParamsSchema = householdParamsSchema.extend({
  purchaseId: z.string().cuid(),
  lineId: z.string().cuid()
});

const purchaseParamsSchema = householdParamsSchema.extend({
  purchaseId: z.string().cuid()
});

const purchaseInclude = {
  lines: {
    where: {
      inventoryItem: {
        deletedAt: null
      }
    },
    include: {
      inventoryItem: true
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" }
    ]
  }
} satisfies Prisma.InventoryPurchaseInclude;


type InventoryPurchaseWithLines = Prisma.InventoryPurchaseGetPayload<{ include: typeof purchaseInclude }>;

const activePurchaseStatuses = ["draft", "ordered"] as const;

const getSupplierKey = (supplierName: string | null, supplierUrl: string | null): string => (
  `${supplierName?.trim().toLowerCase() ?? ""}::${supplierUrl?.trim().toLowerCase() ?? ""}`
);

const getPlannedQuantity = (item: {
  quantityOnHand: number;
  reorderThreshold: number | null;
  reorderQuantity: number | null;
}): number => {
  if (item.reorderQuantity !== null && item.reorderQuantity > 0) {
    return item.reorderQuantity;
  }

  return Math.max(calculateInventoryDeficit(item.quantityOnHand, item.reorderThreshold), 1);
};

const getDerivedPurchaseStatus = (purchase: InventoryPurchaseWithLines): "draft" | "ordered" | "received" => {
  if (purchase.lines.length > 0 && purchase.lines.every((line) => line.status === "received")) {
    return "received";
  }

  if (purchase.lines.some((line) => line.status === "ordered" || line.status === "received")) {
    return "ordered";
  }

  return "draft";
};

const listActivePurchases = async (prisma: PrismaExecutor, householdId: string): Promise<InventoryPurchaseWithLines[]> => {
  const purchases = await prisma.inventoryPurchase.findMany({
    where: {
      householdId,
      status: {
        in: [...activePurchaseStatuses]
      }
    },
    include: purchaseInclude,
    orderBy: [
      { supplierName: "asc" },
      { createdAt: "asc" }
    ]
  });

  return purchases.filter((purchase) => purchase.lines.length > 0);
};

const syncPurchaseStatus = async (
  prisma: Prisma.TransactionClient,
  purchaseId: string
): Promise<InventoryPurchaseWithLines> => {
  const purchase = await prisma.inventoryPurchase.findUnique({
    where: { id: purchaseId },
    include: purchaseInclude
  });

  if (!purchase) {
    throw new Error("Inventory purchase not found.");
  }

  const nextStatus = getDerivedPurchaseStatus(purchase);
  const orderedAt = nextStatus === "draft"
    ? null
    : (purchase.orderedAt ?? purchase.lines.find((line) => line.orderedAt)?.orderedAt ?? new Date());
  const receivedAt = nextStatus === "received"
    ? (purchase.receivedAt ?? purchase.lines.find((line) => line.receivedAt)?.receivedAt ?? new Date())
    : null;

  return prisma.inventoryPurchase.update({
    where: { id: purchase.id },
    data: {
      status: nextStatus,
      orderedAt,
      receivedAt
    },
    include: purchaseInclude
  });
};

export const householdInventoryPurchaseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/inventory/shopping-list", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const purchases = await listActivePurchases(app.prisma, params.householdId);
    return reply.send(toInventoryShoppingListResponse(purchases));
  });

  app.post("/v1/households/:householdId/inventory/shopping-list/generate", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const [items, existingPurchases] = await Promise.all([
      app.prisma.inventoryItem.findMany({
        where: {
          householdId: params.householdId,
          deletedAt: null,
          itemType: "consumable",
          reorderThreshold: { not: null }
        },
        orderBy: [
          { preferredSupplier: "asc" },
          { name: "asc" }
        ]
      }),
      listActivePurchases(app.prisma, params.householdId)
    ]);

    const lowStockItems = items.filter((item) => isInventoryLowStock(item.quantityOnHand, item.reorderThreshold));

    const openPurchaseBySupplier = new Map(existingPurchases.map((purchase) => [
      getSupplierKey(purchase.supplierName, purchase.supplierUrl),
      purchase
    ]));
    const existingLineKeys = new Set(existingPurchases.flatMap((purchase) => (
      purchase.lines.map((line) => `${purchase.id}:${line.inventoryItemId}`)
    )));

    const createdPurchaseIds = new Set<string>();

    await app.prisma.$transaction(async (tx) => {
      for (const item of lowStockItems) {
        const supplierName = item.preferredSupplier?.trim() || null;
        const supplierUrl = item.supplierUrl?.trim() || null;
        const supplierKey = getSupplierKey(supplierName, supplierUrl);
        let purchase = openPurchaseBySupplier.get(supplierKey) ?? null;

        if (!purchase) {
          purchase = await tx.inventoryPurchase.create({
            data: {
              householdId: params.householdId,
              createdById: request.auth.userId,
              supplierName,
              supplierUrl,
              source: "reorder",
              status: "draft",
              notes: "Generated from the low-stock reorder watchlist."
            },
            include: purchaseInclude
          });

          openPurchaseBySupplier.set(supplierKey, purchase);
          createdPurchaseIds.add(purchase.id);
        }

        const lineKey = `${purchase.id}:${item.id}`;
        if (existingLineKeys.has(lineKey)) {
          continue;
        }

        await tx.inventoryPurchaseLine.create({
          data: {
            purchaseId: purchase.id,
            inventoryItemId: item.id,
            status: "draft",
            plannedQuantity: getPlannedQuantity(item),
            unitCost: item.unitCost,
            notes: item.notes ?? null
          }
        });

        existingLineKeys.add(lineKey);
      }
    });

    for (const purchaseId of createdPurchaseIds) {
            await createActivityLogger(app.prisma, request.auth.userId).log("inventory_purchase", purchaseId, "inventory.purchase.generated", params.householdId, { source: "reorder" });
    }

    const purchases = await listActivePurchases(app.prisma, params.householdId);
    return reply.code(201).send(toInventoryShoppingListResponse(purchases));
  });

  app.patch("/v1/households/:householdId/inventory/purchases/:purchaseId/lines/:lineId", async (request, reply) => {
    const params = purchaseLineParamsSchema.parse(request.params);
    const input = updateInventoryPurchaseLineSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.inventoryPurchaseLine.findFirst({
      where: {
        id: params.lineId,
        purchaseId: params.purchaseId,
        purchase: {
          householdId: params.householdId
        },
        inventoryItem: {
          deletedAt: null
        }
      },
      include: {
        inventoryItem: true,
        purchase: true,
        projectPhaseSupply: {
          select: {
            id: true,
            name: true,
            quantityNeeded: true,
            quantityOnHand: true,
            isProcured: true,
            procuredAt: true,
            actualUnitCost: true,
            phase: {
              select: {
                name: true,
                projectId: true
              }
            }
          }
        }
      }
    });

    if (!existing) {
      return notFound(reply, "Purchase line");
    }

    const nextStatus = input.status ?? existing.status;

    if (existing.status === "received" && nextStatus === "received") {
      return reply.code(400).send({ message: "This purchase line has already been received." });
    }

    const { purchase: updatedPurchase, linkedSupplyResult } = await app.prisma.$transaction(async (tx) => {
      const lineData: Prisma.InventoryPurchaseLineUncheckedUpdateInput = {
        ...(input.plannedQuantity !== undefined ? { plannedQuantity: input.plannedQuantity } : {}),
        ...(input.unitCost !== undefined ? { unitCost: input.unitCost ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
      };

      if (nextStatus === "ordered") {
        lineData.status = "ordered";
        lineData.orderedQuantity = input.orderedQuantity ?? existing.orderedQuantity ?? input.plannedQuantity ?? existing.plannedQuantity;
        lineData.orderedAt = existing.orderedAt ?? new Date();
      }

      if (nextStatus === "received") {
        const receivedQuantity = input.receivedQuantity
          ?? existing.orderedQuantity
          ?? input.orderedQuantity
          ?? input.plannedQuantity
          ?? existing.plannedQuantity;
        const unitCost = input.unitCost !== undefined
          ? input.unitCost ?? undefined
          : existing.unitCost ?? existing.inventoryItem.unitCost ?? undefined;

        lineData.status = "received";
        lineData.orderedQuantity = input.orderedQuantity ?? existing.orderedQuantity ?? existing.plannedQuantity;
        lineData.receivedQuantity = receivedQuantity;
        lineData.orderedAt = existing.orderedAt ?? new Date();
        lineData.receivedAt = new Date();

        await tx.inventoryPurchaseLine.update({
          where: { id: existing.id },
          data: lineData
        });

        await applyInventoryTransaction(tx, {
          inventoryItemId: existing.inventoryItemId,
          userId: request.auth.userId,
          input: {
            type: "purchase",
            quantity: receivedQuantity,
            unitCost,
            referenceType: "inventory_purchase_line",
            referenceId: existing.id,
            notes: input.notes ?? existing.notes ?? `Received via ${existing.purchase.source === "reorder" ? "shopping list" : "quick restock"}`
          }
        });

        let linkedSupplyResult: {
          id: string;
          name: string;
          phaseName: string;
          projectId: string;
          becameProcured: boolean;
        } | null = null;

        if (existing.projectPhaseSupply) {
          const resolvedUnitCost = input.unitCost !== undefined
            ? input.unitCost ?? null
            : (existing.unitCost ?? existing.projectPhaseSupply.actualUnitCost ?? existing.inventoryItem.unitCost ?? null);
          const shouldMarkProcured = existing.projectPhaseSupply.isProcured
            || (existing.projectPhaseSupply.quantityOnHand + receivedQuantity >= existing.projectPhaseSupply.quantityNeeded);
          const updatedSupply = await tx.projectPhaseSupply.update({
            where: { id: existing.projectPhaseSupply.id },
            data: {
              actualUnitCost: resolvedUnitCost,
              isProcured: shouldMarkProcured,
              procuredAt: shouldMarkProcured
                ? (existing.projectPhaseSupply.procuredAt ?? new Date())
                : null
            },
            select: {
              id: true,
              name: true,
              isProcured: true
            }
          });

          await syncProjectDerivedStatuses(tx, existing.projectPhaseSupply.phase.projectId);

          linkedSupplyResult = {
            id: updatedSupply.id,
            name: updatedSupply.name,
            phaseName: existing.projectPhaseSupply.phase.name,
            projectId: existing.projectPhaseSupply.phase.projectId,
            becameProcured: !existing.projectPhaseSupply.isProcured && updatedSupply.isProcured
          };
        }

        return {
          purchase: await syncPurchaseStatus(tx, existing.purchaseId),
          linkedSupplyResult
        };
      }

      if (nextStatus === "draft") {
        lineData.status = "draft";
        lineData.orderedQuantity = null;
        lineData.receivedQuantity = null;
        lineData.orderedAt = null;
        lineData.receivedAt = null;
      }

      await tx.inventoryPurchaseLine.update({
        where: { id: existing.id },
        data: lineData
      });

      return {
        purchase: await syncPurchaseStatus(tx, existing.purchaseId),
        linkedSupplyResult: null
      };
    });

    if (nextStatus === "ordered") {
            await createActivityLogger(app.prisma, request.auth.userId).log("inventory_purchase", updatedPurchase.id, "inventory.purchase_line.ordered", params.householdId, {
          inventoryItemId: existing.inventoryItemId,
          itemName: existing.inventoryItem.name
        });
    }

    if (nextStatus === "received") {
            await createActivityLogger(app.prisma, request.auth.userId).log("inventory_purchase", updatedPurchase.id, "inventory.purchase_line.received", params.householdId, {
          inventoryItemId: existing.inventoryItemId,
          itemName: existing.inventoryItem.name
        });

      if (linkedSupplyResult?.becameProcured) {
                await createActivityLogger(app.prisma, request.auth.userId).log("project_phase_supply", linkedSupplyResult.id, "project.supply.procured", params.householdId, {
            supplyName: linkedSupplyResult.name,
            phaseName: linkedSupplyResult.phaseName,
            source: "inventory_purchase"
          });
      }
    }

    return reply.send(toInventoryPurchaseResponse(updatedPurchase));
  });

  app.post("/v1/households/:householdId/inventory/restock-batches", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createQuickRestockSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    for (const line of input.items) {
      const item = await getHouseholdInventoryItem(app.prisma, params.householdId, line.inventoryItemId);

      if (!item) {
        return reply.code(400).send({ message: "One or more inventory items were not found." });
      }
    }

    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const purchase = await app.prisma.$transaction(async (tx) => {
      const createdPurchase = await tx.inventoryPurchase.create({
        data: {
          householdId: params.householdId,
          createdById: request.auth.userId,
          supplierName: input.supplierName?.trim() || null,
          supplierUrl: input.supplierUrl?.trim() || null,
          source: "quick_restock",
          status: "received",
          notes: input.notes ?? null,
          orderedAt: receivedAt,
          receivedAt
        }
      });

      for (const line of input.items) {
        const item = await getHouseholdInventoryItem(tx, params.householdId, line.inventoryItemId);

        if (!item) {
          throw new Error("Inventory item not found.");
        }

        const createdLine = await tx.inventoryPurchaseLine.create({
          data: {
            purchaseId: createdPurchase.id,
            inventoryItemId: item.id,
            status: "received",
            plannedQuantity: line.quantity,
            orderedQuantity: line.quantity,
            receivedQuantity: line.quantity,
            unitCost: line.unitCost ?? item.unitCost ?? null,
            notes: line.notes ?? null,
            orderedAt: receivedAt,
            receivedAt
          }
        });

        await applyInventoryTransaction(tx, {
          inventoryItemId: item.id,
          userId: request.auth.userId,
          input: {
            type: "purchase",
            quantity: line.quantity,
            unitCost: line.unitCost ?? item.unitCost ?? undefined,
            referenceType: "inventory_purchase_line",
            referenceId: createdLine.id,
            notes: line.notes ?? input.notes ?? "Recorded from quick restock."
          }
        });
      }

      return tx.inventoryPurchase.findUniqueOrThrow({
        where: { id: createdPurchase.id },
        include: purchaseInclude
      });
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("inventory_purchase", purchase.id, "inventory.quick_restock.created", params.householdId, {
        supplierName: purchase.supplierName,
        itemCount: purchase.lines.length
      });

    return reply.code(201).send(toInventoryPurchaseResponse(purchase));
  });

  // ── Update purchase metadata ──────────────────────────────────────

  app.patch("/v1/households/:householdId/inventory/purchases/:purchaseId", async (request, reply) => {
    const params = purchaseParamsSchema.parse(request.params);
    const input = updateInventoryPurchaseBodySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.inventoryPurchase.findFirst({
      where: { id: params.purchaseId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Purchase not found." });
    }

    const updated = await app.prisma.inventoryPurchase.update({
      where: { id: existing.id },
      data: {
        ...(input.supplierName !== undefined ? { supplierName: input.supplierName ?? null } : {}),
        ...(input.supplierUrl !== undefined ? { supplierUrl: input.supplierUrl ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
      },
      include: purchaseInclude
    });

    return reply.send(toInventoryPurchaseResponse(updated));
  });

  // ── Delete (cancel) a draft or ordered purchase ───────────────────

  app.delete("/v1/households/:householdId/inventory/purchases/:purchaseId", async (request, reply) => {
    const params = purchaseParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.inventoryPurchase.findFirst({
      where: { id: params.purchaseId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Purchase not found." });
    }

    if (existing.status === "received") {
      return reply.code(409).send({ message: "Received purchases cannot be deleted." });
    }

    await app.prisma.inventoryPurchase.delete({ where: { id: existing.id } });

    await createActivityLogger(app.prisma, request.auth.userId).log("inventory_purchase", existing.id, "inventory.purchase.deleted", params.householdId, {
      supplierName: existing.supplierName,
      status: existing.status
    });

    return reply.code(204).send();
  });
};