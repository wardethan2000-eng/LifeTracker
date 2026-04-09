import type { Prisma, TriggerType } from "@prisma/client";
import {
  completionCycleRecordSchema,
  maintenanceTriggerSchema,
  type CompletionCycleRecord,
  type MaintenanceTrigger
} from "@aegis/types";
import { MS_PER_DAY, addDays, calculateNextDue, calculateUsageRate } from "@aegis/utils";
import type { PrismaExecutor } from "../lib/prisma-types.js";


type ScheduleWithContext = {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  triggerConfig: Prisma.JsonValue;
  isActive: boolean;
  isRegulatory: boolean;
  createdAt: Date;
  asset: {
    id: string;
    name: string;
    category: string;
  };
};

type LogWithContext = {
  id: string;
  scheduleId: string;
  assetId: string;
  completedAt: Date;
  completedById: string;
  usageValue: number | null;
  completedBy: {
    id: string;
    displayName: string | null;
  };
};

type UsageLogSample = {
  completedAt: Date;
  usageValue: number;
};

export interface BuildCompletionLedgerOptions {
  scheduleIds: string | string[];
  includeOpenCycles?: boolean;
}

const toUtcDayMs = (date: Date): number => Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
);

const toCalendarDayDelta = (completedAt: Date, dueDate: Date): number => (
  Math.round((toUtcDayMs(completedAt) - toUtcDayMs(dueDate)) / MS_PER_DAY)
);

const toCycleRecord = (input: {
  schedule: ScheduleWithContext;
  dueDate: Date | null;
  completedAt: Date | null;
  completedById: string | null;
  completedByName: string | null;
}): CompletionCycleRecord => completionCycleRecordSchema.parse({
  scheduleId: input.schedule.id,
  scheduleName: input.schedule.name,
  assetId: input.schedule.asset.id,
  assetName: input.schedule.asset.name,
  assetCategory: input.schedule.asset.category,
  dueDate: input.dueDate?.toISOString() ?? null,
  completedAt: input.completedAt?.toISOString() ?? null,
  deltaInDays: input.dueDate && input.completedAt
    ? toCalendarDayDelta(input.completedAt, input.dueDate)
    : null,
  completedById: input.completedById,
  completedByName: input.completedByName
});

const getInitialIntervalDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "interval" }>,
  createdAt: Date
): Date | null => calculateNextDue({
  ...trigger,
  anchorDate: trigger.anchorDate ?? createdAt.toISOString()
}).nextDueAt ?? null;

const getIntervalDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "interval" }>,
  createdAt: Date,
  previousCompletion?: Date
): Date | null => previousCompletion
  ? calculateNextDue(trigger, { lastCompletedAt: previousCompletion }).nextDueAt ?? null
  : getInitialIntervalDueDate(trigger, createdAt);

const getSeasonalDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "seasonal" }>,
  referenceDate: Date
): Date | null => calculateNextDue(trigger, { referenceDate }).nextDueAt ?? null;

const getOneTimeDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "one_time" }>
): Date | null => calculateNextDue(trigger).nextDueAt ?? null;

const toUsageSample = (log: LogWithContext | undefined): UsageLogSample | null => {
  if (!log || typeof log.usageValue !== "number") {
    return null;
  }

  return {
    completedAt: log.completedAt,
    usageValue: log.usageValue
  };
};

const projectUsageThresholdDate = (
  anchor: UsageLogSample | null,
  comparison: UsageLogSample | null,
  intervalValue: number
): Date | null => {
  if (!anchor || !comparison || comparison.completedAt >= anchor.completedAt) {
    return null;
  }

  const ratePerDay = calculateUsageRate([
    { value: comparison.usageValue, date: comparison.completedAt },
    { value: anchor.usageValue, date: anchor.completedAt }
  ]);

  if (!Number.isFinite(ratePerDay) || ratePerDay <= 0) {
    return null;
  }

  const daysUntilDue = intervalValue / ratePerDay;

  if (!Number.isFinite(daysUntilDue) || daysUntilDue < 0) {
    return null;
  }

  return new Date(anchor.completedAt.getTime() + (daysUntilDue * MS_PER_DAY));
};

const getUsageClosedCycleDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "usage" }>,
  previousLog?: LogWithContext,
  currentLog?: LogWithContext
): Date | null => projectUsageThresholdDate(
  toUsageSample(previousLog),
  toUsageSample(currentLog),
  trigger.intervalValue
);

const getUsageOpenCycleDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "usage" }>,
  previousLog?: LogWithContext,
  lastLog?: LogWithContext
): Date | null => projectUsageThresholdDate(
  toUsageSample(lastLog),
  toUsageSample(previousLog),
  trigger.intervalValue
);

const getCompoundTimeDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "compound" }>,
  createdAt: Date,
  previousCompletion?: Date
): Date | null => getIntervalDueDate({
  type: "interval",
  intervalDays: trigger.intervalDays,
  anchorDate: createdAt.toISOString(),
  leadTimeDays: trigger.leadTimeDays
}, createdAt, previousCompletion);

const pickCompoundDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "compound" }>,
  timeDueDate: Date | null,
  usageDueDate: Date | null
): Date | null => {
  if (!timeDueDate) {
    return usageDueDate;
  }

  if (!usageDueDate) {
    return timeDueDate;
  }

  return trigger.logic === "whichever_last"
    ? (timeDueDate >= usageDueDate ? timeDueDate : usageDueDate)
    : (timeDueDate <= usageDueDate ? timeDueDate : usageDueDate);
};

const getCompoundClosedCycleDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "compound" }>,
  createdAt: Date,
  previousLog: LogWithContext | undefined,
  currentLog: LogWithContext
): Date | null => {
  const timeDueDate = getCompoundTimeDueDate(trigger, createdAt, previousLog?.completedAt);

  if (!previousLog) {
    return timeDueDate;
  }

  const usageDueDate = projectUsageThresholdDate(
    toUsageSample(previousLog),
    toUsageSample(currentLog),
    trigger.intervalValue
  );

  return pickCompoundDueDate(trigger, timeDueDate, usageDueDate);
};

const getCompoundOpenCycleDueDate = (
  trigger: Extract<MaintenanceTrigger, { type: "compound" }>,
  createdAt: Date,
  previousLog: LogWithContext | undefined,
  lastLog: LogWithContext | undefined
): Date | null => {
  const timeDueDate = getCompoundTimeDueDate(trigger, createdAt, lastLog?.completedAt);

  if (!previousLog || !lastLog) {
    return timeDueDate;
  }

  const usageDueDate = projectUsageThresholdDate(
    toUsageSample(lastLog),
    toUsageSample(previousLog),
    trigger.intervalValue
  );

  return pickCompoundDueDate(trigger, timeDueDate, usageDueDate);
};

const getClosedCycleDueDate = (
  schedule: ScheduleWithContext,
  trigger: MaintenanceTrigger,
  logs: LogWithContext[],
  index: number
): Date | null => {
  const previousLog = index > 0 ? logs[index - 1] : undefined;
  const currentLog = logs[index]!;

  switch (trigger.type) {
    case "interval":
      return getIntervalDueDate(trigger, schedule.createdAt, previousLog?.completedAt);
    case "seasonal":
      return getSeasonalDueDate(trigger, previousLog?.completedAt ?? schedule.createdAt);
    case "one_time":
      return index === 0 ? getOneTimeDueDate(trigger) : null;
    case "usage":
      return getUsageClosedCycleDueDate(trigger, previousLog, currentLog);
    case "compound":
      return getCompoundClosedCycleDueDate(trigger, schedule.createdAt, previousLog, currentLog);
    default:
      return null;
  }
};

const getOpenCycleDueDate = (
  schedule: ScheduleWithContext,
  trigger: MaintenanceTrigger,
  logs: LogWithContext[]
): Date | null => {
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : undefined;
  const previousLog = logs.length > 1 ? logs[logs.length - 2] : undefined;

  switch (trigger.type) {
    case "interval":
      return getIntervalDueDate(trigger, schedule.createdAt, lastLog?.completedAt);
    case "seasonal":
      return getSeasonalDueDate(trigger, lastLog?.completedAt ?? schedule.createdAt);
    case "one_time":
      return logs.length === 0 ? getOneTimeDueDate(trigger) : null;
    case "usage":
      return getUsageOpenCycleDueDate(trigger, previousLog, lastLog);
    case "compound":
      return getCompoundOpenCycleDueDate(trigger, schedule.createdAt, previousLog, lastLog);
    default:
      return null;
  }
};

const buildScheduleCycles = (schedule: ScheduleWithContext, logs: LogWithContext[], includeOpenCycles: boolean): CompletionCycleRecord[] => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
  const cycles: CompletionCycleRecord[] = [];

  for (let index = 0; index < logs.length; index += 1) {
    const log = logs[index]!;
    const dueDate = getClosedCycleDueDate(schedule, trigger, logs, index);

    if (trigger.type === "one_time" && index > 0) {
      continue;
    }

    cycles.push(toCycleRecord({
      schedule,
      dueDate,
      completedAt: log.completedAt,
      completedById: log.completedById,
      completedByName: log.completedBy.displayName
    }));
  }

  if (includeOpenCycles && schedule.isActive) {
    const dueDate = getOpenCycleDueDate(schedule, trigger, logs);

    if (dueDate) {
      cycles.push(toCycleRecord({
        schedule,
        dueDate,
        completedAt: null,
        completedById: null,
        completedByName: null
      }));
    }
  }

  return cycles;
};

export const buildCompletionCycleLedger = async (
  prisma: PrismaExecutor,
  options: BuildCompletionLedgerOptions
): Promise<CompletionCycleRecord[]> => {
  const scheduleIds = Array.from(new Set(Array.isArray(options.scheduleIds) ? options.scheduleIds : [options.scheduleIds]));

  if (scheduleIds.length === 0) {
    return [];
  }

  const [schedules, logs] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: {
        deletedAt: null,
        id: {
          in: scheduleIds
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        triggerConfig: true,
        isActive: true,
        isRegulatory: true,
        createdAt: true,
        asset: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    }),
    prisma.maintenanceLog.findMany({
      where: {
        deletedAt: null,
        scheduleId: {
          in: scheduleIds
        }
      },
      select: {
        id: true,
        scheduleId: true,
        assetId: true,
        completedAt: true,
        completedById: true,
        usageValue: true,
        completedBy: {
          select: {
            id: true,
            displayName: true
          }
        }
      },
      orderBy: [
        { scheduleId: "asc" },
        { completedAt: "asc" },
        { createdAt: "asc" }
      ]
    })
  ]);

  const logsByScheduleId = logs.reduce<Map<string, LogWithContext[]>>((map, log) => {
    const bucket = map.get(log.scheduleId ?? "");

    if (bucket) {
      bucket.push(log as LogWithContext);
    } else if (log.scheduleId) {
      map.set(log.scheduleId, [log as LogWithContext]);
    }

    return map;
  }, new Map());

  return schedules.flatMap((schedule) => buildScheduleCycles(
    schedule as ScheduleWithContext,
    logsByScheduleId.get(schedule.id) ?? [],
    options.includeOpenCycles ?? true
  ));
};