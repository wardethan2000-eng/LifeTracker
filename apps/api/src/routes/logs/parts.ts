import {
  createMaintenanceLogPartSchema,
  updateMaintenanceLogPartSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  createMaintenanceLogPartWithInventory,
  InventoryError,
  toMaintenanceLogPartWithInventoryResponse
} from "../../lib/inventory.js";
import { toMaintenanceLogPartResponse } from "../../lib/serializers/index.js";

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

    const part = await app.prisma.maintenanceLogPart.update({
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

    return toMaintenanceLogPartResponse(part);
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

    await app.prisma.maintenanceLogPart.delete({ where: { id: part.id } });

    return reply.code(204).send();
  });
};