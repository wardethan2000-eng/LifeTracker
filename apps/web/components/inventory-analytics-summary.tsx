import type { JSX } from "react";
import { LkBarChart, LkDonutChart, LkLineChart, formatCurrencyTick, formatMonthTick } from "./charts";
import { getInventoryAnalyticsSummary } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type InventoryAnalyticsSummaryProps = {
  householdId: string;
};

export async function InventoryAnalyticsSummary({ householdId }: InventoryAnalyticsSummaryProps): Promise<JSX.Element> {
  const analytics = await getInventoryAnalyticsSummary(householdId);

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
          <div className="panel__body--padded">
            <LkBarChart
              data={analytics.topConsumers.map((item) => ({
                itemName: item.itemName,
                totalConsumed: item.totalConsumed
              }))}
              xKey="itemName"
              bars={[{ dataKey: "totalConsumed", label: "Consumed" }]}
              layout="vertical"
              height={300}
              emptyMessage="No consumption activity has been recorded in the last 12 months."
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Spending by Category</h2>
          </div>
          <div className="panel__body--padded">
            <LkDonutChart
              data={analytics.categoryBreakdown.map((entry) => ({
                name: entry.category,
                value: entry.totalSpentLast12Months
              }))}
              centerValue={formatCurrency(analytics.totalSpentLast12Months, "—")}
              centerLabel="12-Month Spend"
              emptyMessage="No category spending has been recorded yet."
            />
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h2>Monthly Inventory Spending</h2>
        </div>
        <div className="panel__body--padded">
          <LkLineChart
            data={analytics.monthlySpending.map((entry) => ({
              month: entry.month,
              totalSpent: entry.totalSpent,
              transactionCount: entry.transactionCount
            }))}
            xKey="month"
            xTickFormatter={formatMonthTick}
            yTickFormatter={formatCurrencyTick}
            lines={[{ dataKey: "totalSpent", label: "Monthly Spend" }]}
            emptyMessage="No monthly inventory spending is available yet."
          />
        </div>
      </section>
    </div>
  );
}