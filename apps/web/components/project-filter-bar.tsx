"use client";

import type { JSX, ReactNode } from "react";
import { useState } from "react";

type ProjectFilterBarProps = {
  children: ReactNode;
  hasActiveFilters: boolean;
  activeFilterSummary: string;
};

export function ProjectFilterBar({
  children,
  hasActiveFilters,
  activeFilterSummary,
}: ProjectFilterBarProps): JSX.Element {
  const [open, setOpen] = useState(hasActiveFilters);

  return (
    <div className={`collapsible-filter-bar${open ? " collapsible-filter-bar--open" : ""}`}>
      <button
        type="button"
        className="collapsible-filter-bar__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span className="collapsible-filter-bar__label">
          {hasActiveFilters ? activeFilterSummary : "Search & filter"}
        </span>
        <svg
          className="collapsible-filter-bar__chevron"
          xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="collapsible-filter-bar__body">
          {children}
        </div>
      )}
    </div>
  );
}
