export type ProjectRiskScoreInput = {
  status?: string | null;
  percentComplete: number;
  budgetRatio: number | null;
  materialCoverage: number | null;
  daysToTarget: number | null;
};

const CLOSED_PROJECT_STATUSES = new Set(["completed", "cancelled"]);

export const getProjectDaysToTarget = (
  targetEndDate: string | Date | null,
  now: number = Date.now()
): number | null => {
  if (!targetEndDate) {
    return null;
  }

  const targetTime = targetEndDate instanceof Date
    ? targetEndDate.getTime()
    : new Date(targetEndDate).getTime();

  return Math.ceil((targetTime - now) / 86_400_000);
};

export const isProjectLate = (input: Pick<ProjectRiskScoreInput, "status" | "daysToTarget">): boolean => (
  input.daysToTarget !== null
  && input.daysToTarget < 0
  && !CLOSED_PROJECT_STATUSES.has(input.status ?? "")
);

export const calculateProjectRiskScore = (input: ProjectRiskScoreInput): number => {
  const late = isProjectLate(input);

  return (late ? 3 : 0)
    + (input.budgetRatio !== null && input.budgetRatio >= 1 ? 3 : input.budgetRatio !== null && input.budgetRatio >= 0.9 ? 2 : 0)
    + (input.materialCoverage !== null && input.materialCoverage < 0.5 ? 2 : input.materialCoverage !== null && input.materialCoverage < 1 ? 1 : 0)
    + (input.percentComplete < 50 && input.daysToTarget !== null && input.daysToTarget <= 14 ? 1 : 0);
};

export const isProjectAtRisk = (riskScore: number): boolean => riskScore >= 2;