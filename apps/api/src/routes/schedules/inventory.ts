import {
  createScheduleInventoryItemSchema,
  schedulePartsReadinessSchema,
  updateScheduleInventoryItemSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { computeSchedulePartsReadiness, getHouseholdInventoryItem } from "../../lib/inventory.js";
import { toScheduleInventoryLinkDetailResponse } from "../../lib/serializers/index.js";

const scheduleParamsSchema = z.object({
  assetId: z.string().cuid(),
  scheduleId: z.string().cuid()
});

const scheduleInventoryItemParamsSchema = scheduleParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const getScheduleForAsset = async (
  app: Parameters<FastifyPluginAsync>[0],
  assetId: string,
  scheduleId: string
) => app.prisma.maintenanceSchedule.findFirst({
  where: {
    id: scheduleId,
    assetId
  },
  select: {
    id: true,
    assetId: true
  }
});

export const scheduleInventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/schedules/:scheduleId/inventory", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await getScheduleForAsset(app, asset.id, params.scheduleId);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const links = await app.prisma.scheduleInventoryItem.findMany({
      where: {
        scheduleId: schedule.id
      },
      include: {
        inventoryItem: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return links.map(toScheduleInventoryLinkDetailResponse);
  });

  app.get("/v1/assets/:assetId/schedules/:scheduleId/inventory/readiness", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await getScheduleForAsset(app, asset.id, params.scheduleId);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const readiness = await computeSchedulePartsReadiness(app.prisma, schedule.id);

    return schedulePartsReadinessSchema.parse(readiness);
  });

  app.post("/v1/assets/:assetId/schedules/:scheduleId/inventory", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const input = createScheduleInventoryItemSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await getScheduleForAsset(app, asset.id, params.scheduleId);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, asset.householdId, input.inventoryItemId);

    if (!inventoryItem) {
      return reply.code(400).send({ message: "Inventory item not found or belongs to a different household." });
    }

    const existing = await app.prisma.scheduleInventoryItem.findUnique({
      where: {
        scheduleId_inventoryItemId: {
          scheduleId: schedule.id,
          inventoryItemId: inventoryItem.id
        }
      }
    });

    if (existing) {
      return reply.code(409).send({ message: "Inventory item is already linked to this schedule." });
    }

    const link = await app.prisma.scheduleInventoryItem.create({
      data: {
        scheduleId: schedule.id,
        inventoryItemId: inventoryItem.id,
        quantityPerService: input.quantityPerService,
        notes: input.notes ?? null
      },
      include: {
        inventoryItem: true
      }
    });

    return reply.code(201).send(toScheduleInventoryLinkDetailResponse(link));
  });

  app.patch("/v1/assets/:assetId/schedules/:scheduleId/inventory/:inventoryItemId", async (request, reply) => {
    const params = scheduleInventoryItemParamsSchema.parse(request.params);
    const input = updateScheduleInventoryItemSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await getScheduleForAsset(app, asset.id, params.scheduleId);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const existing = await app.prisma.scheduleInventoryItem.findUnique({
      where: {
        scheduleId_inventoryItemId: {
          scheduleId: schedule.id,
          inventoryItemId: params.inventoryItemId
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Schedule inventory link not found." });
    }

    const link = await app.prisma.scheduleInventoryItem.update({
      where: {
        id: existing.id
      },
      data: {
        ...(input.quantityPerService !== undefined ? { quantityPerService: input.quantityPerService } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
      },
      include: {
        inventoryItem: true
      }
    });

    return toScheduleInventoryLinkDetailResponse(link);
  });

  app.delete("/v1/assets/:assetId/schedules/:scheduleId/inventory/:inventoryItemId", async (request, reply) => {
    const params = scheduleInventoryItemParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await getScheduleForAsset(app, asset.id, params.scheduleId);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const existing = await app.prisma.scheduleInventoryItem.findUnique({
      where: {
        scheduleId_inventoryItemId: {
          scheduleId: schedule.id,
          inventoryItemId: params.inventoryItemId
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Schedule inventory link not found." });
    }

    await app.prisma.scheduleInventoryItem.delete({
      where: {
        id: existing.id
      }
    });

    return reply.code(204).send();
  });
};