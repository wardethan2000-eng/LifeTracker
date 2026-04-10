import type { Prisma, PrismaClient } from "@prisma/client";
import {
  completeMaintenanceScheduleSchema,
  createOffsetPaginationQuerySchema,
  createMaintenanceScheduleSchema,
  maintenanceTriggerSchema,
  updateMaintenanceScheduleSchema
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import {
  createScheduleLinkedLogParts
} from "../../lib/inventory.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";
import {
  recalculateScheduleFields,
  resolveScheduleMetricId,
  toMaintenanceScheduleResponse,
  updateScheduleDueState
} from "../../lib/schedule-state.js";
import { createActivityLogger, logActivity } from "../../lib/activity-log.js";
import { buildOffsetPage } from "../../lib/pagination.js";
import { syncLogToSearchIndex, syncScheduleToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { softDeleteData } from "../../lib/soft-delete.js";
import { assetParamsSchema } from "../../lib/schemas.js";

const scheduleParamsSchema = assetParamsSchema.extend({
  scheduleId: z.string().cuid()
});

const listSchedulesQuerySchema = createOffsetPaginationQuerySchema({
  defaultLimit: 25,
  maxLimit: 100
});

const loadMetric = async (
  prisma: PrismaClient,
  assetId: string,
  metricId: string | null
) => {
  if (!metricId) {
    return null;
  }

  return prisma.usageMetric.findFirst({
    where: {
      id: metricId,
      assetId
    },
    select: {
      id: true,
      currentValue: true
    }
  });
};

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/schedules", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listSchedulesQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const scheduleQuery = {
      where: { assetId: asset.id, deletedAt: null },
      include: {
        metric: {
          select: {
            currentValue: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            displayName: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
    } satisfies Prisma.MaintenanceScheduleFindManyArgs;

    if (query.paginated) {
      const [schedules, total] = await Promise.all([
        app.prisma.maintenanceSchedule.findMany({
          ...scheduleQuery,
          skip: query.offset,
          take: query.limit
        }),
        app.prisma.maintenanceSchedule.count({ where: { assetId: asset.id, deletedAt: null } })
      ]);

      return buildOffsetPage(
        schedules.map(toMaintenanceScheduleResponse),
        total,
        query
      );
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany(scheduleQuery);

    return schedules.map(toMaintenanceScheduleResponse);
  });

  app.post("/v1/assets/:assetId/schedules", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const body = request.body && typeof request.body === "object"
      ? { ...(request.body as Record<string, unknown>), assetId: params.assetId }
      : { assetId: params.assetId };
    const input = createMaintenanceScheduleSchema.parse(body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const metricId = resolveScheduleMetricId(input.triggerConfig, input.metricId);
    const metric = await loadMetric(app.prisma, asset.id, metricId);

    if (metricId && !metric) {
      return badRequest(reply, "Referenced metric does not belong to this asset.");
    }

    const recalculated = recalculateScheduleFields({
      triggerConfig: input.triggerConfig,
      lastCompletedAt: null,
      metric
    });

    const data: Prisma.MaintenanceScheduleUncheckedCreateInput = {
      assetId: asset.id,
      name: input.name,
      triggerType: input.triggerConfig.type,
      triggerConfig: input.triggerConfig,
      notificationConfig: toInputJsonValue(input.notificationConfig),
      metricId,
      isRegulatory: input.isRegulatory ?? false,
      nextDueAt: recalculated.nextDueAt,
      nextDueMetricValue: recalculated.nextDueMetricValue
    };

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.presetKey !== undefined) {
      data.presetKey = input.presetKey;
    }

    if (input.estimatedCost !== undefined) {
      data.estimatedCost = input.estimatedCost;
    }

    if (input.estimatedMinutes !== undefined) {
      data.estimatedMinutes = input.estimatedMinutes;
    }

    if (input.procedureId !== undefined) {
      data.procedureId = input.procedureId;
    }

    if (input.assignedToId !== undefined) {
      const membership = await app.prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: asset.householdId, userId: input.assignedToId } }
      });

      if (!membership) {
        return badRequest(reply, "Assigned user is not a member of this household.");
      }

      data.assignedToId = input.assignedToId;
    }

    const schedule = await app.prisma.maintenanceSchedule.create({
      data,
      include: {
        metric: {
          select: {
            currentValue: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });

    const extraLogActivity = schedule.assignedToId ? logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "schedule.assigned",
      entityType: "schedule",
      entityId: schedule.id,
      metadata: {
        name: schedule.name,
        assetId: asset.id,
        assignedToId: schedule.assignedToId
      }
    }) : Promise.resolve(null);

    await Promise.all([
      logActivity(app.prisma, {
        householdId: asset.householdId,
        userId: request.auth.userId,
        action: "schedule.created",
        entityType: "schedule",
        entityId: schedule.id,
        metadata: { name: schedule.name, assetId: asset.id }
      }),
      extraLogActivity,
      enqueueNotificationScan({ householdId: asset.householdId })
    ]);

    void syncScheduleToSearchIndex(app.prisma, schedule.id).catch(console.error);

    return reply.code(201).send(toMaintenanceScheduleResponse(schedule));
  });

  app.get("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const schedule = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id,
        deletedAt: null
      },
      include: {
        metric: {
          select: {
            currentValue: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });

    if (!schedule) {
      return notFound(reply, "Maintenance schedule");
    }

    return toMaintenanceScheduleResponse(schedule);
  });

  app.post("/v1/assets/:assetId/schedules/:scheduleId/complete", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const input = completeMaintenanceScheduleSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const existing = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id,
        deletedAt: null
      },
      include: {
        metric: {
          select: {
            id: true,
            currentValue: true
          }
        },
        inventoryItems: {
          include: {
            inventoryItem: {
              select: {
                id: true,
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

    if (!existing) {
      return notFound(reply, "Maintenance schedule");
    }

    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    let inventoryWarnings: string[] = [];

    const result = await app.prisma.$transaction(async (tx) => {
      if (existing.metricId && input.usageValue !== undefined) {
        await tx.usageMetric.update({
          where: { id: existing.metricId },
          data: {
            currentValue: input.usageValue,
            lastRecordedAt: completedAt
          }
        });
      }

      const logData: Prisma.MaintenanceLogUncheckedCreateInput = {
        assetId: asset.id,
        scheduleId: existing.id,
        completedById: request.auth.userId,
        title: input.title ?? existing.name,
        completedAt,
        metadata: toInputJsonValue(input.metadata)
      };

      if (input.notes !== undefined) {
        logData.notes = input.notes;
      }

      if (input.usageValue !== undefined) {
        logData.usageValue = input.usageValue;
      }

      if (input.cost !== undefined) {
        logData.cost = input.cost;
      }

      if (input.serviceProviderId !== undefined) {
        logData.serviceProviderId = input.serviceProviderId;
      }

      const log = await tx.maintenanceLog.create({ data: logData });

      if (input.applyLinkedParts && existing.inventoryItems.length > 0) {
        inventoryWarnings.push(...await createScheduleLinkedLogParts(tx, {
          householdId: asset.householdId,
          logId: log.id,
          userId: request.auth.userId,
          scheduleInventoryItems: existing.inventoryItems
        }));
      }

      const logWithParts = await tx.maintenanceLog.findUniqueOrThrow({
        where: { id: log.id },
        include: { parts: true }
      });

      const schedule = await syncScheduleCompletionFromLogs(tx, existing.id);

      return { log: logWithParts, schedule };
    });

    if (!result.schedule) {
      return notFound(reply, "Maintenance schedule");
    }

    await Promise.all([
      logActivity(app.prisma, {
        householdId: asset.householdId,
        userId: request.auth.userId,
        action: "schedule.completed",
        entityType: "schedule",
        entityId: existing.id,
        metadata: { name: existing.name, assetId: asset.id }
      }),
      enqueueNotificationScan({ householdId: asset.householdId })
    ]);

    void Promise.all([
      syncScheduleToSearchIndex(app.prisma, existing.id),
      syncLogToSearchIndex(app.prisma, result.log.id)
    ]).catch(console.error);

    return reply.code(201).send({
      log: toMaintenanceLogResponse(result.log, result.log.parts),
      schedule: toMaintenanceScheduleResponse(result.schedule),
      inventoryWarnings
    });
  });

  app.patch("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const input = updateMaintenanceScheduleSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const existing = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id
      },
      include: {
        metric: {
          select: {
            id: true,
            currentValue: true
          }
        }
      }
    });

    if (!existing) {
      return notFound(reply, "Maintenance schedule");
    }

    const triggerConfig = input.triggerConfig ?? maintenanceTriggerSchema.parse(existing.triggerConfig);
    const explicitMetricId = input.metricId !== undefined
      ? input.metricId
      : input.triggerConfig === undefined
        ? existing.metricId ?? undefined
        : undefined;
    const metricId = resolveScheduleMetricId(triggerConfig, explicitMetricId);
    const metric = await loadMetric(app.prisma, asset.id, metricId);

    if (metricId && !metric) {
      return badRequest(reply, "Referenced metric does not belong to this asset.");
    }

    const lastCompletedAt = input.lastCompletedAt !== undefined
      ? new Date(input.lastCompletedAt)
      : existing.lastCompletedAt;
    const recalculated = recalculateScheduleFields({
      triggerConfig,
      lastCompletedAt,
      metric
    });

    const data: Prisma.MaintenanceScheduleUncheckedUpdateInput = {
      metricId,
      triggerType: triggerConfig.type,
      triggerConfig,
      nextDueAt: recalculated.nextDueAt,
      nextDueMetricValue: recalculated.nextDueMetricValue
    };

    if (input.notificationConfig !== undefined) {
      data.notificationConfig = toInputJsonValue(input.notificationConfig);
    }

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.presetKey !== undefined) {
      data.presetKey = input.presetKey;
    }

    if (input.estimatedCost !== undefined) {
      data.estimatedCost = input.estimatedCost;
    }

    if (input.estimatedMinutes !== undefined) {
      data.estimatedMinutes = input.estimatedMinutes;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (input.isRegulatory !== undefined) {
      data.isRegulatory = input.isRegulatory;
    }

    if (input.procedureId !== undefined) {
      data.procedureId = input.procedureId;
    }

    if (input.lastCompletedAt !== undefined) {
      data.lastCompletedAt = new Date(input.lastCompletedAt);
    }

    if (input.assignedToId !== undefined) {
      if (input.assignedToId !== null) {
        const membership = await app.prisma.householdMember.findUnique({
          where: { householdId_userId: { householdId: asset.householdId, userId: input.assignedToId } }
        });

        if (!membership) {
          return badRequest(reply, "Assigned user is not a member of this household.");
        }
      }

      data.assignedToId = input.assignedToId;
    }

    if (input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId) {
            await createActivityLogger(app.prisma, request.auth.userId).log("schedule", existing.id, "schedule.assigned", asset.householdId, {
          name: existing.name,
          assetId: asset.id,
          previousAssignedToId: existing.assignedToId,
          newAssignedToId: input.assignedToId
        });
    }

    await app.prisma.maintenanceSchedule.update({
      where: { id: existing.id },
      data
    });

    const schedule = await updateScheduleDueState(app.prisma, existing.id);

    if (!schedule) {
      return notFound(reply, "Maintenance schedule");
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    void syncScheduleToSearchIndex(app.prisma, existing.id).catch(console.error);

    return toMaintenanceScheduleResponse(schedule);
  });

  app.delete("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const existing = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id,
        deletedAt: null
      }
    });

    if (!existing) {
      return notFound(reply, "Maintenance schedule");
    }

    await app.prisma.maintenanceSchedule.update({
      where: { id: existing.id },
      data: { ...softDeleteData(), isActive: false }
    });

    await Promise.all([
      enqueueNotificationScan({ householdId: asset.householdId }),
      emitDomainEvent(app.prisma, {
        householdId: asset.householdId,
        eventType: "maintenance_schedule.deleted",
        entityType: "schedule",
        entityId: existing.id,
        payload: {
          assetId: asset.id,
          assetName: asset.name,
          name: existing.name
        }
      })
    ]);

    void removeSearchIndexEntry(app.prisma, "schedule", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};
