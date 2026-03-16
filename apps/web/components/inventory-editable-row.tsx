"use client";

import type { InventoryItemConsumption, InventoryItemSummary } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpandableCard } from "./expandable-card";
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

const inventoryRowColumnCount = 7;

export function InventoryEditableRow({ householdId, item, className, defaultOpen = false, analytics = null, children }: InventoryEditableRowProps): JSX.Element {
  const [editing, setEditing] = useState(defaultOpen);
  const router = useRouter();

  const handleClick = useCallback(() => {
    setEditing((current) => !current);
  }, []);

  const handleSaved = useCallback(() => {
    setEditing(false);
    router.refresh();
  }, [router]);

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
        title={editing ? "Click to collapse" : "Click to edit"}
      >
        {children}
      </tr>
      {editing && (
        <tr>
          <td colSpan={inventoryRowColumnCount} style={{ padding: "12px 0 0" }}>
            <ExpandableCard
              title={`Edit ${item.name}`}
              modalTitle={`Edit ${item.name}`}
              open={editing}
              onOpenChange={setEditing}
              previewContent={(
                analytics ? (
                  <div style={{ display: "grid", gap: 12 }}>
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
                ) : (
                  <div className="compact-preview">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <span className="compact-preview__pill">{item.quantityOnHand} {item.unit} on hand</span>
                      <span className="compact-preview__pill">{formatCurrency(item.unitCost, "No price")}</span>
                      <span className="compact-preview__pill">{item.preferredSupplier ?? "No supplier"}</span>
                    </div>
                    <p className="compact-preview__overflow">Update stock, pricing, reorder rules, and attachments inline.</p>
                  </div>
                )
              )}
            >
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
            </ExpandableCard>
          </td>
        </tr>
      )}
    </>
  );
}
