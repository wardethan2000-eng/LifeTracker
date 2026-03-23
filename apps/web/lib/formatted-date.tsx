"use client";

import type { JSX } from "react";
import { useTimezone } from "./timezone-context";
import { formatDate, formatDateTime } from "./formatters";

export type FormattedDateProps = {
  value: string | null | undefined;
  fallback?: string;
  /** Include time (hour + minute) in the output */
  showTime?: boolean;
};

/**
 * Renders a date (or datetime) string formatted in the household's timezone.
 * Must be used inside a <TimezoneProvider>.
 */
export function FormattedDate({ value, fallback = "Not set", showTime = false }: FormattedDateProps): JSX.Element {
  const { timezone } = useTimezone();
  const formatted = showTime
    ? formatDateTime(value, fallback, timezone)
    : formatDate(value, fallback, timezone);
  return <>{formatted}</>;
}

/**
 * Hook that returns a formatter function bound to the household's timezone.
 * Useful for imperative formatting (e.g., in callbacks or derived values).
 */
export function useFormattedDate(): {
  formatDate: (value: string | null | undefined, fallback?: string) => string;
  formatDateTime: (value: string | null | undefined, fallback?: string) => string;
} {
  const { timezone } = useTimezone();
  return {
    formatDate: (value, fallback) => formatDate(value, fallback, timezone),
    formatDateTime: (value, fallback) => formatDateTime(value, fallback, timezone)
  };
}
