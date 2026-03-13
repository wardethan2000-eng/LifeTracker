import type { Prisma } from "@prisma/client";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import {
  applyInventoryTransaction,
  getHouseholdInventoryItem,
  toInventoryItemDetailResponse,
  toInventoryItemSummaryResponse,
  toLowStockInventoryItemResponse
} from "../../lib/inventory.js";
import { calculateInventoryDeficit, isInventoryLowStock } from "@lifekeeper/utils";
import { syncInventoryItemToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const inventoryItemParamsSchema = householdParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const listInventoryQuerySchema = z.object({
  category: z.string().min(1).max(120).optional(),
  search: z.string().min(1).max(200).optional(),
  lowStock: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

const inventoryDetailQuerySchema = z.object({
  transactionLimit: z.coerce.number().int().min(1).max(100).default(20)
});

const ensureMembership = async (app: Parameters<FastifyPluginAsync>[0], householdId: string, userId: string) => {
  try {
    await assertMembership(app.prisma, householdId, userId);
    return true;
  } catch {
    return false;
  }
};

export const householdInventoryItemRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/inventory", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createInventoryItemSchema.parse(request.body);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          householdId: params.householdId,
          name: input.name,
          partNumber: input.partNumber ?? null,
          description: input.description ?? null,
          category: input.category ?? null,
          manufacturer: input.manufacturer ?? null,
          quantityOnHand: 0,
          unit: input.unit,
          reorderThreshold: input.reorderThreshold ?? null,
          reorderQuantity: input.reorderQuantity ?? null,
          preferredSupplier: input.preferredSupplier ?? null,
          supplierUrl: input.supplierUrl ?? null,
          unitCost: input.unitCost ?? null,
          storageLocation: input.storageLocation ?? null,
          notes: input.notes ?? null
        }
      });

      if (input.quantityOnHand > 0) {
        const result = await applyInventoryTransaction(tx, {
          inventoryItemId: created.id,
          userId: request.auth.userId,
          input: {
            type: "adjust",
            quantity: input.quantityOnHand,
            unitCost: input.unitCost,
            referenceType: "manual",
            referenceId: created.id,
            notes: "Initial inventory quantity"
          }
        });

        return result.item;
      }

      return created;
    });

    void syncInventoryItemToSearchIndex(app.prisma, item.id).catch(console.error);

    return reply.code(201).send(toInventoryItemSummaryResponse(item));
  });

  app.get("/v1/households/:householdId/inventory", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listInventoryQuerySchema.parse(request.query);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.InventoryItemWhereInput = {
      householdId: params.householdId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { partNumber: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };

    const take = query.lowStock ? Math.min(query.limit * 5, 250) : query.limit + 1;
    const items = await app.prisma.inventoryItem.findMany({
      where,
      take,
      ...(query.cursor ? {
        cursor: { id: query.cursor },
        skip: 1
      } : {}),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    const filtered = query.lowStock
      ? items.filter((item) => isInventoryLowStock(item.quantityOnHand, item.reorderThreshold))
      : items;

    const page = filtered.slice(0, query.limit);
    const nextCursor = filtered.length > query.limit ? filtered[query.limit]?.id ?? null : null;

    return {
      items: page.map(toInventoryItemSummaryResponse),
      nextCursor
    };
  });

  app.get("/v1/households/:householdId/inventory/low-stock", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const items = await app.prisma.inventoryItem.findMany({
      where: {
        householdId: params.householdId,
        reorderThreshold: { not: null }
      },
      orderBy: { createdAt: "desc" }
    });

    // This shopping-list endpoint should eventually feed inventory alert scanning once notifications support inventory events.
    return items
      .filter((item) => isInventoryLowStock(item.quantityOnHand, item.reorderThreshold))
      .sort((left, right) => calculateInventoryDeficit(right.quantityOnHand, right.reorderThreshold) - calculateInventoryDeficit(left.quantityOnHand, left.reorderThreshold))
      .map(toLowStockInventoryItemResponse);
  });

  app.get("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    const query = inventoryDetailQuerySchema.parse(request.query);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.inventoryItem.findFirst({
      where: {
        id: params.inventoryItemId,
        householdId: params.householdId
      },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: query.transactionLimit
        },
        assetLinks: {
          include: {
            asset: {
              select: { id: true, name: true, category: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        projectLinks: {
          include: {
            project: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    return toInventoryItemDetailResponse(item);
  });

  app.patch("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    const input = updateInventoryItemSchema.parse(request.body);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const item = await app.prisma.$transaction(async (tx) => {
      const quantityChanged = input.quantityOnHand !== undefined && input.quantityOnHand !== existing.quantityOnHand;

      const updated = await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.partNumber !== undefined ? { partNumber: input.partNumber ?? null } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.category !== undefined ? { category: input.category ?? null } : {}),
          ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer ?? null } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.reorderThreshold !== undefined ? { reorderThreshold: input.reorderThreshold ?? null } : {}),
          ...(input.reorderQuantity !== undefined ? { reorderQuantity: input.reorderQuantity ?? null } : {}),
          ...(input.preferredSupplier !== undefined ? { preferredSupplier: input.preferredSupplier ?? null } : {}),
          ...(input.supplierUrl !== undefined ? { supplierUrl: input.supplierUrl ?? null } : {}),
          ...(input.storageLocation !== undefined ? { storageLocation: input.storageLocation ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(!quantityChanged && input.unitCost !== undefined ? { unitCost: input.unitCost ?? null } : {})
        }
      });

      if (!quantityChanged) {
        return updated;
      }

      const result = await applyInventoryTransaction(tx, {
        inventoryItemId: existing.id,
        userId: request.auth.userId,
        input: {
          type: "adjust",
          quantity: (input.quantityOnHand ?? existing.quantityOnHand) - existing.quantityOnHand,
          unitCost: input.unitCost,
          referenceType: "manual",
          referenceId: existing.id,
          notes: "Direct quantity adjustment"
        },
        preventNegative: false,
        clampToZero: false
      });

      return result.item;
    });

    void syncInventoryItemToSearchIndex(app.prisma, item.id).catch(console.error);

    return toInventoryItemSummaryResponse(item);
  });

  app.delete("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    await app.prisma.inventoryItem.delete({
      where: { id: existing.id }
    });

    void removeSearchIndexEntry(app.prisma, "inventory_item", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};