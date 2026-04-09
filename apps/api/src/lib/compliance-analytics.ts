import type { CompletionCycleRecord } from "@aegis/types";

export type ComplianceSummary = {
  totalCycles: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  averageDaysLate: number | null;
};

type CountableCycle = CompletionCycleRecord & {
  dueDate: string;
  completedAt: string;
  deltaInDays: number;
};

export const isCountableCycle = (cycle: CompletionCycleRecord): cycle is CountableCycle => (
  cycle.dueDate !== null && cycle.completedAt !== null && cycle.deltaInDays !== null
);

export const isLateCycle = (cycle: CompletionCycleRecord): cycle is CountableCycle => (
  isCountableCycle(cycle) && cycle.deltaInDays > 0
);

export const summarizeCycles = (cycles: CompletionCycleRecord[]): ComplianceSummary => {
  const eligibleCycles = cycles.filter(isCountableCycle);
  const onTimeCount = eligibleCycles.filter((cycle) => cycle.deltaInDays <= 0).length;
  const lateCycles = eligibleCycles.filter((cycle) => cycle.deltaInDays > 0);
  const lateCount = lateCycles.length;

  return {
    totalCycles: eligibleCycles.length,
    onTimeCount,
    lateCount,
    onTimeRate: eligibleCycles.length > 0 ? (onTimeCount / eligibleCycles.length) * 100 : 0,
    averageDaysLate: lateCycles.length > 0
      ? lateCycles.reduce((sum, cycle) => sum + cycle.deltaInDays, 0) / lateCycles.length
      : null
  };
};

export const filterCompletedCyclesInRange = (
  cycles: CompletionCycleRecord[],
  start: Date,
  end: Date
): CompletionCycleRecord[] => cycles.filter((cycle) => {
  if (!cycle.completedAt) {
    return false;
  }

  const completedAt = new Date(cycle.completedAt);
  return completedAt >= start && completedAt <= end;
});

export const filterReportCyclesInRange = (
  cycles: CompletionCycleRecord[],
  startDate?: Date,
  endDate?: Date
): CompletionCycleRecord[] => cycles.filter((cycle) => {
  if (!startDate && !endDate) {
    return true;
  }

  const effectiveDate = cycle.completedAt ? new Date(cycle.completedAt) : cycle.dueDate ? new Date(cycle.dueDate) : null;

  if (!effectiveDate) {
    return false;
  }

  return (!startDate || effectiveDate >= startDate) && (!endDate || effectiveDate <= endDate);
});