"use client";

import type { ProjectPortfolioItem, ProjectStatus } from "@lifekeeper/types";
import { projectStatusValues } from "@lifekeeper/types";
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
import { ClickToEdit } from "./click-to-edit";
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
          <h2>Project Portfolio ({portfolioProjects.length})</h2>
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
                {portfolioProjects.map((project: PortfolioProject) => {
                  const tone = getRiskTone(project);
                  const subtitle =
                    project.description && project.description.length > 50
                      ? `${project.description.slice(0, 50)}...`
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
                        <ClickToEdit
                          value={name}
                          required
                          disabled={saving.has(`${project.id}:name`)}
                          aria-label={`Edit name of ${project.name}`}
                          onSave={(v) => { void handleSave(project.id, "name", v); }}
                        />
                        <div className="data-table__secondary">
                          {project.depth > 0 && (
                            <span style={{ marginRight: 6, opacity: 0.7 }}>Sub-project ·</span>
                          )}
                          {tone !== "neutral" && tone !== "accent" ? (
                            <strong
                              style={{
                                color: `var(--${tone}-text, var(--${tone}))`,
                              }}
                            >
                              {getRiskLabel(project)}
                            </strong>
                          ) : (
                            subtitle ?? getRiskLabel(project)
                          )}
                        </div>
                      </td>
                      <td>
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
                      </td>
                      <td>
                        <ProjectProgressBar
                          phases={project.phaseProgress ?? []}
                          totalTaskCount={project.taskCount}
                          completedTaskCount={project.completedTaskCount}
                          showLabel={true}
                        />
                      </td>
                      <td>
                        <strong>
                          {project.status === "completed"
                            ? formatDate(project.actualEndDate, "Completed")
                            : getTargetLabel(project)}
                        </strong>
                        <div className="data-table__secondary">
                          {project.completedPhaseCount} of {project.phaseCount} phases
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
                          <div className="data-table__secondary">Unbudgeted</div>
                        )}
                      </td>
                      <td>
                        <strong>{getCoverageLabel(project)}</strong>
                        <div className="data-table__secondary">
                          {project.inventoryLineCount} lines
                        </div>
                      </td>
                      <td>{formatDate(project.updatedAt, "Recently")}</td>
                      <td>
                        <div className="data-table__row-actions">
                          <Link
                            href={`/projects/${project.id}/tasks?householdId=${householdId}`}
                            className="button button--sm button--ghost"
                          >
                            Tasks
                          </Link>
                          <Link
                            href={`/projects/${project.id}?householdId=${householdId}`}
                            className="button button--sm button--primary"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Material Rollups — no checkboxes */}
      <section className="panel">
        <div className="panel__header">
          <h2>Material Rollups</h2>
        </div>
        <div className="panel__body">
          {portfolioProjects.filter((p) => p.inventoryLineCount > 0).length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <EmptyState
                icon="box"
                title="No material requirements yet"
                message="Link inventory items to project tasks to track material plans here."
              />
            </div>
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
                {portfolioProjects
                  .filter((p) => p.inventoryLineCount > 0)
                  .map((project) => (
                    <tr key={project.id}>
                      <td>
                        <div className="data-table__primary">{project.name}</div>
                        <div className="data-table__secondary">{getCoverageLabel(project)}</div>
                      </td>
                      <td>{project.inventoryLineCount}</td>
                      <td>
                        {project.totalInventoryAllocated} / {project.totalInventoryNeeded}
                      </td>
                      <td>{project.totalInventoryRemaining}</td>
                      <td>{formatCurrency(project.plannedInventoryCost, "$0.00")}</td>
                      <td>
                        <div className="data-table__row-actions">
                          <Link
                            href={`/projects/${project.id}?householdId=${householdId}`}
                            className="button button--sm button--ghost"
                          >
                            Review
                          </Link>
                        </div>
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
