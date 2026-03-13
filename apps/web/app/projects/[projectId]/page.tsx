import Link from "next/link";
import type { JSX } from "react";
import {
  addProjectAssetAction,
  allocateProjectInventoryItemAction,
  createProjectInventoryItemAction,
  createProjectExpenseAction,
  createProjectTaskAction,
  deleteProjectAction,
  deleteProjectExpenseAction,
  deleteProjectInventoryItemAction,
  deleteProjectTaskAction,
  removeProjectAssetAction,
  updateProjectAction,
  updateProjectExpenseAction,
  updateProjectInventoryItemAction,
  updateProjectStatusAction,
  updateProjectTaskAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { ProjectCoreFormFields } from "../../../components/project-core-form-fields";
import {
  ApiError,
  getHouseholdAssets,
  getHouseholdInventory,
  getHouseholdMembers,
  getHouseholdServiceProviders,
  getMe,
  getProjectDetail,
  getProjectInventory
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

const taskStatusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

const taskStatusOptions = ["pending", "in_progress", "completed", "skipped"] as const;
const projectStatusOptions = ["planning", "active", "on_hold", "completed", "cancelled"] as const;

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

    const [project, householdAssets, householdMembers, householdInventory, serviceProviders, projectInventory] = await Promise.all([
      getProjectDetail(household.id, routeParams.projectId),
      getHouseholdAssets(household.id),
      getHouseholdMembers(household.id),
      getHouseholdInventory(household.id, { limit: 200 }),
      getHouseholdServiceProviders(household.id),
      getProjectInventory(household.id, routeParams.projectId)
    ]);

    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const completedTaskCount = project.tasks.filter((task) => task.status === "completed").length;
    const percentComplete = project.tasks.length === 0 ? 0 : Math.round((completedTaskCount / project.tasks.length) * 100);
    const linkedAssetIds = new Set(project.assets.map((asset) => asset.assetId));
    const linkedInventoryIds = new Set(projectInventory.map((item) => item.inventoryItemId));
    const availableAssets = householdAssets.filter((asset) => !linkedAssetIds.has(asset.id));
    const availableInventoryItems = householdInventory.items.filter((item) => !linkedInventoryIds.has(item.id));
    const totalInventoryBudget = projectInventory.reduce(
      (sum, item) => sum + ((item.budgetedUnitCost ?? 0) * item.quantityNeeded),
      0
    );
    const totalInventoryAllocated = projectInventory.reduce((sum, item) => sum + item.quantityAllocated, 0);
    const providerLookup = new Map(serviceProviders.map((provider) => [provider.id, provider]));

    return (
      <AppShell activePath="/projects">
        <header className="page-header">
          <div>
            <h1>{project.name}</h1>
            <p style={{ marginTop: 6 }}>{project.description ?? "Manage project scope, ownership, linked assets, task progress, and costs from one place."}</p>
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
              <span className="stat-card__sub">{completedTaskCount} of {project.tasks.length} completed</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Budget</span>
              <strong className="stat-card__value">{formatCurrency(project.budgetAmount, "Unbudgeted")}</strong>
              <span className="stat-card__sub">Target end {formatDate(project.targetEndDate, "not set")}</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Spent</span>
              <strong className="stat-card__value">{formatCurrency(totalSpent, "$0.00")}</strong>
              <span className="stat-card__sub">{project.expenses.length} tracked expenses</span>
            </div>
          </section>

          <div className="detail-tiles">
            <div className="detail-tiles__grid">
              <section className="panel detail-tile" data-tile="edit">
                <div className="panel__header">
                  <div>
                    <h2>Project Settings</h2>
                    <p className="data-table__secondary">Use the same structured setup view as project creation, including optional template re-application.</p>
                  </div>
                </div>
                <div className="panel__body--padded">
                  <form action={updateProjectAction} className="asset-studio asset-studio--industrial project-creation-studio">
                    <ProjectCoreFormFields householdId={household.id} project={project} includeProjectId variant="studio" />
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button">Save Project</button>
                    </div>
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
                      <div className="field">
                        <label htmlFor="new-project-asset">Asset</label>
                        <select id="new-project-asset" name="assetId" required defaultValue="">
                          <option value="" disabled>Select an asset</option>
                          {availableAssets.map((asset) => (
                            <option key={asset.id} value={asset.id}>{asset.name} · {asset.category}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="new-project-asset-role">Role</label>
                        <input id="new-project-asset-role" name="role" placeholder="Primary asset, affected system, workspace" />
                      </div>
                      <div className="field field--full">
                        <label htmlFor="new-project-asset-notes">Notes</label>
                        <textarea id="new-project-asset-notes" name="notes" rows={2} placeholder="Why this asset is part of the project" />
                      </div>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button" disabled={availableAssets.length === 0}>Link Asset</button>
                    </div>
                  </form>
                </div>
                <div className="panel__body">
                  {project.assets.length === 0 ? (
                    <p className="panel__empty">No assets are linked to this project.</p>
                  ) : (
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
                  )}
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <div>
                    <h2>Project Inventory ({projectInventory.length})</h2>
                    <p className="data-table__secondary">Plan required parts, reserve stock, and track budgeted material spend.</p>
                  </div>
                </div>
                <div className="panel__body--padded">
                  <div className="stats-row" style={{ marginBottom: 20 }}>
                    <div className="stat-card">
                      <span className="stat-card__label">Material Budget</span>
                      <strong className="stat-card__value">{formatCurrency(totalInventoryBudget, "$0.00")}</strong>
                      <span className="stat-card__sub">Budgeted unit cost x required quantity</span>
                    </div>
                    <div className="stat-card stat-card--warning">
                      <span className="stat-card__label">Units Allocated</span>
                      <strong className="stat-card__value">{totalInventoryAllocated}</strong>
                      <span className="stat-card__sub">Reserved from household stock</span>
                    </div>
                  </div>

                  <form action={createProjectInventoryItemAction}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="form-grid">
                      <div className="field field--full">
                        <label htmlFor="new-project-inventory-item">Inventory Item</label>
                        <select id="new-project-inventory-item" name="inventoryItemId" required defaultValue="">
                          <option value="" disabled>Select an inventory item</option>
                          {availableInventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} · {item.quantityOnHand} {item.unit} on hand</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="new-project-inventory-needed">Quantity Needed</label>
                        <input id="new-project-inventory-needed" name="quantityNeeded" type="number" min="0.01" step="0.01" placeholder="1" required />
                      </div>
                      <div className="field">
                        <label htmlFor="new-project-inventory-budget">Budgeted Unit Cost</label>
                        <input id="new-project-inventory-budget" name="budgetedUnitCost" type="number" min="0" step="0.01" placeholder="0.00" />
                      </div>
                      <div className="field field--full">
                        <label htmlFor="new-project-inventory-notes">Notes</label>
                        <textarea id="new-project-inventory-notes" name="notes" rows={2} placeholder="Part choice, source, staging notes" />
                      </div>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button" disabled={availableInventoryItems.length === 0}>Add Inventory Item</button>
                      {availableInventoryItems.length === 0 ? (
                        <Link href={`/inventory?householdId=${household.id}`} className="button button--ghost">Review Inventory</Link>
                      ) : null}
                    </div>
                  </form>
                </div>
                <div className="panel__body">
                  {projectInventory.length === 0 ? (
                    <p className="panel__empty">No inventory requirements are linked to this project yet.</p>
                  ) : (
                    <div className="schedule-stack">
                      {projectInventory.map((item) => (
                        <div key={item.inventoryItemId} className="schedule-card">
                          <div className="schedule-card__summary" style={{ marginBottom: 16 }}>
                            <div>
                              <div className="data-table__primary">{item.inventoryItem.name}</div>
                              <div className="data-table__secondary">
                                {item.quantityNeeded} {item.inventoryItem.unit} needed · {item.quantityAllocated} allocated · {item.quantityRemaining} remaining
                              </div>
                              <div className="data-table__secondary">
                                {item.inventoryItem.quantityOnHand} {item.inventoryItem.unit} on hand · {formatCurrency(item.inventoryItem.unitCost, "No unit cost")}
                              </div>
                            </div>
                            <span className="pill">{formatCurrency(item.budgetedUnitCost, "Unbudgeted")}</span>
                          </div>

                          <form action={updateProjectInventoryItemAction}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="inventoryItemId" value={item.inventoryItemId} />
                            <div className="form-grid">
                              <div className="field">
                                <label htmlFor={`project-inventory-needed-${item.inventoryItemId}`}>Quantity Needed</label>
                                <input
                                  id={`project-inventory-needed-${item.inventoryItemId}`}
                                  name="quantityNeeded"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  defaultValue={item.quantityNeeded}
                                  required
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`project-inventory-budget-${item.inventoryItemId}`}>Budgeted Unit Cost</label>
                                <input
                                  id={`project-inventory-budget-${item.inventoryItemId}`}
                                  name="budgetedUnitCost"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={item.budgetedUnitCost ?? ""}
                                />
                              </div>
                              <div className="field field--full">
                                <label htmlFor={`project-inventory-notes-${item.inventoryItemId}`}>Notes</label>
                                <textarea
                                  id={`project-inventory-notes-${item.inventoryItemId}`}
                                  name="notes"
                                  rows={2}
                                  defaultValue={item.notes ?? ""}
                                />
                              </div>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 16 }}>
                              <button type="submit" className="button button--ghost">Save Inventory Plan</button>
                            </div>
                          </form>

                          <form action={allocateProjectInventoryItemAction} style={{ marginTop: 16 }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="inventoryItemId" value={item.inventoryItemId} />
                            <div className="form-grid">
                              <div className="field">
                                <label htmlFor={`project-inventory-allocate-${item.inventoryItemId}`}>Allocate Quantity</label>
                                <input
                                  id={`project-inventory-allocate-${item.inventoryItemId}`}
                                  name="quantity"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  max={Math.min(item.quantityRemaining, item.inventoryItem.quantityOnHand)}
                                  placeholder="0"
                                  required
                                />
                              </div>
                              <div className="field">
                                <label htmlFor={`project-inventory-unit-cost-${item.inventoryItemId}`}>Actual Unit Cost</label>
                                <input
                                  id={`project-inventory-unit-cost-${item.inventoryItemId}`}
                                  name="unitCost"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Optional"
                                />
                              </div>
                              <div className="field field--full">
                                <label htmlFor={`project-inventory-allocation-notes-${item.inventoryItemId}`}>Allocation Notes</label>
                                <textarea
                                  id={`project-inventory-allocation-notes-${item.inventoryItemId}`}
                                  name="notes"
                                  rows={2}
                                  placeholder="Reserved for install, consumed during prep, etc."
                                />
                              </div>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 16 }}>
                              <button
                                type="submit"
                                className="button"
                                disabled={item.quantityRemaining <= 0 || item.inventoryItem.quantityOnHand <= 0}
                              >
                                Allocate From Stock
                              </button>
                            </div>
                          </form>

                          <form action={deleteProjectInventoryItemAction} className="inline-actions inline-actions--end" style={{ marginTop: 16 }}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="inventoryItemId" value={item.inventoryItemId} />
                            <button type="submit" className="button button--danger">Remove Inventory Item</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Add Task</h2>
                </div>
                <div className="panel__body--padded">
                  <form action={createProjectTaskAction}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="form-grid">
                      <div className="field field--full">
                        <label htmlFor="new-task-title">Task Title</label>
                        <input id="new-task-title" name="title" placeholder="Order parts, prep site, review contractor bid" required />
                      </div>
                      <div className="field field--full">
                        <label htmlFor="new-task-description">Description</label>
                        <textarea id="new-task-description" name="description" rows={2} placeholder="What needs to happen for this task to be done" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-status">Status</label>
                        <select id="new-task-status" name="status" defaultValue="pending">
                          {taskStatusOptions.map((status) => (
                            <option key={status} value={status}>{taskStatusLabels[status] ?? status}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-assignee">Assignee</label>
                        <select id="new-task-assignee" name="assignedToId" defaultValue="">
                          <option value="">Unassigned</option>
                          {householdMembers.map((member) => (
                            <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-due-date">Due Date</label>
                        <input id="new-task-due-date" name="dueDate" type="date" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-sort-order">Sort Order</label>
                        <input id="new-task-sort-order" name="sortOrder" type="number" step="1" placeholder="0" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-estimated-cost">Estimated Cost</label>
                        <input id="new-task-estimated-cost" name="estimatedCost" type="number" min="0" step="0.01" placeholder="0.00" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-task-actual-cost">Actual Cost</label>
                        <input id="new-task-actual-cost" name="actualCost" type="number" min="0" step="0.01" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button">Add Task</button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Tasks ({project.tasks.length})</h2>
                </div>
                <div className="panel__body">
                  {project.tasks.length === 0 ? (
                    <p className="panel__empty">No tasks are attached to this project yet.</p>
                  ) : (
                    <div className="schedule-stack">
                      {project.tasks.map((task) => (
                        <div key={task.id} className="schedule-card">
                          <form action={updateProjectTaskAction}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="taskId" value={task.id} />
                            <div className="form-grid">
                              <div className="field field--full">
                                <label htmlFor={`task-title-${task.id}`}>Task Title</label>
                                <input id={`task-title-${task.id}`} name="title" defaultValue={task.title} required />
                              </div>
                              <div className="field field--full">
                                <label htmlFor={`task-description-${task.id}`}>Description</label>
                                <textarea id={`task-description-${task.id}`} name="description" rows={2} defaultValue={task.description ?? ""} />
                              </div>
                              <div className="field">
                                <label htmlFor={`task-status-${task.id}`}>Status</label>
                                <select id={`task-status-${task.id}`} name="status" defaultValue={task.status}>
                                  {taskStatusOptions.map((status) => (
                                    <option key={status} value={status}>{taskStatusLabels[status] ?? status}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label htmlFor={`task-assignee-${task.id}`}>Assignee</label>
                                <select id={`task-assignee-${task.id}`} name="assignedToId" defaultValue={task.assignedToId ?? ""}>
                                  <option value="">Unassigned</option>
                                  {householdMembers.map((member) => (
                                    <option key={member.id} value={member.userId}>{member.user.displayName ?? member.user.email ?? member.userId}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label htmlFor={`task-due-date-${task.id}`}>Due Date</label>
                                <input id={`task-due-date-${task.id}`} name="dueDate" type="date" defaultValue={toDateInputValue(task.dueDate)} />
                              </div>
                              <div className="field">
                                <label htmlFor={`task-sort-order-${task.id}`}>Sort Order</label>
                                <input id={`task-sort-order-${task.id}`} name="sortOrder" type="number" step="1" defaultValue={task.sortOrder ?? ""} />
                              </div>
                              <div className="field">
                                <label htmlFor={`task-estimated-cost-${task.id}`}>Estimated Cost</label>
                                <input id={`task-estimated-cost-${task.id}`} name="estimatedCost" type="number" min="0" step="0.01" defaultValue={task.estimatedCost ?? ""} />
                              </div>
                              <div className="field">
                                <label htmlFor={`task-actual-cost-${task.id}`}>Actual Cost</label>
                                <input id={`task-actual-cost-${task.id}`} name="actualCost" type="number" min="0" step="0.01" defaultValue={task.actualCost ?? ""} />
                              </div>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 16 }}>
                              <button type="submit" className="button button--ghost">Save Task</button>
                            </div>
                          </form>
                          <div className="inline-actions">
                            <span className="pill">{taskStatusLabels[task.status] ?? task.status}</span>
                            <span className="data-table__secondary">Due {formatDate(task.dueDate, "not set")}</span>
                            <span className="data-table__secondary">Assignee {task.assignee?.displayName ?? "Unassigned"}</span>
                            {task.scheduleId ? <span className="data-table__secondary">Linked schedule {task.scheduleId}</span> : null}
                          </div>
                          <form action={deleteProjectTaskAction} className="inline-actions inline-actions--end">
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="taskId" value={task.id} />
                            <button type="submit" className="button button--danger">Delete Task</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Add Expense</h2>
                </div>
                <div className="panel__body--padded">
                  <form action={createProjectExpenseAction}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <div className="form-grid">
                      <div className="field field--full">
                        <label htmlFor="new-expense-description">Description</label>
                        <input id="new-expense-description" name="description" placeholder="Materials, contractor invoice, rental, permit" required />
                      </div>
                      <div className="field">
                        <label htmlFor="new-expense-amount">Amount</label>
                        <input id="new-expense-amount" name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
                      </div>
                      <div className="field">
                        <label htmlFor="new-expense-category">Category</label>
                        <input id="new-expense-category" name="category" placeholder="Materials, labor, permit" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-expense-date">Date</label>
                        <input id="new-expense-date" name="date" type="date" />
                      </div>
                      <div className="field">
                        <label htmlFor="new-expense-task">Related Task</label>
                        <select id="new-expense-task" name="taskId" defaultValue="">
                          <option value="">Not tied to a task</option>
                          {project.tasks.map((task) => (
                            <option key={task.id} value={task.id}>{task.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="new-expense-provider">Service Provider</label>
                        <select id="new-expense-provider" name="serviceProviderId" defaultValue="">
                          <option value="">No provider</option>
                          {serviceProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field field--full">
                        <label htmlFor="new-expense-notes">Notes</label>
                        <textarea id="new-expense-notes" name="notes" rows={2} placeholder="Receipt details, reimbursement notes, vendor context" />
                      </div>
                    </div>
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                      <button type="submit" className="button">Add Expense</button>
                      <Link href={`/service-providers?householdId=${household.id}`} className="button button--ghost">Manage Providers</Link>
                    </div>
                  </form>
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Expenses ({project.expenses.length})</h2>
                </div>
                <div className="panel__body">
                  {project.expenses.length === 0 ? (
                    <p className="panel__empty">No expenses recorded yet.</p>
                  ) : (
                    <div className="schedule-stack">
                      {project.expenses.map((expense) => (
                        <div key={expense.id} className="schedule-card">
                          <form action={updateProjectExpenseAction}>
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <div className="form-grid">
                              <div className="field field--full">
                                <label htmlFor={`expense-description-${expense.id}`}>Description</label>
                                <input id={`expense-description-${expense.id}`} name="description" defaultValue={expense.description} required />
                              </div>
                              <div className="field">
                                <label htmlFor={`expense-amount-${expense.id}`}>Amount</label>
                                <input id={`expense-amount-${expense.id}`} name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required />
                              </div>
                              <div className="field">
                                <label htmlFor={`expense-category-${expense.id}`}>Category</label>
                                <input id={`expense-category-${expense.id}`} name="category" defaultValue={expense.category ?? ""} />
                              </div>
                              <div className="field">
                                <label htmlFor={`expense-date-${expense.id}`}>Date</label>
                                <input id={`expense-date-${expense.id}`} name="date" type="date" defaultValue={toDateInputValue(expense.date)} />
                              </div>
                              <div className="field">
                                <label htmlFor={`expense-task-${expense.id}`}>Related Task</label>
                                <select id={`expense-task-${expense.id}`} name="taskId" defaultValue={expense.taskId ?? ""}>
                                  <option value="">Not tied to a task</option>
                                  {project.tasks.map((task) => (
                                    <option key={task.id} value={task.id}>{task.title}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field">
                                <label htmlFor={`expense-provider-${expense.id}`}>Service Provider</label>
                                <select id={`expense-provider-${expense.id}`} name="serviceProviderId" defaultValue={expense.serviceProviderId ?? ""}>
                                  <option value="">No provider</option>
                                  {serviceProviders.map((provider) => (
                                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field field--full">
                                <label htmlFor={`expense-notes-${expense.id}`}>Notes</label>
                                <textarea id={`expense-notes-${expense.id}`} name="notes" rows={2} defaultValue={expense.notes ?? ""} />
                              </div>
                            </div>
                            <div className="inline-actions" style={{ marginTop: 16 }}>
                              <button type="submit" className="button button--ghost">Save Expense</button>
                            </div>
                          </form>
                          <div className="inline-actions">
                            <span className="pill">{formatCurrency(expense.amount, "$0.00")}</span>
                            <span className="data-table__secondary">{expense.category ?? "Uncategorized"}</span>
                            <span className="data-table__secondary">{formatDate(expense.date, "No date")}</span>
                            {expense.serviceProviderId ? (
                              <span className="data-table__secondary">
                                Provider {providerLookup.get(expense.serviceProviderId)?.name ?? expense.serviceProviderId}
                              </span>
                            ) : null}
                          </div>
                          <form action={deleteProjectExpenseAction} className="inline-actions inline-actions--end">
                            <input type="hidden" name="householdId" value={household.id} />
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <button type="submit" className="button button--danger">Delete Expense</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel detail-tile">
                <div className="panel__header">
                  <h2>Danger Zone</h2>
                </div>
                <div className="panel__body--padded">
                  <p>This permanently deletes the project and its nested links, tasks, and expenses.</p>
                  <form action={deleteProjectAction} className="inline-actions" style={{ marginTop: 16 }}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button type="submit" className="button button--danger">Delete Project</button>
                  </form>
                </div>
              </section>
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
                <p>Failed to load project: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}