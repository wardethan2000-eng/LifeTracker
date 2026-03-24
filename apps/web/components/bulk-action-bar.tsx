"use client";

import type { JSX, ReactNode } from "react";

type BulkActionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  selectAllPages?: boolean;
  totalAssets?: number;
  children?: ReactNode;
};

export function BulkActionBar({ selectedCount, onClearSelection, selectAllPages, totalAssets, children }: BulkActionBarProps): JSX.Element | null {
  if (selectedCount === 0) {
    return null;
  }

  const countLabel = selectAllPages && totalAssets
    ? `All ${totalAssets} assets selected`
    : `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected`;

  return (
    <div className="bulk-action-bar">
      <span className="bulk-action-bar__count">
        {countLabel}
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
