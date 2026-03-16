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
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ExpandableCard({
  title,
  modalTitle: _modalTitle,
  previewContent,
  children,
  actions,
  headerContent,
  badge,
  defaultOpen = false,
  open,
  onOpenChange
}: ExpandableCardProps): JSX.Element {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const setOpen = (nextOpen: boolean): void => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  const toggleOpen = () => setOpen(!isOpen);

  return (
    <div className={`card card--expandable${isOpen ? " card--open" : ""}`}>
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
            title={`${isOpen ? "Collapse" : "Expand"} ${title}`}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
            aria-expanded={isOpen}
            onClick={toggleOpen}
          >
            {isOpen ? "▴" : "▾"}
          </button>
        </div>
      </div>
      {headerContent}
      <div className={`card__body${isOpen ? "" : " card__body--interactive"}`} onClick={isOpen ? undefined : toggleOpen}>
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
