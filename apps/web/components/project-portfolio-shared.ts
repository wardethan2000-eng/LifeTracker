import type { ProjectPortfolioItem } from "@lifekeeper/types";
import { calculateProjectRiskScore, getProjectDaysToTarget, isProjectAtRisk, isProjectLate } from "@lifekeeper/utils";

export const projectSortValues = ["risk", "target", "budget", "progress"] as const;

export type ProjectSort = (typeof projectSortValues)[number];

export type PortfolioProject = ProjectPortfolioItem & {
  committedCost: number;
  budgetRatio: number | null;
  materialCoverage: number | null;
  daysToTarget: number | null;
  isLate: boolean;
  isAtRisk: boolean;
  riskScore: number;
};

const compareNullableNumbersAsc = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

export const sortProjects = (projects: PortfolioProject[], sort: ProjectSort): PortfolioProject[] => {
  const ranked = [...projects];

  ranked.sort((left, right) => {
    if (sort === "target") {
      const targetComparison = compareNullableNumbersAsc(left.daysToTarget, right.daysToTarget);
      if (targetComparison !== 0) return targetComparison;
      return right.riskScore - left.riskScore;
    }

    if (sort === "budget") {
      const leftBudget = left.budgetRatio ?? -1;
      const rightBudget = right.budgetRatio ?? -1;
      if (rightBudget !== leftBudget) return rightBudget - leftBudget;
      return right.committedCost - left.committedCost;
    }

    if (sort === "progress") {
      if (left.percentComplete !== right.percentComplete) {
        return left.percentComplete - right.percentComplete;
      }
      return right.riskScore - left.riskScore;
    }

    if (left.riskScore !== right.riskScore) {
      return right.riskScore - left.riskScore;
    }

    const targetComparison = compareNullableNumbersAsc(left.daysToTarget, right.daysToTarget);
    if (targetComparison !== 0) return targetComparison;
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return ranked;
};

export const buildPortfolioProjects = (
  projects: ProjectPortfolioItem[],
  selectedSort: ProjectSort
): PortfolioProject[] => {
  const now = Date.now();

  return sortProjects(projects.map((project) => {
    const inventoryLineCount = project.inventoryLineCount;
    const totalInventoryNeeded = project.totalInventoryNeeded;
    const totalInventoryAllocated = project.totalInventoryAllocated;
    const totalInventoryRemaining = project.totalInventoryRemaining;
    const plannedInventoryCost = project.plannedInventoryCost;
    const committedCost = project.totalSpent + plannedInventoryCost;
    const budgetRatio = project.totalBudgeted && project.totalBudgeted > 0
      ? committedCost / project.totalBudgeted
      : null;
    const materialCoverage = totalInventoryNeeded > 0
      ? totalInventoryAllocated / totalInventoryNeeded
      : null;
    const daysToTarget = getProjectDaysToTarget(project.targetEndDate, now);
    const isLate = isProjectLate({ status: project.status, daysToTarget });
    const riskScore = calculateProjectRiskScore({
      status: project.status,
      percentComplete: project.percentComplete,
      budgetRatio,
      materialCoverage,
      daysToTarget
    });

    return {
      ...project,
      inventoryLineCount,
      totalInventoryNeeded,
      totalInventoryAllocated,
      totalInventoryRemaining,
      plannedInventoryCost,
      committedCost,
      budgetRatio,
      materialCoverage,
      daysToTarget,
      isLate,
      isAtRisk: isProjectAtRisk(riskScore),
      riskScore
    };
  }), selectedSort);
};

export const getRiskTone = (project: PortfolioProject): "danger" | "warning" | "accent" | "neutral" => {
  if (project.riskScore >= 4) return "danger";
  if (project.riskScore >= 2) return "warning";
  if (project.status === "completed") return "accent";
  return "neutral";
};

export const getRiskLabel = (project: PortfolioProject): string => {
  if (project.isLate) return "Late against target";
  if (project.budgetRatio !== null && project.budgetRatio >= 1) return "Over budget";
  if (project.budgetRatio !== null && project.budgetRatio >= 0.9) return "Budget pressure";
  if (project.materialCoverage !== null && project.materialCoverage < 0.5) return "Material gap";
  if (project.materialCoverage !== null && project.materialCoverage < 1) return "Awaiting stock";
  if (project.status === "completed") return "Closed out";
  return "On track";
};

export const getTargetLabel = (project: PortfolioProject): string => {
  if (project.status === "completed") {
    return project.actualEndDate ?? "Completed";
  }

  if (project.daysToTarget === null) {
    return "No target date";
  }

  if (project.daysToTarget < 0) {
    return `${Math.abs(project.daysToTarget)}d overdue`;
  }

  if (project.daysToTarget === 0) {
    return "Due today";
  }

  return `${project.daysToTarget}d remaining`;
};

export const getCoverageLabel = (project: PortfolioProject): string => {
  if (project.inventoryLineCount === 0) {
    return "No material plan";
  }

  if (project.materialCoverage === null) {
    return "No allocation data";
  }

  return `${Math.round(project.materialCoverage * 100)}% allocated`;
};