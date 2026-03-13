import type { Prisma } from "@prisma/client";
import {
  createMaintenanceLogSchema,
  updateMaintenanceLogSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  createMaintenanceLogPartWithInventory,
  InventoryError
} from "../../lib/inventory.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";
import { logActivity } from "../../lib/activity-log.js";
import { syncLogToSearchIndex, syncScheduleToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const logParamsSchema = assetParamsSchema.extend({
  logId: z.string().cuid()
});

const listLogsQuerySchema = z.object({
  scheduleId: z.string().cuid().optional()
});

const toInputJsonValue = (value: Record<string, unknown>): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export const maintenanceLogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/logs", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listLogsQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    if (query.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: query.scheduleId,
          assetId: asset.id
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }
    }

    const logs = await app.prisma.maintenanceLog.findMany({
      where: {
        assetId: asset.id,
        ...(query.scheduleId ? { scheduleId: query.scheduleId } : {})
      },
      include: { parts: true },
      orderBy: [
        { completedAt: "desc" },
        { createdAt: "desc" }
      ]
    });

    return logs.map(log => toMaintenanceLogResponse(log, log.parts));
  });

  app.post("/v1/assets/:assetId/logs", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createMaintenanceLogSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    let scheduleName: string | undefined;

    if (input.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: input.scheduleId,
          assetId: asset.id
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }

      scheduleName = schedule.name;
    }

    if (!input.title && !scheduleName) {
      return reply.code(400).send({
        message: "A title is required when the log is not associated with a maintenance schedule."
      });
    }

    // Validate serviceProviderId if provided
    if (input.serviceProviderId) {
      const provider = await app.prisma.serviceProvider.findFirst({
        where: { id: input.serviceProviderId, householdId: asset.householdId },
        select: { id: true }
      });

      if (!provider) {
        return reply.code(400).send({ message: "Service provider not found or belongs to a different household." });
      }
    }

    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    const data: Prisma.MaintenanceLogUncheckedCreateInput = {
      assetId: asset.id,
      scheduleId: input.scheduleId ?? null,
      completedById: request.auth.userId,
      serviceProviderId: input.serviceProviderId ?? null,
      title: input.title ?? scheduleName ?? "Maintenance completed",
      completedAt,
      metadata: toInputJsonValue(input.metadata)
    };

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    if (input.usageValue !== undefined) {
      data.usageValue = input.usageValue;
    }

    if (input.cost !== undefined) {
      data.cost = input.cost;
    }

    if (input.laborHours !== undefined) {
      data.laborHours = input.laborHours;
    }

    if (input.laborRate !== undefined) {
      data.laborRate = input.laborRate;
    }

    if (input.difficultyRating !== undefined) {
      data.difficultyRating = input.difficultyRating;
    }

    if (input.performedBy !== undefined) {
      data.performedBy = input.performedBy;
    }

    let inventoryWarnings: string[] = [];

    const log = await app.prisma.$transaction(async (tx) => {
      const createdLog = await tx.maintenanceLog.create({ data });

      if (input.parts && input.parts.length > 0) {
        for (const part of input.parts) {
          try {
            const result = await createMaintenanceLogPartWithInventory(tx, {
              householdId: asset.householdId,
              logId: createdLog.id,
              userId: request.auth.userId,
              input: part
            });

            if (result.warning) {
              inventoryWarnings.push(`${part.name}: ${result.warning}`);
            }
          } catch (error) {
            if (error instanceof InventoryError && error.code === "INVENTORY_ITEM_NOT_FOUND") {
              throw new Error(error.message);
            }

            throw error;
          }
        }
      }

      return tx.maintenanceLog.findUniqueOrThrow({
        where: { id: createdLog.id },
        include: { parts: true }
      });
    });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "log.created",
      entityType: "log",
      entityId: log.id,
      metadata: { title: log.title, assetId: asset.id }
    });

    await enqueueNotificationScan({ householdId: asset.householdId });

    void Promise.all([
      syncLogToSearchIndex(app.prisma, log.id),
      ...(log.scheduleId ? [syncScheduleToSearchIndex(app.prisma, log.scheduleId)] : [])
    ]).catch(console.error);

    return reply.code(201).send({
      ...toMaintenanceLogResponse(log, log.parts),
      inventoryWarnings
    });
  });

  app.get("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      },
      include: { parts: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    return toMaintenanceLogResponse(log, log.parts);
  });

  app.patch("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const input = updateMaintenanceLogSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const data: Prisma.MaintenanceLogUncheckedUpdateInput = {};

    if (input.serviceProviderId !== undefined) {
      if (input.serviceProviderId) {
        const provider = await app.prisma.serviceProvider.findFirst({
          where: { id: input.serviceProviderId, householdId: asset.householdId },
          select: { id: true }
        });

        if (!provider) {
          return reply.code(400).send({ message: "Service provider not found or belongs to a different household." });
        }
      }

      data.serviceProviderId = input.serviceProviderId;
    }

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    if (input.completedAt !== undefined) {
      data.completedAt = new Date(input.completedAt);
    }

    if (input.usageValue !== undefined) {
      data.usageValue = input.usageValue;
    }

    if (input.cost !== undefined) {
      data.cost = input.cost;
    }

    if (input.laborHours !== undefined) {
      data.laborHours = input.laborHours;
    }

    if (input.laborRate !== undefined) {
      data.laborRate = input.laborRate;
    }

    if (input.difficultyRating !== undefined) {
      data.difficultyRating = input.difficultyRating;
    }

    if (input.performedBy !== undefined) {
      data.performedBy = input.performedBy;
    }

    if (input.metadata !== undefined) {
      data.metadata = toInputJsonValue(input.metadata);
    }

    const log = await app.prisma.maintenanceLog.update({
      where: { id: existing.id },
      data,
      include: { parts: true }
    });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    void Promise.all([
      syncLogToSearchIndex(app.prisma, log.id),
      ...(log.scheduleId ? [syncScheduleToSearchIndex(app.prisma, log.scheduleId)] : [])
    ]).catch(console.error);

    return toMaintenanceLogResponse(log, log.parts);
  });

  app.delete("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    await app.prisma.maintenanceLog.delete({
      where: { id: existing.id }
    });

    if (existing.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, existing.scheduleId);
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    void Promise.all([
      removeSearchIndexEntry(app.prisma, "log", existing.id),
      ...(existing.scheduleId ? [syncScheduleToSearchIndex(app.prisma, existing.scheduleId)] : [])
    ]).catch(console.error);

    return reply.code(204).send();
  });
};
