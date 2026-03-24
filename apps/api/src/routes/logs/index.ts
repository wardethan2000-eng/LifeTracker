import type { Prisma } from "@prisma/client";
import {
  createMaintenanceLogSchema,
  updateMaintenanceLogSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { buildCursorPage } from "../../lib/pagination.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import {
  createScheduleLinkedLogParts,
  createMaintenanceLogPartWithInventory,
  InventoryError
} from "../../lib/inventory.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
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
  scheduleId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional()
});

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
          assetId: asset.id,
          deletedAt: null
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }
    }

    const logs = await app.prisma.maintenanceLog.findMany({
      where: {
        assetId: asset.id,
        deletedAt: null,
        ...(query.scheduleId ? { scheduleId: query.scheduleId } : {})
      },
      include: { parts: true },
      orderBy: [
        { completedAt: "desc" },
        { createdAt: "desc" }
      ],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
    });

    const { items: page, nextCursor } = buildCursorPage(logs, query.limit);

    return {
      logs: page.map(log => toMaintenanceLogResponse(log, log.parts)),
      nextCursor
    };
  });

  app.post("/v1/assets/:assetId/logs", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createMaintenanceLogSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    let scheduleName: string | undefined;
    let linkedScheduleInventoryItems:
      | Array<{
        inventoryItemId: string;
        quantityPerService: number;
        notes: string | null;
        inventoryItem: {
          name: string;
          partNumber: string | null;
          unitCost: number | null;
          preferredSupplier: string | null;
        };
      }>
      | undefined;

    if (input.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: input.scheduleId,
          assetId: asset.id,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          inventoryItems: {
            include: {
              inventoryItem: {
                select: {
                  name: true,
                  partNumber: true,
                  unitCost: true,
                  preferredSupplier: true
                }
              }
            }
          }
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }

      scheduleName = schedule.name;

      linkedScheduleInventoryItems = schedule.inventoryItems;
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

      if (input.applyLinkedParts && linkedScheduleInventoryItems && linkedScheduleInventoryItems.length > 0) {
        const linkedPartWarnings = await createScheduleLinkedLogParts(tx, {
          householdId: asset.householdId,
          logId: createdLog.id,
          userId: request.auth.userId,
          scheduleInventoryItems: linkedScheduleInventoryItems
        });

        inventoryWarnings.push(...linkedPartWarnings);
      }

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

    await Promise.all([
      log.scheduleId ? syncScheduleCompletionFromLogs(app.prisma, log.scheduleId) : Promise.resolve(),
      logActivity(app.prisma, {
        householdId: asset.householdId,
        userId: request.auth.userId,
        action: "log.created",
        entityType: "log",
        entityId: log.id,
        metadata: { title: log.title, assetId: asset.id }
      }),
      enqueueNotificationScan({ householdId: asset.householdId })
    ]);

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
        assetId: asset.id,
        deletedAt: null
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
        assetId: asset.id,
        deletedAt: null
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

    await Promise.all([
      log.scheduleId ? syncScheduleCompletionFromLogs(app.prisma, log.scheduleId) : Promise.resolve(),
      enqueueNotificationScan({ householdId: asset.householdId })
    ]);

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
        assetId: asset.id,
        deletedAt: null
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    await app.prisma.maintenanceLog.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });

    await Promise.all([
      existing.scheduleId ? syncScheduleCompletionFromLogs(app.prisma, existing.scheduleId) : Promise.resolve(),
      enqueueNotificationScan({ householdId: asset.householdId }),
      emitDomainEvent(app.prisma, {
        householdId: asset.householdId,
        eventType: "maintenance_log.deleted",
        entityType: "log",
        entityId: existing.id,
        payload: {
          assetId: asset.id,
          assetName: asset.name,
          title: existing.title
        }
      })
    ]);

    void Promise.all([
      removeSearchIndexEntry(app.prisma, "log", existing.id),
      ...(existing.scheduleId ? [syncScheduleToSearchIndex(app.prisma, existing.scheduleId)] : [])
    ]).catch(console.error);

    return reply.code(204).send();
  });
};
