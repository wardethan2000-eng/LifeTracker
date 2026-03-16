import {
  createMaintenanceLogPartSchema,
  updateMaintenanceLogPartSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  applyInventoryTransaction,
  createMaintenanceLogPartWithInventory,
  InventoryError
} from "../../lib/inventory.js";
import {
  toMaintenanceLogPartResponse,
  toMaintenanceLogPartWithInventoryResponse
} from "../../lib/serializers/index.js";

const logParamsSchema = z.object({
  assetId: z.string().cuid(),
  logId: z.string().cuid()
});

const partParamsSchema = logParamsSchema.extend({
  partId: z.string().cuid()
});

export const maintenanceLogPartRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/assets/:assetId/logs/:logId/parts", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const input = createMaintenanceLogPartSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    try {
      const result = await app.prisma.$transaction((tx) => createMaintenanceLogPartWithInventory(tx, {
        householdId: asset.householdId,
        logId: log.id,
        userId: request.auth.userId,
        input
      }));

      return reply.code(201).send({
        ...toMaintenanceLogPartWithInventoryResponse(result.part),
        warning: result.warning ?? null
      });
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INVENTORY_ITEM_NOT_FOUND") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });

  app.get("/v1/assets/:assetId/logs/:logId/parts", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const parts = await app.prisma.maintenanceLogPart.findMany({
      where: { logId: log.id },
      orderBy: { createdAt: "desc" }
    });

    return parts.map(toMaintenanceLogPartResponse);
  });

  app.patch("/v1/assets/:assetId/logs/:logId/parts/:partId", async (request, reply) => {
    const params = partParamsSchema.parse(request.params);
    const input = updateMaintenanceLogPartSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const existing = await app.prisma.maintenanceLogPart.findFirst({
      where: { id: params.partId, logId: log.id }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Part not found." });
    }

    if (input.inventoryItemId) {
      const inventoryItem = await app.prisma.inventoryItem.findFirst({
        where: {
          id: input.inventoryItemId,
          householdId: asset.householdId
        },
        select: { id: true }
      });

      if (!inventoryItem) {
        return reply.code(400).send({ message: "Inventory item not found or belongs to a different household." });
      }
    }

    const nextInventoryItemId = input.inventoryItemId !== undefined ? input.inventoryItemId ?? null : existing.inventoryItemId;
    const nextQuantity = input.quantity ?? existing.quantity;

    try {
      const part = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.maintenanceLogPart.update({
          where: { id: existing.id },
          data: {
            ...(input.inventoryItemId !== undefined ? { inventoryItemId: input.inventoryItemId ?? null } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.partNumber !== undefined ? { partNumber: input.partNumber ?? null } : {}),
            ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
            ...(input.unitCost !== undefined ? { unitCost: input.unitCost ?? null } : {}),
            ...(input.supplier !== undefined ? { supplier: input.supplier ?? null } : {}),
            ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
          }
        });

        if (existing.inventoryItemId && nextInventoryItemId && existing.inventoryItemId !== nextInventoryItemId) {
          await applyInventoryTransaction(tx, {
            inventoryItemId: existing.inventoryItemId,
            userId: request.auth.userId,
            input: {
              type: "adjust",
              quantity: existing.quantity,
              referenceType: "maintenance_log",
              referenceId: params.logId,
              notes: "Part reassigned to different inventory item"
            },
            clampToZero: false,
          });

          await applyInventoryTransaction(tx, {
            inventoryItemId: nextInventoryItemId,
            userId: request.auth.userId,
            input: {
              type: "consume",
              quantity: -nextQuantity,
              referenceType: "maintenance_log",
              referenceId: params.logId,
              notes: "Part linked from maintenance log"
            },
            preventNegative: false,
            clampToZero: true,
          });
        } else if (existing.inventoryItemId && nextInventoryItemId === null) {
          await applyInventoryTransaction(tx, {
            inventoryItemId: existing.inventoryItemId,
            userId: request.auth.userId,
            input: {
              type: "adjust",
              quantity: existing.quantity,
              referenceType: "maintenance_log",
              referenceId: params.logId,
              notes: "Part reassigned to different inventory item"
            },
            clampToZero: false,
          });
        } else if (!existing.inventoryItemId && nextInventoryItemId) {
          await applyInventoryTransaction(tx, {
            inventoryItemId: nextInventoryItemId,
            userId: request.auth.userId,
            input: {
              type: "consume",
              quantity: -nextQuantity,
              referenceType: "maintenance_log",
              referenceId: params.logId,
              notes: "Part linked from maintenance log"
            },
            preventNegative: false,
            clampToZero: true,
          });
        } else {
          const delta = existing.quantity - nextQuantity;

          if (delta !== 0 && nextInventoryItemId) {
            await applyInventoryTransaction(tx, {
              inventoryItemId: nextInventoryItemId,
              userId: request.auth.userId,
              input: {
                type: "adjust",
                quantity: delta,
                referenceType: "maintenance_log",
                referenceId: params.logId,
                notes: "Part quantity adjustment"
              },
              clampToZero: true,
            });
          }
        }

        return updated;
      });

      return toMaintenanceLogPartResponse(part);
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INVENTORY_ITEM_NOT_FOUND") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });

  app.delete("/v1/assets/:assetId/logs/:logId/parts/:partId", async (request, reply) => {
    const params = partParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const part = await app.prisma.maintenanceLogPart.findFirst({
      where: { id: params.partId, logId: log.id }
    });

    if (!part) {
      return reply.code(404).send({ message: "Part not found." });
    }

    try {
      if (part.inventoryItemId) {
        const inventoryItemId = part.inventoryItemId;

        await app.prisma.$transaction(async (tx) => {
          await applyInventoryTransaction(tx, {
            inventoryItemId,
            userId: request.auth.userId,
            input: {
              type: "adjust",
              quantity: part.quantity,
              referenceType: "maintenance_log",
              referenceId: params.logId,
              notes: "Part removed from maintenance log"
            },
            clampToZero: false,
          });

          await tx.maintenanceLogPart.delete({ where: { id: part.id } });
        });
      } else {
        await app.prisma.maintenanceLogPart.delete({ where: { id: part.id } });
      }
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INVENTORY_ITEM_NOT_FOUND") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }

    return reply.code(204).send();
  });
};