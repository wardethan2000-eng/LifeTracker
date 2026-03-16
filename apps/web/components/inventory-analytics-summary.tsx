import type { JSX } from "react";
import { getInventoryAnalyticsSummary } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type InventoryAnalyticsSummaryProps = {
  householdId: string;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short"
});

const getBarWidth = (value: number, max: number): string => {
  if (max <= 0 || value <= 0) {
    return "0%";
  }

  return `${Math.max((value / max) * 100, 4)}%`;
};

const formatMonthLabel = (month: string): string => {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart ?? "1970");
  const monthValue = Number(monthPart ?? "1");
  const date = new Date(Date.UTC(year, monthValue - 1, 1));
  return `${monthFormatter.format(date)} '${String(year).slice(-2)}`;
};

export async function InventoryAnalyticsSummary({ householdId }: InventoryAnalyticsSummaryProps): Promise<JSX.Element> {
  const analytics = await getInventoryAnalyticsSummary(householdId);
  const topConsumerMax = Math.max(...analytics.topConsumers.map((item) => item.totalConsumed), 0);
  const categoryMax = Math.max(...analytics.categoryBreakdown.map((item) => item.totalSpentLast12Months), 0);
  const monthlyMax = Math.max(...analytics.monthlySpending.map((item) => item.totalSpent), 0);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="stats-row">
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">Total Inventory Value</span>
          <strong className="stat-card__value">{formatCurrency(analytics.totalValue, "—")}</strong>
          <span className="stat-card__sub">Current on-hand value with known costs</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Spent Last 30 Days</span>
          <strong className="stat-card__value">{formatCurrency(analytics.totalSpentLast30Days, "—")}</strong>
          <span className="stat-card__sub">Recent inventory consumption cost</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__label">Spent Last 12 Months</span>
          <strong className="stat-card__value">{formatCurrency(analytics.totalSpentLast12Months, "—")}</strong>
          <span className="stat-card__sub">Trailing yearly parts and supplies spend</span>
        </div>
        <div className={`stat-card${analytics.staleItemCount > 0 ? " stat-card--warning" : ""}`}>
          <span className="stat-card__label">Stale Items</span>
          <strong className="stat-card__value">{analytics.staleItemCount}</strong>
          <span className="stat-card__sub">Items with no recent consumption activity</span>
        </div>
      </section>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel__header">
            <h2>Top Consumers (12 Months)</h2>
          </div>
          <div className="panel__body">
            {analytics.topConsumers.length === 0 ? (
              <p className="panel__empty">No consumption activity has been recorded in the last 12 months.</p>
            ) : (
              analytics.topConsumers.map((item) => (
                <div key={item.inventoryItemId} className="analytics-chart-bar">
                  <div className="analytics-chart-bar__label" title={item.itemName}>{item.itemName}</div>
                  <div className="analytics-chart-bar__track">
                    <div className="analytics-chart-bar__fill analytics-chart-bar__fill--warning" style={{ width: getBarWidth(item.totalConsumed, topConsumerMax) }} />
                  </div>
                  <div className="analytics-chart-bar__value">{item.totalConsumed} • {formatCurrency(item.totalSpent, "—")}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Spending by Category</h2>
          </div>
          <div className="panel__body">
            {analytics.categoryBreakdown.length === 0 ? (
              <p className="panel__empty">No category spending has been recorded yet.</p>
            ) : (
              analytics.categoryBreakdown.map((entry) => (
                <div key={entry.category} className="analytics-chart-bar">
                  <div className="analytics-chart-bar__label" title={entry.category}>{entry.category}</div>
                  <div className="analytics-chart-bar__track">
                    <div className="analytics-chart-bar__fill" style={{ width: getBarWidth(entry.totalSpentLast12Months, categoryMax) }} />
                  </div>
                  <div className="analytics-chart-bar__value">{formatCurrency(entry.totalSpentLast12Months, "—")} • {entry.itemCount}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h2>Monthly Inventory Spending</h2>
        </div>
        <div className="panel__body">
          {analytics.monthlySpending.map((entry) => (
            <div key={entry.month} className="analytics-chart-bar">
              <div className="analytics-chart-bar__label">{formatMonthLabel(entry.month)}</div>
              <div className="analytics-chart-bar__track">
                <div className="analytics-chart-bar__fill analytics-chart-bar__fill--success" style={{ width: getBarWidth(entry.totalSpent, monthlyMax) }} />
              </div>
              <div className="analytics-chart-bar__value">{formatCurrency(entry.totalSpent, "—")} • {entry.transactionCount}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}