"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { useTheme, type ThemePreference } from "./theme-provider";

const themeOptions: ThemePreference[] = ["light", "dark", "system"];

export function ThemeToggle(): JSX.Element {
  const t = useTranslations("common.toolbar.theme");
  const { theme, setTheme } = useTheme();

  return (
    <div className="toolbar-segment">
      <span className="toolbar-segment__label">{t("label")}</span>
      <div className="toolbar-segment__group" role="group" aria-label={t("ariaLabel")}>
        {themeOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="toolbar-segment__button"
            aria-pressed={theme === option}
            onClick={() => setTheme(option)}
          >
            {t(option)}
          </button>
        ))}
      </div>
    </div>
  );
}