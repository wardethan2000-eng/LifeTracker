"use client";

import type {
  Asset,
  CategoryAdherencePayload,
  ComplianceReportPayload,
  ComplianceStatus,
  OnTimeRatePayload,
  OverdueTrendPayload,
  RegulatoryAssetOption
} from "@aegis/types";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
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
  getComplianceCategoryAdherence,
  getComplianceOnTimeRate,
  getComplianceOverdueTrend,
  getComplianceReport,
  getRegulatoryAssets
} from "../lib/api";
import { AnalyticsWorkspaceShell } from "./analytics-workspace-shell";
import { formatCategoryLabel, formatDate, formatDateTime } from "../lib/formatters";
import { useTimezone } from "../lib/timezone-context";
import { toIsoStartOfDayInTimezone, toIsoEndOfDayInTimezone } from "../lib/date-input-utils";

type ComplianceAnalyticsWorkspaceProps = {
  householdId: string;
  assets: Asset[];
};

type ComplianceTab = "on-time" | "trend" | "categories" | "report";

type BreakdownEntry = {
  label: string;
  totalCycles: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  averageDaysLate: number | null;
};

const trendLabels: Record<OverdueTrendPayload["trendDirection"], { marker: string; label: string }> = {
  improving: { marker: "v", label: "Improving" },
  worsening: { marker: "^", label: "Worsening" },
  stable: { marker: "-", label: "Stable" }
};

const triggerTypeLabels: Record<string, string> = {
  interval: "Interval",
  usage: "Usage",
  seasonal: "Seasonal",
  compound: "Compound",
  one_time: "One-Time"
};

const shortPercentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

const toIsoStartOfDay = (value: string, timezone: string): string => toIsoStartOfDayInTimezone(value, timezone);

const toIsoEndOfDay = (value: string, timezone: string): string => toIsoEndOfDayInTimezone(value, timezone);

const formatPercent = (value: number | null | undefined): string => `${shortPercentFormatter.format(value ?? 0)}%`;

const formatAverageDays = (value: number | null | undefined): string => value === null || value === undefined
  ? "-"
  : `${numberFormatter.format(value)} days`;

const getTone = (rate: number): "success" | "warning" | "danger" => {
  if (rate > 90) {
    return "success";
  }

  if (rate >= 70) {
    return "warning";
  }

  return "danger";
};

const formatMonth = (value: string): string => {
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));

  if (!year || !month) {
    return value;
  }

  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

const emptyMessage = "No maintenance logs in this period";

const AnalyticsLoadingState = ({ blocks = 3 }: { blocks?: number }): JSX.Element => (
  <section className="panel comparative-panel">
    <div className="panel__body compliance-skeleton-grid">
      {Array.from({ length: blocks }, (_, index) => (
        <div key={index} className="skeleton-bar" style={{ width: "100%", height: index === 0 ? 120 : 280, borderRadius: 12 }} />
      ))}
    </div>
  </section>
);

const EmptyState = ({ message }: { message: string }): JSX.Element => (
  <section className="panel comparative-panel">
    <div className="panel__body--padded">
      <p className="panel__empty">{message}</p>
    </div>
  </section>
);

const tabs: Array<{ id: ComplianceTab; label: string }> = [
  { id: "on-time", label: "On-Time Rate" },
  { id: "trend", label: "Overdue Trend" },
  { id: "categories", label: "Category Adherence" },
  { id: "report", label: "Compliance Report" }
];

const BreakdownChartPanel = ({
  title,
  items,
  dataKey,
  prominent = false
}: {
  title: string;
  items: BreakdownEntry[];
  dataKey: string;
  prominent?: boolean;
}): JSX.Element => (
  <section className={`panel comparative-panel compliance-breakdown-panel${prominent ? " compliance-breakdown-panel--prominent" : ""}`}>
    <div className="panel__header">
      <div>
        <h2>{title}</h2>
        <p className="comparative-note">On-time rate and late-cycle drag for this segment.</p>
      </div>
    </div>
    <div className="panel__body--padded compliance-chart-body">
      <div className="comparative-chart-shell comparative-chart-shell--short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 8, right: 16, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey={dataKey} tickLine={false} axisLine={false} interval={0} angle={items.length > 4 ? -20 : 0} textAnchor={items.length > 4 ? "end" : "middle"} height={items.length > 4 ? 70 : 40} />
            <YAxis tickFormatter={(value) => `${value}%`} domain={[0, 100]} tickLine={false} axisLine={false} width={48} />
            <Tooltip formatter={(value: unknown) => typeof value === "number" ? `${shortPercentFormatter.format(value)}%` : typeof value === "string" ? value : ""} />
            <Bar dataKey="onTimeRate" fill={prominent ? "#0f766e" : "#2563eb"} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="compliance-data-table">
        <div className="compliance-data-table__row compliance-data-table__row--header">
          <span>{title}</span>
          <span>Total</span>
          <span>On Time</span>
          <span>Late</span>
          <span>Avg Late</span>
        </div>
        {items.map((item) => (
          <div key={item.label} className="compliance-data-table__row">
            <span>{item.label}</span>
            <span>{item.totalCycles}</span>
            <span>{item.onTimeCount}</span>
            <span>{item.lateCount}</span>
            <span>{formatAverageDays(item.averageDaysLate)}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export function ComplianceAnalyticsWorkspace({ householdId, assets }: ComplianceAnalyticsWorkspaceProps): JSX.Element {
  const { timezone } = useTimezone();

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: timezone
  });

  const formatMonth = (value: string): string => {
    const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));
    if (!year || !month) return value;
    return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  };

  const todayAsInput = (): string => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  };

  const trailingYearStart = (): string => {
    const date = new Date();
    const yearAgo = new Date(date);
    yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(yearAgo);
  };

  const [activeTab, setActiveTab] = useState<ComplianceTab>("on-time");

  const [startDate, setStartDate] = useState(trailingYearStart);
  const [endDate, setEndDate] = useState(todayAsInput);
  const [assetId, setAssetId] = useState("");

  const [onTimeData, setOnTimeData] = useState<OnTimeRatePayload | null>(null);
  const [onTimeLoading, setOnTimeLoading] = useState(false);
  const [onTimeError, setOnTimeError] = useState<string | null>(null);

  const [overdueData, setOverdueData] = useState<OverdueTrendPayload | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);

  const [categoryData, setCategoryData] = useState<CategoryAdherencePayload | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [regulatoryAssets, setRegulatoryAssets] = useState<RegulatoryAssetOption[]>([]);
  const [regulatoryAssetsLoading, setRegulatoryAssetsLoading] = useState(false);
  const [regulatoryAssetsError, setRegulatoryAssetsError] = useState<string | null>(null);
  const [reportAssetId, setReportAssetId] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("0");
  const [reportData, setReportData] = useState<ComplianceReportPayload | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<string[]>([]);

  const [recentTrendSupportData, setRecentTrendSupportData] = useState<OnTimeRatePayload | null>(null);
  const [recentTrendSupportLoading, setRecentTrendSupportLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setOnTimeLoading(true);
      setOnTimeError(null);

      try {
        const next = await getComplianceOnTimeRate(householdId, {
          startDate: toIsoStartOfDay(startDate, timezone),
          endDate: toIsoEndOfDay(endDate, timezone),
          ...(assetId ? { assetId } : {})
        });

        if (!cancelled) {
          setOnTimeData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setOnTimeData(null);
          setOnTimeError(error instanceof Error ? error.message : "Failed to load on-time completion analytics.");
        }
      } finally {
        if (!cancelled) {
          setOnTimeLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [assetId, endDate, householdId, startDate, timezone]);

  useEffect(() => {
    if (activeTab !== "trend") {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setOverdueLoading(true);
      setOverdueError(null);

      try {
        const next = await getComplianceOverdueTrend(householdId, {
          startDate: toIsoStartOfDay(startDate, timezone),
          endDate: toIsoEndOfDay(endDate, timezone),
          ...(assetId ? { assetId } : {})
        });

        if (!cancelled) {
          setOverdueData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setOverdueData(null);
          setOverdueError(error instanceof Error ? error.message : "Failed to load overdue trend analytics.");
        }
      } finally {
        if (!cancelled) {
          setOverdueLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, assetId, endDate, householdId, startDate, timezone]);

  useEffect(() => {
    if (activeTab !== "categories") {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setCategoryLoading(true);
      setCategoryError(null);

      try {
        const next = await getComplianceCategoryAdherence(householdId, {
          startDate: toIsoStartOfDay(startDate, timezone),
          endDate: toIsoEndOfDay(endDate, timezone)
        });

        if (!cancelled) {
          setCategoryData(next);
        }
      } catch (error) {
        if (!cancelled) {
          setCategoryData(null);
          setCategoryError(error instanceof Error ? error.message : "Failed to load category adherence analytics.");
        }
      } finally {
        if (!cancelled) {
          setCategoryLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, endDate, householdId, startDate, timezone]);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setRegulatoryAssetsLoading(true);
      setRegulatoryAssetsError(null);

      try {
        const next = await getRegulatoryAssets(householdId);

        if (!cancelled) {
          setRegulatoryAssets(next);
        }
      } catch (error) {
        if (!cancelled) {
          setRegulatoryAssets([]);
          setRegulatoryAssetsError(error instanceof Error ? error.message : "Failed to load assets with regulatory schedules.");
        }
      } finally {
        if (!cancelled) {
          setRegulatoryAssetsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  useEffect(() => {
    if (activeTab !== "report" || !reportAssetId) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setReportLoading(true);
      setReportError(null);

      try {
        const next = await getComplianceReport(reportAssetId, householdId, {
          ...(reportStartDate ? { startDate: toIsoStartOfDay(reportStartDate, timezone) } : {}),
          ...(reportEndDate ? { endDate: toIsoEndOfDay(reportEndDate, timezone) } : {}),
          gracePeriodDays: Number.parseInt(gracePeriodDays, 10) || 0
        });

        if (!cancelled) {
          setReportData(next);
          setExpandedScheduleIds([]);
        }
      } catch (error) {
        if (!cancelled) {
          setReportData(null);
          setReportError(error instanceof Error ? error.message : "Failed to load the compliance report.");
        }
      } finally {
        if (!cancelled) {
          setReportLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, gracePeriodDays, householdId, reportAssetId, reportEndDate, reportStartDate, timezone]);

  useEffect(() => {
    if (activeTab !== "trend" || overdueData?.trendDirection !== "worsening") {
      setRecentTrendSupportData(null);
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
      const recentStart = new Date(end);
      recentStart.setUTCMonth(recentStart.getUTCMonth() - 3);

      setRecentTrendSupportLoading(true);

      try {
        const next = await getComplianceOnTimeRate(householdId, {
          startDate: recentStart.toISOString(),
          endDate: end.toISOString(),
          ...(assetId ? { assetId } : {})
        });

        if (!cancelled) {
          setRecentTrendSupportData(next);
        }
      } catch {
        if (!cancelled) {
          setRecentTrendSupportData(null);
        }
      } finally {
        if (!cancelled) {
          setRecentTrendSupportLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, assetId, endDate, householdId, overdueData?.trendDirection]);

  const assetOptions = useMemo(() => [...assets].sort((left, right) => left.name.localeCompare(right.name)), [assets]);

  const byAssetEntries = useMemo<BreakdownEntry[]>(() => (onTimeData?.breakdowns.byAsset ?? []).map((entry) => ({
    label: entry.assetName,
    totalCycles: entry.totalCycles,
    onTimeCount: entry.onTimeCount,
    lateCount: entry.lateCount,
    onTimeRate: entry.onTimeRate,
    averageDaysLate: entry.averageDaysLate
  })), [onTimeData]);

  const byCategoryEntries = useMemo<BreakdownEntry[]>(() => (onTimeData?.breakdowns.byCategory ?? []).map((entry) => ({
    label: formatCategoryLabel(entry.category),
    totalCycles: entry.totalCycles,
    onTimeCount: entry.onTimeCount,
    lateCount: entry.lateCount,
    onTimeRate: entry.onTimeRate,
    averageDaysLate: entry.averageDaysLate
  })), [onTimeData]);

  const byMemberEntries = useMemo<BreakdownEntry[]>(() => (onTimeData?.breakdowns.byMember ?? []).map((entry) => ({
    label: entry.userName ?? "Unknown member",
    totalCycles: entry.totalCycles,
    onTimeCount: entry.onTimeCount,
    lateCount: entry.lateCount,
    onTimeRate: entry.onTimeRate,
    averageDaysLate: entry.averageDaysLate
  })), [onTimeData]);

  const trendChartData = useMemo(() => (overdueData?.months ?? []).map((point) => ({
    ...point,
    monthLabel: formatMonth(point.month)
  })), [overdueData, formatMonth]);

  const trendContributors = useMemo(() => {
    if (!recentTrendSupportData) {
      return { categories: [], assets: [] };
    }

    return {
      categories: [...recentTrendSupportData.breakdowns.byCategory]
        .filter((entry) => entry.lateCount > 0)
        .sort((left, right) => right.lateCount - left.lateCount || left.category.localeCompare(right.category))
        .slice(0, 3),
      assets: [...recentTrendSupportData.breakdowns.byAsset]
        .filter((entry) => entry.lateCount > 0)
        .sort((left, right) => right.lateCount - left.lateCount || left.assetName.localeCompare(right.assetName))
        .slice(0, 3)
    };
  }, [recentTrendSupportData]);

  const categoryRows = useMemo(() => [...(categoryData?.categories ?? [])]
    .sort((left, right) => left.onTimeRate - right.onTimeRate || right.totalCyclesInPeriod - left.totalCyclesInPeriod), [categoryData]);

  const reportAssetName = useMemo(() => regulatoryAssets.find((asset) => asset.assetId === reportAssetId)?.assetName ?? "", [regulatoryAssets, reportAssetId]);

  const reportStatusTone = (status: ComplianceStatus): string => {
    switch (status) {
      case "compliant":
        return "success";
      case "non-compliant":
        return "danger";
      case "current":
        return "info";
    }
  };

  const reportHasCycles = Boolean(reportData?.regulatorySchedules.some((schedule) => schedule.cycles.length > 0));

  const activeLoading = activeTab === "on-time"
    ? onTimeLoading
    : activeTab === "trend"
      ? overdueLoading
      : activeTab === "categories"
        ? categoryLoading
        : reportLoading;

  return (
    <AnalyticsWorkspaceShell
      title="Compliance Analytics"
      activeTab={activeTab}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        active: activeTab === tab.id,
        onClick: () => setActiveTab(tab.id),
      }))}
      loading={activeLoading}
      loadingFallback={<AnalyticsLoadingState />}
    >
      <div className="comparative-stack">
        <section className="panel comparative-panel">
        <div className="panel__header">
          <div>
            <h2>Analytics Controls</h2>
            <p className="comparative-note">Date range drives tabs 1 through 3. Asset filtering applies to on-time and overdue trend views.</p>
          </div>
        </div>
        <div className="panel__body--padded comparative-filter-grid compliance-filter-grid">
          <label className="field comparative-field">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
          </label>

          <label className="field comparative-field">
            <span>End date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} />
          </label>

          <label className="field comparative-field">
            <span>Asset filter</span>
            <select value={assetId} onChange={(event) => setAssetId(event.currentTarget.value)}>
              <option value="">All assets</option>
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
          </label>
        </div>
        </section>

      {activeTab === "on-time" ? (
        onTimeLoading ? <AnalyticsLoadingState /> : onTimeError ? <EmptyState message={onTimeError} /> : !onTimeData || onTimeData.summary.totalCycles === 0 ? <EmptyState message={emptyMessage} /> : (
          <div className="comparative-stack">
            <section className={`panel comparative-panel compliance-hero compliance-hero--${getTone(onTimeData.summary.onTimeRate)}`}>
              <div className="panel__body--padded compliance-hero__body">
                <div>
                  <div className="comparative-overline">Overall On-Time Rate</div>
                  <div className="compliance-hero__value">{formatPercent(onTimeData.summary.onTimeRate)}</div>
                  <p className="comparative-note">{onTimeData.summary.onTimeCount} on time, {onTimeData.summary.lateCount} late, {onTimeData.summary.totalCycles} measured cycles.</p>
                </div>
                <div className="compliance-kpi-grid">
                  <div className="analytics-inline-metric">
                    <span>Late Cycles</span>
                    <strong>{onTimeData.summary.lateCount}</strong>
                  </div>
                  <div className="analytics-inline-metric">
                    <span>Average Days Late</span>
                    <strong>{formatAverageDays(onTimeData.summary.averageDaysLate)}</strong>
                  </div>
                  <div className="analytics-inline-metric">
                    <span>Asset Scope</span>
                    <strong>{assetId ? 1 : assetOptions.length}</strong>
                  </div>
                </div>
              </div>
            </section>

            <div className="compliance-breakdown-grid">
              <BreakdownChartPanel title="By Category" items={byCategoryEntries} dataKey="label" prominent />
              <BreakdownChartPanel title="By Asset" items={byAssetEntries} dataKey="label" />
              <BreakdownChartPanel title="By Member" items={byMemberEntries} dataKey="label" />
            </div>
          </div>
        )
      ) : null}

      {activeTab === "trend" ? (
        overdueLoading ? <AnalyticsLoadingState /> : overdueError ? <EmptyState message={overdueError} /> : !overdueData || overdueData.months.every((point) => point.totalCompletions === 0) ? <EmptyState message={emptyMessage} /> : (
          <div className="comparative-stack">
            <section className="panel comparative-panel">
              <div className="panel__body--padded compliance-trend-banner">
                <div className={`compliance-trend-indicator compliance-trend-indicator--${overdueData.trendDirection}`}>
                  <span className="compliance-trend-indicator__marker">{trendLabels[overdueData.trendDirection].marker}</span>
                  <div>
                    <div className="comparative-overline">Trend Direction</div>
                    <strong>{trendLabels[overdueData.trendDirection].label}</strong>
                  </div>
                </div>
                <p className="comparative-note">Trend compares the most recent three months to the prior three-month window using late-completion counts.</p>
              </div>
            </section>

            <section className="panel comparative-panel">
              <div className="panel__header">
                <h2>Monthly Overdue Trend</h2>
              </div>
              <div className="panel__body--padded compliance-chart-body">
                <div className="comparative-chart-shell">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="overdueCount" stroke="#b91c1c" strokeWidth={3} name="Late completions" />
                      <Line yAxisId="right" type="monotone" dataKey="averageDaysLate" stroke="#1d4ed8" strokeWidth={3} name="Average days late" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {overdueData.trendDirection === "worsening" ? (
              <section className="panel comparative-panel">
                <div className="panel__header">
                  <h2>Recent Contributors</h2>
                </div>
                <div className="panel__body--padded compliance-contributor-grid">
                  <div>
                    <div className="comparative-overline">Categories</div>
                    {recentTrendSupportLoading ? <p className="comparative-note">Calculating recent contributors...</p> : trendContributors.categories.length === 0 ? <p className="comparative-note">No category-level late completions found in the most recent three months.</p> : (
                      <ul className="comparative-ranked-list">
                        {trendContributors.categories.map((entry) => (
                          <li key={entry.category}>
                            <strong>{formatCategoryLabel(entry.category)}</strong>
                            <span>{entry.lateCount} late completions in the most recent three months.</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="comparative-overline">Assets</div>
                    {recentTrendSupportLoading ? <p className="comparative-note">Calculating recent contributors...</p> : trendContributors.assets.length === 0 ? <p className="comparative-note">No asset-level late completions found in the most recent three months.</p> : (
                      <ul className="comparative-ranked-list">
                        {trendContributors.assets.map((entry) => (
                          <li key={entry.assetId}>
                            <strong>{entry.assetName}</strong>
                            <span>{entry.lateCount} late completions in the most recent three months.</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {activeTab === "categories" ? (
        categoryLoading ? <AnalyticsLoadingState /> : categoryError ? <EmptyState message={categoryError} /> : !categoryData || categoryRows.length === 0 || categoryRows.every((entry) => entry.totalCyclesInPeriod === 0) ? <EmptyState message={emptyMessage} /> : (
          <section className="panel comparative-panel">
            <div className="panel__header">
              <div>
                <h2>Category Adherence</h2>
                <p className="comparative-note">Worst-performing categories float to the top so the operational blind spots are obvious.</p>
              </div>
            </div>
            <div className="panel__body--padded compliance-category-chart">
              {assetId ? <p className="comparative-note">Category adherence remains household-wide. Clear the asset filter to keep tabs aligned.</p> : null}
              <div className="compliance-category-list">
                {categoryRows.map((entry) => (
                  <div key={entry.category} className="compliance-category-row">
                    <div className="compliance-category-row__meta">
                      <strong>{formatCategoryLabel(entry.category)}</strong>
                      <span>{entry.totalCyclesInPeriod} measured cycles across {entry.activeScheduleCount} active schedules</span>
                    </div>
                    <div className="compliance-category-row__bar-shell">
                      <div className="compliance-category-row__bar-track">
                        <div
                          className={`compliance-category-row__bar compliance-category-row__bar--${getTone(entry.onTimeRate)}`}
                          style={{ width: `${Math.max(entry.onTimeRate, 4)}%` }}
                        />
                      </div>
                      <strong className="compliance-category-row__rate">{formatPercent(entry.onTimeRate)}</strong>
                    </div>
                    <div className="compliance-category-row__worst">
                      <span className="comparative-overline">Worst Schedule</span>
                      {entry.worstSchedule ? (
                        <p>
                          <strong>{entry.worstSchedule.scheduleName}</strong> on {entry.worstSchedule.assetName} is running at {formatPercent(entry.worstSchedule.onTimeRate)} on time.
                        </p>
                      ) : (
                        <p>No measured cycles yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      ) : null}

      {activeTab === "report" ? (
        <div className="comparative-stack">
          <section className="panel comparative-panel">
            <div className="panel__header">
              <div>
                <h2>Report Controls</h2>
                <p className="comparative-note">Reports default to full history unless you narrow the window.</p>
              </div>
            </div>
            <div className="panel__body--padded comparative-filter-grid compliance-filter-grid">
              <label className="field comparative-field">
                <span>Regulatory asset</span>
                <select value={reportAssetId} onChange={(event) => setReportAssetId(event.currentTarget.value)} disabled={regulatoryAssetsLoading}>
                  <option value="">Select an asset</option>
                  {regulatoryAssets.map((asset) => (
                    <option key={asset.assetId} value={asset.assetId}>{asset.assetName}</option>
                  ))}
                </select>
              </label>

              <label className="field comparative-field">
                <span>Start date</span>
                <input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.currentTarget.value)} />
              </label>

              <label className="field comparative-field">
                <span>End date</span>
                <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.currentTarget.value)} />
              </label>

              <label className="field comparative-field">
                <span>Grace period days</span>
                <input type="number" min="0" step="1" value={gracePeriodDays} onChange={(event) => setGracePeriodDays(event.currentTarget.value)} />
              </label>
            </div>
          </section>

          {regulatoryAssetsError ? <EmptyState message={regulatoryAssetsError} /> : null}
          {!regulatoryAssetsLoading && regulatoryAssets.length === 0 ? <EmptyState message="This household has no assets with schedules marked as regulatory." /> : null}
          {!reportAssetId && regulatoryAssets.length > 0 ? <EmptyState message="Select an asset with regulatory schedules to generate a compliance report" /> : null}
          {reportAssetId && reportLoading ? <AnalyticsLoadingState blocks={2} /> : null}
          {reportAssetId && reportError ? <EmptyState message={reportError} /> : null}
          {reportAssetId && !reportLoading && !reportError && reportData ? (
            reportData.regulatorySchedules.length === 0 ? <EmptyState message="This asset has no schedules marked as regulatory" /> : (
              <div className="comparative-stack">
                <section className="panel comparative-panel">
                  <div className="panel__body--padded compliance-report-header">
                    <div>
                      <div className="comparative-overline">Overall Status</div>
                      <div className={`compliance-status-pill compliance-status-pill--${reportStatusTone(reportData.overallComplianceStatus)}`}>
                        {reportData.overallComplianceStatus}
                      </div>
                      <p className="comparative-note">{reportAssetName || reportData.assetName} in {formatCategoryLabel(reportData.assetCategory)}. Generated {formatDateTime(reportData.reportGeneratedAt, "Not set", timezone)}.</p>
                    </div>
                    <div className="compliance-kpi-grid">
                      <div className="analytics-inline-metric">
                        <span>Regulatory Schedules</span>
                        <strong>{reportData.summary.totalRegulatorySchedules}</strong>
                      </div>
                      <div className="analytics-inline-metric">
                        <span>Compliant</span>
                        <strong>{reportData.summary.compliantCount}</strong>
                      </div>
                      <div className="analytics-inline-metric">
                        <span>Non-Compliant</span>
                        <strong>{reportData.summary.nonCompliantCount}</strong>
                      </div>
                    </div>
                  </div>
                </section>

                {!reportHasCycles ? <EmptyState message="This asset has regulatory schedules, but there are no measurable cycles in the selected window." /> : null}

                <section className="panel comparative-panel">
                  <div className="panel__header">
                    <h2>Regulatory Schedule Ledger</h2>
                  </div>
                  <div className="panel__body compliance-report-table-wrap">
                    <div className="compliance-report-table">
                      <div className="compliance-report-table__row compliance-report-table__row--header">
                        <span>Schedule</span>
                        <span>Trigger</span>
                        <span>Completed Cycles</span>
                        <span>Status</span>
                        <span>Detail</span>
                      </div>
                      {reportData.regulatorySchedules.map((schedule) => {
                        const isExpanded = expandedScheduleIds.includes(schedule.scheduleId);
                        const completedCycles = schedule.cycles.filter((cycle) => cycle.completedAt !== null).length;

                        return (
                          <div key={schedule.scheduleId} className="compliance-report-table__group">
                            <div className="compliance-report-table__row">
                              <span>
                                <strong>{schedule.scheduleName}</strong>
                                {schedule.description ? <small>{schedule.description}</small> : null}
                              </span>
                              <span>{triggerTypeLabels[schedule.triggerType] ?? schedule.triggerType}</span>
                              <span>{completedCycles}</span>
                              <span>
                                <span className={`compliance-status-pill compliance-status-pill--${reportStatusTone(schedule.complianceStatus)}`}>
                                  {schedule.complianceStatus}
                                </span>
                              </span>
                              <span>
                                <button
                                  type="button"
                                  className="button button--ghost"
                                  onClick={() => setExpandedScheduleIds((current) => current.includes(schedule.scheduleId)
                                    ? current.filter((id) => id !== schedule.scheduleId)
                                    : [...current, schedule.scheduleId])}
                                >
                                  {isExpanded ? "Hide cycles" : "Show cycles"}
                                </button>
                              </span>
                            </div>

                            {isExpanded ? (
                              <div className="compliance-report-table__detail">
                                <div className="compliance-cycle-table">
                                  <div className="compliance-cycle-table__row compliance-cycle-table__row--header">
                                    <span>Due Date</span>
                                    <span>Completed</span>
                                    <span>Delta</span>
                                    <span>Completed By</span>
                                  </div>
                                  {schedule.cycles.map((cycle, index) => (
                                    <div key={`${schedule.scheduleId}-${index}`} className="compliance-cycle-table__row">
                                      <span>{formatDate(cycle.dueDate, "Unresolved")}</span>
                                      <span>{formatDate(cycle.completedAt, cycle.completedAt === null ? "Open cycle" : "Unresolved")}</span>
                                      <span className={cycle.deltaInDays !== null && cycle.deltaInDays > Number.parseInt(gracePeriodDays, 10) ? "compliance-cycle-table__delta compliance-cycle-table__delta--late" : "compliance-cycle-table__delta"}>
                                        {cycle.deltaInDays === null ? "-" : `${cycle.deltaInDays > 0 ? "+" : ""}${cycle.deltaInDays} days`}
                                      </span>
                                      <span>{cycle.completedByName ?? cycle.completedById ?? "-"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            )
          ) : null}
        </div>
      ) : null}
      </div>
    </AnalyticsWorkspaceShell>
  );
}