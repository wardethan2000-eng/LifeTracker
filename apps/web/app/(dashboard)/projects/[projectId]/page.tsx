import Link from "next/link";
import type {
  ProjectPhaseProgress,
} from "@lifekeeper/types";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  addProjectAssetAction,
  removeProjectAssetAction,
} from "../../../actions";
import { Card } from "../../../../components/card";
import { ProjectLinkedInventoryCard } from "../../../../components/project-linked-inventory-card";
import { ProjectProgressBar } from "../../../../components/project-progress-bar";
import { ProjectSupplyStatCards } from "../../../../components/project-supply-stat-cards";
import { AttachmentSection } from "../../../../components/attachment-section";
import {
  ApiError,
  getHouseholdAssets,
  getMe,
  getProjectDetail,
} from "../../../../lib/api";
import { formatCurrency } from "../../../../lib/formatters";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const projectStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

const assetRelationshipLabels: Record<string, string> = {
  target: "Works on",
  produces: "Will create",
  consumes: "Consumes",
  supports: "Supports"
};

const assetRelationshipSortOrder: Record<string, number> = {
  target: 0,
  produces: 1,
  supports: 2,
  consumes: 3
};

const hobbyStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "active":
      return "pill pill--success";
    case "paused":
      return "pill pill--warning";
    case "archived":
      return "pill pill--muted";
    default:
      return "pill";
  }
};

const ProjectSupplyStatCardsSkeleton = (): JSX.Element => (
  <>
    <div className="stat-card">
      <div className="skeleton-bar" style={{ width: 80, height: 12, marginBottom: 10 }} />
      <div className="skeleton-bar" style={{ width: 90, height: 28, marginBottom: 8 }} />
      <div className="skeleton-bar" style={{ width: 180, height: 12 }} />
    </div>
    <div className="stat-card stat-card--danger">
      <div className="skeleton-bar" style={{ width: 120, height: 12, marginBottom: 10 }} />
      <div className="skeleton-bar" style={{ width: 110, height: 28, marginBottom: 8 }} />
      <div className="skeleton-bar" style={{ width: 220, height: 12 }} />
    </div>
  </>
);

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps): Promise<JSX.Element> {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <p>No household found. <Link href="/projects" className="text-link">Go back to projects</Link>.</p>
      );
    }

    const project = await getProjectDetail(household.id, routeParams.projectId);
    const qs = `?householdId=${household.id}`;
    const base = `/projects/${project.id}`;

    const quickTodos = project.tasks.filter((task) => task.taskType === "quick");
    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const completedQuickTodoCount = quickTodos.filter((task) => task.isCompleted).length;
    const fullTasks = project.tasks.filter((task) => task.taskType !== "quick");
    const remainingEstimatedHours = fullTasks
      .filter((task) => task.status !== "completed" && task.status !== "skipped")
      .reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const blockedTasks = fullTasks.filter((task) => task.isBlocked);
    const criticalPathTasks = fullTasks.filter((task) => task.isCriticalPath);
    const unphasedTasks = fullTasks.filter((task) => task.phaseId === null);
    const completedFullTaskCount = fullTasks.filter((task) => task.status === "completed").length;
    const completedTaskCount = completedQuickTodoCount + completedFullTaskCount;
    const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
    const phaseCount = project.phases.length;
    const totalTaskCount = project.tasks.length;
    const remainingTaskCount = totalTaskCount - completedTaskCount;
    const percentComplete = totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);
    const activePhase = project.phases.find((phase) => phase.status === "in_progress");
    const workspacePhase = activePhase ?? project.phases[0] ?? null;
    const workspaceHref = workspacePhase
      ? `${base}/phases${qs}&focusPhaseId=${workspacePhase.id}#phase-${workspacePhase.id}`
      : `${base}/phases${qs}`;
    const workspaceActionLabel = activePhase
      ? `Continue ${activePhase.name}`
      : workspacePhase
        ? `Open ${workspacePhase.name}`
        : "Set up first phase";
    const phaseProgress: ProjectPhaseProgress[] = project.phases.map((phase) => ({
      name: phase.name,
      status: phase.status,
      taskCount: phase.taskCount,
      completedTaskCount: phase.completedTaskCount
    }));

    if (unphasedTasks.length > 0) {
      phaseProgress.push({
        name: "Unphased",
        status: "in_progress",
        taskCount: unphasedTasks.length,
        completedTaskCount: unphasedTasks.filter((task) => task.status === "completed").length
      });
    }

    return (
      <div className="resource-layout">
        <div className="resource-layout__primary">
          <section id="project-workspace" className="panel panel--studio project-workspace">
            <div className="panel__header mode-workspace__header">
              <div>
                <h2>Overview</h2>
                <p className="mode-workspace__subcopy">
                  {workspacePhase
                    ? `Start in ${workspacePhase.name}, then open the dedicated phase, task, note, and supply pages from the tabs above.`
                    : "This project does not have a phase yet. Start by creating one so the project can move into execution."}
                </p>
              </div>
              <div className="mode-workspace__header-meta">
                <span className="pill pill--info">{projectStatusLabels[project.status] ?? project.status}</span>
                <span className="pill">{percentComplete}% complete</span>
                {workspacePhase ? <span className="pill pill--muted">Phase: {workspacePhase.name}</span> : null}
              </div>
            </div>
            <div className="panel__body--padded project-workspace__body">
              <div className="project-workspace__summary mode-stack">
                <div className="mode-kv-grid">
                  <div>
                    <span>Task backlog</span>
                    <strong>{remainingTaskCount} remaining</strong>
                  </div>
                  <div>
                    <span>Phase progress</span>
                    <strong>{completedPhaseCount} of {phaseCount} complete</strong>
                  </div>
                  <div>
                    <span>Budget</span>
                    <strong>{project.budgetAmount ? formatCurrency(project.budgetAmount, "$0.00") : "Not set"}</strong>
                  </div>
                  <div>
                    <span>Spent</span>
                    <strong>{formatCurrency(totalSpent, "$0.00")}</strong>
                  </div>
                  <div>
                    <span>Labor left</span>
                    <strong>{remainingEstimatedHours.toFixed(1)}h</strong>
                  </div>
                  <div>
                    <span>Execution flags</span>
                    <strong>{blockedTasks.length} blocked / {criticalPathTasks.length} critical</strong>
                  </div>
                  {project.treeStats ? (
                    <div>
                      <span>Project tree</span>
                      <strong>{project.treeStats.descendantProjectCount} sub-project{project.treeStats.descendantProjectCount === 1 ? "" : "s"}</strong>
                    </div>
                  ) : null}
                </div>
                <ProjectProgressBar
                  phases={phaseProgress}
                  totalTaskCount={totalTaskCount}
                  completedTaskCount={completedTaskCount}
                />
                <div className="stats-row project-workspace__supply">
                  <Suspense fallback={<ProjectSupplyStatCardsSkeleton />}>
                    <ProjectSupplyStatCards householdId={household.id} projectId={project.id} />
                  </Suspense>
                </div>
              </div>

              <div className="project-workspace__actions">
                <Link href={workspaceHref} className="button button--primary">{workspaceActionLabel}</Link>
                <Link href={`${base}/tasks${qs}`} className="button button--ghost">Tasks</Link>
                <Link href={`${base}/notes${qs}`} className="button button--ghost">Notes</Link>
                <Link href={`${base}/entries${qs}`} className="button button--ghost">Journal</Link>
                <Link href={`${base}/supplies${qs}`} className="button button--ghost">Inventory</Link>
              </div>
            </div>
          </section>

          {project.childProjects && project.childProjects.length > 0 ? (
            <section className="panel" style={{ marginTop: "24px" }}>
              <div className="panel__header">
                <h2>Sub-projects ({project.childProjects.length})</h2>
                <Link href={`/projects/new${qs}&parentProjectId=${project.id}`} className="button button--ghost button--sm">+ Add Sub-project</Link>
              </div>
              <div className="panel__body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Budget</th>
                      <th>Spent</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.childProjects.map((child) => (
                      <tr key={child.id}>
                        <td>
                          <div className="data-table__primary">{child.name}</div>
                          {child.childProjectCount > 0 ? (
                            <div className="data-table__secondary">{child.childProjectCount} sub-project{child.childProjectCount === 1 ? "" : "s"}</div>
                          ) : null}
                        </td>
                        <td><span className="pill">{projectStatusLabels[child.status] ?? child.status}</span></td>
                        <td>{child.percentComplete}% ({child.completedTaskCount}/{child.taskCount})</td>
                        <td>{formatCurrency(child.budgetAmount, "No budget")}</td>
                        <td>{formatCurrency(child.totalSpent, "$0.00")}</td>
                        <td><Link href={`/projects/${child.id}${qs}`} className="data-table__link">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <div className="resource-layout__aside">
          <Card title="Workspace Snapshot">
            <dl className="schedule-meta">
              <div><dt>Status</dt><dd><span className="pill">{projectStatusLabels[project.status] ?? project.status}</span></dd></div>
              <div><dt>Task progress</dt><dd>{percentComplete}% — {completedTaskCount}/{totalTaskCount} tasks</dd></div>
              <div><dt>Next focus</dt><dd>{workspacePhase ? workspacePhase.name : "Create first phase"}</dd></div>
              <div><dt>Budget</dt><dd>{project.budgetAmount ? formatCurrency(project.budgetAmount, "$0.00") : "Not set"}</dd></div>
              <div><dt>Spent</dt><dd>{formatCurrency(totalSpent, "$0.00")}</dd></div>
              <div><dt>Labor left</dt><dd>{remainingEstimatedHours.toFixed(1)}h remaining</dd></div>
              <div><dt>Flags</dt><dd>{blockedTasks.length} blocked / {criticalPathTasks.length} critical</dd></div>
            </dl>
            <div className="project-aside-actions">
              <Link href={workspaceHref} className="button button--primary button--sm">{workspaceActionLabel}</Link>
              <Link href={`${base}/entries${qs}`} className="button button--ghost button--sm">Journal</Link>
            </div>
          </Card>

          <Suspense fallback={<LinkedAssetsSkeleton linkedAssetCount={project.assets.length} />}>
            <ProjectLinkedAssetsCard householdId={household.id} project={project} />
          </Suspense>

          <Suspense fallback={<LinkedInventorySkeleton />}>
            <ProjectLinkedInventoryCard householdId={household.id} projectId={project.id} />
          </Suspense>

          <Card title="Project Files">
            <AttachmentSection
              householdId={household.id}
              entityType="project"
              entityId={project.id}
              label=""
            />
          </Card>

          {project.hobbyLinks.length > 0 ? (
            <Card title="Linked Hobbies">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {project.hobbyLinks.map((link) => (
                  <div
                    key={link.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      paddingBottom: "10px",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      <Link href={`/hobbies/${link.hobbyId}`} className="data-table__link">{link.hobbyName}</Link>
                      <span className={hobbyStatusBadgeClass(link.hobbyStatus)}>{link.hobbyStatus}</span>
                      {link.hobbyType ? <span className="pill">{link.hobbyType}</span> : null}
                    </div>
                    {link.notes ? <div className="data-table__secondary">{link.notes}</div> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load project: {error.message}</p>
          </div>
        </div>
      );
    }

    throw error;
  }
}

/* ── Sidebar async panels ── */

const LinkedAssetsSkeleton = ({ linkedAssetCount }: { linkedAssetCount: number }): JSX.Element => (
  <Card title={`Linked Assets (${linkedAssetCount})`}>
    <div style={{ display: "grid", gap: "10px" }}>
      {[1, 2, 3].map((row) => (
        <div key={row} className="skeleton-bar" style={{ width: "100%", height: 42, borderRadius: 10 }} />
      ))}
    </div>
  </Card>
);

const LinkedInventorySkeleton = (): JSX.Element => (
  <Card title="Linked Inventory">
    <dl className="schedule-meta">
      {[1, 2, 3, 4, 5, 6, 7].map((row) => (
        <div key={row}><dt><div className="skeleton-bar" style={{ width: 100, height: 12 }} /></dt><dd><div className="skeleton-bar" style={{ width: 110, height: 14 }} /></dd></div>
      ))}
    </dl>
  </Card>
);

async function ProjectLinkedAssetsCard({
  householdId,
  project
}: {
  householdId: string;
  project: Awaited<ReturnType<typeof getProjectDetail>>;
}): Promise<JSX.Element> {
  const householdAssets = await getHouseholdAssets(householdId);
  const linkedAssetIds = new Set(project.assets.map((asset) => asset.assetId));
  const availableAssets = householdAssets.filter((asset) => !linkedAssetIds.has(asset.id));

  return (
    <Card title={`Linked Assets (${project.assets.length})`}>
      <form action={addProjectAssetAction} style={{ marginBottom: 8 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={project.id} />
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="field">
            <span>Asset</span>
            <select name="assetId" required defaultValue="">
              <option value="" disabled>Select an asset</option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name} · {asset.category}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Relationship</span>
            <select name="relationship" defaultValue="target">
              <option value="target">This project works on this asset</option>
              <option value="produces">This project will create this asset</option>
              <option value="consumes">This project uses/consumes this asset</option>
              <option value="supports">This asset supports the project</option>
            </select>
          </label>
          <label className="field">
            <span>Role / Description</span>
            <input name="role" placeholder="Primary, affected system, haul vehicle…" />
          </label>
          <button type="submit" className="button button--sm" disabled={availableAssets.length === 0}>Link Asset</button>
        </div>
      </form>
      {project.assets.length === 0 ? (
        <p className="panel__empty">No assets linked yet.</p>
      ) : (() => {
        const sorted = [...project.assets].sort((left, right) => {
          const leftOrder = assetRelationshipSortOrder[left.relationship ?? "target"] ?? 99;
          const rightOrder = assetRelationshipSortOrder[right.relationship ?? "target"] ?? 99;
          return leftOrder - rightOrder;
        });
        let previousRelationship: string | null = null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sorted.map((asset) => {
              const relationship = asset.relationship ?? "target";
              const showHeader = relationship !== previousRelationship;
              previousRelationship = relationship;

              return (
                <div key={asset.id}>
                  {showHeader && (
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 0 4px", borderTop: "1px solid var(--border)" }}>
                      {assetRelationshipLabels[relationship] ?? relationship}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      {asset.asset ? (
                        <Link href={`/assets/${asset.asset.id}`} className="data-table__link">{asset.asset.name}</Link>
                      ) : "Unknown asset"}
                      {relationship === "produces" && (
                        <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontStyle: "italic", marginTop: 2 }}>Asset will be created when this project completes</div>
                      )}
                      {asset.role ? <div style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{asset.role}</div> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span className="status-badge" style={{ fontSize: "0.72rem" }}>{assetRelationshipLabels[relationship] ?? relationship}</span>
                      <form action={removeProjectAssetAction}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="projectAssetId" value={asset.id} />
                        <button type="submit" className="button button--ghost button--sm">Remove</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </Card>
  );
}
