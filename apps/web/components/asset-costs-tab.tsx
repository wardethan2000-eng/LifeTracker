import type {
  AssetCostPerUnit,
  AssetCostSummary,
  CostForecast
} from "@lifekeeper/types";
import type { JSX } from "react";
import { AssetCostCharts } from "./asset-cost-charts";
import { formatCurrency } from "../lib/formatters";

type AssetCostsTabProps = {
  costSummary: AssetCostSummary | null;
  costPerUnit: AssetCostPerUnit | null;
  costForecast: CostForecast | null;
};

export async function AssetCostsTab({ costSummary, costPerUnit, costForecast }: AssetCostsTabProps): Promise<JSX.Element> {
  const totalLogs = costSummary?.costByMonth.reduce((sum, entry) => sum + entry.logCount, 0) ?? 0;
  const normalizedMetrics = costPerUnit?.metrics.filter((metric) => metric.costPerUnit !== null) ?? [];

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>Lifetime Cost Summary</h2>
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "20px" }}>
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Lifetime Cost</span>
              <strong className="stat-card__value">{formatCurrency(costSummary?.lifetimeCost ?? 0, "$0.00")}</strong>
              <span className="stat-card__sub">All recorded maintenance spend for this asset</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Year-to-Date Cost</span>
              <strong className="stat-card__value">{formatCurrency(costSummary?.yearToDateCost ?? 0, "$0.00")}</strong>
              <span className="stat-card__sub">Current calendar year</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Rolling 12-Month Average</span>
              <strong className="stat-card__value">{formatCurrency(costSummary?.rolling12MonthAverage ?? 0, "$0.00")}</strong>
              <span className="stat-card__sub">Average monthly spend over the last year</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Total Logs</span>
              <strong className="stat-card__value">{totalLogs}</strong>
              <span className="stat-card__sub">Maintenance records counted in cost history</span>
            </div>
          </section>

          <AssetCostCharts
            costByYear={costSummary?.costByYear ?? []}
            forecast={costForecast}
          />

          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Cost</th>
                <th>Logs</th>
              </tr>
            </thead>
            <tbody>
              {costSummary?.costByYear.length ? costSummary.costByYear.map((entry) => (
                <tr key={entry.year}>
                  <td>{entry.year}</td>
                  <td>{formatCurrency(entry.totalCost, "$0.00")}</td>
                  <td>{entry.logCount}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="panel__empty">No maintenance cost history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {normalizedMetrics.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <h2>Cost per Unit</h2>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              {normalizedMetrics.map((metric) => (
                <div key={metric.metricId}>
                  <dt>{metric.metricName}</dt>
                  <dd>
                    <strong>{formatCurrency(metric.costPerUnit, "$0.00")} per {metric.metricUnit}</strong>
                    <br />
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
                      {formatCurrency(metric.totalCost, "$0.00")} across {metric.totalUsage.toFixed(1)} {metric.metricUnit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Top Schedules by Cost</h2>
        </div>
        <div className="panel__body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Schedule Name</th>
                <th>Total Spent</th>
                <th>Occurrences</th>
                <th>Average Cost</th>
              </tr>
            </thead>
            <tbody>
              {costSummary?.topSchedulesByCost.length ? costSummary.topSchedulesByCost.map((schedule) => (
                <tr key={schedule.scheduleId}>
                  <td>{schedule.scheduleName}</td>
                  <td>{formatCurrency(schedule.totalCost, "$0.00")}</td>
                  <td>{schedule.occurrences}</td>
                  <td>{formatCurrency(schedule.averageCost, "$0.00")}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="panel__empty">No schedule-linked maintenance cost history yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Cost Forecast</h2>
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "20px" }}>
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Projected 3-Month</span>
              <strong className="stat-card__value">{formatCurrency(costForecast?.total3m ?? 0, "$0.00")}</strong>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Projected 6-Month</span>
              <strong className="stat-card__value">{formatCurrency(costForecast?.total6m ?? 0, "$0.00")}</strong>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Projected 12-Month</span>
              <strong className="stat-card__value">{formatCurrency(costForecast?.total12m ?? 0, "$0.00")}</strong>
            </div>
          </section>

          {costForecast?.schedules.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Schedule Name</th>
                  <th>Est. Cost Each</th>
                  <th>3-Month</th>
                  <th>6-Month</th>
                  <th>12-Month</th>
                </tr>
              </thead>
              <tbody>
                {costForecast.schedules.map((schedule) => (
                  <tr key={schedule.scheduleId}>
                    <td>{schedule.scheduleName}</td>
                    <td>{formatCurrency(schedule.costPerOccurrence, "No estimate")}</td>
                    <td>{schedule.occurrences3m} x {formatCurrency(schedule.cost3m, "$0.00")}</td>
                    <td>{schedule.occurrences6m} x {formatCurrency(schedule.cost6m, "$0.00")}</td>
                    <td>{schedule.occurrences12m} x {formatCurrency(schedule.cost12m, "$0.00")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="panel__empty">Add cost data to maintenance logs or set estimated costs on schedules to enable forecasting.</p>
          )}
        </div>
      </section>
    </div>
  );
}