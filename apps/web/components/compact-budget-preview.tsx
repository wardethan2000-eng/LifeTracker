import { CompactPreview } from "./compact-preview";

type BudgetCategory = {
  id: string;
  name: string;
  budgetAmount: number | null | undefined;
};

type Expense = {
  id: string;
  amount: number;
  budgetCategoryId: string | null | undefined;
};

type Props = {
  budgetAmount: number | null | undefined;
  totalSpent: number;
  categories: BudgetCategory[];
  expenses: Expense[];
};

function formatCurrencySimple(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CompactBudgetPreview({ budgetAmount, totalSpent, categories, expenses }: Props) {
  const budget = budgetAmount ?? 0;
  const remaining = budget - totalSpent;
  const spentPct = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 0;

  const categorySpend = categories.map((cat) => {
    const spent = expenses
      .filter((e) => e.budgetCategoryId === cat.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { ...cat, spent };
  });

  const topCategories = categorySpend
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  return (
    <div className="compact-preview">
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center" }}>
        <span className="compact-preview__pill">{formatCurrencySimple(totalSpent)} spent</span>
        {budget > 0 ? (
          <>
            <span className="compact-preview__pill">of {formatCurrencySimple(budget)} budget</span>
            <span className={`compact-preview__pill${remaining < 0 ? " compact-preview__pill--danger" : ""}`}>
              {remaining >= 0 ? formatCurrencySimple(remaining) + " remaining" : formatCurrencySimple(Math.abs(remaining)) + " over"}
            </span>
            <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>{spentPct}% used</span>
          </>
        ) : null}
      </div>
      {topCategories.length > 0 ? (
        <CompactPreview
          layout="table"
          ariaLabel="Budget categories preview"
          items={topCategories.map((cat) => ({
            id: cat.id,
            label: cat.name,
            value: formatCurrencySimple(cat.spent),
          }))}
          emptyMessage="No expenses logged yet"
        />
      ) : (
        <p className="compact-preview__empty">No expenses logged yet</p>
      )}
      {expenses.length > 0 ? (
        <p className="compact-preview__overflow">{expenses.length} expense{expenses.length !== 1 ? "s" : ""} total — expand to manage</p>
      ) : null}
    </div>
  );
}
