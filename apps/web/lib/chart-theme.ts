const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC"
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  timeZone: "UTC"
});

export const chartColors = {
  primary: "#4f6ef7",
  secondary: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
  series: ["#4f6ef7", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"]
} as const;

export const formatCurrencyTick = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "$0";
  }

  return compactCurrencyFormatter.format(value).replace(/\.0(?=[A-Z']|$)/, "");
};

export const formatMonthTick = (value: string): string => {
  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return value;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return `${monthFormatter.format(date)} '${String(year).slice(-2)}`;
};

export const formatDateTick = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dayFormatter.format(date);
};

export const formatPercentTick = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value}%`;
};