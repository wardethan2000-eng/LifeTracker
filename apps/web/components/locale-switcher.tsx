"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

const localeCookieName = "NEXT_LOCALE";

export function LocaleSwitcher(): JSX.Element {
  const t = useTranslations("common.toolbar.locale");
  const locale = useLocale();
  const router = useRouter();

  const handleChange = (nextLocale: string): void => {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; samesite=lax`;
    router.refresh();
  };

  return (
    <label className="toolbar-select">
      <span className="toolbar-select__label">{t("label")}</span>
      <select value={locale} onChange={(event) => handleChange(event.target.value)} aria-label={t("ariaLabel")}>
        <option value="en">{t("english")}</option>
      </select>
    </label>
  );
}