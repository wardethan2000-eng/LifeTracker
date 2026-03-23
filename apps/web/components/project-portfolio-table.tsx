import type { ProjectPortfolioItem } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { ProjectProgressBar } from "./project-progress-bar";
import { formatCurrency, formatDate } from "../lib/formatters";
import {
  buildPortfolioProjects,
  getCoverageLabel,
  getRiskLabel,
  getRiskTone,
  getTargetLabel,
  type ProjectSort
} from "./project-portfolio-shared";

type ProjectPortfolioTableProps = {
  householdId: string;
  projects: ProjectPortfolioItem[];
  selectedSort: ProjectSort;
  total: number;
};

export function ProjectPortfolioTable({ householdId, projects, selectedSort, total }: ProjectPortfolioTableProps): JSX.Element {
  const portfolioProjects = buildPortfolioProjects(projects, selectedSort);

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Project Portfolio ({portfolioProjects.length})</h2>
          <span className="pill">{total} total</span>
        </div>
        <div className="panel__body">
          {portfolioProjects.length === 0 ? (
            <div className="panel__body--padded">
              <p className="panel__empty">No projects match the current filters. Adjust the scope or create a new project to populate the portfolio view.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Target</th>
                  <th>Budget</th>
                  <th>Material Plan</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {portfolioProjects.map((project) => {
                  const tone = getRiskTone(project);
                  const subtitle = project.description && project.description.length > 50 ? `${project.description.slice(0, 50)}...` : project.description;

                  return (
                    <tr key={project.id} className={`row--${tone === "neutral" ? "default" : tone}`}>
                      <td>
                        <div className="data-table__primary">
                          <Link href={`/projects/${project.id}?householdId=${householdId}`} className="data-table__link">{project.name}</Link>
                        </div>
                        <div className="data-table__secondary">
                          {project.depth > 0 && (
                            <span style={{ marginRight: 6, opacity: 0.7 }}>Sub-project ·</span>
                          )}
                          {tone !== "neutral" && tone !== "accent" ? (
                            <strong style={{ color: `var(--${tone}-text, var(--${tone}))` }}>{getRiskLabel(project)}</strong>
                          ) : (
                            subtitle || getRiskLabel(project)
                          )}
                        </div>
                      </td>
                      <td><span className={`status-chip status-chip--${tone === "neutral" ? "default" : tone}`}>{project.status}</span></td>
                      <td>
                        <ProjectProgressBar
                          phases={project.phaseProgress ?? []}
                          totalTaskCount={project.taskCount}
                          completedTaskCount={project.completedTaskCount}
                          showLabel={true}
                        />
                      </td>
                      <td>
                        <strong>{project.status === "completed" ? formatDate(project.actualEndDate, "Completed") : getTargetLabel(project)}</strong>
                        <div className="data-table__secondary">{project.completedPhaseCount} of {project.phaseCount} phases</div>
                      </td>
                      <td>
                        <strong>{formatCurrency(project.committedCost, "$0.00")}</strong>
                        {project.totalBudgeted && project.totalBudgeted > 0 ? (
                          <div className="data-table__secondary">{Math.round((project.committedCost / project.totalBudgeted) * 100)}% of {formatCurrency(project.totalBudgeted, "$0")}</div>
                        ) : (
                          <div className="data-table__secondary">Unbudgeted</div>
                        )}
                      </td>
                      <td>
                        <strong>{getCoverageLabel(project)}</strong>
                        <div className="data-table__secondary">{project.inventoryLineCount} lines</div>
                      </td>
                      <td>{formatDate(project.updatedAt, "Recently")}</td>
                      <td>
                        <Link href={`/projects/${project.id}?householdId=${householdId}`} className="data-table__link">Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Material Rollups</h2>
        </div>
        <div className="panel__body">
          {portfolioProjects.filter((project) => project.inventoryLineCount > 0).length === 0 ? (
            <p className="panel__empty">No inventory-linked requirements on the visible projects yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Inventory Lines</th>
                  <th>Allocated</th>
                  <th>Gap</th>
                  <th>Planned Cost</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {portfolioProjects.filter((project) => project.inventoryLineCount > 0).map((project) => (
                  <tr key={project.id}>
                    <td>
                      <div className="data-table__primary">{project.name}</div>
                      <div className="data-table__secondary">{getCoverageLabel(project)}</div>
                    </td>
                    <td>{project.inventoryLineCount}</td>
                    <td>{project.totalInventoryAllocated} / {project.totalInventoryNeeded}</td>
                    <td>{project.totalInventoryRemaining}</td>
                    <td>{formatCurrency(project.plannedInventoryCost, "$0.00")}</td>
                    <td>
                      <Link href={`/projects/${project.id}?householdId=${householdId}`} className="data-table__link">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}