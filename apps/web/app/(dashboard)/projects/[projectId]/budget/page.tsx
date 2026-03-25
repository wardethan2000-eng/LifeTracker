import type { JSX } from "react";
import { Suspense } from "react";
import {
  createProjectExpenseAction,
  updateProjectExpenseAction,
  deleteProjectExpenseAction,
} from "../../../../actions";
import { ProjectBudgetBreakdown } from "../../../../../components/project-budget-breakdown";
import { ApiError, getMe, getProjectDetail, getProjectPhaseDetails } from "../../../../../lib/api";
import { formatCurrency, formatDate } from "../../../../../lib/formatters";

type ProjectBudgetPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectBudgetPage({ params, searchParams }: ProjectBudgetPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    return (
      <section id="project-budget">
        <Suspense fallback={<BudgetSkeleton />}>
          <ProjectBudgetAsync householdId={household.id} projectId={projectId} />
        </Suspense>
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load budget: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

const BudgetSkeleton = (): JSX.Element => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="skeleton-bar" style={{ height: 120, borderRadius: 8 }} />
    <div className="skeleton-bar" style={{ height: 80, borderRadius: 8 }} />
    <div className="skeleton-bar" style={{ height: 80, borderRadius: 8 }} />
  </div>
);

async function ProjectBudgetAsync({
  householdId,
  projectId,
}: {
  householdId: string;
  projectId: string;
}): Promise<JSX.Element> {
  const [project, phaseDetails] = await Promise.all([
    getProjectDetail(householdId, projectId),
    getProjectPhaseDetails(householdId, projectId),
  ]);

  const phaseLookup = new Map(project.phases.map((phase) => [phase.id, phase.name]));
  const categoryLookup = new Map(project.budgetCategories.map((cat) => [cat.id, cat.name]));
  const sortedExpenses = [...project.expenses].sort((a, b) => {
    const dateA = a.date ?? a.createdAt;
    const dateB = b.date ?? b.createdAt;
    return dateB.localeCompare(dateA);
  });

  return (
    <>
      <ProjectBudgetBreakdown
        householdId={householdId}
        projectId={projectId}
        projectBudgetAmount={project.budgetAmount}
        categories={project.budgetCategories}
        expenses={project.expenses}
        phaseDetails={phaseDetails}
      />

      <section className="panel detail-tile" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <div>
            <h2>Expense Log</h2>
            <p className="data-table__secondary">All recorded expenses for this project.</p>
          </div>
        </div>

        {/* Add expense form */}
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9375rem", padding: "4px 0" }}>+ Add Expense</summary>
            <form action={createProjectExpenseAction} style={{ marginTop: 16 }}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <div className="workbench-grid" style={{ gap: 12 }}>
                <label className="field">
                  <span>Description</span>
                  <input name="description" required placeholder="What was purchased or paid for?" />
                </label>
                <label className="field">
                  <span>Amount</span>
                  <input name="amount" type="number" min="0" step="0.01" required placeholder="0.00" />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input name="date" type="date" />
                </label>
                <label className="field">
                  <span>Phase</span>
                  <select name="phaseId" defaultValue="">
                    <option value="">No phase</option>
                    {project.phases.map((phase) => (
                      <option key={phase.id} value={phase.id}>{phase.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Budget Category</span>
                  <select name="budgetCategoryId" defaultValue="">
                    <option value="">Uncategorized</option>
                    {project.budgetCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Category (freeform)</span>
                  <input name="category" placeholder="Materials, Labor, Permits…" />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea name="notes" rows={2} placeholder="Optional notes about this expense" />
                </label>
              </div>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="button">Add Expense</button>
              </div>
            </form>
          </details>
        </div>

        {/* Expense list */}
        {sortedExpenses.length === 0 ? (
          <p className="panel__empty">No expenses recorded yet. Add one above.</p>
        ) : (
          <div className="workbench-table">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Phase</th>
                  <th>Category</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <details>
                        <summary style={{ cursor: "pointer", listStyle: "none" }}>
                          <span className="data-table__primary">{expense.description}</span>
                          {expense.notes ? (
                            <span className="data-table__secondary" style={{ display: "block", marginTop: 2 }}>{expense.notes}</span>
                          ) : null}
                        </summary>
                        <form action={updateProjectExpenseAction} style={{ marginTop: 12, padding: "12px", background: "var(--surface-hover)", borderRadius: "6px" }}>
                          <input type="hidden" name="householdId" value={householdId} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <div className="workbench-grid" style={{ gap: 10 }}>
                            <label className="field">
                              <span>Description</span>
                              <input name="description" defaultValue={expense.description} required />
                            </label>
                            <label className="field">
                              <span>Amount</span>
                              <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} required />
                            </label>
                            <label className="field">
                              <span>Date</span>
                              <input name="date" type="date" defaultValue={expense.date ? expense.date.slice(0, 10) : ""} />
                            </label>
                            <label className="field">
                              <span>Phase</span>
                              <select name="phaseId" defaultValue={expense.phaseId ?? ""}>
                                <option value="">No phase</option>
                                {project.phases.map((phase) => (
                                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Budget Category</span>
                              <select name="budgetCategoryId" defaultValue={expense.budgetCategoryId ?? ""}>
                                <option value="">Uncategorized</option>
                                {project.budgetCategories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Category (freeform)</span>
                              <input name="category" defaultValue={expense.category ?? ""} />
                            </label>
                            <label className="field field--full">
                              <span>Notes</span>
                              <textarea name="notes" rows={2} defaultValue={expense.notes ?? ""} />
                            </label>
                          </div>
                          <div className="inline-actions" style={{ marginTop: 10 }}>
                            <button type="submit" className="button button--ghost button--sm">Save</button>
                            <button formAction={deleteProjectExpenseAction} className="button button--danger button--sm">Delete</button>
                          </div>
                        </form>
                      </details>
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <strong>{formatCurrency(expense.amount)}</strong>
                    </td>
                    <td className="data-table__secondary" style={{ whiteSpace: "nowrap" }}>
                      {expense.date ? formatDate(expense.date) : "—"}
                    </td>
                    <td className="data-table__secondary">
                      {expense.phaseId ? phaseLookup.get(expense.phaseId) ?? "—" : "—"}
                    </td>
                    <td>
                      {expense.budgetCategoryId ? (
                        <span className="pill pill--muted">{categoryLookup.get(expense.budgetCategoryId) ?? "—"}</span>
                      ) : expense.category ? (
                        <span className="data-table__secondary">{expense.category}</span>
                      ) : (
                        <span className="data-table__secondary">—</span>
                      )}
                    </td>
                    <td>
                      <form action={deleteProjectExpenseAction} style={{ display: "inline" }}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <button type="submit" className="button button--ghost button--sm button--danger">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
