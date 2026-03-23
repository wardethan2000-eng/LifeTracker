"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const DEFAULT_TIMEZONE = "America/New_York";
const DEFAULT_LOCALE = "en-US";

type TimezoneContextValue = {
  timezone: string;
  locale: string;
};

const TimezoneContext = createContext<TimezoneContextValue>({
  timezone: DEFAULT_TIMEZONE,
  locale: DEFAULT_LOCALE
});

export function TimezoneProvider({
  timezone,
  children
}: {
  timezone: string;
  locale?: string;
  children: ReactNode;
}): JSX.Element {
  const resolvedLocale =
    typeof navigator !== "undefined" ? navigator.language : DEFAULT_LOCALE;

  return (
    <TimezoneContext.Provider value={{ timezone, locale: resolvedLocale }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): TimezoneContextValue {
  return useContext(TimezoneContext);
}
