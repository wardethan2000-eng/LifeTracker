import type {
  InventoryItemSummary,
  ProjectBudgetAnalysis,
  ProjectDetail,
  ProjectPhaseSummary,
  ServiceProvider,
  HouseholdMember
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  createProjectExpenseAction,
  createProjectPhaseAction,
  createProjectPhaseSupplyAction,
  deleteProjectExpenseAction,
  updateProjectExpenseAction
} from "../app/actions";
import { AttachmentSection } from "./attachment-section";
import { CompactBudgetPreview } from "./compact-budget-preview";
import { CompactSupplyPreview } from "./compact-supply-preview";
import { ExpandableCard } from "./expandable-card";
import { PlanningSuppliesTable } from "./planning-supplies-table";
import { ProjectBudgetBreakdown } from "./project-budget-breakdown";
import { ProjectPhaseTimeline } from "./project-phase-timeline";
import { getProjectPhaseDetails } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/formatters";

type ProjectPhaseDetailsSectionProps = {
  householdId: string;
  project: ProjectDetail;
  focusedPhaseId?: string | undefined;
  householdMembers: HouseholdMember[];
  serviceProviders: ServiceProvider[];
  inventoryItems: InventoryItemSummary[];
  projectBudgetAnalysis: ProjectBudgetAnalysis | null;
};

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

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

export async function ProjectPhaseDetailsSection({
  householdId,
  project,
  focusedPhaseId,
  householdMembers,
  serviceProviders,
  inventoryItems,
  projectBudgetAnalysis
}: ProjectPhaseDetailsSectionProps): Promise<JSX.Element> {
  const phaseDetails = await getProjectPhaseDetails(householdId, project.id);
  const phaseNameLookup = new Map(project.phases.map((phase) => [phase.id, phase.name]));
  const budgetCategoryLookup = new Map(project.budgetCategories.map((category) => [category.id, category.name]));
  const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const allSupplies = phaseDetails.flatMap((phase) => phase.supplies);
  const allSuppliesWithPhase = allSupplies.map((s) => ({ ...s, phaseName: phaseNameLookup.get(s.phaseId) ?? "—" }));
  const estimatedProcurementCost = allSupplies.reduce((sum, supply) => sum + ((supply.estimatedUnitCost ?? 0) * supply.quantityNeeded), 0);
  const remainingProcurementCost = allSupplies.reduce((sum, supply) => {
    const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
    return sum + ((supply.estimatedUnitCost ?? 0) * quantityRemaining);
  }, 0);

  return (
    <>
      <ProjectPhaseTimeline
        householdId={householdId}
        projectId={project.id}
        focusedPhaseId={focusedPhaseId}
        phases={project.phases}
        phaseDetails={phaseDetails}
        allTasks={project.tasks.filter((task) => task.taskType !== "quick")}
        householdMembers={householdMembers}
        serviceProviders={serviceProviders}
        budgetCategories={project.budgetCategories}
        inventoryItems={inventoryItems}
        addPhaseForm={(
          <form action={createProjectPhaseAction}>
            <input type="hidden" name="householdId" value={householdId} />
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
            householdId={householdId}
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
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <div className="schedule-card__summary" style={{ marginBottom: 16 }}>
                      <div>
                        <div className="data-table__primary">{expense.description}</div>
                        <div className="data-table__secondary">
                          Phase: {expense.phaseId ? (phaseNameLookup.get(expense.phaseId) ?? "Unknown phase") : "Unphased"}
                          {" · "}
                          Budget category: {expense.budgetCategoryId ? (project.budgetCategories.find((category) => category.id === expense.budgetCategoryId)?.name ?? "Unknown category") : "Uncategorized"}
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
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="expenseId" value={expense.id} />
                    <button type="submit" className="button button--danger">Delete Expense</button>
                  </form>
                  <AttachmentSection
                    householdId={householdId}
                    entityType="project_expense"
                    entityId={expense.id}
                    compact
                    label="Receipts"
                  />
                </div>
              ))}
            </div>
            <form action={createProjectExpenseAction} style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <input type="hidden" name="householdId" value={householdId} />
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
              householdId={householdId}
              projectId={project.id}
              phases={project.phases}
              inventoryItems={inventoryItems}
            />
          ) : null}
          <PlanningSuppliesTable
            householdId={householdId}
            projectId={project.id}
            supplies={allSuppliesWithPhase}
            phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
            inventoryItems={inventoryItems}
          />
        </div>
      </ExpandableCard>
    </>
  );
}