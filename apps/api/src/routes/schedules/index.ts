import type { Prisma } from "@prisma/client";
import {
  completeMaintenanceScheduleSchema,
  createMaintenanceScheduleSchema,
  maintenanceTriggerSchema,
  updateMaintenanceScheduleSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
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

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const scheduleParamsSchema = assetParamsSchema.extend({
  scheduleId: z.string().cuid()
});

const loadMetric = async (
  prisma: { usageMetric: { findFirst: Function } },
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

const toInputJsonValue = (value: Record<string, unknown>): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/schedules", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: { assetId: asset.id },
      include: {
        metric: {
          select: {
            currentValue: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

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
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metricId = resolveScheduleMetricId(input.triggerConfig, input.metricId);
    const metric = await loadMetric(app.prisma, asset.id, metricId);

    if (metricId && !metric) {
      return reply.code(400).send({ message: "Referenced metric does not belong to this asset." });
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
      nextDueAt: recalculated.nextDueAt,
      nextDueMetricValue: recalculated.nextDueMetricValue
    };

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.presetKey !== undefined) {
      data.presetKey = input.presetKey;
    }

    const schedule = await app.prisma.maintenanceSchedule.create({
      data,
      include: {
        metric: {
          select: {
            currentValue: true
          }
        }
      }
    });

    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(201).send(toMaintenanceScheduleResponse(schedule));
  });

  app.get("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedule = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id
      },
      include: {
        metric: {
          select: {
            currentValue: true
          }
        }
      }
    });

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    return toMaintenanceScheduleResponse(schedule);
  });

  app.post("/v1/assets/:assetId/schedules/:scheduleId/complete", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const input = completeMaintenanceScheduleSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
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
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();

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

      const log = await tx.maintenanceLog.create({ data: logData });
      const schedule = await syncScheduleCompletionFromLogs(tx, existing.id);

      return { log, schedule };
    });

    if (!result.schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(201).send({
      log: toMaintenanceLogResponse(result.log, []),
      schedule: toMaintenanceScheduleResponse(result.schedule)
    });
  });

  app.patch("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const input = updateMaintenanceScheduleSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
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
      return reply.code(404).send({ message: "Maintenance schedule not found." });
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
      return reply.code(400).send({ message: "Referenced metric does not belong to this asset." });
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

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (input.lastCompletedAt !== undefined) {
      data.lastCompletedAt = new Date(input.lastCompletedAt);
    }

    await app.prisma.maintenanceSchedule.update({
      where: { id: existing.id },
      data
    });

    const schedule = await updateScheduleDueState(app.prisma, existing.id);

    if (!schedule) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    return toMaintenanceScheduleResponse(schedule);
  });

  app.delete("/v1/assets/:assetId/schedules/:scheduleId", async (request, reply) => {
    const params = scheduleParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.maintenanceSchedule.findFirst({
      where: {
        id: params.scheduleId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance schedule not found." });
    }

    await app.prisma.maintenanceSchedule.delete({
      where: { id: existing.id }
    });

    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(204).send();
  });
};
