import type {
  AssetTimelineItem,
  MaintenanceLog,
  UsageCostNormalization,
  UsageMetricEntry,
  UsageProjection,
  UsageRateAnalytics,
  EnhancedUsageProjection
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  formatCurrency,
  formatDate,
  formatDateTime
} from "./formatters";

export type AssetDetailPageSearchParams = {
  tab?: string | string[];
  sourceType?: string | string[];
  category?: string | string[];
  search?: string | string[];
  since?: string | string[];
  until?: string | string[];
  cursor?: string | string[];
  showAddForm?: string | string[];
};

export type MetricInsight = {
  metricId: string;
  entries: UsageMetricEntry[];
  projection: UsageProjection | null;
  rateAnalytics: UsageRateAnalytics | null;
  costNormalization: UsageCostNormalization | null;
  enhancedProjection: EnhancedUsageProjection | null;
};

export const assetDetailTabs = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Structured Details" },
  { id: "metrics", label: "Usage Metrics" },
  { id: "costs", label: "Costs" },
  { id: "maintenance", label: "Maintenance" },
  { id: "history", label: "History" },
  { id: "comments", label: "Comments" },
  { id: "settings", label: "Settings" }
] as const;

export const getSearchParamValue = (value: string | string[] | undefined): string | undefined => Array.isArray(value)
  ? value[0]
  : value;

export const toDateBoundaryIso = (value: string | undefined, boundary: "start" | "end"): string | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}`);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

export const buildAssetDetailHref = (
  assetId: string,
  searchParams: AssetDetailPageSearchParams,
  overrides: Record<string, string | undefined>,
  keysToDelete: string[] = []
): string => {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    const normalized = getSearchParamValue(value);

    if (normalized) {
      params.set(key, normalized);
    }
  });

  keysToDelete.forEach((key) => params.delete(key));
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined || value.length === 0) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return `/assets/${assetId}${query ? `?${query}` : ""}`;
};

export const formatTimelineSourceLabel = (sourceType: AssetTimelineItem["sourceType"]): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project";
    case "inventory_transaction":
      return "Inventory";
    case "schedule_change":
      return "Schedule";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition";
    case "usage_reading":
      return "Usage";
    default:
      return "Activity";
  }
};

export const renderMetaRow = (label: string, value: string | null | undefined): JSX.Element => (
  <div>
    <dt>{label}</dt>
    <dd>{value && value.trim().length > 0 ? value : "Not set"}</dd>
  </div>
);

export const renderMoneyMetaRow = (label: string, value: number | null | undefined): JSX.Element => (
  <div>
    <dt>{label}</dt>
    <dd>{value === null || value === undefined ? "Not set" : formatCurrency(value)}</dd>
  </div>
);

export const renderLogSummary = (log: MaintenanceLog): JSX.Element => (
  <article key={log.id} className="log-card">
    <div>
      <h4>{log.title}</h4>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        {log.notes ?? "No notes recorded."}
      </p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
        <span className="pill">{formatDateTime(log.completedAt)}</span>
        <span className="pill">Labor {formatCurrency(log.cost, "$0.00")}</span>
        <span className="pill">Parts {formatCurrency(log.totalPartsCost, "$0.00")}</span>
        {log.serviceProviderId ? <span className="pill">Provider linked</span> : null}
      </div>
    </div>
    {log.parts.length > 0 ? (
      <div style={{ minWidth: "260px" }}>
        <div className="eyebrow">Parts Used</div>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: "18px" }}>
          {log.parts.map((part) => (
            <li key={part.id}>
              {part.name}
              {part.partNumber ? ` (${part.partNumber})` : ""}
              {` x${part.quantity}`}
              {part.unitCost !== null ? ` • ${formatCurrency(part.unitCost)}` : ""}
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </article>
);

export const formatTransferTypeLabel = (value: "reassignment" | "household_transfer"): string => value === "reassignment"
  ? "Reassignment"
  : "Household Transfer";

export const hobbyStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "active":
      return "pill pill--success";
    case "paused":
      return "pill pill--warning";
    case "archived":
      return "pill pill--muted";
    default:
      return "pill";
  }
};

export const getUsageRateStatusClass = (
  insufficientData: boolean,
  isAnomaly: boolean,
  deviationFactor: number
): string => {
  if (insufficientData) {
    return "pill";
  }

  if (!isAnomaly) {
    return "pill pill--success";
  }

  return Math.abs(deviationFactor) > 2.5 ? "pill pill--danger" : "pill pill--warning";
};

export const getUsageRateStatusLabel = (
  insufficientData: boolean,
  isAnomaly: boolean,
  deviationFactor: number
): string => {
  if (insufficientData) {
    return "Insufficient data";
  }

  if (!isAnomaly) {
    return "Normal";
  }

  return Math.abs(deviationFactor) > 2.5 ? "Anomaly" : "Unusual";
};

export const getCorrelationStrengthLabel = (correlation: number): string => {
  if (correlation > 0.8) {
    return "Strong positive";
  }

  if (correlation > 0.5) {
    return "Moderate positive";
  }

  if (correlation >= -0.5) {
    return "Weak";
  }

  if (correlation >= -0.8) {
    return "Moderate negative";
  }

  return "Strong negative";
};

export const getDivergencePillClass = (trend: string): string => {
  switch (trend) {
    case "stable":
      return "pill pill--success";
    case "diverging":
      return "pill pill--warning";
    case "converging":
      return "pill pill--accent";
    default:
      return "pill";
  }
};

export const formatDateRangeLabel = (start: string, end: string): string => `${formatDate(start)} - ${formatDate(end)}`;