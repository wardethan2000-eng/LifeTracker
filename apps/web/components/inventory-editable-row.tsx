"use client";

import type { InventoryItemConsumption, InventoryItemSummary } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX, MouseEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import { formatCurrency, formatDate } from "../lib/formatters";

type InventoryEditableRowProps = {
  householdId: string;
  item: InventoryItemSummary;
  className?: string;
  defaultOpen?: boolean;
  analytics?: InventoryItemConsumption | null;
  columnCount?: number;
  children: ReactNode;
};

const formatConsumptionRate = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No consumption trend";
  }

  return `~${value.toFixed(1)} ${unit}/month`;
};

export function InventoryEditableRow({ householdId, item, className, defaultOpen = false, analytics = null, columnCount = 6, children }: InventoryEditableRowProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  const handleClick = useCallback((event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest("a, button, input, select, textarea, label")) {
      return;
    }

    setOpen((current) => !current);
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
        title={open ? "Click to collapse" : "Click to expand"}
      >
        {children}
      </tr>
      <tr className="inventory-row-expand-wrapper" aria-hidden={!open}>
        <td colSpan={columnCount} style={{ padding: 0, border: "none" }}>
          <div className={`inventory-row-expand${open ? " inventory-row-expand--open" : ""}`}>
            <div>
              <div className="inventory-row-expand__body">
                <div className="inventory-row-expand__grid">
                  <div>
                    <span className="inventory-row-expand__label">Reorder At</span>
                    <span className="inventory-row-expand__value">{item.reorderThreshold !== null ? `${item.reorderThreshold} ${item.unit}` : "—"}</span>
                  </div>
                  <div>
                    <span className="inventory-row-expand__label">Restock Qty</span>
                    <span className="inventory-row-expand__value">{item.reorderQuantity !== null ? `${item.reorderQuantity} ${item.unit}` : "—"}</span>
                  </div>
                  <div>
                    <span className="inventory-row-expand__label">Last Price</span>
                    <span className="inventory-row-expand__value">{formatCurrency(item.unitCost, "—")}</span>
                  </div>
                  <div>
                    <span className="inventory-row-expand__label">Supplier</span>
                    <span className="inventory-row-expand__value">{item.preferredSupplier ?? "—"}</span>
                  </div>
                  {item.conditionStatus && (
                    <div>
                      <span className="inventory-row-expand__label">Condition</span>
                      <span className="inventory-row-expand__value">{item.conditionStatus.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {item.supplierUrl && (
                    <div>
                      <span className="inventory-row-expand__label">Buy Link</span>
                      <a href={item.supplierUrl} target="_blank" rel="noopener noreferrer" className="text-link" style={{ fontSize: "0.8rem" }}>Visit supplier ↗</a>
                    </div>
                  )}
                </div>
                {analytics && (
                  <div className="inventory-row-expand__analytics">
                    <span className="inventory-row-expand__label">Consumption</span>
                    <span className="inventory-row-expand__value">{formatConsumptionRate(analytics.averageConsumptionPerMonth, item.unit)}</span>
                    {analytics.projectedDepletionDate && (
                      <>
                        <span className="inventory-row-expand__label">Depletion</span>
                        <span className="inventory-row-expand__value">~{formatDate(analytics.projectedDepletionDate, "—")}</span>
                      </>
                    )}
                    {averageCost !== null && (
                      <>
                        <span className="inventory-row-expand__label">Avg Cost</span>
                        <span className="inventory-row-expand__value">{formatCurrency(averageCost, "—")}</span>
                      </>
                    )}
                  </div>
                )}
                {item.notes && (
                  <p className="inventory-row-expand__notes">{item.notes.length > 120 ? `${item.notes.slice(0, 120)}…` : item.notes}</p>
                )}
                <Link href={`/inventory/${item.id}?householdId=${householdId}`} className="button button--ghost button--sm" style={{ marginTop: 8 }}>Open full editor →</Link>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
