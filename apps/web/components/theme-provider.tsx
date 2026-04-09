"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const storageKey = "aegis-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const getStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  return storedTheme === "dark" ? "dark" : "light";
};

const applyTheme = (theme: ResolvedTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
};

const disableThemeTransitionsTemporarily = (): void => {
  const root = document.documentElement;
  root.setAttribute("data-theme-switching", "true");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.removeAttribute("data-theme-switching");
    });
  });
};

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps): ReactNode {
  const [theme, setThemeState] = useState<ThemePreference>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const initialTheme = getStoredTheme();

    setThemeState(initialTheme);
    setResolvedTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = (nextTheme: ThemePreference): void => {
    disableThemeTransitionsTemporarily();

    setThemeState(nextTheme);
    setResolvedTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  };

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }), [resolvedTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}