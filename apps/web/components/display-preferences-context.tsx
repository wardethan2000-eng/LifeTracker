"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DisplayPreferences } from "@lifekeeper/types";
import {
  formatDate as rawFormatDate,
  formatDateTime as rawFormatDateTime,
  formatCurrency as rawFormatCurrency,
} from "../lib/formatters";

type DisplayPreferencesContextValue = {
  preferences: DisplayPreferences;
  formatDate: (value: string | null | undefined, fallback?: string, timeZone?: string) => string;
  formatDateTime: (value: string | null | undefined, fallback?: string, timeZone?: string) => string;
  formatCurrency: (value: number | null | undefined, fallback?: string) => string;
};

const defaultPreferences: DisplayPreferences = {
  pageSize: 25,
  dateFormat: "US",
  currencyCode: "USD",
};

const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue>({
  preferences: defaultPreferences,
  formatDate: (v, fb, tz) => rawFormatDate(v, fb, tz, "US"),
  formatDateTime: (v, fb, tz) => rawFormatDateTime(v, fb, tz, "US"),
  formatCurrency: (v, fb) => rawFormatCurrency(v, fb, "USD"),
});

export function DisplayPreferencesProvider({
  initialPreferences,
  children,
}: {
  initialPreferences: DisplayPreferences;
  children: ReactNode;
}) {
  const value: DisplayPreferencesContextValue = {
    preferences: initialPreferences,
    formatDate: (v, fb, tz) =>
      rawFormatDate(v, fb, tz, initialPreferences.dateFormat),
    formatDateTime: (v, fb, tz) =>
      rawFormatDateTime(v, fb, tz, initialPreferences.dateFormat),
    formatCurrency: (v, fb) =>
      rawFormatCurrency(v, fb, initialPreferences.currencyCode),
  };

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences(): DisplayPreferencesContextValue {
  return useContext(DisplayPreferencesContext);
}
