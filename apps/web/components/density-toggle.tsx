"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

type Density = "relaxed" | "standard" | "compact";

const densityOptions: Density[] = ["relaxed", "standard", "compact"];
const storageKey = "lifekeeper-ui-density";

const applyDensity = (density: Density): void => {
  document.documentElement.setAttribute("data-ui-density", density);
};

export function DensityToggle(): JSX.Element {
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
    <div className="density-toggle">
      <span className="density-toggle__label">Style</span>
      <div className="density-toggle__group" role="group" aria-label="Interface density">
        {densityOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="density-toggle__button"
            aria-pressed={density === option}
            onClick={() => handleSelect(option)}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}