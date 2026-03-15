"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type CollapsibleCardProps = {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  badge?: { count: number; variant: "danger" | "warning" };
};

export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  actions,
  children,
  badge
}: CollapsibleCardProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`card card--collapsible${open ? " card--open" : ""}`}>
      <div
        className="card__header"
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        aria-expanded={open}
      >
        <div className="card__header-left">
          <h3>{title}</h3>
          {badge && badge.count > 0 ? (
            <span className={`card__header-badge card__header-badge--${badge.variant}`}>
              {badge.count}
            </span>
          ) : null}
        </div>
        {actions ? (
          <div
            className="card__header-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {!open && summary ? (
        <div className="card__summary">{summary}</div>
      ) : null}
      <div className="card__collapse-region">
        <div className="card__collapse-inner">
          <div className="card__body">{children}</div>
        </div>
      </div>
    </div>
  );
}
