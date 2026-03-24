import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { AnalyticsPanelBoundary, AnalyticsPanelSkeleton } from "../../../components/analytics-panel-boundary";
import { InventoryAnalyticsAssetParts } from "../../../components/inventory-analytics-asset-parts";
import { InventoryAnalyticsCommonality } from "../../../components/inventory-analytics-commonality";
import { InventoryAnalyticsReorder } from "../../../components/inventory-analytics-reorder";
import { InventoryAnalyticsSummary } from "../../../components/inventory-analytics-summary";
import { InventoryAnalyticsTurnover } from "../../../components/inventory-analytics-turnover";
import { AnnualCostReportButton } from "../../../components/report-download-actions";
import { LkBarChart, LkDonutChart, LkLineChart } from "../../../components/charts";
import {
  getDisplayPreferences,
  getHouseholdCostOverview,
  getHouseholdUsageHighlights,
  getMe,
  getScheduleComplianceDashboard,
} from "../../../lib/api";
import { formatCurrency, formatDate } from "../../../lib/formatters";

type AnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AnalyticsTab = "costs" | "inventory" | "compliance" | "usage";
type InventorySection = "summary" | "turnover" | "reorder" | "asset-parts" | "commonality";

const analyticsTabs: Array<{ value: AnalyticsTab; label: string }> = [
  { value: "costs", label: "Costs" },
  { value: "inventory", label: "Inventory" },
  { value: "compliance", label: "Schedule Compliance" },
  { value: "usage", label: "Usage Trends" }
];

const inventorySections: Array<{ value: InventorySection; label: string }> = [
  { value: "summary", label: "Summary" },
  { value: "turnover", label: "Turnover" },
  { value: "reorder", label: "Reorder Forecast" },
  { value: "asset-parts", label: "Asset Parts" },
  { value: "commonality", label: "Shared Parts" }
];

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

const isAnalyticsTab = (value: string | undefined): value is AnalyticsTab => (
  value === "costs"
  || value === "inventory"
  || value === "compliance"
  || value === "usage"
);

const isInventorySection = (value: string | undefined): value is InventorySection => (
  value === "summary"
  || value === "turnover"
  || value === "reorder"
  || value === "asset-parts"
  || value === "commonality"
);

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const getComplianceRateClass = (value: number): string => {
  if (value >= 0.9) {
    return "compliance-rate--good";
  }

  if (value >= 0.75) {
    return "compliance-rate--warning";
  }

  return "compliance-rate--danger";
};

const getComplianceBarColor = (value: number): string => {
  if (value >= 0.9) {
    return "#287a54";
  }

  if (value >= 0.75) {
    return "#c6851d";
  }

  return "#c84d4d";
};

const renderInventoryPanel = (title: string, content: JSX.Element): JSX.Element => (
  <AnalyticsPanelBoundary title={title}>
    <Suspense fallback={<AnalyticsPanelSkeleton title={title} />}>
      {content}
    </Suspense>
  </AnalyticsPanelBoundary>
);

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const me = await getMe();
  const household = me.households.find((item) => item.id === getParam(params.householdId)) ?? me.households[0];
  const tabParam = getParam(params.tab);
  const sectionParam = getParam(params.section);
  const tab = isAnalyticsTab(tabParam) ? tabParam : "costs";
  const inventorySection = isInventorySection(sectionParam) ? sectionParam : "summary";
  const periodMonthsValue = Number(getParam(params.periodMonths) ?? "12");
  const periodMonths = Number.isFinite(periodMonthsValue) ? Math.max(3, Math.min(24, Math.round(periodMonthsValue))) : 12;

  if (!household) {
    return (
      <>
        <header className="page-header">
          <h1>Analytics</h1>
        </header>
        <div className="page-body">
          <section className="panel">
            <div className="panel__body">
              <p className="panel__empty">No household found.</p>
            </div>
          </section>
        </div>
      </>
    );
  }

  const buildAnalyticsHref = (overrides: Record<string, string | undefined>): string => {
    const query = new URLSearchParams();
    query.set("householdId", household.id);

    Object.entries(overrides).forEach(([key, value]) => {
      if (value && value.length > 0) {
        query.set(key, value);
      } else {
        query.delete(key);
      }
    });

    return `/analytics?${query.toString()}`;
  };

  const [costOverview, complianceDashboard, usageHighlights, prefs] = await Promise.all([
    tab === "costs"
      ? getHouseholdCostOverview(household.id).catch(() => ({ dashboard: null, serviceProviderSpend: null, forecast: null }))
      : Promise.resolve({ dashboard: null, serviceProviderSpend: null, forecast: null }),
    tab === "compliance" ? getScheduleComplianceDashboard(household.id, periodMonths).catch(() => null) : Promise.resolve(null),
    tab === "usage"
      ? getHouseholdUsageHighlights(household.id, { limit: 8, assetLimit: 12, lookback: 365, bucketSize: "month" }).catch(() => [])
      : Promise.resolve([]),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }))
  ]);
  const costDashboard = costOverview.dashboard;
  const serviceProviderSpend = costOverview.serviceProviderSpend;
  const costForecast = costOverview.forecast;

  const renderCostsTab = (): JSX.Element => {
    const assetCount = costDashboard ? new Set(costDashboard.spendByAsset.map((asset) => asset.assetId)).size : 0;
    const averagePerAsset = costDashboard && assetCount > 0 ? costDashboard.totalSpend / assetCount : 0;

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="stats-row">
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Total Spend</span>
            <strong className="stat-card__value">{formatCurrency(costDashboard?.totalSpend ?? 0, "$0.00", prefs.currencyCode)}</strong>
            <span className="stat-card__sub">Selected household period</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Tracked Assets</span>
            <strong className="stat-card__value">{assetCount}</strong>
            <span className="stat-card__sub">Assets with recorded spend</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Average per Asset</span>
            <strong className="stat-card__value">{formatCurrency(averagePerAsset, "$0.00", prefs.currencyCode)}</strong>
            <span className="stat-card__sub">Average spend across active assets</span>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">Projected 12-Month</span>
            <strong className="stat-card__value">{formatCurrency(costForecast?.total12m ?? 0, "$0.00", prefs.currencyCode)}</strong>
            <span className="stat-card__sub">Forecasted scheduled maintenance</span>
          </div>
        </section>

        <div className="analytics-grid analytics-grid--2">
          <section className="panel">
            <div className="panel__header">
              <h2>Spending by Category</h2>
            </div>
            <div className="panel__body--padded">
              <LkDonutChart
                data={(costDashboard?.spendByCategory ?? []).map((category) => ({
                  name: category.categoryLabel,
                  value: category.totalCost
                }))}
                centerValue={formatCurrency(costDashboard?.totalSpend ?? 0, "$0.00", prefs.currencyCode)}
                centerLabel="Total Spend"
                emptyMessage="No cost data is available yet."
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Monthly Spend Trend</h2>
            </div>
            <div className="panel__body--padded">
              <LkLineChart
                data={(costDashboard?.spendByMonth ?? []).map((entry) => ({ month: entry.month, totalCost: entry.totalCost }))}
                xKey="month"
                xTickFormatter="month"
                yTickFormatter="currency"
                lines={[{ dataKey: "totalCost", label: "Spend" }]}
                emptyMessage="No monthly spend trend is available yet."
              />
            </div>
          </section>
        </div>

        <div className="analytics-grid analytics-grid--2">
          <section className="panel">
            <div className="panel__header">
              <h2>Top Assets by Spend</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={(costDashboard?.spendByAsset ?? []).slice(0, 8).map((asset) => ({
                  assetName: asset.assetName,
                  totalCost: asset.totalCost
                }))}
                xKey="assetName"
                bars={[{ dataKey: "totalCost", label: "Spend" }]}
                yTickFormatter="currency"
                emptyMessage="No asset spend data is available yet."
                height={280}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Service Provider Concentration</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={(serviceProviderSpend?.providers ?? []).slice(0, 8).map((provider) => ({
                  providerName: provider.providerName,
                  totalCombinedCost: provider.totalCombinedCost
                }))}
                xKey="providerName"
                bars={[{ dataKey: "totalCombinedCost", label: "Spend" }]}
                yTickFormatter="currency"
                emptyMessage="No service provider spend data is available yet."
                height={280}
              />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel__header">
            <h2>Forecast by Asset</h2>
          </div>
          <div className="panel__body--padded">
            <LkBarChart
              data={(costForecast?.byAsset ?? []).slice(0, 8).map((asset) => ({
                assetName: asset.assetName,
                cost12m: asset.cost12m
              }))}
              xKey="assetName"
              bars={[{ dataKey: "cost12m", label: "12-Month Forecast" }]}
              yTickFormatter="currency"
              emptyMessage="No forecast data is available yet."
              height={280}
            />
          </div>
        </section>
      </div>
    );
  };

  const renderInventoryTab = (): JSX.Element => (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>Inventory Analytics</h2>
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "16px" }}>
          <Link href={`/inventory?householdId=${household.id}`} className="analytics-section-link">
            <span>Open inventory workspace</span>
            <span>Manage stock</span>
          </Link>
          <nav className="analytics-tab-bar" aria-label="Inventory analytics sections">
            {inventorySections.map((section) => (
              <Link
                key={section.value}
                href={buildAnalyticsHref({ tab: "inventory", section: section.value })}
                className={`analytics-tab-bar__tab${inventorySection === section.value ? " analytics-tab-bar__tab--active" : ""}`}
              >
                {section.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {inventorySection === "summary" ? renderInventoryPanel("Inventory Summary", <InventoryAnalyticsSummary householdId={household.id} />) : null}
      {inventorySection === "turnover" ? renderInventoryPanel("Inventory Turnover", <InventoryAnalyticsTurnover householdId={household.id} />) : null}
      {inventorySection === "reorder" ? renderInventoryPanel("Reorder Forecast", <InventoryAnalyticsReorder householdId={household.id} />) : null}
      {inventorySection === "asset-parts" ? renderInventoryPanel("Asset Parts", <InventoryAnalyticsAssetParts householdId={household.id} />) : null}
      {inventorySection === "commonality" ? renderInventoryPanel("Shared Parts", <InventoryAnalyticsCommonality householdId={household.id} />) : null}
    </div>
  );

  const renderComplianceTab = (): JSX.Element => {
    const trendData = (complianceDashboard?.trend ?? []).map((entry) => ({
      month: entry.month,
      onTimeRatePercent: Number((entry.onTimeRate * 100).toFixed(1)),
      lateCompletions: entry.lateCompletions,
      overdueAtEndOfMonth: entry.overdueAtEndOfMonth
    }));

    const categoryData = (complianceDashboard?.byCategory ?? []).map((category) => ({
      categoryLabel: category.categoryLabel,
      onTimeRatePercent: Number((category.onTimeRate * 100).toFixed(1)),
      fill: getComplianceBarColor(category.onTimeRate)
    }));

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header analytics-hub__header">
            <div>
              <h2>Schedule Compliance</h2>
              <span>{periodMonths}-month rolling window</span>
            </div>
            <nav className="analytics-tab-bar" aria-label="Compliance period selection">
              {[6, 12, 24].map((value) => (
                <Link
                  key={value}
                  href={buildAnalyticsHref({ tab: "compliance", periodMonths: String(value) })}
                  className={`analytics-tab-bar__tab${periodMonths === value ? " analytics-tab-bar__tab--active" : ""}`}
                >
                  {value}m
                </Link>
              ))}
            </nav>
          </div>
          <div className="panel__body--padded">
            <section className="stats-row">
              <div className="stat-card stat-card--accent">
                <span className="stat-card__label">On-Time Rate</span>
                <strong className={`stat-card__value ${getComplianceRateClass(complianceDashboard?.overview.onTimeRate ?? 0)}`}>
                  {formatPercent(complianceDashboard?.overview.onTimeRate ?? 0)}
                </strong>
                <span className="stat-card__sub">{complianceDashboard?.overview.onTimeCompletions ?? 0} on-time completions</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Late Completions</span>
                <strong className="stat-card__value">{complianceDashboard?.overview.lateCompletions ?? 0}</strong>
                <span className="stat-card__sub">Within the selected period</span>
              </div>
              <div className="stat-card stat-card--warning">
                <span className="stat-card__label">Avg Days Overdue</span>
                <strong className="stat-card__value">{Math.round(complianceDashboard?.overview.averageDaysOverdue ?? 0)}</strong>
                <span className="stat-card__sub">For late completions only</span>
              </div>
              <div className="stat-card stat-card--danger">
                <span className="stat-card__label">Currently Overdue</span>
                <strong className="stat-card__value">{complianceDashboard?.overview.currentOverdueCount ?? 0}</strong>
                <span className="stat-card__sub">Active schedules overdue right now</span>
              </div>
            </section>
          </div>
        </section>

        <div className="analytics-grid analytics-grid--2">
          <section className="panel">
            <div className="panel__header">
              <h2>On-Time Trend</h2>
            </div>
            <div className="panel__body--padded">
              <LkLineChart
                data={trendData}
                xKey="month"
                xTickFormatter="month"
                yTickFormatter="percent"
                lines={[{ dataKey: "onTimeRatePercent", label: "On-Time Rate" }]}
                emptyMessage="No compliance history is available yet."
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Late Workload</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={trendData}
                xKey="month"
                bars={[
                  { dataKey: "lateCompletions", label: "Late Completions" },
                  { dataKey: "overdueAtEndOfMonth", label: "Overdue at Month End", color: "#c84d4d" }
                ]}
                xTickFormatter="month"
                emptyMessage="No late-completion data is available yet."
              />
            </div>
          </section>
        </div>

        <div className="analytics-grid analytics-grid--2">
          <section className="panel">
            <div className="panel__header">
              <h2>By Category</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={categoryData}
                xKey="categoryLabel"
                bars={[{ dataKey: "onTimeRatePercent", label: "On-Time Rate", colorKey: "fill" }]}
                yTickFormatter="percent"
                emptyMessage="No category compliance data is available yet."
                height={280}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>By Member</h2>
            </div>
            <div className="panel__body--padded">
              <LkBarChart
                data={(complianceDashboard?.byMember ?? []).slice(0, 8).map((member) => ({
                  displayName: member.displayName ?? "Unknown",
                  onTimeRatePercent: Number((member.onTimeRate * 100).toFixed(1))
                }))}
                xKey="displayName"
                bars={[{ dataKey: "onTimeRatePercent", label: "On-Time Rate" }]}
                yTickFormatter="percent"
                emptyMessage="No member compliance data is available yet."
                height={280}
              />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel__header">
            <h2>Asset-Level Risk</h2>
          </div>
          <div className="panel__body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>On-Time Rate</th>
                  <th>Avg Days Overdue</th>
                  <th>Current Overdue</th>
                </tr>
              </thead>
              <tbody>
                {complianceDashboard?.byAsset.length ? complianceDashboard.byAsset.slice(0, 12).map((asset) => (
                  <tr key={asset.assetId}>
                    <td><Link href={`/assets/${asset.assetId}/maintenance`} className="data-table__link">{asset.assetName}</Link></td>
                    <td>{asset.category}</td>
                    <td className={getComplianceRateClass(asset.onTimeRate)}>{formatPercent(asset.onTimeRate)}</td>
                    <td>{asset.averageDaysOverdue === null ? "—" : Math.round(asset.averageDaysOverdue)}</td>
                    <td>{asset.currentOverdueCount}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="panel__empty">No asset-level compliance data is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  const renderUsageTab = (): JSX.Element => {
    const totalMetrics = usageHighlights.reduce((sum, asset) => sum + asset.metricCount, 0);
    const totalProjectedSchedules = usageHighlights.reduce((sum, asset) => sum + asset.projectedScheduleCount, 0);
    const totalAnomalies = usageHighlights.reduce((sum, asset) => sum + asset.anomalyCount, 0);

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="stats-row">
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Assets with Metrics</span>
            <strong className="stat-card__value">{usageHighlights.length}</strong>
            <span className="stat-card__sub">Sampled assets with usage telemetry</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Tracked Metrics</span>
            <strong className="stat-card__value">{totalMetrics}</strong>
            <span className="stat-card__sub">Across the usage-trend sample</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Projected Schedule Hits</span>
            <strong className="stat-card__value">{totalProjectedSchedules}</strong>
            <span className="stat-card__sub">Upcoming usage-driven due events</span>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">Notable Anomalies</span>
            <strong className="stat-card__value">{totalAnomalies}</strong>
            <span className="stat-card__sub">Bucket-level rate anomalies detected</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Metric Coverage and Anomalies</h2>
          </div>
          <div className="panel__body--padded">
            <LkBarChart
              data={usageHighlights.map((asset) => ({
                assetName: asset.assetName,
                metricCount: asset.metricCount,
                anomalyCount: asset.anomalyCount
              }))}
              xKey="assetName"
              bars={[
                { dataKey: "metricCount", label: "Metrics" },
                { dataKey: "anomalyCount", label: "Anomalies", color: "#c84d4d" }
              ]}
              emptyMessage="No metric telemetry is available yet."
              height={300}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Top Assets with Usage Metrics</h2>
          </div>
          <div className="panel__body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Metrics</th>
                  <th>Next Projected Due</th>
                  <th>Projected Schedules</th>
                  <th>Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {usageHighlights.length ? usageHighlights.map((asset) => (
                  <tr key={asset.assetId}>
                    <td>
                      <Link href={`/assets/${asset.assetId}/metrics`} className="data-table__link">{asset.assetName}</Link>
                      <div className="data-table__secondary">{asset.metricNames.join(", ")}</div>
                    </td>
                    <td>{asset.metricCount}</td>
                    <td>{formatDate(asset.nextProjectedDue, "—", undefined, prefs.dateFormat)}</td>
                    <td>{asset.projectedScheduleCount}</td>
                    <td>{asset.anomalyCount}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="panel__empty">No usage-metric trend data is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p style={{ marginTop: 6 }}>
            {household.name}
            {tab === "costs" && costDashboard ? ` • ${formatDate(costDashboard.periodStart, undefined, undefined, prefs.dateFormat)} through ${formatDate(costDashboard.periodEnd, undefined, undefined, prefs.dateFormat)}` : ""}
          </p>
        </div>
        {tab === "costs" ? (
          <div className="page-header__actions">
            <AnnualCostReportButton householdId={household.id} />
          </div>
        ) : null}
      </header>

      <div className="page-body">
        <nav className="analytics-tab-bar" aria-label="Analytics tabs">
          {analyticsTabs.map((item) => (
            <Link
              key={item.value}
              href={buildAnalyticsHref({ tab: item.value, section: item.value === "inventory" ? inventorySection : undefined, periodMonths: item.value === "compliance" ? String(periodMonths) : undefined })}
              className={`analytics-tab-bar__tab${tab === item.value ? " analytics-tab-bar__tab--active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel__header">
            <h2>Dedicated Analytics Workspaces</h2>
          </div>
          <div className="panel__body--padded">
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {[
                {
                  href: `/analytics/compliance?householdId=${household.id}`,
                  title: "Compliance",
                  description: "Investigate on-time performance, late work, and risk by category or asset."
                },
                {
                  href: `/analytics/comparative?householdId=${household.id}`,
                  title: "Comparative",
                  description: "Compare assets, seasonal cost shifts, and household member contribution patterns."
                },
                {
                  href: `/analytics/projects?householdId=${household.id}`,
                  title: "Projects",
                  description: "Timeline tracking, budget burn analysis, and task velocity."
                },
                {
                  href: `/analytics/hobbies?householdId=${household.id}`,
                  title: "Hobbies",
                  description: "Session trends, practice streaks, and goal tracking."
                }
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-link"
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: 16,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    textDecoration: "none",
                    color: "inherit"
                  }}
                >
                  <strong style={{ fontSize: "1rem" }}>{link.title}</strong>
                  <span style={{ color: "var(--ink-muted)", lineHeight: 1.5 }}>{link.description}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {tab === "costs" ? renderCostsTab() : null}
        {tab === "inventory" ? renderInventoryTab() : null}
        {tab === "compliance" ? renderComplianceTab() : null}
        {tab === "usage" ? renderUsageTab() : null}
      </div>
    </>
  );
}