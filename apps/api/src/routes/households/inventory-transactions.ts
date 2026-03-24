import {
  createInventoryTransactionCorrectionSchema,
  createInventoryTransactionSchema,
  inventoryTransactionCorrectionResultSchema,
  inventoryTransactionListSchema,
  inventoryTransactionQuerySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import {
  applyInventoryTransaction,
  createInventoryTransactionCorrection,
  getHouseholdInventoryItem,
  InventoryError
} from "../../lib/inventory.js";
import {
  getInventoryTransactionReferenceKey,
  resolveInventoryTransactionReferenceLinks
} from "../../lib/inventory-transaction-references.js";
import {
  toInventoryItemSummaryResponse,
  toInventoryTransactionResponse,
  toInventoryTransactionWithItemResponse
} from "../../lib/serializers/index.js";
import { notFound } from "../../lib/errors.js";

const inventoryTransactionParamsSchema = z.object({
  householdId: z.string().cuid(),
  inventoryItemId: z.string().cuid()
});

const householdInventoryTransactionParamsSchema = z.object({
  householdId: z.string().cuid()
});

const inventoryTransactionCorrectionParamsSchema = z.object({
  householdId: z.string().cuid(),
  transactionId: z.string().cuid()
});

export const householdInventoryTransactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/inventory/transactions", async (request, reply) => {
    const params = householdInventoryTransactionParamsSchema.parse(request.params);
    const query = inventoryTransactionQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const rawTransactions = await app.prisma.inventoryTransaction.findMany({
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
        ...cursorWhere(query.cursor)
      },
      include: {
        correctionOfTransaction: {
          select: {
            id: true,
            type: true,
            quantity: true,
            createdAt: true
          }
        },
        correctedByTransactions: {
          select: {
            id: true,
            type: true,
            quantity: true,
            createdAt: true
          },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" }
          ]
        },
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

    const { items: transactions, nextCursor } = buildCursorPage(rawTransactions, query.limit);
    const referenceLinks = await resolveInventoryTransactionReferenceLinks(app.prisma, params.householdId, transactions);

    return reply.send(inventoryTransactionListSchema.parse({
      transactions: transactions.map((transaction) => toInventoryTransactionWithItemResponse(
        transaction,
        referenceLinks.get(getInventoryTransactionReferenceKey(transaction.referenceType, transaction.referenceId) ?? "") ?? null
      )),
      nextCursor
    }));
  });

  app.post("/v1/households/:householdId/inventory/:inventoryItemId/transactions", async (request, reply) => {
    const params = inventoryTransactionParamsSchema.parse(request.params);
    const input = createInventoryTransactionSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return notFound(reply, "Inventory item");
    }

    try {
      const result = await app.prisma.$transaction((tx) => applyInventoryTransaction(tx, {
        inventoryItemId: existing.id,
        userId: request.auth.userId,
        input
      }));

      const referenceLinks = await resolveInventoryTransactionReferenceLinks(app.prisma, params.householdId, [result.transaction]);

      return reply.code(201).send({
        transaction: toInventoryTransactionResponse(
          result.transaction,
          referenceLinks.get(getInventoryTransactionReferenceKey(result.transaction.referenceType, result.transaction.referenceId) ?? "") ?? null
        ),
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

  app.post("/v1/households/:householdId/inventory/transactions/:transactionId/corrections", async (request, reply) => {
    const params = inventoryTransactionCorrectionParamsSchema.parse(request.params);
    const input = createInventoryTransactionCorrectionSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    try {
      const result = await app.prisma.$transaction((tx) => createInventoryTransactionCorrection(tx, {
        householdId: params.householdId,
        transactionId: params.transactionId,
        userId: request.auth.userId,
        input
      }));

      const referenceLinks = await resolveInventoryTransactionReferenceLinks(app.prisma, params.householdId, [result.transaction]);

            await createActivityLogger(app.prisma, request.auth.userId).log("inventory_transaction", result.transaction.id, "inventory.transaction.corrected", params.householdId, {
          correctedTransactionId: params.transactionId,
          inventoryItemId: result.item.id,
          correctionQuantity: result.transaction.quantity,
          replacementQuantity: input.replacementQuantity
        });

      return reply.code(201).send(inventoryTransactionCorrectionResultSchema.parse({
        transaction: toInventoryTransactionResponse(
          result.transaction,
          referenceLinks.get(getInventoryTransactionReferenceKey(result.transaction.referenceType, result.transaction.referenceId) ?? "") ?? null
        ),
        inventoryItem: toInventoryItemSummaryResponse(result.item)
      }));
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INVENTORY_TRANSACTION_NOT_FOUND") {
        return reply.code(404).send({ message: error.message });
      }

      if (error instanceof InventoryError && error.code === "NO_CORRECTION_REQUIRED") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });
};
