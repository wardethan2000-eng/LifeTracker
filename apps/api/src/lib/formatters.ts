import type { AssetTimelineItem } from "@aegis/types";

export const formatDate = (value: string | Date): string => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
}).format(value instanceof Date ? value : new Date(value));

export const formatCurrency = (value: number | null | undefined): string => typeof value === "number"
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
  : "";

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const formatTimelineSourceLabel = (sourceType: AssetTimelineItem["sourceType"]): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance Log";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project Event";
    case "inventory_transaction":
      return "Inventory Transaction";
    case "schedule_change":
      return "Schedule Change";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition Assessment";
    case "usage_reading":
      return "Usage Reading";
    default:
      return "Activity";
  }
};
