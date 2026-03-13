import type { ProjectBudgetCategorySummary, ProjectExpense, ProjectPhaseDetail } from "@lifekeeper/types";
import {
  createProjectBudgetCategoryAction,
  deleteProjectBudgetCategoryAction,
  updateProjectBudgetCategoryAction
} from "../app/actions";
import { formatCurrency } from "../lib/formatters";

type ProjectBudgetBreakdownProps = {
  householdId: string;
  projectId: string;
  projectBudgetAmount: number | null;
  categories: ProjectBudgetCategorySummary[];
  expenses: ProjectExpense[];
  phaseDetails: ProjectPhaseDetail[];
};

export function ProjectBudgetBreakdown({
  householdId,
  projectId,
  projectBudgetAmount,
  categories,
  expenses,
  phaseDetails
}: ProjectBudgetBreakdownProps) {
  const categoryAllocatedBudget = categories.reduce((sum, category) => sum + (category.budgetAmount ?? 0), 0);
  const phaseAllocatedBudget = phaseDetails.reduce((sum, phase) => sum + (phase.budgetAmount ?? 0), 0);
  const actualSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const estimatedRemainingProcurementCost = phaseDetails
    .flatMap((phase) => phase.supplies)
    .reduce((sum, supply) => {
      const unitCost = supply.estimatedUnitCost ?? 0;
      const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
      return sum + (quantityRemaining * unitCost);
    }, 0);
  const committedCost = actualSpend + estimatedRemainingProcurementCost;
  const contingencyCategory = categories.find((category) => category.name.toLowerCase().includes("contingency"));
  const forecastedTotal = committedCost + (contingencyCategory?.budgetAmount ?? 0);
  const budgetBasis = Math.max(categoryAllocatedBudget, phaseAllocatedBudget);
  const unallocatedBudget = projectBudgetAmount !== null
    ? projectBudgetAmount - budgetBasis
    : null;
  const uncategorizedSpend = expenses
    .filter((expense) => !expense.budgetCategoryId)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const budgetHealth = projectBudgetAmount && projectBudgetAmount > 0
    ? Math.min((actualSpend / projectBudgetAmount) * 100, 100)
    : 0;

  return (
    <section className="panel detail-tile">
      <div className="panel__header">
        <div>
          <h2>Budget Breakdown</h2>
          <p className="data-table__secondary">Track structured category budgets alongside phase allocations, actual spend, and remaining procurement exposure.</p>
        </div>
      </div>

      <div className="panel__body--padded">
        <div className="stats-row" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <span className="stat-card__label">Total Project Budget</span>
            <strong className="stat-card__value">{formatCurrency(projectBudgetAmount, "Unbudgeted")}</strong>
            <span className="stat-card__sub">Category allocated {formatCurrency(categoryAllocatedBudget, "$0.00")}</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Phase Allocation</span>
            <strong className="stat-card__value">{formatCurrency(phaseAllocatedBudget, "$0.00")}</strong>
            <span className="stat-card__sub">
              {unallocatedBudget !== null
                ? (unallocatedBudget >= 0 ? `${formatCurrency(unallocatedBudget, "$0.00")} unallocated` : `${formatCurrency(Math.abs(unallocatedBudget), "$0.00")} over-allocated`)
                : "No project budget set"}
            </span>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">Committed Cost</span>
            <strong className="stat-card__value">{formatCurrency(committedCost, "$0.00")}</strong>
            <span className="stat-card__sub">Forecast {formatCurrency(forecastedTotal, "$0.00")}</span>
          </div>
        </div>

        <div className="project-meter" style={{ marginBottom: 20 }}>
          <div className="project-meter__labels">
            <span>Budget health</span>
            <strong>{Math.round(budgetHealth)}%</strong>
          </div>
          <div className="project-meter__track">
            <span className="project-meter__fill" style={{ width: `${budgetHealth}%` }} />
          </div>
        </div>

        <div className="schedule-stack">
          {categories.map((category) => {
            const remaining = (category.budgetAmount ?? 0) - category.actualSpend;
            const meter = category.budgetAmount && category.budgetAmount > 0
              ? Math.min((category.actualSpend / category.budgetAmount) * 100, 100)
              : 0;

            return (
              <div key={category.id} className="schedule-card">
                <form action={updateProjectBudgetCategoryAction}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div className="form-grid">
                    <label className="field">
                      <span>Category</span>
                      <input name="name" defaultValue={category.name} required />
                    </label>
                    <label className="field">
                      <span>Budget Amount</span>
                      <input name="budgetAmount" type="number" min="0" step="0.01" defaultValue={category.budgetAmount ?? ""} />
                    </label>
                    <label className="field">
                      <span>Sort Order</span>
                      <input name="sortOrder" type="number" step="1" defaultValue={category.sortOrder ?? ""} />
                    </label>
                    <label className="field field--full">
                      <span>Notes</span>
                      <textarea name="notes" rows={2} defaultValue={category.notes ?? ""} />
                    </label>
                  </div>

                  <div className="project-meter" style={{ marginTop: 16 }}>
                    <div className="project-meter__labels">
                      <span>{formatCurrency(category.actualSpend, "$0.00")} spent across {category.expenseCount} expenses</span>
                      <strong>{formatCurrency(remaining, "$0.00")}</strong>
                    </div>
                    <div className="project-meter__track">
                      <span className="project-meter__fill project-meter__fill--secondary" style={{ width: `${meter}%` }} />
                    </div>
                  </div>

                  <div className="inline-actions" style={{ marginTop: 16 }}>
                    <button type="submit" className="button button--ghost">Save Category</button>
                  </div>
                </form>

                <form action={deleteProjectBudgetCategoryAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button type="submit" className="button button--danger">Delete Category</button>
                </form>
              </div>
            );
          })}

          <div className="schedule-card">
            <div className="data-table__primary">Uncategorized</div>
            <div className="data-table__secondary">{formatCurrency(uncategorizedSpend, "$0.00")} across expenses without a budget category.</div>
          </div>
        </div>

        <form action={createProjectBudgetCategoryAction} style={{ marginTop: 20 }}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <div className="form-grid">
            <label className="field">
              <span>Category Name</span>
              <input name="name" placeholder="Materials, Labor, Permits & Fees" required />
            </label>
            <label className="field">
              <span>Budget Amount</span>
              <input name="budgetAmount" type="number" min="0" step="0.01" placeholder="0.00" />
            </label>
            <label className="field">
              <span>Sort Order</span>
              <input name="sortOrder" type="number" step="1" placeholder="0" />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea name="notes" rows={2} placeholder="Describe what belongs in this category and any assumptions behind the budget figure." />
            </label>
          </div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button">Add Category</button>
          </div>
        </form>
      </div>
    </section>
  );
}