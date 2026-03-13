import Link from "next/link";
import type { JSX } from "react";
import {
  addProjectAssetAction,
  createProjectPhaseAction,
  createProjectExpenseAction,
  createProjectTaskAction,
  deleteProjectAction,
  deleteProjectExpenseAction,
  deleteProjectTaskAction,
  removeProjectAssetAction,
  updateProjectAction,
  updateProjectExpenseAction,
  updateProjectTaskAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
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

    const [project, householdAssets, householdMembers, householdInventory, serviceProviders] = await Promise.all([
      getProjectDetail(household.id, routeParams.projectId),
      getHouseholdAssets(household.id),
      getHouseholdMembers(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdServiceProviders(household.id)
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
            <h1>{project.name}</h1>
            <p style={{ marginTop: 6 }}>{project.description ?? "Organize the work by phase, track structured budgets, and stage supplies before execution starts."}</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">Back to Projects</Link>
          </div>
        </header>

        <div className="page-body">
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

          <section className="panel detail-tile">
            <div className="panel__header">
              <div>
                <h2>Phase Timeline</h2>
                <p className="data-table__secondary">Sequence the work, then expand a phase to manage its checklist, tasks, supplies, spend, and execution notes in one place.</p>
              </div>
            </div>
            <div className="panel__body--padded">
              <div className="project-portfolio-grid">
                {project.phases.map((phase) => {
                  const phaseDetail = phaseDetailsById.get(phase.id);

                  if (!phaseDetail) {
                    return null;
                  }

                  return (
                    <details key={phase.id} className="project-phase-details" style={{ width: "100%" }}>
                      <summary style={{ listStyle: "none", cursor: "pointer" }}>
                        <ProjectPhaseCard phase={phase} />
                      </summary>
                      <ProjectPhaseDetail
                        householdId={household.id}
                        projectId={project.id}
                        phase={phaseDetail}
                        householdMembers={householdMembers}
                        serviceProviders={serviceProviders}
                        budgetCategories={project.budgetCategories}
                        inventoryItems={householdInventory.items}
                      />
                    </details>
                  );
                })}
              </div>
              <div className="panel__body--padded" style={{ marginTop: 20, borderTop: "1px solid var(--border)" }}>
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
            </div>
          </section>

          <section className="stats-row" style={{ marginTop: 8 }}>
            <div className="stat-card">
              <span className="stat-card__label">Supply Line Items</span>
              <strong className="stat-card__value">{totalSupplyLines}</strong>
              <span className="stat-card__sub">{totalSuppliesProcured} procured · {totalSuppliesStaged} staged</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Estimated Procurement</span>
              <strong className="stat-card__value">{formatCurrency(estimatedProcurementCost, "$0.00")}</strong>
              <span className="stat-card__sub">{formatCurrency(actualProcurementCost, "$0.00")} actual captured so far</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Inventory-Linked Supplies</span>
              <strong className="stat-card__value">{inventoryLinkedSupplyCount}</strong>
              <span className="stat-card__sub">{inventoryCoveredSupplyCount} lines fully covered by household stock</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Spend</span>
              <strong className="stat-card__value">{formatCurrency(totalSpent, "$0.00")}</strong>
              <span className="stat-card__sub">{project.expenses.length} total expenses logged</span>
            </div>
          </section>

          <div className="detail-tiles">
            <div className="detail-tiles__grid">
              <section className="panel detail-tile" data-tile="edit">
                <div className="panel__header">
                  <div>
                    <h2>Project Settings</h2>
                    <p className="data-table__secondary">Update the core project scope, timing, and execution notes without leaving the workbench.</p>
                  </div>
                </div>
                <div className="panel__body--padded">
                  <form action={updateProjectAction} className="asset-studio asset-studio--industrial project-creation-studio">
                    <ProjectCoreFormFields householdId={household.id} project={project} includeProjectId variant="studio" />
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button">Save Project</button>
                    </div>
                  </form>
                  <form action={deleteProjectAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button type="submit" className="button button--danger">Delete Project</button>
                  </form>
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Linked Assets ({project.assets.length})</h2>
                </div>
                <div className="panel__body--padded">
                  <form action={addProjectAssetAction}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="form-grid">
                      <label className="field field--full">
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
                        <input name="role" placeholder="Primary asset, affected system, workspace" />
                      </label>
                      <label className="field field--full">
                        <span>Notes</span>
                        <textarea name="notes" rows={2} placeholder="Why this asset is part of the project" />
                      </label>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 16 }}>
                      <button type="submit" className="button" disabled={availableAssets.length === 0}>Link Asset</button>
                    </div>
                  </form>
                </div>
                <div className="panel__body">
                  {project.assets.length === 0 ? <p className="panel__empty">No assets are linked to this project.</p> : null}
                  <div className="schedule-stack">
                    {project.assets.map((asset) => (
                      <div key={asset.id} className="schedule-card">
                        <div className="schedule-card__summary">
                          <div>
                            <div className="data-table__primary">
                              {asset.asset ? <Link href={`/assets/${asset.asset.id}`} className="data-table__link">{asset.asset.name}</Link> : "Unknown asset"}
                            </div>
                            <div className="data-table__secondary">{asset.asset?.category ?? "Unknown"} · {asset.role ?? "No role set"}</div>
                            {asset.notes ? <div className="data-table__secondary">{asset.notes}</div> : null}
                          </div>
                          <form action={removeProjectAssetAction}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="projectAssetId" value={asset.id} />
                            <button type="submit" className="button button--ghost">Remove</button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <div>
                    <h2>Unphased Tasks ({unphasedTasks.length})</h2>
                    <p className="data-table__secondary">Tasks not assigned to any phase stay here until you drag them into a stage of work.</p>
                  </div>
                </div>
                <div className="panel__body--padded">
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
                      <button type="submit" className="button">Add Unphased Task</button>
                    </div>
                  </form>
                </div>
                <div className="panel__body">
                  {unphasedTasks.length === 0 ? <p className="panel__empty">Every task is currently assigned to a phase.</p> : null}
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
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <div>
                    <h2>All Expenses ({project.expenses.length})</h2>
                    <p className="data-table__secondary">See the full spend stream with phase and budget category context preserved on each row.</p>
                  </div>
                </div>
                <div className="panel__body">
                  {project.expenses.length === 0 ? <p className="panel__empty">No expenses tracked yet.</p> : null}
                  <div className="schedule-stack">
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
                            <label className="field field--full">
                              <span>Description</span>
                              <input name="description" defaultValue={expense.description} required />
                            </label>
                            <label className="field">
                              <span>Amount</span>
                              <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required />
                            </label>
                            <label className="field">
                              <span>Freeform Category</span>
                              <input name="category" defaultValue={expense.category ?? ""} />
                            </label>
                            <label className="field">
                              <span>Phase</span>
                              <select name="phaseId" defaultValue={expense.phaseId ?? ""}>
                                <option value="">Unphased</option>
                                {project.phases.map((phase) => (
                                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Budget Category</span>
                              <select name="budgetCategoryId" defaultValue={expense.budgetCategoryId ?? ""}>
                                <option value="">None</option>
                                {project.budgetCategories.map((category) => (
                                  <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Service Provider</span>
                              <select name="serviceProviderId" defaultValue={expense.serviceProviderId ?? ""}>
                                <option value="">None</option>
                                {serviceProviders.map((provider) => (
                                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Date</span>
                              <input name="date" type="date" defaultValue={toDateInputValue(expense.date)} />
                            </label>
                            <label className="field field--full">
                              <span>Notes</span>
                              <textarea name="notes" rows={2} defaultValue={expense.notes ?? ""} />
                            </label>
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

                  <div className="panel__body--padded">
                    <form action={createProjectExpenseAction}>
                      <input type="hidden" name="householdId" value={household.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <div className="form-grid">
                        <label className="field field--full">
                          <span>Description</span>
                          <input name="description" placeholder="Project-wide expense" required />
                        </label>
                        <label className="field">
                          <span>Amount</span>
                          <input name="amount" type="number" min="0" step="0.01" required />
                        </label>
                        <label className="field">
                          <span>Phase</span>
                          <select name="phaseId" defaultValue="">
                            <option value="">Unphased</option>
                            {project.phases.map((phase) => (
                              <option key={phase.id} value={phase.id}>{phase.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Budget Category</span>
                          <select name="budgetCategoryId" defaultValue="">
                            <option value="">None</option>
                            {project.budgetCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="inline-actions" style={{ marginTop: 16 }}>
                        <button type="submit" className="button">Add Expense</button>
                      </div>
                    </form>
                  </div>
                </div>
              </section>

              <ProjectBudgetBreakdown
                householdId={household.id}
                projectId={project.id}
                projectBudgetAmount={project.budgetAmount}
                categories={project.budgetCategories}
                expenses={project.expenses}
                phaseDetails={phaseDetails}
              />
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