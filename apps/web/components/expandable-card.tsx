"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ExpandModal } from "./expand-modal";

type ExpandableCardProps = {
  title: string;
  modalTitle: string;
  previewContent: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  badge?: { count: number; variant: "danger" | "warning" };
};

export function ExpandableCard({
  title,
  modalTitle,
  previewContent,
  children,
  actions,
  badge
}: ExpandableCardProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="card card--expandable">
        <div className="card__header">
          <div className="card__header-left">
            <h3>{title}</h3>
            {badge && badge.count > 0 ? (
              <span className={`card__header-badge card__header-badge--${badge.variant}`}>
                {badge.count}
              </span>
            ) : null}
          </div>
          <div className="card__header-actions">
            {actions}
            <button
              type="button"
              className="card__expand-trigger"
              title={`Expand ${title}`}
              aria-label={`Expand ${title}`}
              onClick={() => setOpen(true)}
            >
              ⤢
            </button>
          </div>
        </div>
        <div className="card__body">{previewContent}</div>
      </div>

      {open ? (
        <ExpandModal title={modalTitle} onClose={() => setOpen(false)}>
          {children}
        </ExpandModal>
      ) : null}
    </>
  );
}
