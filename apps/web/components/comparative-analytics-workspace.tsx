"use client";

import type {
  Asset,
  AssetComparisonPayload,
  MemberContributionPayload,
  YearOverYearPayload
} from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getAssetComparisonAnalytics,
  getMemberContributionAnalytics,
  getYearOverYearAnalytics
} from "../lib/api";
import { AnalyticsWorkspaceShell } from "./analytics-workspace-shell";
import { formatCategoryLabel, formatCurrency } from "../lib/formatters";

type ComparativeAnalyticsWorkspaceProps = {
  householdId: string;
  assets: Asset[];
};

type AnalyticsTab = "assets" | "yoy" | "members";

type AssetRequest = {
  assetIds: string[];
  startDate?: string;
  endDate?: string;
} | null;

type YearOverYearRequest = {
  assetId?: string;
  years: number[];
};

type MemberRequest = {
  startDate?: string;
  endDate?: string;
};

const chartPalette = ["#0d9488", "#2563eb", "#d97706", "#dc2626", "#7c3aed"];

const getChartColor = (index: number): string => chartPalette[index % chartPalette.length] ?? chartPalette[0] ?? "#0d9488";

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit"
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short"
});

const toIsoStartOfDay = (value: string): string => new Date(`${value}T00:00:00.000Z`).toISOString();

const toIsoEndOfDay = (value: string): string => new Date(`${value}T23:59:59.999Z`).toISOString();

const formatMonthKey = (value: string): string => {
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));

  if (!year || !month) {
    return value;
  }

  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatMonthNumber = (value: number): string => shortMonthFormatter.format(new Date(Date.UTC(2026, value - 1, 1)));

const formatTooltipCurrency = (value: unknown): string => {
  if (typeof value === "number") {
    return formatCurrency(value, "$0.00");
  }

  if (Array.isArray(value) && typeof value[0] === "number") {
    return formatCurrency(value[0], "$0.00");
  }

  return "$0.00";
};

const formatTooltipCount = (value: unknown, suffix: string): string => {
  if (typeof value === "number") {
    return `${value} ${suffix}`;
  }

  if (Array.isArray(value) && typeof value[0] === "number") {
    return `${value[0]} ${suffix}`;
  }

  return `0 ${suffix}`;
};

const getInitials = (value: string | null): string => {
  if (!value) {
    return "?";
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
};

const buildYearRange = (startYear: number, endYear: number): number[] => {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    return [];
  }

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
};

const AnalyticsLoadingState = ({ rows = 4 }: { rows?: number }): JSX.Element => (
  <section className="panel comparative-panel">
    <div className="panel__header">
      <div className="skeleton-bar" style={{ width: 180, height: 20 }} />
    </div>
    <div className="panel__body comparative-skeleton">
      <div className="skeleton-bar" style={{ width: "100%", height: 280, borderRadius: 12 }} />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-bar" style={{ width: "100%", height: 44, borderRadius: 10 }} />
      ))}
    </div>
  </section>
);

const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <div className="panel comparative-panel">
    <div className="panel__body--padded">
      <p className="panel__empty">{message}</p>
    </div>
  </div>
);

const tabs: Array<{ id: AnalyticsTab; label: string }> = [
  { id: "assets", label: "Asset Comparison" },
  { id: "yoy", label: "Year Over Year" },
  { id: "members", label: "Member Contributions" }
];

export function ComparativeAnalyticsWorkspace({ householdId, assets }: ComparativeAnalyticsWorkspaceProps): JSX.Element {
  const currentYear = new Date().getUTCFullYear();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("assets");

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(assets.slice(0, 2).map((asset) => asset.id));
  const [assetStartDate, setAssetStartDate] = useState("");
  const [assetEndDate, setAssetEndDate] = useState("");
  const [assetRequest, setAssetRequest] = useState<AssetRequest>(assets.length >= 2 ? {
    assetIds: assets.slice(0, 2).map((asset) => asset.id)
  } : null);
  const [assetData, setAssetData] = useState<AssetComparisonPayload | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  const [yearAssetId, setYearAssetId] = useState("");
  const [startYear, setStartYear] = useState(String(currentYear - 1));
  const [endYear, setEndYear] = useState(String(currentYear));
  const [yearRequest, setYearRequest] = useState<YearOverYearRequest>({ years: [currentYear - 1, currentYear] });
  const [yearData, setYearData] = useState<YearOverYearPayload | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);

  const [memberStartDate, setMemberStartDate] = useState("");
  const [memberEndDate, setMemberEndDate] = useState("");
  const [memberRequest, setMemberRequest] = useState<MemberRequest>({});
  const [memberData, setMemberData] = useState<MemberContributionPayload | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetRequest || assetRequest.assetIds.length < 2 || assetRequest.assetIds.length > 5) {
      setAssetData(null);
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setAssetLoading(true);
      setAssetError(null);

      try {
        const next = await getAssetComparisonAnalytics(householdId, assetRequest.assetIds, {
          ...(assetRequest.startDate ? { startDate: assetRequest.startDate } : {}),
          ...(assetRequest.endDate ? { endDate: assetRequest.endDate } : {})
        });

        if (!cancelled) {
          setAssetData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setAssetData(null);
          setAssetError(error instanceof Error ? error.message : "Failed to load asset comparison analytics.");
        }
      } finally {
        if (!cancelled) {
          setAssetLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [assetRequest, householdId]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setYearLoading(true);
      setYearError(null);

      try {
        const next = await getYearOverYearAnalytics(householdId, {
          ...(yearRequest.assetId ? { assetId: yearRequest.assetId } : {}),
          years: yearRequest.years
        });

        if (!cancelled) {
          setYearData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setYearData(null);
          setYearError(error instanceof Error ? error.message : "Failed to load year-over-year analytics.");
        }
      } finally {
        if (!cancelled) {
          setYearLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId, yearRequest]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setMemberLoading(true);
      setMemberError(null);

      try {
        const next = await getMemberContributionAnalytics(householdId, {
          ...(memberRequest.startDate ? { startDate: memberRequest.startDate } : {}),
          ...(memberRequest.endDate ? { endDate: memberRequest.endDate } : {})
        });

        if (!cancelled) {
          setMemberData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setMemberData(null);
          setMemberError(error instanceof Error ? error.message : "Failed to load member contribution analytics.");
        }
      } finally {
        if (!cancelled) {
          setMemberLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId, memberRequest]);

  const assetNameMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const assetChartData = useMemo(() => {
    if (!assetData) {
      return [];
    }

    const monthMap = new Map<string, Record<string, number | string>>();

    for (const asset of assetData.assets) {
      for (const point of asset.monthlyCostBreakdown) {
        const row = monthMap.get(point.month) ?? { month: formatMonthKey(point.month), monthKey: point.month };
        row[asset.assetId] = point.cost;
        monthMap.set(point.month, row);
      }
    }

    return Array.from(monthMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [assetData]);

  const yearChartData = useMemo(() => {
    if (!yearData) {
      return [];
    }

    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const row: Record<string, number | string> = {
        month: formatMonthNumber(month)
      };

      for (const year of yearData.years) {
        row[String(year.year)] = year.monthlyCostBreakdown[index]?.cost ?? 0;
      }

      return row;
    });
  }, [yearData]);

  const sortedMembers = useMemo(() => [...(memberData?.members ?? [])].sort((left, right) => (
    right.totalMaintenanceLogsCompleted - left.totalMaintenanceLogsCompleted
    || right.totalCostOfWorkLogged - left.totalCostOfWorkLogged
    || (left.userDisplayName ?? "").localeCompare(right.userDisplayName ?? "")
  )), [memberData]);

  const memberBarData = useMemo(() => sortedMembers.map((member) => ({
    name: member.userDisplayName ?? "Unnamed member",
    userId: member.userId,
    logCount: member.totalMaintenanceLogsCompleted
  })), [sortedMembers]);

  const memberAreaData = useMemo(() => {
    if (!memberData || memberData.members.length === 0) {
      return [];
    }

    const rowMap = new Map<string, Record<string, number | string>>();

    for (const member of memberData.members) {
      for (const point of member.monthlyActivityBreakdown) {
        const row = rowMap.get(point.month) ?? { month: formatMonthKey(point.month), monthKey: point.month };
        row[member.userId] = point.logCount;
        rowMap.set(point.month, row);
      }
    }

    return Array.from(rowMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }, [memberData]);

  const assetComparisonHasData = Boolean(assetData?.assets.some((asset) => asset.totalMaintenanceLogCount > 0));
  const yearOverYearHasData = Boolean(yearData?.years.some((year) => year.totalLogCount > 0));
  const memberContributionHasData = Boolean(memberData?.householdTotals.totalLogs);

  const activeLoading = activeTab === "assets"
    ? assetLoading
    : activeTab === "yoy"
      ? yearLoading
      : memberLoading;

  const loadingRows = activeTab === "members" ? 6 : activeTab === "assets" ? 5 : 4;

  return (
    <AnalyticsWorkspaceShell
      title="Comparative Analytics"
      activeTab={activeTab}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        active: activeTab === tab.id,
        onClick: () => setActiveTab(tab.id),
      }))}
      loading={activeLoading}
      loadingFallback={<AnalyticsLoadingState rows={loadingRows} />}
    >
      {activeTab === "assets" ? (
        <div className="comparative-stack">
          <section className="panel comparative-panel">
            <div className="panel__header">
              <h2>Asset Comparison Controls</h2>
            </div>
            <div className="panel__body--padded comparative-filter-grid">
              <label className="field comparative-field comparative-field--full">
                <span>Select 2 to 5 assets</span>
                <select
                  multiple
                  size={Math.min(Math.max(assets.length, 4), 8)}
                  value={selectedAssetIds}
                  onChange={(event) => {
                    const next = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
                    setSelectedAssetIds(next);
                  }}
                >
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({formatCategoryLabel(asset.category)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field comparative-field">
                <span>Start date</span>
                <input type="date" value={assetStartDate} onChange={(event) => setAssetStartDate(event.target.value)} />
              </label>
              <label className="field comparative-field">
                <span>End date</span>
                <input type="date" value={assetEndDate} onChange={(event) => setAssetEndDate(event.target.value)} />
              </label>
              <div className="comparative-actions comparative-field comparative-field--full">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={selectedAssetIds.length < 2 || selectedAssetIds.length > 5}
                  onClick={() => setAssetRequest({
                    assetIds: selectedAssetIds,
                    ...(assetStartDate ? { startDate: toIsoStartOfDay(assetStartDate) } : {}),
                    ...(assetEndDate ? { endDate: toIsoEndOfDay(assetEndDate) } : {})
                  })}
                >
                  Compare assets
                </button>
                <p className="comparative-hint">Monthly cost series align automatically across the selected assets for charting.</p>
              </div>
            </div>
          </section>

          {assets.length < 2 ? (
            <EmptyState message="Add maintenance logs to at least two assets to compare them here." />
          ) : assetLoading ? (
            <AnalyticsLoadingState rows={5} />
          ) : assetError ? (
            <EmptyState message={assetError} />
          ) : !assetComparisonHasData ? (
            <EmptyState message="Add maintenance logs to at least two assets in the selected range to compare costs and parts consumption here." />
          ) : (
            <>
              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Monthly Cost by Asset</h2>
                </div>
                <div className="panel__body--padded">
                  <div className="comparative-chart-shell">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assetChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `$${Math.round(value)}`} />
                        <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                        <Legend formatter={(value) => assetNameMap.get(value as string) ?? String(value)} />
                        {assetData?.assets.map((asset, index) => (
                          <Bar key={asset.assetId} dataKey={asset.assetId} name={asset.assetId} fill={getChartColor(index)} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Asset Summary</h2>
                </div>
                <div className="panel__body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Category</th>
                        <th>Lifetime Cost</th>
                        <th>Log Count</th>
                        <th>On-Time Rate</th>
                        <th>Parts Consumed</th>
                        <th>Parts Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetData?.assets.map((asset) => (
                        <tr key={asset.assetId}>
                          <td>{asset.assetName}</td>
                          <td>{formatCategoryLabel(asset.assetCategory)}</td>
                          <td>{formatCurrency(asset.totalMaintenanceCost, "$0.00")}</td>
                          <td>{asset.totalMaintenanceLogCount}</td>
                          <td>{asset.onTimeCompletionRate === null ? "N/A" : `${asset.onTimeCompletionRate.toFixed(1)}%`}</td>
                          <td>{asset.totalPartsConsumed}</td>
                          <td>{formatCurrency(asset.totalPartsCost, "$0.00")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Top Parts by Asset</h2>
                </div>
                <div className="panel__body--padded comparative-top-parts">
                  {assetData?.assets.map((asset) => (
                    <div key={asset.assetId} className="comparative-top-parts__column">
                      <h3>{asset.assetName}</h3>
                      {asset.topParts.length > 0 ? (
                        <ol className="comparative-ranked-list">
                          {asset.topParts.map((part) => (
                            <li key={`${asset.assetId}-${part.itemName}`}>
                              <strong>{part.itemName}</strong>
                              <span>{part.totalQuantityConsumed} used</span>
                              <span>{formatCurrency(part.totalCost, "$0.00")}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="panel__empty">No tracked parts consumption for this asset yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "yoy" ? (
        <div className="comparative-stack">
          <section className="panel comparative-panel">
            <div className="panel__header">
              <h2>Year Over Year Controls</h2>
            </div>
            <div className="panel__body--padded comparative-filter-grid">
              <label className="field comparative-field">
                <span>Scope</span>
                <select value={yearAssetId} onChange={(event) => setYearAssetId(event.target.value)}>
                  <option value="">Entire household</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
              </label>
              <label className="field comparative-field">
                <span>Start year</span>
                <input type="number" min="2000" max="2100" value={startYear} onChange={(event) => setStartYear(event.target.value)} />
              </label>
              <label className="field comparative-field">
                <span>End year</span>
                <input type="number" min="2000" max="2100" value={endYear} onChange={(event) => setEndYear(event.target.value)} />
              </label>
              <div className="comparative-actions comparative-field comparative-field--full">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    const nextYears = buildYearRange(Number.parseInt(startYear, 10), Number.parseInt(endYear, 10));
                    setYearRequest({
                      ...(yearAssetId ? { assetId: yearAssetId } : {}),
                      years: nextYears
                    });
                  }}
                >
                  Load trend
                </button>
              </div>
            </div>
          </section>

          {yearLoading ? (
            <AnalyticsLoadingState rows={4} />
          ) : yearError ? (
            <EmptyState message={yearError} />
          ) : !yearOverYearHasData ? (
            <EmptyState message="Add maintenance logs across at least one year to compare seasonal cost patterns here." />
          ) : (
            <>
              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Monthly Overlay by Year</h2>
                </div>
                <div className="panel__body--padded">
                  <div className="comparative-chart-shell">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yearChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `$${Math.round(value)}`} />
                        <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                        <Legend />
                        {yearData?.years.map((year, index) => (
                          <Line
                            key={year.year}
                            type="monotone"
                            dataKey={String(year.year)}
                            stroke={getChartColor(index)}
                            strokeWidth={3}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="comparative-summary-grid">
                {yearData?.years.map((year) => (
                  <article key={year.year} className="panel comparative-panel comparative-summary-card">
                    <div className="panel__body--padded">
                      <p className="comparative-overline">{year.year}</p>
                      <h3>{formatCurrency(year.totalCost, "$0.00")}</h3>
                      <p>{year.totalLogCount} maintenance logs</p>
                      <p>{year.distinctScheduleCount} schedules completed</p>
                    </div>
                  </article>
                ))}
                {yearData?.yearOverYearDelta ? (
                  <article className="panel comparative-panel comparative-summary-card comparative-summary-card--delta">
                    <div className="panel__body--padded">
                      <p className="comparative-overline">Delta</p>
                      <h3>{yearData.yearOverYearDelta.currentYear} vs {yearData.yearOverYearDelta.previousYear}</h3>
                      <p className={yearData.yearOverYearDelta.costChangeAbsolute <= 0 ? "comparative-delta comparative-delta--good" : "comparative-delta comparative-delta--bad"}>
                        Cost {yearData.yearOverYearDelta.costChangeAbsolute <= 0 ? "down" : "up"} {formatCurrency(Math.abs(yearData.yearOverYearDelta.costChangeAbsolute), "$0.00")}
                        {yearData.yearOverYearDelta.costChangePercentage !== null ? ` (${Math.abs(yearData.yearOverYearDelta.costChangePercentage).toFixed(1)}%)` : ""}
                      </p>
                      <p className={yearData.yearOverYearDelta.logCountChangeAbsolute >= 0 ? "comparative-delta comparative-delta--good" : "comparative-delta comparative-delta--bad"}>
                        Log count {yearData.yearOverYearDelta.logCountChangeAbsolute >= 0 ? "up" : "down"} {Math.abs(yearData.yearOverYearDelta.logCountChangeAbsolute)}
                        {yearData.yearOverYearDelta.logCountChangePercentage !== null ? ` (${Math.abs(yearData.yearOverYearDelta.logCountChangePercentage).toFixed(1)}%)` : ""}
                      </p>
                    </div>
                  </article>
                ) : null}
              </section>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "members" ? (
        <div className="comparative-stack">
          <section className="panel comparative-panel">
            <div className="panel__header">
              <h2>Member Contribution Controls</h2>
            </div>
            <div className="panel__body--padded comparative-filter-grid">
              <label className="field comparative-field">
                <span>Start date</span>
                <input type="date" value={memberStartDate} onChange={(event) => setMemberStartDate(event.target.value)} />
              </label>
              <label className="field comparative-field">
                <span>End date</span>
                <input type="date" value={memberEndDate} onChange={(event) => setMemberEndDate(event.target.value)} />
              </label>
              <div className="comparative-actions comparative-field comparative-field--full">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setMemberRequest({
                    ...(memberStartDate ? { startDate: toIsoStartOfDay(memberStartDate) } : {}),
                    ...(memberEndDate ? { endDate: toIsoEndOfDay(memberEndDate) } : {})
                  })}
                >
                  Refresh contributions
                </button>
                <p className="comparative-hint">Leave the dates blank to use the default trailing 12-month window.</p>
              </div>
            </div>
          </section>

          {memberLoading ? (
            <AnalyticsLoadingState rows={6} />
          ) : memberError ? (
            <EmptyState message={memberError} />
          ) : !memberContributionHasData ? (
            <EmptyState message="Add maintenance logs for household members to see who is contributing work over time." />
          ) : (
            <>
              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Maintenance Logs by Member</h2>
                </div>
                <div className="panel__body--padded">
                  <div className="comparative-chart-shell comparative-chart-shell--short">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberBarData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={180} />
                        <Tooltip formatter={(value) => formatTooltipCount(value, "logs")} />
                        <Bar dataKey="logCount" fill="#0d9488" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Member Summary</h2>
                </div>
                <div className="panel__body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Log Count</th>
                        <th>Share of Logs</th>
                        <th>Cost Logged</th>
                        <th>Labor Hours</th>
                        <th>Distinct Assets</th>
                        <th>Most Active Asset</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMembers.map((member) => (
                        <tr key={member.userId}>
                          <td>
                            <div className="comparative-member-cell">
                              {member.userAvatarUrl ? (
                                <img src={member.userAvatarUrl} alt="" className="comparative-avatar" />
                              ) : (
                                <span className="comparative-avatar comparative-avatar--fallback">{getInitials(member.userDisplayName)}</span>
                              )}
                              <div>
                                <div className="data-table__primary">{member.userDisplayName ?? "Unnamed member"}</div>
                                <div className="data-table__secondary">{member.userId}</div>
                              </div>
                            </div>
                          </td>
                          <td>{member.totalMaintenanceLogsCompleted}</td>
                          <td>
                            {memberData && memberData.householdTotals.totalLogs > 0
                              ? `${((member.totalMaintenanceLogsCompleted / memberData.householdTotals.totalLogs) * 100).toFixed(1)}%`
                              : "0.0%"}
                          </td>
                          <td>{formatCurrency(member.totalCostOfWorkLogged, "$0.00")}</td>
                          <td>{member.totalLaborHoursLogged.toFixed(1)}</td>
                          <td>{member.distinctAssetCount}</td>
                          <td>{member.mostActiveAsset?.assetName ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Monthly Contribution Trend</h2>
                </div>
                <div className="panel__body--padded">
                  <div className="comparative-chart-shell">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={memberAreaData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip formatter={(value) => formatTooltipCount(value, "logs")} />
                        <Legend formatter={(value) => sortedMembers.find((member) => member.userId === value)?.userDisplayName ?? String(value)} />
                        {sortedMembers.map((member, index) => (
                          <Area
                            key={member.userId}
                            type="monotone"
                            dataKey={member.userId}
                            stackId="members"
                            stroke={getChartColor(index)}
                            fill={getChartColor(index)}
                            fillOpacity={0.35}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}
    </AnalyticsWorkspaceShell>
  );
}