"use client";

import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { InventoryAddDrawer } from "./inventory-add-drawer";

type InventorySectionProps = {
  householdId: string;
  totalCount: number;
  categoryOptions: string[];
  actions?: ReactNode;
  children: ReactNode;
};

export function InventorySection({ householdId, totalCount, categoryOptions, actions, children }: InventorySectionProps): JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Universal Inventory ({totalCount})</h2>
          <div className="data-table__secondary">Household-wide stock, organized by category across assets, projects, and shared supplies</div>
        </div>
        <div className="panel__header-actions">
          {actions}
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={() => setDrawerOpen(true)}
          >
            Add to Inventory
          </button>
        </div>
      </div>

      <div className="panel__body">{children}</div>

      <InventoryAddDrawer
        householdId={householdId}
        categoryOptions={categoryOptions}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </section>
  );
}