"use client";

import type { JSX } from "react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Density = "relaxed" | "standard" | "compact";

const densityOptions: Density[] = ["relaxed", "standard", "compact"];
const storageKey = "lifekeeper-ui-density";

const applyDensity = (density: Density): void => {
  document.documentElement.setAttribute("data-ui-density", density);
};

export function DensityToggle(): JSX.Element {
  const t = useTranslations("common.toolbar.density");
  const [density, setDensity] = useState<Density>("standard");

  useEffect(() => {
    const savedDensity = window.localStorage.getItem(storageKey);
    const initialDensity = densityOptions.includes(savedDensity as Density)
      ? savedDensity as Density
      : "standard";

    setDensity(initialDensity);
    applyDensity(initialDensity);
  }, []);

  const handleSelect = (nextDensity: Density): void => {
    setDensity(nextDensity);
    applyDensity(nextDensity);
    window.localStorage.setItem(storageKey, nextDensity);
  };

  return (
    <div className="toolbar-segment">
      <span className="toolbar-segment__label">{t("label")}</span>
      <div className="toolbar-segment__group" role="group" aria-label={t("ariaLabel")}>
        {densityOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="toolbar-segment__button"
            aria-pressed={density === option}
            onClick={() => handleSelect(option)}
          >
            {t(option)}
          </button>
        ))}
      </div>
    </div>
  );
}