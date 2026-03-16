import Link from "next/link";
import type {
  InventoryItemSummary,
  ProjectPhaseProgress,
  ProjectPhaseSummary,
  ProjectPhaseSupply
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  addProjectAssetAction,
  createProjectNoteAction,
  createProjectPhaseAction,
  createProjectPhaseSupplyAction,
  createProjectExpenseAction,
  createProjectTaskAction,
  createQuickTodoAction,
  deleteProjectAction,
  deleteProjectExpenseAction,
  deleteProjectNoteAction,
  deleteProjectTaskAction,
  promoteTaskAction,
  removeProjectAssetAction,
  toggleProjectNotePinAction,
  toggleQuickTodoAction,
  updateProjectAction,
  updateProjectAssetAction,
  updateProjectExpenseAction,
  updateProjectTaskAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { Card } from "../../../components/card";
import { CompactBudgetPreview } from "../../../components/compact-budget-preview";
import { CompactPhasePreview } from "../../../components/compact-phase-preview";
import { CompactSupplyPreview } from "../../../components/compact-supply-preview";
import { CompactTaskPreview } from "../../../components/compact-task-preview";
import { ExpandableCard } from "../../../components/expandable-card";
import { ProjectBudgetBreakdown } from "../../../components/project-budget-breakdown";
import { ProjectChecklist } from "../../../components/project-checklist";
import { ProjectProgressBar } from "../../../components/project-progress-bar";
import { ProjectShoppingListItemActions } from "../../../components/project-shopping-list-item-actions";
import { ProjectSupplyRollupActions } from "../../../components/project-supply-rollup-actions";
import { ProjectCoreFormFields } from "../../../components/project-core-form-fields";
import { ProjectPhaseTimeline } from "../../../components/project-phase-timeline";
import { AttachmentSection } from "../../../components/attachment-section";
import {
  createTaskChecklistItemAction,
  deleteTaskChecklistItemAction,
  updateTaskChecklistItemAction
} from "../../actions";
import {
  ApiError,
  getHouseholdAssets,
  getHouseholdInventory,
  getHouseholdMembers,
  getProjectBudgetAnalysis,
  getHouseholdServiceProviders,
  getMe,
  getProjectDetail,
  getProjectNotes,
  getProjectPhaseDetails,
  getProjectShoppingList
} from "../../../lib/api";
import { formatCurrency, formatDate } from "../../../lib/formatters";

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

const taskStatusOptions = ["pending", "in_progress", "completed", "skipped"] as const;
const taskStatusLabels: Record<(typeof taskStatusOptions)[number], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

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

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps): Promise<JSX.Element> {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;
  const focusedPhaseId = typeof query.focusPhaseId === "string" ? query.focusPhaseId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Project Detail</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/projects" className="text-link">Go back to projects</Link>.</p>
          </div>
        </AppShell>
      );
    }

    const [project, householdAssets, householdMembers, householdInventory, serviceProviders, projectNotes, projectBudgetAnalysis] = await Promise.all([
      getProjectDetail(household.id, routeParams.projectId),
      getHouseholdAssets(household.id),
      getHouseholdMembers(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdServiceProviders(household.id),
      getProjectNotes(household.id, routeParams.projectId),
      getProjectBudgetAnalysis(household.id, routeParams.projectId).catch(() => null)
    ]);

    const phaseDetails = await getProjectPhaseDetails(household.id, project.id);
    const shoppingList = await getProjectShoppingList(household.id, project.id);
    const phaseNameLookup = new Map(project.phases.map((phase) => [phase.id, phase.name]));
    const budgetCategoryLookup = new Map(project.budgetCategories.map((category) => [category.id, category.name]));
    const inventoryItemLookup = new Map(householdInventory.items.map((item) => [item.id, item]));
    const linkedAssetIds = new Set(project.assets.map((asset) => asset.assetId));
    const availableAssets = householdAssets.filter((asset) => !linkedAssetIds.has(asset.id));
    const quickTodos = project.tasks.filter((task) => task.taskType === "quick");
    const fullTasks = project.tasks.filter((task) => task.taskType !== "quick");
    const unphasedTasks = fullTasks.filter((task) => task.phaseId === null);
    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const completedQuickTodoCount = quickTodos.filter((task) => task.isCompleted).length;
    const completedFullTaskCount = fullTasks.filter((task) => task.status === "completed").length;
    const completedTaskCount = completedQuickTodoCount + completedFullTaskCount;
    const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
    const phaseCount = project.phases.length;
    const totalTaskCount = project.tasks.length;
    const percentComplete = totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);
    const activePhase = project.phases.find((phase) => phase.status === "in_progress");
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

    const allSupplies = phaseDetails.flatMap((phase) => phase.supplies);
    const totalSupplyLines = allSupplies.length;
    const totalSuppliesProcured = allSupplies.filter((supply) => supply.isProcured).length;
    const totalSuppliesStaged = allSupplies.filter((supply) => supply.isStaged).length;
    const estimatedProcurementCost = allSupplies.reduce((sum, supply) => sum + ((supply.estimatedUnitCost ?? 0) * supply.quantityNeeded), 0);
    const actualProcurementCost = allSupplies.reduce((sum, supply) => {
      const basis = supply.isProcured ? Math.max(supply.quantityOnHand, supply.quantityNeeded) : supply.quantityOnHand;
      return sum + ((supply.actualUnitCost ?? 0) * basis);
    }, 0);
    const remainingProcurementCost = allSupplies.reduce((sum, supply) => {
      const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
      return sum + ((supply.estimatedUnitCost ?? 0) * quantityRemaining);
    }, 0);
    const inventoryLinkedSupplyCount = allSupplies.filter((supply) => supply.inventoryItemId !== null).length;
    const inventoryCoveredSupplyCount = allSupplies.filter((supply) => (
      supply.inventoryItemId !== null
      && (householdInventory.items.find((item) => item.id === supply.inventoryItemId)?.quantityOnHand ?? 0) >= Math.max(supply.quantityNeeded - supply.quantityOnHand, 0)
    )).length;

    return (
      <AppShell activePath="/projects">
        <header className="page-header">
          <div>
            {project.breadcrumbs && project.breadcrumbs.length > 1 && (
              <nav className="project-breadcrumbs" style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "0.82rem", color: "var(--ink-muted)", marginBottom: "4px" }}>
                {project.breadcrumbs.map((crumb, index) => (
                  <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {index > 0 && <span style={{ color: "var(--ink-muted)" }}>›</span>}
                    {index < project.breadcrumbs.length - 1 ? (
                      <Link href={`/projects/${crumb.id}?householdId=${household.id}`} className="text-link">{crumb.name}</Link>
                    ) : (
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>{crumb.name}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1>{project.name}</h1>
            <p style={{ marginTop: 6 }}>{project.description ?? "Organize the work by phase, track structured budgets, and stage supplies before execution starts."}</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/projects/new?householdId=${household.id}&parentProjectId=${project.id}`} className="button button--ghost">+ Sub-project</Link>
            <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">Back to Projects</Link>
          </div>
        </header>

        <div className="page-body">
          {project.treeStats && (
            <div className="note" style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.85rem", marginBottom: "12px" }}>
              <span><strong>Tree totals:</strong></span>
              <span>{project.treeStats.descendantProjectCount} sub-project{project.treeStats.descendantProjectCount === 1 ? "" : "s"}</span>
              <span>Budget: {formatCurrency(project.treeStats.treeBudgetTotal, "No budget")}</span>
              <span>Spent: {formatCurrency(project.treeStats.treeSpentTotal, "$0.00")}</span>
              <span>Tasks: {project.treeStats.treeCompletedTaskCount}/{project.treeStats.treeTaskCount} ({project.treeStats.treePercentComplete}%)</span>
            </div>
          )}

          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Status</span>
              <strong className="stat-card__value">{projectStatusLabels[project.status] ?? project.status}</strong>
              <span className="stat-card__sub">Start {formatDate(project.startDate, "not set")}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Task Progress</span>
              <ProjectProgressBar
                phases={phaseProgress}
                totalTaskCount={totalTaskCount}
                completedTaskCount={completedTaskCount}
              />
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Phases</span>
              <strong className="stat-card__value">{completedPhaseCount} / {phaseCount}</strong>
              <span className="stat-card__sub">{activePhase ? `Active: ${activePhase.name}` : "No active phase."}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Supplies</span>
              <strong className="stat-card__value">{totalSuppliesProcured} / {totalSupplyLines}</strong>
              <span className="stat-card__sub">{formatCurrency(remainingProcurementCost, "$0.00")} estimated remaining procurement cost</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Supplies Overview</span>
              <strong className="stat-card__value">{formatCurrency(estimatedProcurementCost, "$0.00")}</strong>
              <span className="stat-card__sub">{inventoryLinkedSupplyCount} linked to inventory, {inventoryCoveredSupplyCount} fully coverable from stock</span>
            </div>
          </section>

          {project.childProjects && project.childProjects.length > 0 && (
            <section className="panel" style={{ marginBottom: "24px" }}>
              <div className="panel__header">
                <h2>Sub-projects ({project.childProjects.length})</h2>
                <Link href={`/projects/new?householdId=${household.id}&parentProjectId=${project.id}`} className="button button--ghost button--sm">+ Add Sub-project</Link>
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
                          {child.childProjectCount > 0 && (
                            <div className="data-table__secondary">{child.childProjectCount} sub-project{child.childProjectCount === 1 ? "" : "s"}</div>
                          )}
                        </td>
                        <td><span className="pill">{projectStatusLabels[child.status] ?? child.status}</span></td>
                        <td>{child.percentComplete}% ({child.completedTaskCount}/{child.taskCount})</td>
                        <td>{formatCurrency(child.budgetAmount, "No budget")}</td>
                        <td>{formatCurrency(child.totalSpent, "$0.00")}</td>
                        <td><Link href={`/projects/${child.id}?householdId=${household.id}`} className="data-table__link">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="resource-layout">
            <div className="resource-layout__primary">
              <ProjectPhaseTimeline
                householdId={household.id}
                projectId={project.id}
                focusedPhaseId={focusedPhaseId}
                phases={project.phases}
                phaseDetails={phaseDetails}
                householdMembers={householdMembers}
                serviceProviders={serviceProviders}
                budgetCategories={project.budgetCategories}
                inventoryItems={householdInventory.items}
                addPhaseForm={(
                  <form action={createProjectPhaseAction}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="form-grid">
                      <label className="field field--full">
                        <span>New Phase Name</span>
                        <input name="name" placeholder="Demo & Prep, Rough-In, Finish Work" required />
                      </label>
                      <label className="field field--full">
                        <span>Description</span>
                        <textarea name="description" rows={2} placeholder="Define what belongs in this stage, what must be true before it starts, and how you know it is done." />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select name="status" defaultValue="pending">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="skipped">Skipped</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Budget Amount</span>
                        <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="0.00" />
                      </label>
                      <label className="field">
                        <span>Target End Date</span>
                        <input name="targetEndDate" type="date" />
                      </label>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 16 }}>
                      <button type="submit" className="button">Add Phase</button>
                    </div>
                  </form>
                )}
              />

              <ExpandableCard
                title="Project Settings"
                modalTitle="Project Settings"
                previewContent={
                  <div className="compact-preview">
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span className="compact-preview__pill">{projectStatusLabels[project.status] ?? project.status}</span>
                      {project.startDate ? <span className="compact-preview__pill">Starts {formatDate(project.startDate, "—")}</span> : null}
                      {project.targetEndDate ? <span className="compact-preview__pill">Target {formatDate(project.targetEndDate, "—")}</span> : null}
                      {project.budgetAmount ? <span className="compact-preview__pill">{formatCurrency(project.budgetAmount, "$0")} budget</span> : null}
                    </div>
                  </div>
                }
              >
                <div>
                  <form action={updateProjectAction} className="workbench-form">
                    <ProjectCoreFormFields householdId={household.id} project={project} includeProjectId />
                    <div className="inline-actions" style={{ marginTop: 16 }}>
                      <button type="submit" className="button">Save Project</button>
                    </div>
                  </form>
                  <form action={deleteProjectAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button type="submit" className="button button--danger">Delete Project</button>
                  </form>
                </div>
              </ExpandableCard>

              <ExpandableCard
                title={`Quick To-dos (${quickTodos.length})`}
                modalTitle="Quick To-dos"
                previewContent={
                  <span className="data-table__secondary">
                    {completedQuickTodoCount} of {quickTodos.length} done
                  </span>
                }
              >
                <div>
                  <form action={createQuickTodoAction} className="quick-todo-form">
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <input
                      name="title"
                      placeholder="Add a to-do…"
                      required
                      className="quick-todo-form__title"
                    />
                    {project.phases.length > 0 && (
                      <select name="phaseId" defaultValue="" className="quick-todo-form__phase">
                        <option value="">No phase</option>
                        {project.phases.map((phase) => (
                          <option key={phase.id} value={phase.id}>{phase.name}</option>
                        ))}
                      </select>
                    )}
                    <button type="submit" className="button button--sm">Add</button>
                  </form>
                  {quickTodos.length === 0 ? (
                    <p className="panel__empty">No quick to-dos yet. Use the field above to add lightweight checkbox items.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {quickTodos.map((todo) => (
                        <div
                          key={todo.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border)",
                            minHeight: "36px"
                          }}
                        >
                          <form action={toggleQuickTodoAction} style={{ display: "contents" }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="taskId" value={todo.id} />
                            <input type="hidden" name="isCompleted" value={todo.isCompleted ? "false" : "true"} />
                            <button
                              type="submit"
                              style={{
                                width: "18px",
                                height: "18px",
                                flexShrink: 0,
                                border: "2px solid var(--border)",
                                borderRadius: "3px",
                                background: todo.isCompleted ? "var(--accent)" : "var(--surface)",
                                cursor: "pointer",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "11px",
                                lineHeight: 1
                              }}
                              title={todo.isCompleted ? "Mark incomplete" : "Mark complete"}
                            >
                              {todo.isCompleted ? "✓" : ""}
                            </button>
                          </form>
                          <span
                            style={{
                              flex: 1,
                              fontSize: "0.875rem",
                              color: todo.isCompleted ? "var(--ink-muted)" : "var(--ink)",
                              textDecoration: todo.isCompleted ? "line-through" : "none"
                            }}
                          >
                            {todo.title}
                          </span>
                          {todo.phaseId ? (
                            <span className="pill pill--muted" style={{ fontSize: "0.75rem" }}>
                              {phaseNameLookup.get(todo.phaseId) ?? ""}
                            </span>
                          ) : null}
                          <form action={promoteTaskAction} style={{ display: "inline" }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="taskId" value={todo.id} />
                            <button type="submit" className="button button--ghost button--small" title="Promote to full task">→ Full task</button>
                          </form>
                          <form action={deleteProjectTaskAction} style={{ display: "inline" }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="taskId" value={todo.id} />
                            <button type="submit" className="button button--ghost button--small button--danger">Delete</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ExpandableCard>

              <ExpandableCard
                title="Tasks"
                modalTitle="Tasks"
                previewContent={<CompactTaskPreview tasks={fullTasks} />}
              >
                <div>
                  <div style={{ marginBottom: 20 }}>
                    <form action={createProjectTaskAction}>
                      <input type="hidden" name="householdId" value={household.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <div className="form-grid">
                        <label className="field field--full">
                          <span>Task Title</span>
                          <input name="title" placeholder="General task not assigned to a phase yet" required />
                        </label>
                        <label className="field field--full">
                          <span>Description</span>
                          <textarea name="description" rows={2} placeholder="Why this is still unphased, or what needs to be decided before slotting it into the timeline." />
                        </label>
                        <label className="field">
                          <span>Status</span>
                          <select name="status" defaultValue="pending">
                            {taskStatusOptions.map((status) => (
                              <option key={status} value={status}>{taskStatusLabels[status]}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Assignee</span>
                          <select name="assignedToId" defaultValue="">
                            <option value="">Unassigned</option>
                            {householdMembers.map((member) => (
                              <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="inline-actions" style={{ marginTop: 16 }}>
                        <button type="submit" className="button">Add Task</button>
                      </div>
                    </form>
                  </div>
                  {unphasedTasks.length === 0 ? <p className="panel__empty">Every full task is assigned to a phase.</p> : null}
                  <div className="schedule-stack">
                    {unphasedTasks.map((task) => (
                      <UnphasedTaskCard
                        key={task.id}
                        householdId={household.id}
                        projectId={project.id}
                        task={task}
                        householdMembers={householdMembers}
                      />
                    ))}
                  </div>
                </div>
              </ExpandableCard>

              <ExpandableCard
                title="Research & Notes"
                modalTitle="Research & Notes"
                previewContent={
                  <span className="data-table__secondary">
                    {projectNotes.length} note{projectNotes.length !== 1 ? "s" : ""}
                    {projectNotes.filter((n) => n.isPinned).length > 0 ? ` · ${projectNotes.filter((n) => n.isPinned).length} pinned` : ""}
                  </span>
                }
              >
                <div>
                  <details style={{ marginBottom: 16 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, padding: "8px 0" }}>Add Note</summary>
                    <form action={createProjectNoteAction} style={{ marginTop: 12 }}>
                      <input type="hidden" name="householdId" value={household.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <div className="workbench-grid" style={{ marginBottom: 12 }}>
                        <label className="field">
                          <span className="field__label">Title *</span>
                          <input type="text" name="title" required maxLength={300} placeholder="Note title" />
                        </label>
                        <label className="field">
                          <span className="field__label">Category</span>
                          <select name="category" defaultValue="general">
                            <option value="research">Research</option>
                            <option value="reference">Reference</option>
                            <option value="decision">Decision</option>
                            <option value="measurement">Measurement</option>
                            <option value="general">General</option>
                          </select>
                        </label>
                        <label className="field">
                          <span className="field__label">Phase (optional)</span>
                          <select name="phaseId" defaultValue="">
                            <option value="">No phase</option>
                            {project.phases.map((phase) => (
                              <option key={phase.id} value={phase.id}>{phase.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field__label">URL (optional)</span>
                          <input type="url" name="url" placeholder="https://…" />
                        </label>
                      </div>
                      <label className="field" style={{ display: "block", marginBottom: 12 }}>
                        <span className="field__label">Body</span>
                        <textarea name="body" rows={5} placeholder="Markdown supported…" style={{ width: "100%", resize: "vertical" }} />
                      </label>
                      <div className="inline-actions">
                        <button type="submit" className="button">Save Note</button>
                      </div>
                    </form>
                  </details>
                  {projectNotes.length === 0 ? <p className="panel__empty">No notes yet. Add one above.</p> : null}
                  <div className="schedule-stack">
                    {projectNotes.map((note) => (
                      <div
                        key={note.id}
                        className="schedule-card"
                        style={note.isPinned ? { background: "var(--surface-accent)", borderLeft: "3px solid var(--accent)" } : undefined}
                      >
                        <div className="schedule-card__summary">
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 4 }}>
                            <span className="pill">{({ research: "Research", reference: "Reference", decision: "Decision", measurement: "Measurement", general: "General" } as Record<string, string>)[note.category] ?? note.category}</span>
                            {note.phaseName ? <span className="pill pill--muted">{note.phaseName}</span> : null}
                            {note.isPinned ? <span className="pill pill--accent">PINNED</span> : null}
                          </div>
                          <div className="data-table__primary">{note.title}</div>
                          {note.body ? (
                            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "8px 0 0", fontFamily: "inherit", fontSize: "0.875rem" }}>
                              {note.body.length > 400 ? `${note.body.slice(0, 400)}…` : note.body}
                            </pre>
                          ) : null}
                          {note.url ? (
                            <a href={note.url} target="_blank" rel="noopener noreferrer" className="text-link" style={{ display: "block", marginTop: 6, fontSize: "0.8125rem" }}>
                              {(() => { try { return new URL(note.url).hostname; } catch { return note.url; } })()}
                            </a>
                          ) : null}
                          <div className="data-table__secondary" style={{ marginTop: 8 }}>
                            {note.createdBy?.displayName ?? "Unknown"} · {formatDate(note.createdAt)}
                          </div>
                        </div>
                        <div className="inline-actions" style={{ marginTop: 8 }}>
                          <form action={toggleProjectNotePinAction} style={{ display: "inline" }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="noteId" value={note.id} />
                            <input type="hidden" name="isPinned" value={note.isPinned ? "false" : "true"} />
                            <button type="submit" className="button button--ghost button--small">
                              {note.isPinned ? "Unpin" : "Pin"}
                            </button>
                          </form>
                          <form action={deleteProjectNoteAction} style={{ display: "inline" }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="noteId" value={note.id} />
                            <button type="submit" className="button button--ghost button--small button--danger">Delete</button>
                          </form>
                        </div>
                        <AttachmentSection
                          householdId={household.id}
                          entityType="project_note"
                          entityId={note.id}
                          compact
                          label=""
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </ExpandableCard>

              <ExpandableCard
                title="Budget & Expenses"
                modalTitle="Budget & Expenses"
                previewContent={
                  <CompactBudgetPreview
                    budgetAmount={project.budgetAmount}
                    totalSpent={totalSpent}
                    categories={project.budgetCategories}
                    expenses={project.expenses}
                  />
                }
              >
                <div>
                  <ProjectBudgetBreakdown
                    householdId={household.id}
                    projectId={project.id}
                    projectBudgetAmount={project.budgetAmount}
                    categories={project.budgetCategories}
                    expenses={project.expenses}
                    phaseDetails={phaseDetails}
                  />
                  {projectBudgetAnalysis ? (
                    <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16, display: "grid", gap: 16 }}>
                      <div>
                        <h3>Variance Analysis</h3>
                        <p style={{ marginTop: 8 }}>
                          Variance: {formatCurrency(projectBudgetAnalysis.variance, "$0.00")}
                          {projectBudgetAnalysis.variancePercent !== null ? ` (${projectBudgetAnalysis.variancePercent.toFixed(1)}% ${projectBudgetAnalysis.variance >= 0 ? "under" : "over"} budget)` : ""}
                        </p>
                        {projectBudgetAnalysis.burnRate !== null ? (
                          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
                            Current burn rate: {formatCurrency(projectBudgetAnalysis.burnRate, "$0.00")}/day
                          </p>
                        ) : null}
                        {projectBudgetAnalysis.projectedTotalAtBurnRate !== null && project.targetEndDate ? (
                          <p style={{ marginTop: 8, color: "var(--ink-muted)" }}>
                            At current pace, projected total spend: {formatCurrency(projectBudgetAnalysis.projectedTotalAtBurnRate, "$0.00")} by {formatDate(project.targetEndDate)}
                            {project.budgetAmount !== null && projectBudgetAnalysis.projectedTotalAtBurnRate > project.budgetAmount ? (
                              <span className="concentration-pill" style={{ marginLeft: 8 }}>Tracking over budget</span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>

                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Phase Name</th>
                            <th>Budget</th>
                            <th>Actual</th>
                            <th>Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectBudgetAnalysis.byPhase.map((phase) => (
                            <tr key={phase.phaseId}>
                              <td>{phase.phaseName}</td>
                              <td>{formatCurrency(phase.budgetAmount, "No budget")}</td>
                              <td>{formatCurrency(phase.actualSpend, "$0.00")}</td>
                              <td style={{ color: phase.variance >= 0 ? "var(--success)" : "var(--danger)" }}>
                                {formatCurrency(phase.variance, "$0.00")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Category Name</th>
                            <th>Budget</th>
                            <th>Actual</th>
                            <th>Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectBudgetAnalysis.byCategory.map((category) => (
                            <tr key={category.categoryId}>
                              <td>{category.categoryName}</td>
                              <td>{formatCurrency(category.budgetAmount, "No budget")}</td>
                              <td>{formatCurrency(category.actualSpend, "$0.00")}</td>
                              <td style={{ color: category.variance >= 0 ? "var(--success)" : "var(--danger)" }}>
                                {formatCurrency(category.variance, "$0.00")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div className="schedule-stack">
                      {project.expenses.length === 0 ? <p className="panel__empty">No expenses tracked yet.</p> : null}
                      {project.expenses.map((expense) => (
                        <div key={expense.id} className="schedule-card">
                          <form action={updateProjectExpenseAction}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <div className="schedule-card__summary" style={{ marginBottom: 16 }}>
                              <div>
                                <div className="data-table__primary">{expense.description}</div>
                                <div className="data-table__secondary">
                                  Phase: {expense.phaseId ? (phaseNameLookup.get(expense.phaseId) ?? "Unknown phase") : "Unphased"}
                                  {" · "}
                                  Budget category: {expense.budgetCategoryId ? (budgetCategoryLookup.get(expense.budgetCategoryId) ?? "Unknown category") : "Uncategorized"}
                                </div>
                              </div>
                              <span className="pill">{formatCurrency(expense.amount, "$0.00")}</span>
                            </div>
                            <div className="form-grid">
                              <label className="field field--full"><span>Description</span><input name="description" defaultValue={expense.description} required /></label>
                              <label className="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required /></label>
                              <label className="field"><span>Freeform Category</span><input name="category" defaultValue={expense.category ?? ""} /></label>
                              <label className="field">
                                <span>Phase</span>
                                <select name="phaseId" defaultValue={expense.phaseId ?? ""}>
                                  <option value="">Unphased</option>
                                  {project.phases.map((phase) => (<option key={phase.id} value={phase.id}>{phase.name}</option>))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Budget Category</span>
                                <select name="budgetCategoryId" defaultValue={expense.budgetCategoryId ?? ""}>
                                  <option value="">None</option>
                                  {project.budgetCategories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Service Provider</span>
                                <select name="serviceProviderId" defaultValue={expense.serviceProviderId ?? ""}>
                                  <option value="">None</option>
                                  {serviceProviders.map((provider) => (<option key={provider.id} value={provider.id}>{provider.name}</option>))}
                                </select>
                              </label>
                              <label className="field"><span>Date</span><input name="date" type="date" defaultValue={toDateInputValue(expense.date)} /></label>
                              <label className="field field--full"><span>Notes</span><textarea name="notes" rows={2} defaultValue={expense.notes ?? ""} /></label>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 16 }}>
                              <button type="submit" className="button button--ghost">Save Expense</button>
                            </div>
                          </form>
                          <form action={deleteProjectExpenseAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <button type="submit" className="button button--danger">Delete Expense</button>
                          </form>
                          <AttachmentSection
                            householdId={household.id}
                            entityType="project_expense"
                            entityId={expense.id}
                            compact
                            label="Receipts"
                          />
                        </div>
                      ))}
                    </div>
                    <form action={createProjectExpenseAction} style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                      <input type="hidden" name="householdId" value={household.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <div className="form-grid">
                        <label className="field field--full"><span>Description</span><input name="description" placeholder="Project-wide expense" required /></label>
                        <label className="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.01" required /></label>
                        <label className="field">
                          <span>Phase</span>
                          <select name="phaseId" defaultValue="">
                            <option value="">Unphased</option>
                            {project.phases.map((phase) => (<option key={phase.id} value={phase.id}>{phase.name}</option>))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Budget Category</span>
                          <select name="budgetCategoryId" defaultValue="">
                            <option value="">None</option>
                            {project.budgetCategories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                          </select>
                        </label>
                      </div>
                      <div className="inline-actions" style={{ marginTop: 16 }}>
                        <button type="submit" className="button">Add Expense</button>
                      </div>
                    </form>
                  </div>
                </div>
              </ExpandableCard>

              <ExpandableCard
                title="Supplies"
                modalTitle="Supplies"
                previewContent={
                  <CompactSupplyPreview
                    supplies={allSupplies}
                    estimatedCost={estimatedProcurementCost}
                    remainingCost={remainingProcurementCost}
                  />
                }
              >
                <div>
                  {project.phases.length > 0 ? (
                    <ProjectSupplyQuickAddForm
                      householdId={household.id}
                      projectId={project.id}
                      phases={project.phases}
                      inventoryItems={householdInventory.items}
                    />
                  ) : null}
                  {allSupplies.length === 0 ? (
                    <p className="panel__empty">No supplies added yet. Expand a phase in the Phase Timeline to add supplies per phase.</p>
                  ) : (
                    <table className="workbench-table">
                      <thead>
                        <tr>
                          <th>Supply</th>
                          <th>Phase</th>
                          <th>Qty</th>
                          <th>Est. Cost</th>
                          <th>Procured</th>
                          <th>Staged</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSupplies.map((supply) => {
                          const phaseName = phaseNameLookup.get(supply.phaseId) ?? "—";
                          return (
                            <tr key={supply.id}>
                              <td>
                                <div className="data-table__primary">{supply.name}</div>
                                {supply.supplier ? <div className="data-table__secondary">{supply.supplier}</div> : null}
                              </td>
                              <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{phaseName}</td>
                              <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{supply.quantityOnHand}/{supply.quantityNeeded} {supply.unit}</td>
                              <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
                                {supply.estimatedUnitCost != null ? formatCurrency(supply.estimatedUnitCost * supply.quantityNeeded, "$0.00") : "—"}
                              </td>
                              <td>
                                {supply.isProcured
                                  ? <span className="status-chip status-chip--upcoming">Yes</span>
                                  : <span className="status-chip status-chip--overdue">No</span>}
                              </td>
                              <td>
                                {supply.isStaged
                                  ? <span className="status-chip status-chip--upcoming">Yes</span>
                                  : <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>No</span>}
                              </td>
                              <td>
                                <ProjectSupplyActions
                                  householdId={household.id}
                                  projectId={project.id}
                                  phaseId={supply.phaseId}
                                  supply={supply}
                                  inventoryItems={householdInventory.items}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </ExpandableCard>

              <Card title="Shopping List">
                {shoppingList.lineCount === 0 ? (
                  <p className="panel__empty">All supplies have been procured. Nothing on the shopping list.</p>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.85rem", color: "var(--ink-muted)", padding: "0 0 12px" }}>
                      <span>{shoppingList.lineCount} item{shoppingList.lineCount === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>{shoppingList.supplierCount} supplier{shoppingList.supplierCount === 1 ? "" : "s"}</span>
                      <span>·</span>
                      <span>~{formatCurrency(shoppingList.totalEstimatedCost, "$0.00")} estimated</span>
                    </div>
                    {shoppingList.groupedBySupplier.map((group) => (
                      <div key={group.supplierName} style={{ marginBottom: "16px" }}>
                        <div style={{ background: "var(--surface-alt)", padding: "8px 12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "0.92rem" }}>{group.supplierName}</strong>
                            {group.supplierUrl ? (
                              <a href={group.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-link" style={{ fontSize: "0.78rem" }}>↗ website</a>
                            ) : null}
                          </div>
                          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Subtotal: {formatCurrency(group.subtotal, "$0.00")}</span>
                        </div>
                        <table className="data-table" style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th>Supply</th>
                              <th>Qty Remaining</th>
                              <th>Unit Cost</th>
                              <th>Line Cost</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <div className="data-table__primary">{item.name}</div>
                                  <div className="data-table__secondary">{item.projectName} › {item.phaseName}</div>
                                </td>
                                <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{item.quantityRemaining} {item.unit}</td>
                                <td style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{item.estimatedUnitCost != null ? formatCurrency(item.estimatedUnitCost, "$0.00") : "—"}</td>
                                <td style={{ fontSize: "0.82rem" }}>{item.estimatedLineCost != null ? formatCurrency(item.estimatedLineCost, "$0.00") : "—"}</td>
                                <td>
                                  <ProjectShoppingListItemActions householdId={household.id} item={item} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </>
                )}
              </Card>
            </div>

            <div className="resource-layout__aside">
              <Card title="Project Status">
                <dl className="schedule-meta">
                  <div><dt>Status</dt><dd><span className="pill">{projectStatusLabels[project.status] ?? project.status}</span></dd></div>
                  <div><dt>Task progress</dt><dd>{percentComplete}% — {completedTaskCount}/{totalTaskCount} tasks</dd></div>
                  <div><dt>Phases</dt><dd>{completedPhaseCount} of {phaseCount} complete</dd></div>
                  {activePhase ? <div><dt>Active phase</dt><dd>{activePhase.name}</dd></div> : null}
                  <div><dt>Start date</dt><dd>{formatDate(project.startDate, "Not set")}</dd></div>
                  {project.targetEndDate ? <div><dt>Target end</dt><dd>{formatDate(project.targetEndDate, "—")}</dd></div> : null}
                  <div><dt>Budget</dt><dd>{project.budgetAmount ? formatCurrency(project.budgetAmount, "$0.00") : "Not set"}</dd></div>
                  <div><dt>Spent</dt><dd>{formatCurrency(totalSpent, "$0.00")}</dd></div>
                </dl>
              </Card>

              <Card title={`Linked Assets (${project.assets.length})`}>
                <form action={addProjectAssetAction} style={{ marginBottom: 8 }}>
                  <input type="hidden" name="householdId" value={household.id} />
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
                  const sorted = [...project.assets].sort((a, b) => {
                    const aOrder = assetRelationshipSortOrder[a.relationship ?? "target"] ?? 99;
                    const bOrder = assetRelationshipSortOrder[b.relationship ?? "target"] ?? 99;
                    return aOrder - bOrder;
                  });
                  let lastRelationship: string | null = null;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {sorted.map((asset) => {
                        const rel = asset.relationship ?? "target";
                        const showHeader = rel !== lastRelationship;
                        lastRelationship = rel;
                        return (
                          <div key={asset.id}>
                            {showHeader && (
                              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "8px 0 4px", borderTop: lastRelationship !== rel ? "1px solid var(--border)" : undefined }}>
                                {assetRelationshipLabels[rel] ?? rel}
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                              <div>
                                {asset.asset ? (
                                  <Link href={`/assets/${asset.asset.id}`} className="data-table__link">{asset.asset.name}</Link>
                                ) : "Unknown asset"}
                                {rel === "produces" && (
                                  <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontStyle: "italic", marginTop: 2 }}>Asset will be created when this project completes</div>
                                )}
                                {asset.role ? <div style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{asset.role}</div> : null}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                <span className="status-badge" style={{ fontSize: "0.72rem" }}>{assetRelationshipLabels[rel] ?? rel}</span>
                                <form action={removeProjectAssetAction}>
                                  <input type="hidden" name="householdId" value={household.id} />
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

              <Card title="Linked Inventory">
                <dl className="schedule-meta">
                  <div><dt>Supply lines</dt><dd>{totalSupplyLines}</dd></div>
                  <div><dt>Procured</dt><dd>{totalSuppliesProcured} / {totalSupplyLines}</dd></div>
                  <div><dt>Staged</dt><dd>{totalSuppliesStaged} / {totalSupplyLines}</dd></div>
                  <div><dt>Inventory-linked</dt><dd>{inventoryLinkedSupplyCount} lines</dd></div>
                  <div><dt>Covered from stock</dt><dd>{inventoryCoveredSupplyCount} fully covered</dd></div>
                  <div><dt>Est. procurement</dt><dd>{formatCurrency(estimatedProcurementCost, "$0.00")}</dd></div>
                  <div><dt>Remaining cost</dt><dd>{formatCurrency(remainingProcurementCost, "$0.00")}</dd></div>
                </dl>
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
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Project Detail</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load project detail page: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}

function getPhaseFocusHref(householdId: string, projectId: string, phaseId: string): string {
  return `/projects/${projectId}?householdId=${householdId}&focusPhaseId=${phaseId}#phase-${phaseId}`;
}

function ProjectSupplyQuickAddForm({
  householdId,
  projectId,
  phases,
  inventoryItems
}: {
  householdId: string;
  projectId: string;
  phases: ProjectPhaseSummary[];
  inventoryItems: InventoryItemSummary[];
}): JSX.Element {
  return (
    <form action={createProjectPhaseSupplyAction} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />
      <div className="form-grid">
        <label className="field">
          <span>Phase</span>
          <select name="phaseId" defaultValue="" required>
            <option value="" disabled>Select phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>{phase.name}</option>
            ))}
          </select>
        </label>
        <label className="field field--full">
          <span>Supply Name</span>
          <input name="name" placeholder="Drywall sheets, primer, stainless screws" required />
        </label>
        <label className="field">
          <span>Quantity Needed</span>
          <input name="quantityNeeded" type="number" min="0" step="0.01" required />
        </label>
        <label className="field">
          <span>Unit</span>
          <input name="unit" defaultValue="each" />
        </label>
        <label className="field">
          <span>Estimated Unit Cost</span>
          <input name="estimatedUnitCost" type="number" min="0" step="0.01" />
        </label>
        <label className="field">
          <span>Supplier</span>
          <input name="supplier" placeholder="Lowe's, Ferguson, West Marine" />
        </label>
        <label className="field">
          <span>Linked Inventory Item</span>
          <select name="inventoryItemId" defaultValue="">
            <option value="">None</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.quantityOnHand} {item.unit} on hand</option>
            ))}
          </select>
        </label>
      </div>
      <div className="inline-actions" style={{ marginTop: 16 }}>
        <button type="submit" className="button">Add Supply</button>
      </div>
    </form>
  );
}

function ProjectSupplyActions({
  householdId,
  projectId,
  phaseId,
  supply,
  inventoryItems
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  inventoryItems: InventoryItemSummary[];
}): JSX.Element {
  return (
    <ProjectSupplyRollupActions
      householdId={householdId}
      projectId={projectId}
      phaseId={phaseId}
      supply={supply}
      inventoryItems={inventoryItems}
      openPhaseHref={getPhaseFocusHref(householdId, projectId, phaseId)}
    />
  );
}

function UnphasedTaskCard({
  householdId,
  projectId,
  task,
  householdMembers
}: {
  householdId: string;
  projectId: string;
  task: Awaited<ReturnType<typeof getProjectDetail>>["tasks"][number];
  householdMembers: Awaited<ReturnType<typeof getHouseholdMembers>>;
}) {
  return (
    <div className="schedule-card">
      <form action={updateProjectTaskAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="form-grid">
          <label className="field field--full">
            <span>Task Title</span>
            <input name="title" defaultValue={task.title} required />
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea name="description" rows={2} defaultValue={task.description ?? ""} />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={task.status}>
              {taskStatusOptions.map((status) => (
                <option key={status} value={status}>{taskStatusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <select name="assignedToId" defaultValue={task.assignedToId ?? ""}>
              <option value="">Unassigned</option>
              {householdMembers.map((member) => (
                <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Due Date</span>
            <input name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} />
          </label>
          <label className="field">
            <span>Sort Order</span>
            <input name="sortOrder" type="number" step="1" defaultValue={task.sortOrder ?? ""} />
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button--ghost">Save Task</button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        <div className="data-table__secondary" style={{ marginBottom: 12 }}>Task checklist</div>
        <ProjectChecklist
          items={task.checklistItems}
          householdId={householdId}
          projectId={projectId}
          parentFieldName="taskId"
          parentId={task.id}
          addAction={createTaskChecklistItemAction}
          toggleAction={updateTaskChecklistItemAction}
          deleteAction={deleteTaskChecklistItemAction}
          addPlaceholder="Add step to this task"
          emptyMessage="No sub-steps yet. Break this task into a quick install or verification checklist if needed."
        />
      </div>

      <form action={deleteProjectTaskAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <button type="submit" className="button button--danger">Delete Task</button>
      </form>
    </div>
  );
}