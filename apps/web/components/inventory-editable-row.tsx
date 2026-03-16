"use client";

import type { InventoryItemConsumption, InventoryItemSummary } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";
import { ExpandModal } from "./expand-modal";
import { InventoryItemEditForm } from "./inventory-item-edit-form";
import { AttachmentSection } from "./attachment-section";
import { formatCurrency, formatDate } from "../lib/formatters";

type InventoryEditableRowProps = {
  householdId: string;
  item: InventoryItemSummary;
  className?: string;
  defaultOpen?: boolean;
  analytics?: InventoryItemConsumption | null;
  children: ReactNode;
};

const formatConsumptionRate = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No consumption trend";
  }

  return `~${value.toFixed(1)} ${unit}/month`;
};

const getAnalyticsLink = (householdId: string): string => {
  const query = new URLSearchParams({
    householdId,
    view: "analytics",
    section: "turnover"
  });

  return `/inventory?${query.toString()}`;
};

export function InventoryEditableRow({ householdId, item, className, defaultOpen = false, analytics = null, children }: InventoryEditableRowProps): JSX.Element {
  const [editing, setEditing] = useState(defaultOpen);

  const handleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleSaved = useCallback(() => {
    setEditing(false);
    window.location.reload();
  }, []);

  const costTrendTotals = analytics
    ? analytics.costTrend.reduce((sum, entry) => ({
        totalCost: sum.totalCost + entry.totalCost,
        quantity: sum.quantity + entry.quantity
      }), { totalCost: 0, quantity: 0 })
    : null;
  const averageCost = costTrendTotals && costTrendTotals.quantity > 0
    ? costTrendTotals.totalCost / costTrendTotals.quantity
    : null;

  return (
    <>
      <tr
        className={className}
        style={{ cursor: "pointer" }}
        onClick={handleClick}
        title="Click to edit"
      >
        {children}
      </tr>
      {editing && (
        <ExpandModal title={`Edit: ${item.name}`} onClose={() => setEditing(false)}>
          {analytics ? (
            <section className="panel inventory-analytics-detail" style={{ marginBottom: 16 }}>
              <div className="panel__header">
                <h2>Consumption Snapshot</h2>
              </div>
              <div className="panel__body" style={{ display: "grid", gap: 12 }}>
                <div className="analytics-detail-grid">
                  <div>
                    <div className="data-table__primary">Average consumption rate</div>
                    <div className="data-table__secondary">{formatConsumptionRate(analytics.averageConsumptionPerMonth, item.unit)}</div>
                  </div>
                  <div>
                    <div className="data-table__primary">Projected depletion</div>
                    <div className="data-table__secondary">
                      {analytics.projectedDepletionDate ? `Stock runs out ~${formatDate(analytics.projectedDepletionDate, "—")}` : "No consumption trend"}
                    </div>
                  </div>
                  <div>
                    <div className="data-table__primary">Projected reorder</div>
                    <div className="data-table__secondary">
                      {item.reorderThreshold === null
                        ? "No threshold set"
                        : analytics.projectedReorderDate
                          ? `Reorder needed by ~${formatDate(analytics.projectedReorderDate, "—")}`
                          : "No consumption trend"}
                    </div>
                  </div>
                  <div>
                    <div className="data-table__primary">Cost trend</div>
                    <div className="data-table__secondary">Avg cost: {formatCurrency(averageCost, "—")} (last 12 months)</div>
                  </div>
                </div>
                <Link href={getAnalyticsLink(householdId)} className="data-table__link">View full analytics</Link>
              </div>
            </section>
          ) : null}
          <InventoryItemEditForm
            householdId={householdId}
            item={item}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <AttachmentSection
              householdId={householdId}
              entityType="inventory_item"
              entityId={item.id}
              compact
            />
          </div>
        </ExpandModal>
      )}
    </>
  );
}
