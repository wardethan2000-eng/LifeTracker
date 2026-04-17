"use client";

import type { ProjectPortfolioItem, ProjectStatus } from "@aegis/types";
import { projectStatusValues } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import { formatCurrency, formatDate } from "../lib/formatters";
import {
  buildPortfolioProjects,
  getCoverageLabel,
  getRiskLabel,
  getRiskTone,
  getTargetLabel,
  type PortfolioProject,
  type ProjectSort,
} from "./project-portfolio-shared";
import { ProjectProgressBar } from "./project-progress-bar";
import { ProjectBulkActions } from "./project-bulk-actions";
import { BulkActionBar } from "./bulk-action-bar";
import { ClickToEditSelect } from "./click-to-edit-select";
import { useToast } from "./toast-provider";
import { EmptyState } from "./empty-state";
import { updateProjectFieldAction } from "../app/actions";

type ProjectPortfolioWorkspaceProps = {
  householdId: string;
  projects: ProjectPortfolioItem[];
  selectedSort: ProjectSort;
  total: number;
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CHIP_CLASS: Record<ProjectStatus, string> = {
  planning: "pill--info",
  active: "pill--success",
  on_hold: "pill--warning",
  completed: "pill--muted",
  cancelled: "pill--danger",
};

const STATUS_OPTIONS = projectStatusValues.map((v) => ({
  value: v,
  label: STATUS_LABELS[v],
}));

type OptimisticProjectFields = { name?: string; status?: ProjectStatus };

export function ProjectPortfolioWorkspace({
  householdId,
  projects,
  selectedSort,
  total,
}: ProjectPortfolioWorkspaceProps): JSX.Element {
  const portfolioProjects = useMemo(
    () => buildPortfolioProjects(projects, selectedSort),
    [projects, selectedSort]
  );

  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();
  const { pushToast } = useToast();

  const [optimistic, setOptimistic] = useState<Record<string, OptimisticProjectFields>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const selectedItems = useMemo(
    () => portfolioProjects.filter((p) => isSelected(p.id)),
    [portfolioProjects, isSelected]
  );
  const focusProjects = useMemo(() => {
    const highestRisk = portfolioProjects.find((project) => project.isAtRisk) ?? portfolioProjects[0];
    const nearestTarget = portfolioProjects.find((project) => project.status !== "completed" && project.daysToTarget !== null);
    const biggestCommitment = [...portfolioProjects]
      .sort((left, right) => right.committedCost - left.committedCost)
      .find((project) => project.committedCost > 0);

    return [highestRisk, nearestTarget, biggestCommitment]
      .filter((project): project is PortfolioProject => Boolean(project))
      .filter((project, index, items) => items.findIndex((item) => item.id === project.id) === index)
      .slice(0, 3);
  }, [portfolioProjects]);

  const allSelected = portfolioProjects.length > 0 && selectedCount === portfolioProjects.length;

  const handleSave = useCallback(
    async (projectId: string, field: "name" | "status", value: string) => {
      const key = `${projectId}:${field}`;
      setSaving((prev) => new Set([...prev, key]));
      setOptimistic((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], [field]: value },
      }));

      const result = await updateProjectFieldAction(householdId, projectId, {
        [field]: value,
      });

      if (!result.success) {
        setOptimistic((prev) => {
          const next = { ...prev };
          if (next[projectId]) {
            const fields = { ...next[projectId] };
            delete (fields as Record<string, unknown>)[field];
            next[projectId] = fields;
          }
          return next;
        });
        pushToast({ message: result.message ?? "Update failed", tone: "danger" });
      }

      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [householdId, pushToast],
  );

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Projects in View ({portfolioProjects.length})</h2>
          {total !== portfolioProjects.length && (
            <span className="pill">{total} total</span>
          )}
          <ProjectBulkActions
            householdId={householdId}
            selectedItems={selectedItems}
            allItems={portfolioProjects}
            onBulkComplete={clearSelection}
          />
        </div>

        <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection} />

        <div className="panel__body">
          {portfolioProjects.length === 0 ? (
            <div style={{ padding: "32px 24px" }}>
              <EmptyState
                icon="layers"
                title="No projects found"
                message="No projects match the current filters. Adjust the scope or create a new project."
                actionLabel="New Project"
                actionHref="/projects/new"
              />
            </div>
          ) : (
            <div className="project-portfolio-stack">
              {focusProjects.length > 0 ? (
                <div className="project-portfolio-grid">
                  {focusProjects.map((project) => {
                    const tone = getRiskTone(project);

                    return (
                      <article key={`focus-${project.id}`} className={`project-portfolio-card project-portfolio-card--${tone}`}>
                        <div className="project-portfolio-card__header">
                          <div>
                            <div className={`project-risk-badge project-risk-badge--${tone}`}>
                              {getRiskLabel(project)}
                            </div>
                            <h3>{project.name}</h3>
                            <p>{project.description?.trim() || "No scope summary yet."}</p>
                          </div>
                          <Link href={`/projects/${project.id}?householdId=${householdId}`} className="button button--ghost button--sm">
                            Open
                          </Link>
                        </div>
                        <div className="project-portfolio-card__metrics">
                          <div className="project-metric">
                            <span>Target</span>
                            <strong>{project.status === "completed" ? formatDate(project.actualEndDate, "Completed") : getTargetLabel(project)}</strong>
                          </div>
                          <div className="project-metric">
                            <span>Budget</span>
                            <strong>{formatCurrency(project.committedCost, "$0.00")}</strong>
                          </div>
                          <div className="project-metric">
                            <span>Progress</span>
                            <strong>{project.percentComplete}% complete</strong>
                          </div>
                          <div className="project-metric">
                            <span>Materials</span>
                            <strong>{getCoverageLabel(project)}</strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        aria-label="Select all projects"
                        checked={allSelected}
                        onChange={(e) =>
                          toggleGroup(portfolioProjects.map((p) => p.id), e.target.checked)
                        }
                      />
                    </th>
                    <th>Project</th>
                    <th>Health</th>
                    <th>Plan</th>
                    <th>Budget</th>
                    <th>Materials</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioProjects.map((project: PortfolioProject) => {
                    const tone = getRiskTone(project);
                    const subtitle =
                      project.description && project.description.length > 70
                        ? `${project.description.slice(0, 70)}...`
                        : project.description;
                    const ov = optimistic[project.id] ?? {};
                    const name = ov.name ?? project.name;
                    const status = (ov.status ?? project.status) as ProjectStatus;

                    return (
                      <tr
                        key={project.id}
                        className={`row--${tone === "neutral" ? "default" : tone}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${project.name}`}
                            checked={isSelected(project.id)}
                            onChange={() => toggleItem(project.id)}
                          />
                        </td>
                        <td>
                          <Link
                            href={`/projects/${project.id}?householdId=${householdId}`}
                            className="data-table__link"
                          >
                            {name}
                          </Link>
                          <div className="data-table__secondary">
                            {project.depth > 0 ? "Sub-project · " : ""}
                            {subtitle ?? "No scope summary yet."}
                          </div>
                        </td>
                        <td>
                          <div className="project-portfolio-health">
                            <ClickToEditSelect
                              value={status}
                              options={STATUS_OPTIONS}
                              disabled={saving.has(`${project.id}:status`)}
                              aria-label={`Edit status of ${project.name}`}
                              renderValue={(v) => (
                                <span className={`pill ${STATUS_CHIP_CLASS[v as ProjectStatus] ?? ""}`}>
                                  {STATUS_LABELS[v as ProjectStatus] ?? v}
                                </span>
                              )}
                              onSave={(v) => { void handleSave(project.id, "status", v); }}
                            />
                            <div className="data-table__secondary">{getRiskLabel(project)}</div>
                          </div>
                        </td>
                        <td>
                          <strong>{project.status === "completed" ? formatDate(project.actualEndDate, "Completed") : getTargetLabel(project)}</strong>
                          <div className="data-table__secondary">
                            {project.completedPhaseCount} of {project.phaseCount} phases · {project.taskCount} tasks
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <ProjectProgressBar
                              phases={project.phaseProgress ?? []}
                              totalTaskCount={project.taskCount}
                              completedTaskCount={project.completedTaskCount}
                              showLabel={true}
                            />
                          </div>
                        </td>
                        <td>
                          <strong>{formatCurrency(project.committedCost, "$0.00")}</strong>
                          {project.totalBudgeted && project.totalBudgeted > 0 ? (
                            <div className="data-table__secondary">
                              {Math.round((project.committedCost / project.totalBudgeted) * 100)}% of{" "}
                              {formatCurrency(project.totalBudgeted, "$0")}
                            </div>
                          ) : (
                            <div className="data-table__secondary">No budget set</div>
                          )}
                        </td>
                        <td>
                          <strong>{getCoverageLabel(project)}</strong>
                          <div className="data-table__secondary">
                            {project.inventoryLineCount > 0 ? `${project.totalInventoryAllocated} of ${project.totalInventoryNeeded} allocated` : "No materials tracked yet"}
                          </div>
                        </td>
                        <td>{formatDate(project.updatedAt, "Recently")}</td>
                        <td>
                          <div className="data-table__row-actions">
                            <Link
                              href={`/projects/${project.id}?householdId=${householdId}`}
                              className="button button--sm button--ghost"
                            >
                              Overview
                            </Link>
                            <Link
                              href={`/projects/${project.id}/phases?householdId=${householdId}`}
                              className="button button--sm button--ghost"
                            >
                              Plan
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
