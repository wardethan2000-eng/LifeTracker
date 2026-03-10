import type {
  CompoundTriggerSchema,
  IntervalTriggerSchema,
  MaintenanceTrigger,
  OneTimeTriggerSchema,
  ScheduleStatus,
  SeasonalTriggerSchema,
  UsageTriggerSchema
} from "@lifekeeper/types";

export interface UsageReading {
  metricId: string;
  currentValue: number;
  lastCompletedValue?: number;
}

export interface DueDateResult {
  nextDueAt: Date | undefined;
  dueMetricValue: number | undefined;
}

const compareDateState = (
  dueAt: Date | undefined,
  leadTimeDays: number,
  now: Date
): ScheduleStatus | undefined => {
  if (!dueAt) {
    return undefined;
  }

  if (now > dueAt) {
    return "overdue";
  }

  if (now.getTime() === dueAt.getTime()) {
    return "due";
  }

  const leadAt = addDays(dueAt, -leadTimeDays);

  if (now >= leadAt) {
    return "due";
  }

  return "upcoming";
};

const compareUsageState = (
  dueMetricValue: number | undefined,
  leadTimeValue: number,
  currentUsageValue: number | undefined
): ScheduleStatus | undefined => {
  if (typeof dueMetricValue !== "number" || typeof currentUsageValue !== "number") {
    return undefined;
  }

  if (currentUsageValue > dueMetricValue) {
    return "overdue";
  }

  if (currentUsageValue === dueMetricValue) {
    return "due";
  }

  if (currentUsageValue >= dueMetricValue - leadTimeValue) {
    return "due";
  }

  return "upcoming";
};

const rankByUrgency = (status: ScheduleStatus): number => {
  switch (status) {
    case "upcoming":
      return 0;
    case "due":
      return 1;
    case "overdue":
      return 2;
  }
};

const statusByRank = (rank: number): ScheduleStatus => {
  if (rank <= 0) {
    return "upcoming";
  }

  if (rank === 1) {
    return "due";
  }

  return "overdue";
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const intervalDueDate = (trigger: IntervalTriggerSchema, lastCompletedAt?: Date): DueDateResult => ({
  nextDueAt: addDays(lastCompletedAt ?? new Date(trigger.anchorDate ?? Date.now()), trigger.intervalDays),
  dueMetricValue: undefined
});

const seasonalDueDate = (trigger: SeasonalTriggerSchema, referenceDate = new Date()): DueDateResult => {
  const year = referenceDate.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, trigger.month - 1, trigger.day));

  if (candidate >= referenceDate) {
    return { nextDueAt: candidate, dueMetricValue: undefined };
  }

  return {
    nextDueAt: new Date(Date.UTC(year + 1, trigger.month - 1, trigger.day)),
    dueMetricValue: undefined
  };
};

const oneTimeDueDate = (trigger: OneTimeTriggerSchema): DueDateResult => ({
  nextDueAt: new Date(trigger.dueAt),
  dueMetricValue: undefined
});

const usageDueDate = (trigger: UsageTriggerSchema, reading?: UsageReading): DueDateResult => {
  if (!reading) {
    return { nextDueAt: undefined, dueMetricValue: undefined };
  }

  return {
    nextDueAt: undefined,
    dueMetricValue: (reading.lastCompletedValue ?? reading.currentValue) + trigger.intervalValue
  };
};

const compoundDueDate = (
  trigger: CompoundTriggerSchema,
  lastCompletedAt?: Date,
  reading?: UsageReading
): DueDateResult => {
  const timeDue = intervalDueDate({
    type: "interval",
    intervalDays: trigger.intervalDays,
    anchorDate: undefined,
    leadTimeDays: trigger.leadTimeDays
  }, lastCompletedAt).nextDueAt;
  const usageDue = usageDueDate({
    type: "usage",
    metricId: trigger.metricId,
    intervalValue: trigger.intervalValue,
    leadTimeValue: trigger.leadTimeValue
  }, reading).dueMetricValue;

  return {
    nextDueAt: timeDue,
    dueMetricValue: usageDue
  };
};

export const calculateNextDue = (
  trigger: MaintenanceTrigger,
  options: {
    lastCompletedAt?: Date;
    usageReading?: UsageReading;
    referenceDate?: Date;
  } = {}
): DueDateResult => {
  switch (trigger.type) {
    case "interval":
      return intervalDueDate(trigger, options.lastCompletedAt);
    case "usage":
      return usageDueDate(trigger, options.usageReading);
    case "seasonal":
      return seasonalDueDate(trigger, options.referenceDate);
    case "compound":
      return compoundDueDate(trigger, options.lastCompletedAt, options.usageReading);
    case "one_time":
      return oneTimeDueDate(trigger);
    default:
      return { nextDueAt: undefined, dueMetricValue: undefined };
  }
};

export const isScheduleOverdue = (
  due: DueDateResult,
  options: {
    now?: Date;
    currentUsageValue?: number;
  } = {}
): boolean => {
  const now = options.now ?? new Date();

  if (due.nextDueAt && due.nextDueAt <= now) {
    return true;
  }

  if (typeof due.dueMetricValue === "number" && typeof options.currentUsageValue === "number") {
    return options.currentUsageValue >= due.dueMetricValue;
  }

  return false;
};

export const calculateScheduleStatus = (
  trigger: MaintenanceTrigger,
  due: DueDateResult,
  options: {
    now?: Date;
    currentUsageValue?: number;
  } = {}
): ScheduleStatus => {
  const now = options.now ?? new Date();

  switch (trigger.type) {
    case "interval":
      return compareDateState(due.nextDueAt, trigger.leadTimeDays, now) ?? "upcoming";
    case "seasonal":
      return compareDateState(due.nextDueAt, trigger.leadTimeDays, now) ?? "upcoming";
    case "one_time":
      return compareDateState(due.nextDueAt, trigger.leadTimeDays, now) ?? "upcoming";
    case "usage":
      return compareUsageState(due.dueMetricValue, trigger.leadTimeValue, options.currentUsageValue) ?? "upcoming";
    case "compound": {
      const dateState = compareDateState(due.nextDueAt, trigger.leadTimeDays, now) ?? "upcoming";
      const usageState = compareUsageState(due.dueMetricValue, trigger.leadTimeValue, options.currentUsageValue) ?? "upcoming";

      if (trigger.logic === "whichever_first") {
        return statusByRank(Math.max(rankByUrgency(dateState), rankByUrgency(usageState)));
      }

      return statusByRank(Math.min(rankByUrgency(dateState), rankByUrgency(usageState)));
    }
    default:
      return "upcoming";
  }
};

