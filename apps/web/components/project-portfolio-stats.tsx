import type { ProjectPortfolioItem } from "@lifekeeper/types";
import type { JSX } from "react";
import { formatCurrency } from "../lib/formatters";
import { buildPortfolioProjects, type ProjectSort } from "./project-portfolio-shared";

type ProjectPortfolioStatsProps = {
  householdId: string;
  projects: ProjectPortfolioItem[];
  selectedStatusLabel: string;
  selectedSort: ProjectSort;
};

export function ProjectPortfolioStats({ householdId, projects, selectedStatusLabel, selectedSort }: ProjectPortfolioStatsProps): JSX.Element {
  const portfolioProjects = buildPortfolioProjects(projects, selectedSort);
  const visibleBudget = portfolioProjects.reduce((sum, project) => sum + (project.totalBudgeted ?? 0), 0);
  const visibleSpent = portfolioProjects.reduce((sum, project) => sum + project.totalSpent, 0);
  const visibleCommitted = portfolioProjects.reduce((sum, project) => sum + project.committedCost, 0);
  const visibleMaterialPlan = portfolioProjects.reduce((sum, project) => sum + project.plannedInventoryCost, 0);
  const totalInventoryNeeded = portfolioProjects.reduce((sum, project) => sum + project.totalInventoryNeeded, 0);
  const totalInventoryAllocated = portfolioProjects.reduce((sum, project) => sum + project.totalInventoryAllocated, 0);
  const portfolioCoverage = totalInventoryNeeded > 0 ? totalInventoryAllocated / totalInventoryNeeded : null;
  const atRiskProjects = portfolioProjects.filter((project) => project.isAtRisk);
  const lateProjects = atRiskProjects.filter((project) => project.isLate);
  const budgetPressureProjects = portfolioProjects.filter((project) => project.budgetRatio !== null && project.budgetRatio >= 0.9);

  return (
    <section className="stats-row">
      <div className="stat-card stat-card--accent">
        <span className="stat-card__label">Visible Projects</span>
        <strong className="stat-card__value">{portfolioProjects.length}</strong>
        <span className="stat-card__sub">{selectedStatusLabel}</span>
      </div>
      <div className="stat-card stat-card--danger">
        <span className="stat-card__label">Delivery Risk</span>
        <strong className="stat-card__value">{atRiskProjects.length}</strong>
        <span className="stat-card__sub">{lateProjects.length} late, {budgetPressureProjects.length} under funding pressure</span>
      </div>
      <div className="stat-card stat-card--warning">
        <span className="stat-card__label">Budget Exposure</span>
        <strong className="stat-card__value">{formatCurrency(visibleCommitted, "$0.00")}</strong>
        <span className="stat-card__sub">
          {visibleBudget > 0
            ? `${Math.round((visibleCommitted / visibleBudget) * 100)}% of ${formatCurrency(visibleBudget, "$0.00")}`
            : "No funded scope on visible projects"}
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-card__label">Material Readiness</span>
        <strong className="stat-card__value">
          {portfolioCoverage === null ? "No plan" : `${Math.round(portfolioCoverage * 100)}%`}
        </strong>
        <span className="stat-card__sub">
          {formatCurrency(visibleMaterialPlan, "$0.00")} planned, {totalInventoryAllocated} of {totalInventoryNeeded} units allocated
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-card__label">Actual Spend</span>
        <strong className="stat-card__value">{formatCurrency(visibleSpent, "$0.00")}</strong>
        <span className="stat-card__sub">Committed total includes planned materials.</span>
      </div>
    </section>
  );
}