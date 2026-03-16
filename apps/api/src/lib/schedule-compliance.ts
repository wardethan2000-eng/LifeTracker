import type { Prisma } from "@prisma/client";
import { maintenanceTriggerSchema, type ScheduleComplianceDashboard } from "@lifekeeper/types";
import { calculateNextDue } from "@lifekeeper/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const categoryLabels: Record<string, string> = {
  vehicle: "Vehicle",
  home: "Home",
  marine: "Marine",
  aircraft: "Aircraft",
  yard: "Yard",
  workshop: "Workshop",
  appliance: "Appliance",
  hvac: "HVAC",
  technology: "Technology",
  other: "Other"
};

const getCategoryLabel = (category: string): string => categoryLabels[category] ?? category;

const monthKeyFor = (date: Date): string => `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  1,
  date.getUTCHours(),
  date.getUTCMinutes(),
  date.getUTCSeconds(),
  date.getUTCMilliseconds()
));

const endOfUtcMonth = (date: Date): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + 1,
  0,
  23,
  59,
  59,
  999
));

const toUtcDayStart = (date: Date): number => Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
);

const toCalendarDayDelta = (completedAt: Date, dueDate: Date): number => Math.max(
  0,
  Math.round((toUtcDayStart(completedAt) - toUtcDayStart(dueDate)) / MS_PER_DAY)
);

type ComplianceLogInput = {
  id: string;
  completedAt: Date;
  scheduleId: string | null;
  assetId: string;
  completedById: string | null;
  usageValue?: number | null;
};

type ComplianceScheduleInput = {
  id: string;
  assetId: string;
  name: string;
  triggerType: string;
  triggerConfig: Prisma.JsonValue;
  isActive: boolean;
  nextDueAt: Date | null;
  nextDueMetricValue: number | null;
  lastCompletedAt: Date | null;
  createdAt?: Date;
  asset: {
    name: string;
    category: string;
  };
  metric?: {
    currentValue: number;
  } | null;
};

type ComplianceUserInput = {
  id: string;
  displayName: string | null;
};

type CompletionAssessment = {
  logId: string;
  scheduleId: string;
  assetId: string;
  assetName: string;
  category: string;
  completedAt: Date;
  completedById: string | null;
  onTime: boolean;
  daysOverdue: number | null;
};

const average = (values: number[]): number | null => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

const getFirstTimeBasedDueDate = (schedule: ComplianceScheduleInput, fallbackDate: Date): Date | null => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
  const referenceDate = schedule.createdAt && schedule.createdAt <= fallbackDate ? schedule.createdAt : fallbackDate;

  switch (trigger.type) {
    case "interval":
      return calculateNextDue({
        ...trigger,
        anchorDate: trigger.anchorDate ?? referenceDate.toISOString()
      }).nextDueAt ?? null;
    case "seasonal":
      return calculateNextDue(trigger, { referenceDate }).nextDueAt ?? null;
    case "one_time":
      return calculateNextDue(trigger).nextDueAt ?? null;
    case "compound":
      return calculateNextDue({
        type: "interval",
        intervalDays: trigger.intervalDays,
        anchorDate: referenceDate.toISOString(),
        leadTimeDays: trigger.leadTimeDays
      }).nextDueAt ?? null;
    case "usage":
      return null;
    default:
      return null;
  }
};

const getHistoricalDueDate = (
  schedule: ComplianceScheduleInput,
  logs: ComplianceLogInput[],
  index: number
): Date | null => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
  const previousLog = index > 0 ? logs[index - 1] : undefined;
  const currentLog = logs[index];

  if (!currentLog) {
    return null;
  }

  switch (trigger.type) {
    case "interval":
      return previousLog
        ? calculateNextDue(trigger, { lastCompletedAt: previousLog.completedAt }).nextDueAt ?? null
        : getFirstTimeBasedDueDate(schedule, currentLog.completedAt);
    case "seasonal":
      return calculateNextDue(
        trigger,
        {
          referenceDate: previousLog?.completedAt ?? getFirstTimeBasedDueDate(schedule, currentLog.completedAt) ?? currentLog.completedAt
        }
      ).nextDueAt ?? null;
    case "one_time":
      return index === 0 ? calculateNextDue(trigger).nextDueAt ?? null : null;
    case "compound":
      return previousLog
        ? calculateNextDue(trigger, { lastCompletedAt: previousLog.completedAt }).nextDueAt ?? null
        : getFirstTimeBasedDueDate(schedule, currentLog.completedAt);
    case "usage":
      return null;
    default:
      return null;
  }
};

const getCurrentScheduleState = (schedule: ComplianceScheduleInput, now: Date): "upcoming" | "due" | "overdue" => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);

  const evaluateDateState = (dueAt: Date | null, leadTimeDays: number): "upcoming" | "due" | "overdue" => {
    if (!dueAt) {
      return "upcoming";
    }

    if (now > dueAt) {
      return "overdue";
    }

    if (now.getTime() === dueAt.getTime()) {
      return "due";
    }

    const leadAt = new Date(dueAt.getTime() - (leadTimeDays * MS_PER_DAY));
    return now >= leadAt ? "due" : "upcoming";
  };

  const evaluateUsageState = (dueMetricValue: number | null, currentValue: number | null, leadTimeValue: number): "upcoming" | "due" | "overdue" => {
    if (typeof dueMetricValue !== "number" || typeof currentValue !== "number") {
      return "upcoming";
    }

    if (currentValue > dueMetricValue) {
      return "overdue";
    }

    if (currentValue === dueMetricValue || currentValue >= dueMetricValue - leadTimeValue) {
      return "due";
    }

    return "upcoming";
  };

  switch (trigger.type) {
    case "interval":
      return evaluateDateState(schedule.nextDueAt, trigger.leadTimeDays);
    case "seasonal":
      return evaluateDateState(schedule.nextDueAt, trigger.leadTimeDays);
    case "one_time":
      return evaluateDateState(schedule.nextDueAt, trigger.leadTimeDays);
    case "usage":
      return evaluateUsageState(schedule.nextDueMetricValue, schedule.metric?.currentValue ?? null, trigger.leadTimeValue);
    case "compound": {
      const dateState = evaluateDateState(schedule.nextDueAt, trigger.leadTimeDays);
      const usageState = evaluateUsageState(schedule.nextDueMetricValue, schedule.metric?.currentValue ?? null, trigger.leadTimeValue);

      if (dateState === "overdue" || usageState === "overdue") {
        return "overdue";
      }

      if (dateState === "due" || usageState === "due") {
        return "due";
      }

      return "upcoming";
    }
    default:
      return "upcoming";
  }
};

const buildMonthRange = (periodStart: Date, periodEnd: Date): string[] => {
  const months: string[] = [];
  let cursor = startOfUtcMonth(periodStart);
  const lastMonth = startOfUtcMonth(periodEnd);

  while (cursor <= lastMonth) {
    months.push(monthKeyFor(cursor));
    cursor = addUtcMonths(cursor, 1);
  }

  return months;
};

export const computeScheduleCompliance = (
  maintenanceLogs: ComplianceLogInput[],
  maintenanceSchedules: ComplianceScheduleInput[],
  users: ComplianceUserInput[],
  period: { periodStart: Date; periodEnd: Date }
): ScheduleComplianceDashboard => {
  const scheduleById = new Map(maintenanceSchedules.map((schedule) => [schedule.id, schedule]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const logsByScheduleId = maintenanceLogs.reduce<Map<string, ComplianceLogInput[]>>((map, log) => {
    if (!log.scheduleId) {
      return map;
    }

    const bucket = map.get(log.scheduleId) ?? [];
    bucket.push(log);
    map.set(log.scheduleId, bucket);
    return map;
  }, new Map());

  for (const logs of logsByScheduleId.values()) {
    logs.sort((left, right) => left.completedAt.getTime() - right.completedAt.getTime());
  }

  const completions: CompletionAssessment[] = [];

  for (const [scheduleId, logs] of logsByScheduleId.entries()) {
    const schedule = scheduleById.get(scheduleId);

    if (!schedule) {
      continue;
    }

    for (let index = 0; index < logs.length; index += 1) {
      const log = logs[index]!;

      if (log.completedAt < period.periodStart || log.completedAt > period.periodEnd) {
        continue;
      }

      const dueDate = getHistoricalDueDate(schedule, logs, index);
      const daysOverdue = dueDate ? toCalendarDayDelta(log.completedAt, dueDate) : null;
      const onTime = dueDate ? daysOverdue === 0 : true;

      completions.push({
        logId: log.id,
        scheduleId,
        assetId: schedule.assetId,
        assetName: schedule.asset.name,
        category: schedule.asset.category,
        completedAt: log.completedAt,
        completedById: log.completedById,
        onTime,
        daysOverdue: dueDate ? daysOverdue : null
      });
    }
  }

  const now = period.periodEnd;
  const activeSchedules = maintenanceSchedules.filter((schedule) => schedule.isActive);
  const currentScheduleStates = activeSchedules.map((schedule) => ({
    schedule,
    state: getCurrentScheduleState(schedule, now)
  }));

  const totalCompletions = completions.length;
  const onTimeCompletions = completions.filter((completion) => completion.onTime).length;
  const lateCompletions = totalCompletions - onTimeCompletions;
  const averageDaysOverdue = average(completions.flatMap((completion) => (
    completion.daysOverdue && completion.daysOverdue > 0 ? [completion.daysOverdue] : []
  )));
  const currentOverdueCount = currentScheduleStates.filter((entry) => entry.state === "overdue").length;
  const currentDueCount = currentScheduleStates.filter((entry) => entry.state === "due").length;

  const monthRange = buildMonthRange(period.periodStart, period.periodEnd);
  const currentMonthKey = monthKeyFor(now);
  const completionsByMonth = completions.reduce<Map<string, CompletionAssessment[]>>((map, completion) => {
    const month = monthKeyFor(completion.completedAt);
    const bucket = map.get(month) ?? [];
    bucket.push(completion);
    map.set(month, bucket);
    return map;
  }, new Map());

  const trend = monthRange.map((month) => {
    const bucket = completionsByMonth.get(month) ?? [];
    const bucketOnTime = bucket.filter((completion) => completion.onTime).length;
    const bucketLate = bucket.length - bucketOnTime;

    return {
      month,
      totalCompletions: bucket.length,
      onTimeCompletions: bucketOnTime,
      lateCompletions: bucketLate,
      onTimeRate: bucket.length > 0 ? bucketOnTime / bucket.length : 0,
      // Historical month-end overdue counts would require reconstructing prior schedule state snapshots.
      overdueAtEndOfMonth: month === currentMonthKey ? currentOverdueCount : 0
    };
  });

  const byCategory = Array.from(completions.reduce<Map<string, CompletionAssessment[]>>((map, completion) => {
    const bucket = map.get(completion.category) ?? [];
    bucket.push(completion);
    map.set(completion.category, bucket);
    return map;
  }, new Map()).entries()).map(([category, bucket]) => {
    const lateDays = bucket.flatMap((completion) => (
      completion.daysOverdue && completion.daysOverdue > 0 ? [completion.daysOverdue] : []
    ));

    return {
      category,
      categoryLabel: getCategoryLabel(category),
      totalCompletions: bucket.length,
      onTimeCompletions: bucket.filter((completion) => completion.onTime).length,
      onTimeRate: bucket.length > 0 ? bucket.filter((completion) => completion.onTime).length / bucket.length : 0,
      averageDaysOverdue: average(lateDays),
      activeScheduleCount: activeSchedules.filter((schedule) => schedule.asset.category === category).length,
      currentOverdueCount: currentScheduleStates.filter((entry) => entry.state === "overdue" && entry.schedule.asset.category === category).length
    };
  }).sort((left, right) => left.onTimeRate - right.onTimeRate || right.totalCompletions - left.totalCompletions);

  const byAsset = Array.from(completions.reduce<Map<string, CompletionAssessment[]>>((map, completion) => {
    const bucket = map.get(completion.assetId) ?? [];
    bucket.push(completion);
    map.set(completion.assetId, bucket);
    return map;
  }, new Map()).entries()).map(([assetId, bucket]) => {
    const first = bucket[0]!;
    const lateDays = bucket.flatMap((completion) => (
      completion.daysOverdue && completion.daysOverdue > 0 ? [completion.daysOverdue] : []
    ));
    const onTimeCount = bucket.filter((completion) => completion.onTime).length;

    return {
      assetId,
      assetName: first.assetName,
      category: first.category,
      totalCompletions: bucket.length,
      onTimeCompletions: onTimeCount,
      onTimeRate: bucket.length > 0 ? onTimeCount / bucket.length : 0,
      averageDaysOverdue: average(lateDays),
      currentOverdueCount: currentScheduleStates.filter((entry) => entry.state === "overdue" && entry.schedule.assetId === assetId).length
    };
  }).sort((left, right) => left.onTimeRate - right.onTimeRate || right.currentOverdueCount - left.currentOverdueCount || right.totalCompletions - left.totalCompletions);

  const byMember = Array.from(completions.reduce<Map<string, CompletionAssessment[]>>((map, completion) => {
    if (!completion.completedById) {
      return map;
    }

    const bucket = map.get(completion.completedById) ?? [];
    bucket.push(completion);
    map.set(completion.completedById, bucket);
    return map;
  }, new Map()).entries()).map(([userId, bucket]) => {
    const onTimeCount = bucket.filter((completion) => completion.onTime).length;

    return {
      userId,
      displayName: usersById.get(userId)?.displayName ?? null,
      totalCompletions: bucket.length,
      onTimeCompletions: onTimeCount,
      onTimeRate: bucket.length > 0 ? onTimeCount / bucket.length : 0
    };
  }).sort((left, right) => right.totalCompletions - left.totalCompletions || right.onTimeRate - left.onTimeRate);

  return {
    overview: {
      totalCompletions,
      onTimeCompletions,
      lateCompletions,
      onTimeRate: totalCompletions > 0 ? onTimeCompletions / totalCompletions : 0,
      averageDaysOverdue,
      currentOverdueCount,
      currentDueCount
    },
    trend,
    byCategory,
    byAsset,
    byMember,
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString()
  };
};