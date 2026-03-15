import type {
  HouseholdMember,
  InventoryItemSummary,
  ProjectBudgetCategorySummary,
  ProjectExpense,
  ProjectPhaseDetail,
  ProjectTask,
  ServiceProvider
} from "@lifekeeper/types";
import {
  createPhaseChecklistItemAction,
  createProjectExpenseAction,
  createProjectPhaseSupplyAction,
  createProjectTaskAction,
  createTaskChecklistItemAction,
  deletePhaseChecklistItemAction,
  deleteProjectExpenseAction,
  deleteProjectPhaseAction,
  deleteProjectTaskAction,
  deleteTaskChecklistItemAction,
  updatePhaseChecklistItemAction,
  updateProjectExpenseAction,
  updateProjectPhaseAction,
  updateProjectTaskAction,
  updateTaskChecklistItemAction
} from "../app/actions";
import { formatCurrency } from "../lib/formatters";
import { ProjectChecklist } from "./project-checklist";
import { ProjectSupplyCard } from "./project-supply-card";
import { ProjectSupplyCreateForm } from "./project-supply-create-form";
import { AttachmentSection } from "./attachment-section";

const taskStatusOptions = ["pending", "in_progress", "completed", "skipped"] as const;
const taskStatusLabels: Record<(typeof taskStatusOptions)[number], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

type ProjectPhaseDetailProps = {
  householdId: string;
  projectId: string;
  phase: ProjectPhaseDetail;
  householdMembers: HouseholdMember[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
  inventoryItems: InventoryItemSummary[];
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

export function ProjectPhaseDetail({
  householdId,
  projectId,
  phase,
  householdMembers,
  serviceProviders,
  budgetCategories,
  inventoryItems
}: ProjectPhaseDetailProps) {
  const inventoryLookup = new Map(inventoryItems.map((item) => [item.id, item]));

  return (
    <div className="schedule-stack" style={{ marginTop: 16 }}>
      <section className="panel detail-tile">
        <div className="panel__header">
          <div>
            <h2>{phase.name}</h2>
            <p className="data-table__secondary">Adjust sequencing, budget allocation, and execution notes for this phase.</p>
          </div>
        </div>
        <div className="panel__body--padded">
          <form action={updateProjectPhaseAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phase.id} />
            <div className="form-grid">
              <label className="field field--full">
                <span>Phase Name</span>
                <input name="name" defaultValue={phase.name} required />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={2} defaultValue={phase.description ?? ""} />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={phase.status}>
                  {taskStatusOptions.map((status) => (
                    <option key={status} value={status}>{taskStatusLabels[status]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sort Order</span>
                <input name="sortOrder" type="number" step="1" defaultValue={phase.sortOrder ?? ""} />
              </label>
              <label className="field">
                <span>Start Date</span>
                <input name="startDate" type="date" defaultValue={toDateInputValue(phase.startDate)} />
              </label>
              <label className="field">
                <span>Target End Date</span>
                <input name="targetEndDate" type="date" defaultValue={toDateInputValue(phase.targetEndDate)} />
              </label>
              <label className="field">
                <span>Actual End Date</span>
                <input name="actualEndDate" type="date" defaultValue={toDateInputValue(phase.actualEndDate)} />
              </label>
              <label className="field">
                <span>Phase Budget</span>
                <input name="budgetAmount" type="number" min="0" step="0.01" defaultValue={phase.budgetAmount ?? ""} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={4} defaultValue={phase.notes ?? ""} />
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="button button--ghost">Save Phase</button>
            </div>
          </form>

          <form action={deleteProjectPhaseAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phase.id} />
            <button type="submit" className="button button--danger">Delete Phase</button>
          </form>
        </div>
      </section>

      <section className="panel detail-tile">
        <div className="panel__header">
          <h2>Phase Checklist ({phase.completedChecklistItemCount} of {phase.checklistItemCount})</h2>
        </div>
        <div className="panel__body--padded">
          <ProjectChecklist
            items={phase.checklistItems}
            householdId={householdId}
            projectId={projectId}
            parentFieldName="phaseId"
            parentId={phase.id}
            addAction={createPhaseChecklistItemAction}
            toggleAction={updatePhaseChecklistItemAction}
            deleteAction={deletePhaseChecklistItemAction}
            addPlaceholder="Add a quick phase readiness check"
            emptyMessage="No checklist items on this phase yet. Add a few binary checkpoints to keep closeout tight."
          />
        </div>
      </section>

      <section className="panel detail-tile">
        <div className="panel__header">
          <h2>Phase Tasks ({phase.tasks.length})</h2>
        </div>
        <div className="panel__body">
          {phase.tasks.length === 0 ? <p className="panel__empty">No tasks assigned to this phase yet.</p> : null}
          <div className="schedule-stack">
            {phase.tasks.map((task) => (
              <TaskCard
                key={task.id}
                householdId={householdId}
                projectId={projectId}
                phaseId={phase.id}
                task={task}
                householdMembers={householdMembers}
              />
            ))}
          </div>

          <div className="panel__body--padded">
            <form action={createProjectTaskAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phase.id} />
              <div className="form-grid">
                <label className="field field--full">
                  <span>Task Title</span>
                  <input name="title" placeholder="Add task to this phase" required />
                </label>
                <label className="field field--full">
                  <span>Description</span>
                  <textarea name="description" rows={2} placeholder="Scope, definition of done, or sequencing notes" />
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
                <label className="field">
                  <span>Due Date</span>
                  <input name="dueDate" type="date" />
                </label>
                <label className="field">
                  <span>Estimated Cost</span>
                  <input name="estimatedCost" type="number" min="0" step="0.01" />
                </label>
              </div>
              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="button">Add Task to Phase</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="panel detail-tile">
        <div className="panel__header">
          <h2>Phase Supplies ({phase.supplies.length})</h2>
        </div>
        <div className="panel__body">
          {phase.supplies.length === 0 ? <p className="panel__empty">No supplies planned for this phase yet.</p> : null}
          <div className="schedule-stack">
            {phase.supplies.map((supply) => (
                <ProjectSupplyCard
                  key={supply.id}
                  householdId={householdId}
                  projectId={projectId}
                  phaseId={phase.id}
                  supply={supply}
                  {...(supply.inventoryItemId && inventoryLookup.has(supply.inventoryItemId)
                    ? { linkedInventoryItem: inventoryLookup.get(supply.inventoryItemId)! }
                    : {})}
                />
            ))}
          </div>

          <ProjectSupplyCreateForm
            householdId={householdId}
            projectId={projectId}
            phaseId={phase.id}
            inventoryItems={inventoryItems}
          />
        </div>
      </section>

      <section className="panel detail-tile">
        <div className="panel__header">
          <h2>Phase Expenses ({phase.expenses.length})</h2>
        </div>
        <div className="panel__body">
          {phase.expenses.length === 0 ? <p className="panel__empty">No expenses assigned to this phase yet.</p> : null}
          <div className="schedule-stack">
            {phase.expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                householdId={householdId}
                projectId={projectId}
                phaseId={phase.id}
                expense={expense}
                serviceProviders={serviceProviders}
                budgetCategories={budgetCategories}
              />
            ))}
          </div>
          <div className="panel__body--padded">
            <form action={createProjectExpenseAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phase.id} />
              <div className="form-grid">
                <label className="field field--full">
                  <span>Description</span>
                  <input name="description" placeholder="Permit fee, drywall delivery, plumber labor" required />
                </label>
                <label className="field">
                  <span>Amount</span>
                  <input name="amount" type="number" min="0" step="0.01" required />
                </label>
                <label className="field">
                  <span>Freeform Category</span>
                  <input name="category" placeholder="Materials, Labor, Permits" />
                </label>
                <label className="field">
                  <span>Budget Category</span>
                  <select name="budgetCategoryId" defaultValue="">
                    <option value="">None</option>
                    {budgetCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Service Provider</span>
                  <select name="serviceProviderId" defaultValue="">
                    <option value="">None</option>
                    {serviceProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Date</span>
                  <input name="date" type="date" />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea name="notes" rows={2} placeholder="Receipt reference, quote context, or what this spend covered." />
                </label>
              </div>
              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="button">Add Phase Expense</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="panel detail-tile">
        <div className="panel__header">
          <h2>Progress Photos</h2>
        </div>
        <div className="panel__body--padded">
          <AttachmentSection
            householdId={householdId}
            entityType="project_phase"
            entityId={phase.id}
            label=""
          />
        </div>
      </section>
    </div>
  );
}

function TaskCard({
  householdId,
  projectId,
  phaseId,
  task,
  householdMembers
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  task: ProjectTask;
  householdMembers: HouseholdMember[];
}) {
  return (
    <div className="schedule-card">
      <form action={updateProjectTaskAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="phaseId" value={phaseId} />
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
          <label className="field">
            <span>Estimated Cost</span>
            <input name="estimatedCost" type="number" min="0" step="0.01" defaultValue={task.estimatedCost ?? ""} />
          </label>
          <label className="field">
            <span>Actual Cost</span>
            <input name="actualCost" type="number" min="0" step="0.01" defaultValue={task.actualCost ?? ""} />
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button--ghost">Save Task</button>
          <span className="pill">{formatCurrency(task.actualCost, "No actual cost")}</span>
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
          emptyMessage="No sub-steps on this task yet. Use them for simple install or verification steps."
        />
      </div>

      <form action={deleteProjectTaskAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <button type="submit" className="button button--danger">Delete Task</button>
      </form>

      <AttachmentSection
        householdId={householdId}
        entityType="project_task"
        entityId={task.id}
        compact
        label=""
      />
    </div>
  );
}

function ExpenseCard({
  householdId,
  projectId,
  phaseId,
  expense,
  serviceProviders,
  budgetCategories
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  expense: ProjectExpense;
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
}) {
  return (
    <div className="schedule-card">
      <form action={updateProjectExpenseAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="expenseId" value={expense.id} />
        <input type="hidden" name="phaseId" value={phaseId} />
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
            <span>Budget Category</span>
            <select name="budgetCategoryId" defaultValue={expense.budgetCategoryId ?? ""}>
              <option value="">None</option>
              {budgetCategories.map((category) => (
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
          <span className="pill">{formatCurrency(expense.amount, "$0.00")}</span>
        </div>
      </form>

      <form action={deleteProjectExpenseAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="expenseId" value={expense.id} />
        <button type="submit" className="button button--danger">Delete Expense</button>
      </form>
    </div>
  );
}