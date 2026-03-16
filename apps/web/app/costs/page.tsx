import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import {
  getHouseholdCostDashboard,
  getHouseholdCostForecast,
  getMe,
  getServiceProviderSpend
} from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/formatters";

type CostsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

export default async function CostsPage({ searchParams }: CostsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const me = await getMe();
  const household = me.households.find((item) => item.id === getParam(params.householdId)) ?? me.households[0];

  if (!household) {
    return (
      <AppShell activePath="/costs">
        <header className="page-header"><h1>Cost Analytics</h1></header>
        <div className="page-body">
          <section className="panel"><div className="panel__body"><p className="panel__empty">No household found.</p></div></section>
        </div>
      </AppShell>
    );
  }

  const [dashboard, serviceProviderSpend, forecast] = await Promise.all([
    getHouseholdCostDashboard(household.id).catch(() => null),
    getServiceProviderSpend(household.id).catch(() => null),
    getHouseholdCostForecast(household.id).catch(() => null)
  ]);
  const assetCount = dashboard ? new Set(dashboard.spendByAsset.map((asset) => asset.assetId)).size : 0;
  const averagePerAsset = dashboard && assetCount > 0 ? dashboard.totalSpend / assetCount : 0;
  const currentMonth = `${new Date().getUTCFullYear()}-${`${new Date().getUTCMonth() + 1}`.padStart(2, "0")}`;
  const totalMaintenanceSpend = dashboard?.totalSpend ?? 0;

  return (
    <AppShell activePath="/costs">
      <header className="page-header">
        <div>
          <h1>Cost Analytics</h1>
          <p>{dashboard ? `${formatDate(dashboard.periodStart)} through ${formatDate(dashboard.periodEnd)}` : "Household spending intelligence"}</p>
        </div>
      </header>

      <div className="page-body">
        <section className="stats-row">
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Total Spend</span>
            <strong className="stat-card__value">{formatCurrency(dashboard?.totalSpend ?? 0, "$0.00")}</strong>
            <span className="stat-card__sub">Maintenance spend for the selected period</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Asset Count</span>
            <strong className="stat-card__value">{assetCount}</strong>
            <span className="stat-card__sub">Assets with logged spend</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Average per Asset</span>
            <strong className="stat-card__value">{formatCurrency(averagePerAsset, "$0.00")}</strong>
            <span className="stat-card__sub">Average spend across active assets</span>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">Projected 12-Month</span>
            <strong className="stat-card__value">{formatCurrency(forecast?.total12m ?? 0, "$0.00")}</strong>
            <span className="stat-card__sub">Scheduled maintenance forecast</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Spending by Category</h2>
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: "14px" }}>
            {dashboard?.spendByCategory.length ? dashboard.spendByCategory.map((category) => {
              const percent = dashboard.totalSpend > 0 ? (category.totalCost / dashboard.totalSpend) * 100 : 0;

              return (
                <div key={category.category} className="cost-bar">
                  <div className="cost-bar__label">{category.categoryLabel}</div>
                  <div style={{ position: "relative", height: 28 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: "var(--surface-raised, var(--surface-alt))" }} />
                    <div style={{ position: "relative", height: "100%", width: `${percent}%`, borderRadius: 4, background: "var(--accent)", transition: "width 300ms ease" }} />
                  </div>
                  <div className="cost-bar__value">
                    <strong>{formatCurrency(category.totalCost, "$0.00")}</strong>
                    <br />
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{percent.toFixed(1)}% · {category.assetCount} assets · {category.logCount} logs</span>
                  </div>
                </div>
              );
            }) : <p className="panel__empty">No category spend data is available yet.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Spending by Asset</h2>
          </div>
          <div className="panel__body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Total Cost</th>
                  <th>Logs</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.spendByAsset.length ? dashboard.spendByAsset.slice(0, 20).map((asset) => (
                  <tr key={asset.assetId}>
                    <td><Link href={`/assets/${asset.assetId}?tab=costs`} className="data-table__link">{asset.assetName}</Link></td>
                    <td>{asset.category}</td>
                    <td>{formatCurrency(asset.totalCost, "$0.00")}</td>
                    <td>{asset.logCount}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="panel__empty">No asset spend data is available yet.</td></tr>}
              </tbody>
            </table>
            {dashboard && dashboard.spendByAsset.length > 20 ? (
              <p style={{ padding: "0 20px 20px", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
                Showing top 20 assets by spend. {dashboard.spendByAsset.length - 20} more assets have activity in this period.
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Monthly Spend Trend</h2>
          </div>
          <div className="panel__body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Cost</th>
                  <th>Logs</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.spendByMonth.length ? dashboard.spendByMonth.map((month) => {
                  const maxMonthSpend = Math.max(...dashboard.spendByMonth.map((entry) => entry.totalCost), 1);

                  return (
                    <tr key={month.month}>
                      <td>
                        {month.month}
                        {month.month === currentMonth ? <span className="pill" style={{ marginLeft: 8 }}>Current</span> : null}
                      </td>
                      <td>{formatCurrency(month.totalCost, "$0.00")}</td>
                      <td>{month.logCount}</td>
                      <td>
                        <div style={{ width: 120, height: 8, borderRadius: 999, background: "var(--surface-raised, var(--surface-alt))", overflow: "hidden" }}>
                          <div style={{ width: `${(month.totalCost / maxMonthSpend) * 100}%`, height: "100%", background: "var(--accent)" }} />
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={4} className="panel__empty">No monthly trend data is available yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Service Provider Analysis</h2>
          </div>
          <div className="panel__body--padded">
            {serviceProviderSpend?.providers.length ? (
              <div className="schedule-stack">
                {serviceProviderSpend.providers.map((provider) => {
                  const highConcentration = totalMaintenanceSpend > 0 && provider.totalMaintenanceCost / totalMaintenanceSpend > 0.4;

                  return (
                    <article key={provider.providerId} className="schedule-card">
                      <div className="schedule-card__summary">
                        <div>
                          <h3>{provider.providerName}</h3>
                          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>{provider.specialty ?? "General service provider"}</p>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {highConcentration ? <span className="concentration-pill">High concentration</span> : null}
                          <span className="pill">{formatCurrency(provider.totalCombinedCost, "$0.00")}</span>
                        </div>
                      </div>
                      <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                        Maintenance: {formatCurrency(provider.totalMaintenanceCost, "$0.00")} ({provider.maintenanceLogCount} logs)
                        {" · "}
                        Projects: {formatCurrency(provider.totalProjectCost, "$0.00")} ({provider.projectExpenseCount} expenses)
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : <p className="panel__empty">No service provider spend data is available yet.</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Cost Forecast</h2>
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 20 }}>
            <section className="stats-row">
              <div className="stat-card stat-card--accent">
                <span className="stat-card__label">3-Month</span>
                <strong className="stat-card__value">{formatCurrency(forecast?.total3m ?? 0, "$0.00")}</strong>
              </div>
              <div className="stat-card stat-card--warning">
                <span className="stat-card__label">6-Month</span>
                <strong className="stat-card__value">{formatCurrency(forecast?.total6m ?? 0, "$0.00")}</strong>
              </div>
              <div className="stat-card stat-card--danger">
                <span className="stat-card__label">12-Month</span>
                <strong className="stat-card__value">{formatCurrency(forecast?.total12m ?? 0, "$0.00")}</strong>
              </div>
            </section>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>3-Month</th>
                  <th>6-Month</th>
                  <th>12-Month</th>
                </tr>
              </thead>
              <tbody>
                {forecast?.byAsset.length ? forecast.byAsset.map((asset) => (
                  <tr key={asset.assetId}>
                    <td><Link href={`/assets/${asset.assetId}?tab=costs`} className="data-table__link">{asset.assetName}</Link></td>
                    <td>{formatCurrency(asset.cost3m, "$0.00")}</td>
                    <td>{formatCurrency(asset.cost6m, "$0.00")}</td>
                    <td>{formatCurrency(asset.cost12m, "$0.00")}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="panel__empty">No forecast data is available yet.</td></tr>}
              </tbody>
            </table>

            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Schedule-level forecast breakdown</summary>
              <div style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Schedule</th>
                      <th>Asset</th>
                      <th>Est. Cost Each</th>
                      <th>3-Month</th>
                      <th>6-Month</th>
                      <th>12-Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast?.schedules.length ? forecast.schedules.map((schedule) => (
                      <tr key={schedule.scheduleId}>
                        <td>{schedule.scheduleName}</td>
                        <td>{schedule.assetName}</td>
                        <td>{formatCurrency(schedule.costPerOccurrence, "No estimate")}</td>
                        <td>{schedule.occurrences3m} · {formatCurrency(schedule.cost3m, "$0.00")}</td>
                        <td>{schedule.occurrences6m} · {formatCurrency(schedule.cost6m, "$0.00")}</td>
                        <td>{schedule.occurrences12m} · {formatCurrency(schedule.cost12m, "$0.00")}</td>
                      </tr>
                    )) : <tr><td colSpan={6} className="panel__empty">No schedule-level forecast data is available yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
      </div>
    </AppShell>
  );
}