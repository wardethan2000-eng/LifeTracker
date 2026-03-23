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

export interface ValueDatePair {
  value: number;
  date: Date;
}

export const calculateUsageRate = (entries: ValueDatePair[]): number => {
  if (entries.length < 2) return 0;

  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const n = sorted.length;

  // Simple linear regression: value = slope * daysSinceFirst + intercept
  const firstTime = sorted[0]!.date.getTime();
  const xs = sorted.map(e => (e.date.getTime() - firstTime) / (1000 * 60 * 60 * 24));
  const ys = sorted.map(e => e.value);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i]!, 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
};

export const projectNextDueValue = (
  currentValue: number,
  ratePerDay: number,
  targetThreshold: number
): Date | null => {
  if (ratePerDay <= 0) return null;

  const remaining = targetThreshold - currentValue;
  if (remaining <= 0) return null;

  const daysUntil = remaining / ratePerDay;
  const projected = new Date();
  projected.setTime(projected.getTime() + daysUntil * 24 * 60 * 60 * 1000);
  return projected;
};

export interface UsageRateBucket {
  bucketStart: string;
  bucketEnd: string;
  deltaValue: number;
  rate: number;
  entryCount: number;
  insufficientData: boolean;
}

export interface UsageAnomalyBucket extends UsageRateBucket {
  isAnomaly: boolean;
  deviationFactor: number;
}

export const LEGACY_ENTRY_SOURCE_TYPES = {
  assetTimelineEntry: "asset_timeline_entry",
  projectNote: "project_note",
  hobbyLog: "hobby_log"
} as const;

export const ASSET_CATEGORY_PREFIX = "lk:asset-category:";
const ASSET_VENDOR_TAG = "lk:asset-vendor";
const PROJECT_NOTE_CATEGORY_PREFIX = "lk:project-note-category:";
const HOBBY_LOG_TYPE_PREFIX = "lk:hobby-log-type:";
const ASSET_COST_MEASUREMENT_NAME = "asset_cost";
const ASSET_COST_MEASUREMENT_UNIT = "currency";

type LegacyEntryMeasurement = {
  name: string;
  value: number;
  unit: string;
};

type AssetEntryPayload = {
  body: string;
  entryType: "note" | "observation" | "issue" | "milestone" | "reference" | "comparison";
  tags: string[];
  measurements: LegacyEntryMeasurement[];
  attachmentName: string | null;
};

type ProjectEntryPayload = {
  body: string;
  entryType: "note" | "measurement" | "decision" | "reference";
  tags: string[];
  flags: Array<"pinned">;
  attachmentUrl: string | null;
  attachmentName: string | null;
};

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? "";

const dedupeStrings = (values: Array<string | null | undefined>): string[] => Array.from(new Set(
  values
    .map((value) => normalizeText(value))
    .filter(Boolean)
));

const hostnameFromUrl = (value: string): string | null => {
  const match = normalizeText(value).match(/^[a-z]+:\/\/([^/?#]+)/i);
  return match?.[1] ?? null;
};

export const isLegacyImportedEntrySourceType = (sourceType: string | null | undefined): boolean => (
  sourceType === LEGACY_ENTRY_SOURCE_TYPES.assetTimelineEntry
  || sourceType === LEGACY_ENTRY_SOURCE_TYPES.projectNote
  || sourceType === LEGACY_ENTRY_SOURCE_TYPES.hobbyLog
);

const mapAssetCategoryToEntryType = (category: string | null | undefined): AssetEntryPayload["entryType"] => {
  switch (normalizeText(category).toLowerCase()) {
    case "observation":
    case "inspection":
      return "observation";
    case "incident":
    case "repair":
      return "issue";
    case "purchase":
      return "reference";
    case "modification":
      return "milestone";
    default:
      return "note";
  }
};

const mapEntryTypeToAssetCategory = (entryType: string): string => {
  switch (entryType) {
    case "observation":
      return "observation";
    case "issue":
      return "incident";
    case "milestone":
      return "modification";
    case "reference":
      return "purchase";
    default:
      return "note";
  }
};

const mapProjectNoteCategoryToEntryType = (category: string | null | undefined): ProjectEntryPayload["entryType"] => {
  switch (normalizeText(category).toLowerCase()) {
    case "measurement":
      return "measurement";
    case "decision":
      return "decision";
    case "reference":
      return "reference";
    default:
      return "note";
  }
};

const mapEntryTypeToProjectNoteCategory = (entryType: string): "research" | "reference" | "decision" | "measurement" | "general" => {
  switch (entryType) {
    case "measurement":
      return "measurement";
    case "decision":
      return "decision";
    case "reference":
      return "reference";
    default:
      return "general";
  }
};

export const mapHobbyLogTypeToEntryType = (logType: string | null | undefined): "note" | "lesson" | "milestone" => {
  switch (normalizeText(logType).toLowerCase()) {
    case "lesson":
      return "lesson";
    case "milestone":
      return "milestone";
    default:
      return "note";
  }
};

export const buildAssetEntryPayload = (input: {
  title: string;
  description?: string | null;
  category?: string | null;
  cost?: number | null;
  vendor?: string | null;
  tags?: string[];
}): AssetEntryPayload => {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const category = normalizeText(input.category);
  const vendor = normalizeText(input.vendor);
  const tags = dedupeStrings([
    ...(input.tags ?? []),
    category ? `${ASSET_CATEGORY_PREFIX}${category}` : null,
    vendor ? ASSET_VENDOR_TAG : null
  ]);

  return {
    body: description || title,
    entryType: mapAssetCategoryToEntryType(category || undefined),
    tags,
    measurements: typeof input.cost === "number"
      ? [{ name: ASSET_COST_MEASUREMENT_NAME, value: input.cost, unit: ASSET_COST_MEASUREMENT_UNIT }]
      : [],
    attachmentName: vendor || null
  };
};

export const parseAssetEntryPayload = (input: {
  title: string | null | undefined;
  body: string | null | undefined;
  entryType: string;
  tags?: string[] | null;
  measurements?: Array<{ name: string; value: number; unit: string }> | null;
  attachmentName?: string | null;
}): {
  description: string | null;
  category: string;
  cost: number | null;
  vendor: string | null;
  tags: string[];
} => {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const tags = input.tags ?? [];
  const categoryTag = tags.find((tag) => tag.startsWith(ASSET_CATEGORY_PREFIX));
  const category = categoryTag
    ? categoryTag.slice(ASSET_CATEGORY_PREFIX.length)
    : mapEntryTypeToAssetCategory(input.entryType);
  const costMeasurement = (input.measurements ?? []).find((measurement) => (
    measurement.name === ASSET_COST_MEASUREMENT_NAME && measurement.unit === ASSET_COST_MEASUREMENT_UNIT
  ));
  const vendor = tags.includes(ASSET_VENDOR_TAG) ? normalizeText(input.attachmentName) || null : null;

  return {
    description: body && body !== title ? body : null,
    category,
    cost: typeof costMeasurement?.value === "number" ? costMeasurement.value : null,
    vendor,
    tags: tags.filter((tag) => tag !== ASSET_VENDOR_TAG && !tag.startsWith(ASSET_CATEGORY_PREFIX))
  };
};

export const buildProjectEntryPayload = (input: {
  title: string;
  body?: string | null;
  category?: string | null;
  url?: string | null;
  isPinned?: boolean;
}): ProjectEntryPayload => {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const category = normalizeText(input.category) || "general";
  const url = normalizeText(input.url);

  return {
    body: body || title,
    entryType: mapProjectNoteCategoryToEntryType(category),
    tags: dedupeStrings([`${PROJECT_NOTE_CATEGORY_PREFIX}${category}`]),
    flags: input.isPinned ? ["pinned"] : [],
    attachmentUrl: url || null,
    attachmentName: url ? hostnameFromUrl(url) ?? url : null
  };
};

export const parseProjectEntryPayload = (input: {
  title: string | null | undefined;
  body: string | null | undefined;
  entryType: string;
  tags?: string[] | null;
  flags?: string[] | null;
  attachmentUrl?: string | null;
}): {
  body: string;
  category: "research" | "reference" | "decision" | "measurement" | "general";
  isPinned: boolean;
  url: string | null;
} => {
  const tags = input.tags ?? [];
  const title = normalizeText(input.title);
  const categoryTag = tags.find((tag) => tag.startsWith(PROJECT_NOTE_CATEGORY_PREFIX));
  const category = categoryTag
    ? categoryTag.slice(PROJECT_NOTE_CATEGORY_PREFIX.length)
    : mapEntryTypeToProjectNoteCategory(input.entryType);

  return {
    body: (() => {
      const body = normalizeText(input.body);
      return body === title ? "" : body;
    })(),
    category: (category || "general") as "research" | "reference" | "decision" | "measurement" | "general",
    isPinned: (input.flags ?? []).includes("pinned"),
    url: normalizeText(input.attachmentUrl) || null
  };
};

export const buildHobbyLogEntryTags = (logType: string | null | undefined): string[] => {
  const normalized = normalizeText(logType);
  return normalized ? [`${HOBBY_LOG_TYPE_PREFIX}${normalized}`] : [];
};

export * from "./project-risk.js";

export interface UsageAnomalyResult {
  mean: number;
  stddev: number;
  buckets: UsageAnomalyBucket[];
}

export interface CostPerUnitEntry {
  cost: number;
  incrementalUsage: number;
  costPerUnit: number;
  completedAt: Date;
}

export interface CostPerUnitResult {
  totalCost: number;
  totalUsage: number;
  averageCostPerUnit: number;
  entries: CostPerUnitEntry[];
}

export interface LogCostBreakdown {
  directCost: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
}

export interface PeriodCostAggregate {
  period: string;
  totalCost: number;
  logCount: number;
}

export interface PeriodCostAggregateResult {
  periods: PeriodCostAggregate[];
  rolling12MonthAverage: number;
}

export interface ScheduleForecastEntry {
  scheduleId: string;
  scheduleName: string;
  costPerOccurrence: number;
  occurrences3m: number;
  occurrences6m: number;
  occurrences12m: number;
  cost3m: number;
  cost6m: number;
  cost12m: number;
}

export interface ScheduleForecastResult {
  schedules: ScheduleForecastEntry[];
  totals: {
    total3m: number;
    total6m: number;
    total12m: number;
  };
}

export interface MultiScheduleProjection {
  scheduleId: string;
  scheduleName: string;
  nextDueMetricValue: number;
  projectedDate: string | null;
  daysUntil: number | null;
  humanLabel: string;
}

export interface MetricCorrelationRatioPoint {
  date: string;
  ratio: number;
}

export interface MetricCorrelationResult {
  correlation: number;
  ratioSeries: MetricCorrelationRatioPoint[];
  divergenceTrend: "stable" | "diverging" | "converging";
  meanRatio: number;
}

export const computeLogTotalCost = (log: {
  cost: number | null;
  laborHours: number | null;
  laborRate: number | null;
  parts: Array<{ quantity: number; unitCost: number | null }>;
}): LogCostBreakdown => {
  const directCost = log.cost ?? 0;
  const laborCost = typeof log.laborHours === "number" && typeof log.laborRate === "number"
    ? log.laborHours * log.laborRate
    : 0;
  const partsCost = log.parts.reduce((sum, part) => sum + (part.quantity * (part.unitCost ?? 0)), 0);

  return {
    directCost,
    laborCost,
    partsCost,
    totalCost: directCost + laborCost + partsCost
  };
};

const formatCostPeriod = (date: Date, granularity: "month" | "year"): string => {
  const year = date.getUTCFullYear();

  if (granularity === "year") {
    return `${year}`;
  }

  return `${year}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;
};

export const aggregateCostsByPeriod = (
  entries: Array<{ totalCost: number; completedAt: Date }>,
  granularity: "month" | "year"
): PeriodCostAggregateResult => {
  const buckets = new Map<string, PeriodCostAggregate>();

  for (const entry of entries) {
    const period = formatCostPeriod(entry.completedAt, granularity);
    const existing = buckets.get(period);

    if (existing) {
      existing.totalCost += entry.totalCost;
      existing.logCount += 1;
      continue;
    }

    buckets.set(period, {
      period,
      totalCost: entry.totalCost,
      logCount: 1
    });
  }

  const periods = Array.from(buckets.values()).sort((left, right) => left.period.localeCompare(right.period));
  const monthlyPeriods = granularity === "month" ? periods.slice(-12) : [];
  const rolling12MonthAverage = monthlyPeriods.length > 0
    ? monthlyPeriods.reduce((sum, item) => sum + item.totalCost, 0) / monthlyPeriods.length
    : 0;

  return {
    periods,
    rolling12MonthAverage
  };
};

const clampOccurrenceCount = (value: number): number => Number.isFinite(value) && value > 0
  ? Math.floor(value)
  : 0;

const countDateWithinHorizon = (nextDueAt: Date | null, horizonDays: number, now: Date): number => {
  if (!nextDueAt) {
    return 0;
  }

  const horizonAt = new Date(now.getTime() + horizonDays * MS_PER_DAY);
  return nextDueAt <= horizonAt ? 1 : 0;
};

export const computeScheduleForecast = (schedules: Array<{
  scheduleId: string;
  scheduleName: string;
  estimatedCost: number | null;
  historicalAverageCost: number | null;
  nextDueAt: Date | null;
  nextDueMetricValue: number | null;
  ratePerDay: number | null;
  triggerType: string;
  intervalDays: number | null;
}>): ScheduleForecastResult => {
  const now = new Date();
  const scheduleForecasts: ScheduleForecastEntry[] = [];

  for (const schedule of schedules) {
    const costPerOccurrence = schedule.estimatedCost ?? schedule.historicalAverageCost;

    if (costPerOccurrence === null) {
      continue;
    }

    let occurrences3m = 0;
    let occurrences6m = 0;
    let occurrences12m = 0;

    if (schedule.triggerType === "seasonal" || schedule.triggerType === "one_time") {
      occurrences3m = countDateWithinHorizon(schedule.nextDueAt, 90, now);
      occurrences6m = countDateWithinHorizon(schedule.nextDueAt, 180, now);
      occurrences12m = countDateWithinHorizon(schedule.nextDueAt, 365, now);
    } else {
      let effectiveIntervalDays = schedule.intervalDays;

      if ((schedule.triggerType === "usage" || schedule.triggerType === "compound") && schedule.intervalDays === null) {
        effectiveIntervalDays = schedule.ratePerDay && schedule.ratePerDay > 0
          ? (schedule.nextDueMetricValue ?? 0) / schedule.ratePerDay
          : null;
      }

      if (effectiveIntervalDays && effectiveIntervalDays > 0) {
        occurrences3m = clampOccurrenceCount(90 / effectiveIntervalDays);
        occurrences6m = clampOccurrenceCount(180 / effectiveIntervalDays);
        occurrences12m = clampOccurrenceCount(365 / effectiveIntervalDays);
      }
    }

    scheduleForecasts.push({
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.scheduleName,
      costPerOccurrence,
      occurrences3m,
      occurrences6m,
      occurrences12m,
      cost3m: occurrences3m * costPerOccurrence,
      cost6m: occurrences6m * costPerOccurrence,
      cost12m: occurrences12m * costPerOccurrence
    });
  }

  return {
    schedules: scheduleForecasts,
    totals: {
      total3m: scheduleForecasts.reduce((sum, item) => sum + item.cost3m, 0),
      total6m: scheduleForecasts.reduce((sum, item) => sum + item.cost6m, 0),
      total12m: scheduleForecasts.reduce((sum, item) => sum + item.cost12m, 0)
    }
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

const startOfUtcDay = (date: Date): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate()
));

const endOfUtcDay = (date: Date): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate(),
  23,
  59,
  59,
  999
));

const startOfUtcWeek = (date: Date): Date => {
  const start = startOfUtcDay(date);
  const day = start.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + offset);
  return start;
};

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  1
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

const differenceInDays = (start: Date, end: Date): number => Math.max(
  1,
  Math.round((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / MS_PER_DAY) + 1
);

const calculateMean = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateStddev = (values: number[], mean = calculateMean(values)): number => {
  if (values.length === 0) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const getBucketBounds = (date: Date, bucketSize: "week" | "month"): { start: Date; end: Date; days: number } => {
  if (bucketSize === "week") {
    const start = startOfUtcWeek(date);
    const end = endOfUtcDay(new Date(start.getTime() + 6 * MS_PER_DAY));
    return { start, end, days: 7 };
  }

  const start = startOfUtcMonth(date);
  const end = endOfUtcMonth(date);
  return {
    start,
    end,
    days: differenceInDays(start, end)
  };
};

const formatProjectionDistance = (daysUntil: number): string => {
  if (daysUntil <= 0) {
    return "today";
  }

  if (daysUntil < 45) {
    const roundedDays = Math.max(1, Math.round(daysUntil));
    return `about ${roundedDays} day${roundedDays === 1 ? "" : "s"}`;
  }

  const months = Math.max(1, Math.round(daysUntil / 30));
  return `about ${months} month${months === 1 ? "" : "s"}`;
};

const projectionDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

const findClosestEntry = (entries: ValueDatePair[], targetDate: Date): ValueDatePair | null => {
  if (entries.length === 0) {
    return null;
  }

  return entries.reduce<ValueDatePair>((closest, candidate) => {
    const closestDistance = Math.abs(closest.date.getTime() - targetDate.getTime());
    const candidateDistance = Math.abs(candidate.date.getTime() - targetDate.getTime());
    return candidateDistance < closestDistance ? candidate : closest;
  }, entries[0]!);
};

const interpolateValueAt = (entries: ValueDatePair[], targetTime: number): number | null => {
  if (entries.length === 0) {
    return null;
  }

  if (entries.length === 1) {
    return entries[0]!.value;
  }

  for (let index = 0; index < entries.length; index += 1) {
    const current = entries[index]!;
    const currentTime = current.date.getTime();

    if (currentTime === targetTime) {
      return current.value;
    }

    const next = entries[index + 1];

    if (!next) {
      break;
    }

    const nextTime = next.date.getTime();
    if (currentTime <= targetTime && targetTime <= nextTime) {
      const range = nextTime - currentTime;
      if (range === 0) {
        return next.value;
      }

      const progress = (targetTime - currentTime) / range;
      return current.value + (next.value - current.value) * progress;
    }
  }

  return null;
};

const calculatePearsonCorrelation = (left: number[], right: number[]): number => {
  if (left.length < 2 || right.length < 2 || left.length !== right.length) {
    return 0;
  }

  const leftMean = calculateMean(left);
  const rightMean = calculateMean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index]! - rightMean), 0);
  const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  const denominator = Math.sqrt(leftVariance * rightVariance);

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
};

export const bucketUsageRates = (
  entries: ValueDatePair[],
  bucketSize: "week" | "month"
): UsageRateBucket[] => {
  if (entries.length === 0) {
    return [];
  }

  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const buckets = new Map<string, { start: Date; end: Date; days: number; entries: ValueDatePair[] }>();

  for (const entry of sorted) {
    const bounds = getBucketBounds(entry.date, bucketSize);
    const key = bounds.start.toISOString();
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.entries.push(entry);
    } else {
      buckets.set(key, {
        ...bounds,
        entries: [entry]
      });
    }
  }

  return [...buckets.values()]
    .sort((left, right) => left.start.getTime() - right.start.getTime())
    .map((bucket) => {
      const first = bucket.entries[0]!;
      const last = bucket.entries[bucket.entries.length - 1]!;
      const sufficientData = bucket.entries.length >= 2;
      const deltaValue = sufficientData ? last.value - first.value : 0;
      const rate = sufficientData ? deltaValue / bucket.days : 0;

      return {
        bucketStart: bucket.start.toISOString(),
        bucketEnd: bucket.end.toISOString(),
        deltaValue,
        rate,
        entryCount: bucket.entries.length,
        insufficientData: !sufficientData
      } satisfies UsageRateBucket;
    });
};

export const detectUsageAnomaly = (
  buckets: UsageRateBucket[],
  sensitivity = 1.5
): UsageAnomalyResult => {
  const sufficientBuckets = buckets.filter((bucket) => !bucket.insufficientData);
  const rates = sufficientBuckets.map((bucket) => bucket.rate);
  const mean = calculateMean(rates);
  const stddev = calculateStddev(rates, mean);

  return {
    mean,
    stddev,
    buckets: buckets.map((bucket) => {
      if (bucket.insufficientData || stddev === 0) {
        return {
          ...bucket,
          isAnomaly: false,
          deviationFactor: 0
        };
      }

      const deviationFactor = (bucket.rate - mean) / stddev;

      return {
        ...bucket,
        isAnomaly: Math.abs(deviationFactor) > sensitivity,
        deviationFactor
      };
    })
  };
};

export const computeCostPerUnit = (
  entries: Array<{ cost: number; usageValueAtCompletion: number; completedAt: Date }>,
  previousBaselineUsageValue: number
): CostPerUnitResult => {
  const sorted = [...entries].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  let previousUsageValue = previousBaselineUsageValue;

  const normalizedEntries = sorted.reduce<CostPerUnitEntry[]>((accumulator, entry) => {
    const incrementalUsage = entry.usageValueAtCompletion - previousUsageValue;
    previousUsageValue = entry.usageValueAtCompletion;

    if (incrementalUsage <= 0) {
      return accumulator;
    }

    accumulator.push({
      cost: entry.cost,
      incrementalUsage,
      costPerUnit: entry.cost / incrementalUsage,
      completedAt: entry.completedAt
    });

    return accumulator;
  }, []);

  const totalCost = normalizedEntries.reduce((sum, entry) => sum + entry.cost, 0);
  const totalUsage = normalizedEntries.reduce((sum, entry) => sum + entry.incrementalUsage, 0);

  return {
    totalCost,
    totalUsage,
    averageCostPerUnit: totalUsage > 0 ? totalCost / totalUsage : 0,
    entries: normalizedEntries
  };
};

export const projectMultipleSchedules = (
  currentValue: number,
  ratePerDay: number,
  schedules: Array<{ scheduleId: string; scheduleName: string; nextDueMetricValue: number }>
): MultiScheduleProjection[] => schedules.map((schedule) => {
  if (currentValue >= schedule.nextDueMetricValue) {
    return {
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.scheduleName,
      nextDueMetricValue: schedule.nextDueMetricValue,
      projectedDate: null,
      daysUntil: 0,
      humanLabel: "Already due"
    } satisfies MultiScheduleProjection;
  }

  const projectedDate = projectNextDueValue(currentValue, ratePerDay, schedule.nextDueMetricValue);

  if (!projectedDate) {
    return {
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.scheduleName,
      nextDueMetricValue: schedule.nextDueMetricValue,
      projectedDate: null,
      daysUntil: null,
      humanLabel: "Unable to project"
    } satisfies MultiScheduleProjection;
  }

  const daysUntil = Math.max(0, Math.round((projectedDate.getTime() - Date.now()) / MS_PER_DAY));

  return {
    scheduleId: schedule.scheduleId,
    scheduleName: schedule.scheduleName,
    nextDueMetricValue: schedule.nextDueMetricValue,
    projectedDate: projectedDate.toISOString(),
    daysUntil,
    humanLabel: `~${projectionDateFormatter.format(projectedDate)} (${formatProjectionDistance(daysUntil)})`
  } satisfies MultiScheduleProjection;
});

export const correlateMetrics = (
  metricAEntries: ValueDatePair[],
  metricBEntries: ValueDatePair[]
): MetricCorrelationResult => {
  const metricA = [...metricAEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const metricB = [...metricBEntries].sort((a, b) => a.date.getTime() - b.date.getTime());

  const overlapStart = Math.max(
    metricA[0]?.date.getTime() ?? Number.POSITIVE_INFINITY,
    metricB[0]?.date.getTime() ?? Number.POSITIVE_INFINITY
  );
  const overlapEnd = Math.min(
    metricA[metricA.length - 1]?.date.getTime() ?? Number.NEGATIVE_INFINITY,
    metricB[metricB.length - 1]?.date.getTime() ?? Number.NEGATIVE_INFINITY
  );

  const weeklySampleTimes: number[] = [];
  if (Number.isFinite(overlapStart) && Number.isFinite(overlapEnd) && overlapStart <= overlapEnd) {
    let cursor = startOfUtcWeek(new Date(overlapStart)).getTime();
    while (cursor <= overlapEnd) {
      if (cursor >= overlapStart) {
        weeklySampleTimes.push(cursor);
      }
      cursor += MS_PER_WEEK;
    }

    if (weeklySampleTimes.length === 0) {
      weeklySampleTimes.push(overlapStart);
    }
  }

  const interpolatedLeft: number[] = [];
  const interpolatedRight: number[] = [];

  for (const sampleTime of weeklySampleTimes) {
    const leftValue = interpolateValueAt(metricA, sampleTime);
    const rightValue = interpolateValueAt(metricB, sampleTime);

    if (leftValue === null || rightValue === null) {
      continue;
    }

    interpolatedLeft.push(leftValue);
    interpolatedRight.push(rightValue);
  }

  const correlation = calculatePearsonCorrelation(interpolatedLeft, interpolatedRight);

  const ratioAnchorEntries = metricA.length <= metricB.length ? metricA : metricB;
  const ratioSeries = ratioAnchorEntries.reduce<MetricCorrelationRatioPoint[]>((accumulator, entry) => {
    const paired = metricA.length <= metricB.length
      ? findClosestEntry(metricB, entry.date)
      : findClosestEntry(metricA, entry.date);

    if (!paired) {
      return accumulator;
    }

    const metricAValue = metricA.length <= metricB.length ? entry.value : paired.value;
    const metricBValue = metricA.length <= metricB.length ? paired.value : entry.value;

    if (metricBValue === 0) {
      return accumulator;
    }

    accumulator.push({
      date: entry.date.toISOString(),
      ratio: metricAValue / metricBValue
    });

    return accumulator;
  }, []);

  const ratioValues = ratioSeries.map((point) => point.ratio);
  const meanRatio = calculateMean(ratioValues);
  const ratioStddev = calculateStddev(ratioValues, meanRatio);

  let divergenceTrend: MetricCorrelationResult["divergenceTrend"] = "stable";
  if (ratioValues.length >= 2) {
    const stableThreshold = Math.abs(meanRatio) * 0.1;
    if (ratioStddev < stableThreshold) {
      divergenceTrend = "stable";
    } else {
      const initialDistance = Math.abs(ratioValues[0]! - 1);
      const finalDistance = Math.abs(ratioValues[ratioValues.length - 1]! - 1);
      divergenceTrend = finalDistance > initialDistance ? "diverging" : "converging";
    }
  }

  return {
    correlation,
    ratioSeries,
    divergenceTrend,
    meanRatio
  };
};

/**
 * Calculates the current extended value of an inventory item when a unit cost is known.
 */
export const calculateInventoryTotalValue = (
  quantityOnHand: number,
  unitCost?: number | null
): number | null => {
  if (unitCost === null || unitCost === undefined) {
    return null;
  }

  return quantityOnHand * unitCost;
};

/**
 * Returns true when an item's on-hand quantity is at or below its reorder threshold.
 */
export const isInventoryLowStock = (
  quantityOnHand: number,
  reorderThreshold?: number | null
): boolean => {
  if (reorderThreshold === null || reorderThreshold === undefined) {
    return false;
  }

  return quantityOnHand <= reorderThreshold;
};

/**
 * Calculates how far below the reorder threshold an item currently is.
 */
export const calculateInventoryDeficit = (
  quantityOnHand: number,
  reorderThreshold?: number | null
): number => {
  if (reorderThreshold === null || reorderThreshold === undefined) {
    return 0;
  }

  return Math.max(reorderThreshold - quantityOnHand, 0);
};

/**
 * Applies a stock delta while preventing the resulting quantity from dropping below zero.
 */
export const applyInventoryDelta = (
  quantityOnHand: number,
  delta: number
): number => Math.max(quantityOnHand + delta, 0);

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

