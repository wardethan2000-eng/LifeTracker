"use client";

import type { JSX, ReactNode } from "react";

type BulkActionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  children?: ReactNode;
};

export function BulkActionBar({ selectedCount, onClearSelection, children }: BulkActionBarProps): JSX.Element | null {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bulk-action-bar">
      <span className="bulk-action-bar__count">
        {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="bulk-action-bar__actions">
        {children}
        <button type="button" className="button button--ghost button--sm" onClick={onClearSelection}>
          Clear selection
        </button>
      </div>
    </div>
  );
}
