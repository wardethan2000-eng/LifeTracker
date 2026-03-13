import type {
  AssetCategory,
  AssetOverview,
  AssetVisibility,
  MaintenanceTrigger,
  Notification,
  ScheduleStatus
} from "@lifekeeper/types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const categoryLabels: Record<AssetCategory, string> = {
  vehicle: "Vehicle",
  home: "Home",
  marine: "Marine",
  aircraft: "Aircraft",
  yard: "Yard",
  workshop: "Workshop",
  appliance: "Appliance",
  hvac: "HVAC",
  technology: "Technology",
  other: "Other"
};

const visibilityLabels: Record<AssetVisibility, string> = {
  personal: "Personal",
  shared: "Shared"
};

const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  overdue: "Overdue",
  due: "Due now",
  upcoming: "Upcoming"
};

export const formatDate = (value: string | null | undefined, fallback = "Not set"): string => {
  if (!value) {
    return fallback;
  }

  return dateFormatter.format(new Date(value));
};

export const formatDateTime = (value: string | null | undefined, fallback = "Not set"): string => {
  if (!value) {
    return fallback;
  }

  return dateTimeFormatter.format(new Date(value));
};

export const formatCurrency = (value: number | null | undefined, fallback = "No cost"): string => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return currencyFormatter.format(value);
};

export const formatCategoryLabel = (value: AssetCategory): string => categoryLabels[value];

export const formatVisibilityLabel = (value: AssetVisibility): string => visibilityLabels[value];

export const formatScheduleStatus = (value: ScheduleStatus): string => scheduleStatusLabels[value];

export const getAssetTone = (asset: AssetOverview): "overdue" | "due" | "upcoming" | "clear" => {
  if (asset.overdueScheduleCount > 0) {
    return "overdue";
  }

  if (asset.dueScheduleCount > 0) {
    return "due";
  }

  if (asset.nextDueAt) {
    return "upcoming";
  }

  return "clear";
};

export const formatAssetStateLabel = (asset: AssetOverview): string => {
  const tone = getAssetTone(asset);

  if (tone === "overdue") {
    return `${asset.overdueScheduleCount} overdue`;
  }

  if (tone === "due") {
    return `${asset.dueScheduleCount} due now`;
  }

  if (tone === "upcoming") {
    return "Upcoming";
  }

  return "Clear";
};

export const formatDueLabel = (
  nextDueAt: string | null,
  nextDueMetricValue: number | null,
  metricUnit: string | null
): string => {
  if (nextDueAt) {
    return formatDate(nextDueAt);
  }

  if (nextDueMetricValue !== null) {
    return `${nextDueMetricValue} ${metricUnit ?? "units"}`;
  }

  return "Needs review";
};

export const formatTriggerSummary = (trigger: MaintenanceTrigger): string => {
  switch (trigger.type) {
    case "interval":
      return `Every ${trigger.intervalDays} days`;
    case "usage":
      return `Every ${trigger.intervalValue} units`;
    case "seasonal":
      return `Seasonal on ${trigger.month}/${trigger.day}`;
    case "one_time":
      return `One-time on ${formatDate(trigger.dueAt)}`;
    case "compound":
      return `${trigger.logic === "whichever_first" ? "Whichever comes first" : "Whichever comes last"}: ${trigger.intervalDays} days or ${trigger.intervalValue} units`;
    default:
      return "Custom trigger";
  }
};

export const formatNotificationTone = (notification: Notification): "read" | "pending" => {
  if (notification.readAt || notification.status === "read") {
    return "read";
  }

  return "pending";
};