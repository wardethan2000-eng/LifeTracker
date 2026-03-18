import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createQuickRestockSchema,
  updateInventoryPurchaseLineSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import {
  applyInventoryTransaction,
  calculateInventoryDeficit,
  getHouseholdInventoryItem,
  isInventoryLowStock
} from "../../lib/inventory.js";
import {
  toInventoryPurchaseResponse,
  toInventoryShoppingListResponse
} from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const purchaseLineParamsSchema = householdParamsSchema.extend({
  purchaseId: z.string().cuid(),
  lineId: z.string().cuid()
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

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
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

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const purchases = await listActivePurchases(app.prisma, params.householdId);
    return reply.send(toInventoryShoppingListResponse(purchases));
  });

  app.post("/v1/households/:householdId/inventory/shopping-list/generate", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
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
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "inventory.purchase.generated",
        entityType: "inventory_purchase",
        entityId: purchaseId,
        metadata: { source: "reorder" }
      });
    }

    const purchases = await listActivePurchases(app.prisma, params.householdId);
    return reply.code(201).send(toInventoryShoppingListResponse(purchases));
  });

  app.patch("/v1/households/:householdId/inventory/purchases/:purchaseId/lines/:lineId", async (request, reply) => {
    const params = purchaseLineParamsSchema.parse(request.params);
    const input = updateInventoryPurchaseLineSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
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
        purchase: true
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Purchase line not found." });
    }

    const nextStatus = input.status ?? existing.status;

    if (existing.status === "received" && nextStatus === "received") {
      return reply.code(400).send({ message: "This purchase line has already been received." });
    }

    const updatedPurchase = await app.prisma.$transaction(async (tx) => {
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

        return syncPurchaseStatus(tx, existing.purchaseId);
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

      return syncPurchaseStatus(tx, existing.purchaseId);
    });

    if (nextStatus === "ordered") {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "inventory.purchase_line.ordered",
        entityType: "inventory_purchase",
        entityId: updatedPurchase.id,
        metadata: {
          inventoryItemId: existing.inventoryItemId,
          itemName: existing.inventoryItem.name
        }
      });
    }

    if (nextStatus === "received") {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "inventory.purchase_line.received",
        entityType: "inventory_purchase",
        entityId: updatedPurchase.id,
        metadata: {
          inventoryItemId: existing.inventoryItemId,
          itemName: existing.inventoryItem.name
        }
      });
    }

    return reply.send(toInventoryPurchaseResponse(updatedPurchase));
  });

  app.post("/v1/households/:householdId/inventory/restock-batches", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createQuickRestockSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
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

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "inventory.quick_restock.created",
      entityType: "inventory_purchase",
      entityId: purchase.id,
      metadata: {
        supplierName: purchase.supplierName,
        itemCount: purchase.lines.length
      }
    });

    return reply.code(201).send(toInventoryPurchaseResponse(purchase));
  });
};