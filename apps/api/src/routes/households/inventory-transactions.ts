import {
  createInventoryTransactionSchema,
  inventoryTransactionListSchema,
  inventoryTransactionQuerySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import {
  applyInventoryTransaction,
  getHouseholdInventoryItem,
  InventoryError
} from "../../lib/inventory.js";
import {
  toInventoryItemSummaryResponse,
  toInventoryTransactionResponse,
  toInventoryTransactionWithItemResponse
} from "../../lib/serializers/index.js";

const inventoryTransactionParamsSchema = z.object({
  householdId: z.string().cuid(),
  inventoryItemId: z.string().cuid()
});

const householdInventoryTransactionParamsSchema = z.object({
  householdId: z.string().cuid()
});

export const householdInventoryTransactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/inventory/transactions", async (request, reply) => {
    const params = householdInventoryTransactionParamsSchema.parse(request.params);
    const query = inventoryTransactionQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const transactions = await app.prisma.inventoryTransaction.findMany({
      where: {
        inventoryItem: {
          householdId: params.householdId
        },
        ...(query.type ? { type: query.type } : {}),
        ...(query.referenceType ? { referenceType: query.referenceType } : {}),
        ...(query.inventoryItemId ? { inventoryItemId: query.inventoryItemId } : {}),
        ...((query.startDate || query.endDate)
          ? {
              createdAt: {
                ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                ...(query.endDate ? { lte: new Date(query.endDate) } : {})
              }
            }
          : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {})
      },
      include: {
        inventoryItem: {
          select: {
            name: true,
            partNumber: true
          }
        }
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      take: query.limit + 1
    });

    const hasNextPage = transactions.length > query.limit;

    if (hasNextPage) {
      transactions.pop();
    }

    return reply.send(inventoryTransactionListSchema.parse({
      transactions: transactions.map(toInventoryTransactionWithItemResponse),
      nextCursor: hasNextPage && transactions.length > 0
        ? transactions[transactions.length - 1]?.id ?? null
        : null
    }));
  });

  app.post("/v1/households/:householdId/inventory/:inventoryItemId/transactions", async (request, reply) => {
    const params = inventoryTransactionParamsSchema.parse(request.params);
    const input = createInventoryTransactionSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    try {
      const result = await app.prisma.$transaction((tx) => applyInventoryTransaction(tx, {
        inventoryItemId: existing.id,
        userId: request.auth.userId,
        input
      }));

      return reply.code(201).send({
        transaction: toInventoryTransactionResponse(result.transaction),
        inventoryItem: toInventoryItemSummaryResponse(result.item),
        lowStockWarning: input.type === "consume" && result.lowStock
      });
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INSUFFICIENT_STOCK") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });
};
