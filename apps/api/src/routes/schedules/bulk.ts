import {
  bulkCompleteSchedulesSchema,
  bulkPauseSchedulesSchema,
  bulkSnoozeSchedulesSchema,
  maintenanceTriggerSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import { syncScheduleCompletionFromLogs } from "../../lib/maintenance-logs.js";
import { recalculateScheduleFields } from "../../lib/schedule-state.js";
import { syncScheduleToSearchIndex } from "../../lib/search-index.js";
import { forbidden } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

type FailedItem = {
  scheduleId: string;
  name: string | null;
  message: string;
};

export const scheduleBulkRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/schedules/bulk/complete", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkCompleteSchedulesSchema.parse({ ...body, householdId: params.householdId });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        id: { in: input.scheduleIds },
        deletedAt: null,
        asset: { householdId: params.householdId }
      },
      select: {
        id: true,
        name: true,
        assetId: true
      }
    });

    const found = new Set(schedules.map((s) => s.id));

    const failed: FailedItem[] = input.scheduleIds
      .filter((id) => !found.has(id))
      .map((id) => ({ scheduleId: id, name: null, message: "Schedule not found." }));

    const completedAt = new Date();
    let succeeded = 0;

    for (const schedule of schedules) {
      try {
        await app.prisma.$transaction(async (tx) => {
          const log = await tx.maintenanceLog.create({
            data: {
              assetId: schedule.assetId,
              scheduleId: schedule.id,
              completedById: request.auth.userId,
              title: schedule.name,
              completedAt,
              metadata: toInputJsonValue({}),
              ...(input.notes !== undefined ? { notes: input.notes } : {})
            }
          });

          await syncScheduleCompletionFromLogs(tx, schedule.id);

          return log;
        });

        succeeded++;

        void syncScheduleToSearchIndex(app.prisma, schedule.id).catch(console.error);
      } catch (err) {
        failed.push({
          scheduleId: schedule.id,
          name: schedule.name,
          message: err instanceof Error ? err.message : "Failed to complete schedule."
        });
      }
    }

    if (succeeded > 0) {
      await Promise.all([
        logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "schedule.bulk_completed",
          entityType: "schedule",
          entityId: params.householdId,
          metadata: { count: succeeded }
        }),
        enqueueNotificationScan({ householdId: params.householdId })
      ]);
    }

    return { succeeded, failed };
  });

  app.post("/v1/households/:householdId/schedules/bulk/snooze", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkSnoozeSchedulesSchema.parse({ ...body, householdId: params.householdId });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        id: { in: input.scheduleIds },
        deletedAt: null,
        asset: { householdId: params.householdId }
      },
      select: {
        id: true,
        name: true,
        triggerConfig: true,
        metric: {
          select: { id: true, currentValue: true }
        }
      }
    });

    const found = new Set(schedules.map((s) => s.id));

    const failed: FailedItem[] = input.scheduleIds
      .filter((id) => !found.has(id))
      .map((id) => ({ scheduleId: id, name: null, message: "Schedule not found." }));

    let succeeded = 0;

    for (const schedule of schedules) {
      try {
        const triggerConfig = maintenanceTriggerSchema.parse(schedule.triggerConfig);

        if (triggerConfig.type !== "interval" && triggerConfig.type !== "compound") {
          failed.push({
            scheduleId: schedule.id,
            name: schedule.name,
            message: "Only interval-based schedules can be snoozed."
          });
          continue;
        }

        const nowMs = Date.now();
        const snoozeDayMs = input.snoozeDays * 86_400_000;
        const intervalDayMs = triggerConfig.intervalDays * 86_400_000;
        const newLastCompletedAt = new Date(nowMs + snoozeDayMs - intervalDayMs);

        const recalculated = recalculateScheduleFields({
          triggerConfig,
          lastCompletedAt: newLastCompletedAt,
          metric: schedule.metric
        });

        await app.prisma.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: {
            lastCompletedAt: newLastCompletedAt,
            nextDueAt: recalculated.nextDueAt,
            nextDueMetricValue: recalculated.nextDueMetricValue
          }
        });

        succeeded++;

        void syncScheduleToSearchIndex(app.prisma, schedule.id).catch(console.error);
      } catch (err) {
        failed.push({
          scheduleId: schedule.id,
          name: schedule.name,
          message: err instanceof Error ? err.message : "Failed to snooze schedule."
        });
      }
    }

    if (succeeded > 0) {
      await Promise.all([
        logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "schedule.bulk_snoozed",
          entityType: "schedule",
          entityId: params.householdId,
          metadata: { count: succeeded, snoozeDays: input.snoozeDays }
        }),
        enqueueNotificationScan({ householdId: params.householdId })
      ]);
    }

    return { succeeded, failed };
  });

  app.post("/v1/households/:householdId/schedules/bulk/pause", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkPauseSchedulesSchema.parse({ ...body, householdId: params.householdId });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        id: { in: input.scheduleIds },
        deletedAt: null,
        asset: { householdId: params.householdId }
      },
      select: {
        id: true,
        name: true
      }
    });

    const found = new Set(schedules.map((s) => s.id));

    const failed: FailedItem[] = input.scheduleIds
      .filter((id) => !found.has(id))
      .map((id) => ({ scheduleId: id, name: null, message: "Schedule not found." }));

    let succeeded = 0;

    for (const schedule of schedules) {
      try {
        await app.prisma.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false }
        });

        succeeded++;
      } catch (err) {
        failed.push({
          scheduleId: schedule.id,
          name: schedule.name,
          message: err instanceof Error ? err.message : "Failed to pause schedule."
        });
      }
    }

    if (succeeded > 0) {
      await Promise.all([
        logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "schedule.bulk_paused",
          entityType: "schedule",
          entityId: params.householdId,
          metadata: { count: succeeded }
        }),
        enqueueNotificationScan({ householdId: params.householdId })
      ]);
    }

    return { succeeded, failed };
  });
};
