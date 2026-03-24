import { MS_PER_DAY } from "@lifekeeper/utils";

export type ProjectBudgetBurnCadence = "day" | "month";

export type ProjectBudgetBurnProjectionInput = {
  totalSpent: number;
  firstExpenseDate: Date | null;
  lastExpenseDate: Date | null;
  targetEndDate: Date | null;
  asOf?: Date;
  cadence?: ProjectBudgetBurnCadence;
};

const AVERAGE_DAYS_PER_MONTH = 30.4375;

const getDurationUnits = (start: Date, end: Date, cadence: ProjectBudgetBurnCadence): number => {
  const days = (end.getTime() - start.getTime()) / MS_PER_DAY;

  if (cadence === "month") {
    return days / AVERAGE_DAYS_PER_MONTH;
  }

  return days;
};

export const calculateProjectBudgetBurnProjection = ({
  totalSpent,
  firstExpenseDate,
  lastExpenseDate,
  targetEndDate,
  asOf = new Date(),
  cadence = "day"
}: ProjectBudgetBurnProjectionInput): {
  burnRate: number | null;
  projectedTotal: number | null;
} => {
  const hasEnoughHistory = firstExpenseDate
    && lastExpenseDate
    && firstExpenseDate.getTime() !== lastExpenseDate.getTime();

  if (!firstExpenseDate || !hasEnoughHistory) {
    return {
      burnRate: null,
      projectedTotal: null
    };
  }

  const elapsedUnits = Math.max(getDurationUnits(firstExpenseDate, asOf, cadence), 1);
  const burnRate = totalSpent / elapsedUnits;

  return {
    burnRate,
    projectedTotal: targetEndDate
      ? burnRate * Math.max(getDurationUnits(firstExpenseDate, targetEndDate, cadence), 0)
      : null
  };
};