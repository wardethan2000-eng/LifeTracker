import type { ProjectPortfolioItem } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { formatCurrency } from "../lib/formatters";
import { buildPortfolioProjects, getRiskLabel, type ProjectSort } from "./project-portfolio-shared";

type ProjectPortfolioAsideProps = {
  householdId: string;
  projects: ProjectPortfolioItem[];
  selectedSort: ProjectSort;
};

export function ProjectPortfolioAside({ householdId, projects, selectedSort }: ProjectPortfolioAsideProps): JSX.Element {
  const portfolioProjects = buildPortfolioProjects(projects, selectedSort);
  const atRiskProjects = portfolioProjects.filter((project) => project.isAtRisk);
  const materialGapProjects = portfolioProjects
    .filter((project) => project.totalInventoryRemaining > 0)
    .sort((left, right) => right.totalInventoryRemaining - left.totalInventoryRemaining)
    .slice(0, 5);
  const visibleBudget = portfolioProjects.reduce((sum, project) => sum + (project.totalBudgeted ?? 0), 0);
  const visibleSpent = portfolioProjects.reduce((sum, project) => sum + project.totalSpent, 0);
  const visibleCommitted = portfolioProjects.reduce((sum, project) => sum + project.committedCost, 0);
  const visibleMaterialPlan = portfolioProjects.reduce((sum, project) => sum + project.plannedInventoryCost, 0);

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Risk Watch</h2>
        </div>
        <div className="panel__body project-insight-list">
          {atRiskProjects.length === 0 ? (
            <p className="panel__empty">No visible projects are currently flagged as late, underfunded, or materially blocked.</p>
          ) : (
            atRiskProjects.slice(0, 5).map((project) => (
              <div key={project.id} className="project-insight-item">
                <div>
                  <strong>{project.name}</strong>
                  <p>{getRiskLabel(project)}</p>
                </div>
                <Link href={`/projects/${project.id}?householdId=${householdId}`} className="data-table__link">Open</Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Material Gaps</h2>
        </div>
        <div className="panel__body project-insight-list">
          {materialGapProjects.length === 0 ? (
            <p className="panel__empty">All visible inventory plans are fully allocated or not yet defined.</p>
          ) : (
            materialGapProjects.map((project) => (
              <div key={project.id} className="project-insight-item">
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.totalInventoryRemaining} units still unallocated across {project.inventoryLineCount} line items</p>
                </div>
                <span className="pill">{project.totalInventoryAllocated}/{project.totalInventoryNeeded}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Funding Snapshot</h2>
        </div>
        <div className="panel__body--padded project-funding-stack">
          <div className="project-funding-row">
            <span>Actual spend</span>
            <strong>{formatCurrency(visibleSpent, "$0.00")}</strong>
          </div>
          <div className="project-funding-row">
            <span>Planned materials</span>
            <strong>{formatCurrency(visibleMaterialPlan, "$0.00")}</strong>
          </div>
          <div className="project-funding-row">
            <span>Budgeted scope</span>
            <strong>{formatCurrency(visibleBudget, "$0.00")}</strong>
          </div>
          <div className="project-funding-row project-funding-row--emphasis">
            <span>Total commitment</span>
            <strong>{formatCurrency(visibleCommitted, "$0.00")}</strong>
          </div>
        </div>
      </section>
    </>
  );
}