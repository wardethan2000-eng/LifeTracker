import type { MaintenanceSchedule, Prisma, UsageMetric } from "@prisma/client";
import {
  maintenanceScheduleSchema,
  notificationConfigSchema,
  maintenanceTriggerSchema,
  type MaintenanceTrigger
} from "@aegis/types";
import { calculateNextDue, calculateScheduleStatus } from "@aegis/utils";
import type { PrismaExecutor } from "./prisma-types.js";


const getMetricIdFromTrigger = (trigger: MaintenanceTrigger): string | undefined => {
  if (trigger.type === "usage" || trigger.type === "compound") {
    return trigger.metricId;
  }

  return undefined;
};

export const resolveScheduleMetricId = (
  trigger: MaintenanceTrigger,
  explicitMetricId?: string
): string | null => {
  const triggerMetricId = getMetricIdFromTrigger(trigger);

  if (triggerMetricId && explicitMetricId && triggerMetricId !== explicitMetricId) {
    throw new Error("Trigger config metricId must match the schedule metricId.");
  }

  if (!triggerMetricId && explicitMetricId) {
    throw new Error("Only usage and compound triggers can reference a metric.");
  }

  return triggerMetricId ?? explicitMetricId ?? null;
};

export interface RecalculatedScheduleFields {
  nextDueAt: Date | null;
  nextDueMetricValue: number | null;
  status: "upcoming" | "due" | "overdue";
}

export const recalculateScheduleFields = (options: {
  triggerConfig: Prisma.JsonValue;
  lastCompletedAt: Date | null;
  metric: Pick<UsageMetric, "id" | "currentValue"> | null;
  /** IANA timezone for seasonal due date calculations */
  timezone?: string;
}): RecalculatedScheduleFields => {
  const trigger = maintenanceTriggerSchema.parse(options.triggerConfig);
  const dueOptions: {
    lastCompletedAt?: Date;
    usageReading?: {
      metricId: string;
      currentValue: number;
    };
    timezone?: string;
  } = {};

  if (options.lastCompletedAt) {
    dueOptions.lastCompletedAt = options.lastCompletedAt;
  }

  if (options.metric) {
    dueOptions.usageReading = {
      metricId: options.metric.id,
      currentValue: options.metric.currentValue
    };
  }

  if (options.timezone) {
    dueOptions.timezone = options.timezone;
  }

  const due = calculateNextDue(trigger, dueOptions);
  const statusOptions: {
    currentUsageValue?: number;
  } = {};

  if (options.metric) {
    statusOptions.currentUsageValue = options.metric.currentValue;
  }

  return {
    nextDueAt: due.nextDueAt ?? null,
    nextDueMetricValue: due.dueMetricValue ?? null,
    status: calculateScheduleStatus(trigger, due, statusOptions)
  };
};

export const updateScheduleDueState = async (
  prisma: PrismaExecutor,
  scheduleId: string
) => {
  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      metric: {
        select: {
          id: true,
          currentValue: true
        }
      },
      asset: {
        select: {
          household: {
            select: { timezone: true }
          }
        }
      }
    }
  });

  if (!schedule) {
    return null;
  }

  const recalculated = recalculateScheduleFields({
    triggerConfig: schedule.triggerConfig,
    lastCompletedAt: schedule.lastCompletedAt,
    metric: schedule.metric,
    timezone: schedule.asset.household.timezone
  });

  return prisma.maintenanceSchedule.update({
    where: { id: schedule.id },
    data: {
      nextDueAt: recalculated.nextDueAt,
      nextDueMetricValue: recalculated.nextDueMetricValue
    },
    include: {
      metric: {
        select: {
          id: true,
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
};

export const recalculateAssetSchedules = async (
  prisma: PrismaExecutor,
  assetId: string
): Promise<void> => {
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { assetId },
    select: { id: true }
  });

  await Promise.all(schedules.map(async (schedule) => {
    await updateScheduleDueState(prisma, schedule.id);
  }));
};

export const toMaintenanceScheduleResponse = (schedule: Pick<MaintenanceSchedule, "id" | "assetId" | "metricId" | "name" | "description" | "triggerType" | "triggerConfig" | "notificationConfig" | "presetKey" | "estimatedCost" | "estimatedMinutes" | "isActive" | "isRegulatory" | "lastCompletedAt" | "nextDueAt" | "nextDueMetricValue" | "assignedToId" | "createdAt" | "updatedAt"> & { metric?: Pick<UsageMetric, "currentValue"> | null; assignedTo?: { id: string; displayName: string | null } | null }) => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
  const notificationConfig = notificationConfigSchema.parse(schedule.notificationConfig);
  const statusOptions: {
    currentUsageValue?: number;
  } = {};

  if (schedule.metric) {
    statusOptions.currentUsageValue = schedule.metric.currentValue;
  }

  const status = calculateScheduleStatus(trigger, {
    nextDueAt: schedule.nextDueAt ?? undefined,
    dueMetricValue: schedule.nextDueMetricValue ?? undefined
  }, statusOptions);

  return maintenanceScheduleSchema.parse({
    id: schedule.id,
    assetId: schedule.assetId,
    metricId: schedule.metricId,
    name: schedule.name,
    description: schedule.description,
    triggerType: schedule.triggerType,
    triggerConfig: trigger,
    notificationConfig,
    presetKey: schedule.presetKey,
    estimatedCost: schedule.estimatedCost,
    estimatedMinutes: schedule.estimatedMinutes,
    isActive: schedule.isActive,
    isRegulatory: schedule.isRegulatory,
    lastCompletedAt: schedule.lastCompletedAt?.toISOString() ?? null,
    nextDueAt: schedule.nextDueAt?.toISOString() ?? null,
    nextDueMetricValue: schedule.nextDueMetricValue,
    assignedToId: schedule.assignedToId ?? null,
    assignee: schedule.assignedTo ? { id: schedule.assignedTo.id, displayName: schedule.assignedTo.displayName } : null,
    status,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString()
  });
};
