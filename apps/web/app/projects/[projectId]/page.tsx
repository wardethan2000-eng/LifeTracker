import Link from "next/link";
import type { JSX } from "react";
import {
  addProjectAssetAction,
  createProjectNoteAction,
  createProjectPhaseAction,
  createProjectExpenseAction,
  createProjectTaskAction,
  deleteProjectAction,
  deleteProjectExpenseAction,
  deleteProjectNoteAction,
  deleteProjectTaskAction,
  removeProjectAssetAction,
  toggleProjectNotePinAction,
  updateProjectAction,
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
import { ProjectCoreFormFields } from "../../../components/project-core-form-fields";
import { ProjectPhaseCard } from "../../../components/project-phase-card";
import { ProjectPhaseDetail } from "../../../components/project-phase-detail";
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
  getHouseholdServiceProviders,
  getMe,
  getProjectDetail,
  getProjectNotes,
  getProjectPhaseDetail
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

const taskStatusOptions = ["pending", "in_progress", "completed", "skipped"] as const;
const taskStatusLabels: Record<(typeof taskStatusOptions)[number], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps): Promise<JSX.Element> {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

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

    const [project, householdAssets, householdMembers, householdInventory, serviceProviders, projectNotes] = await Promise.all([
      getProjectDetail(household.id, routeParams.projectId),
      getHouseholdAssets(household.id),
      getHouseholdMembers(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdServiceProviders(household.id),
      getProjectNotes(household.id, routeParams.projectId)
    ]);

    const phaseDetails = await Promise.all(project.phases.map((phase) => getProjectPhaseDetail(household.id, project.id, phase.id)));
    const phaseDetailsById = new Map(phaseDetails.map((phase) => [phase.id, phase]));
    const phaseNameLookup = new Map(project.phases.map((phase) => [phase.id, phase.name]));
    const budgetCategoryLookup = new Map(project.budgetCategories.map((category) => [category.id, category.name]));
    const linkedAssetIds = new Set(project.assets.map((asset) => asset.assetId));
    const availableAssets = householdAssets.filter((asset) => !linkedAssetIds.has(asset.id));
    const unphasedTasks = project.tasks.filter((task) => task.phaseId === null);
    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const completedTaskCount = project.tasks.filter((task) => task.status === "completed").length;
    const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
    const phaseCount = project.phases.length;
    const percentComplete = project.tasks.length === 0 ? 0 : Math.round((completedTaskCount / project.tasks.length) * 100);
    const activePhase = project.phases.find((phase) => phase.status === "in_progress");

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
              <strong className="stat-card__value">{percentComplete}%</strong>
              <span className="stat-card__sub">{completedTaskCount} of {project.tasks.length} tasks completed</span>
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
              <ExpandableCard
                title="Phase Timeline"
                modalTitle="Phase Timeline"
                previewContent={<CompactPhasePreview phases={project.phases} />}
              >
                <div className="project-phase-stack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {project.phases.map((phase) => {
                    const phaseDetail = phaseDetailsById.get(phase.id);
                    if (!phaseDetail) { return null; }
                    return (
                      <details key={phase.id} className="project-phase-details" style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                        <summary style={{ listStyle: "none", cursor: "pointer", padding: 0 }}>
                          <ProjectPhaseCard phase={phase} />
                        </summary>
                        <div className="project-phase-details__content" style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                          <ProjectPhaseDetail
                            householdId={household.id}
                            projectId={project.id}
                            phase={phaseDetail}
                            householdMembers={householdMembers}
                            serviceProviders={serviceProviders}
                            budgetCategories={project.budgetCategories}
                            inventoryItems={householdInventory.items}
                          />
                        </div>
                      </details>
                    );
                  })}
                </div>
                {project.phases.length === 0 ? <p className="panel__empty">No phases defined yet. Add one below to sequence the work.</p> : null}
                <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
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
                </div>
              </ExpandableCard>

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
              </ExpandableCard>

              <ExpandableCard
                title="Tasks"
                modalTitle="Tasks"
                previewContent={<CompactTaskPreview tasks={project.tasks} />}
              >
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
                {unphasedTasks.length === 0 ? <p className="panel__empty">Every task is assigned to a phase.</p> : null}
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
                    </div>
                  ))}
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
                <ProjectBudgetBreakdown
                  householdId={household.id}
                  projectId={project.id}
                  projectBudgetAmount={project.budgetAmount}
                  categories={project.budgetCategories}
                  expenses={project.expenses}
                  phaseDetails={phaseDetails}
                />
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </ExpandableCard>
            </div>

            <div className="resource-layout__aside">
              <Card title="Project Status">
                <dl className="schedule-meta">
                  <div><dt>Status</dt><dd><span className="pill">{projectStatusLabels[project.status] ?? project.status}</span></dd></div>
                  <div><dt>Task progress</dt><dd>{percentComplete}% — {completedTaskCount}/{project.tasks.length} tasks</dd></div>
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
                      <span>Role</span>
                      <input name="role" placeholder="Primary, affected system…" />
                    </label>
                    <button type="submit" className="button button--sm" disabled={availableAssets.length === 0}>Link Asset</button>
                  </div>
                </form>
                {project.assets.length === 0 ? (
                  <p className="panel__empty">No assets linked yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {project.assets.map((asset) => (
                      <div key={asset.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          {asset.asset ? (
                            <Link href={`/assets/${asset.asset.id}`} className="data-table__link">{asset.asset.name}</Link>
                          ) : "Unknown asset"}
                          {asset.role ? <div style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{asset.role}</div> : null}
                        </div>
                        <form action={removeProjectAssetAction}>
                          <input type="hidden" name="householdId" value={household.id} />
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="projectAssetId" value={asset.id} />
                          <button type="submit" className="button button--ghost button--sm">Remove</button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
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