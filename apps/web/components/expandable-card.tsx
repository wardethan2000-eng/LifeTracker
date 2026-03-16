"use client";

import type { JSX, ReactNode } from "react";
import { useState } from "react";

type ExpandableCardProps = {
  title: string;
  modalTitle: string;
  previewContent: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  headerContent?: ReactNode;
  badge?: { count: number; variant: "danger" | "warning" | "neutral" };
};

export function ExpandableCard({
  title,
  modalTitle: _modalTitle,
  previewContent,
  children,
  actions,
  headerContent,
  badge
}: ExpandableCardProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => setOpen((current) => !current);

  return (
    <div className={`card card--expandable${open ? " card--open" : ""}`}>
      <div className="card__header" onClick={toggleOpen}>
        <div className="card__header-left">
          <h3>{title}</h3>
          {badge && badge.count > 0 ? (
            <span className={`card__header-badge card__header-badge--${badge.variant}`}>
              {badge.count}
            </span>
          ) : null}
        </div>
        <div className="card__header-actions" onClick={(event) => event.stopPropagation()}>
          {actions}
          <button
            type="button"
            className="card__expand-trigger"
            title={`${open ? "Collapse" : "Expand"} ${title}`}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
            aria-expanded={open}
            onClick={toggleOpen}
          >
            {open ? "▴" : "▾"}
          </button>
        </div>
      </div>
      {headerContent}
      <div className={`card__body${open ? "" : " card__body--interactive"}`} onClick={open ? undefined : toggleOpen}>
        {previewContent}
      </div>
      <div className="card__collapse-region">
        <div className="card__collapse-inner">
          <div className="card__collapse-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
