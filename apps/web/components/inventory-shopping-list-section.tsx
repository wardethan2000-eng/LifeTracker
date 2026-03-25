"use client";

import type { InventoryPurchaseLine, InventoryShoppingListSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import { useState } from "react";
import { generateInventoryShoppingListAction, updateInventoryPurchaseLineAction } from "../app/actions";
import { formatCurrency } from "../lib/formatters";

type InventoryShoppingListSectionProps = {
  householdId: string;
  shoppingList: InventoryShoppingListSummary;
  redirectTo: string;
};

type EditState = {
  plannedQuantity: string;
  orderedQuantity: string;
  receivedQuantity: string;
  unitCost: string;
  notes: string;
};

const formatQuantity = (value: number, unit: string): string => `${value} ${unit}`;

function PurchaseLineRow({ householdId, purchaseId, line, redirectTo }: {
  householdId: string;
  purchaseId: string;
  line: InventoryPurchaseLine;
  redirectTo: string;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>({
    plannedQuantity: String(line.plannedQuantity),
    orderedQuantity: String(line.orderedQuantity ?? line.plannedQuantity),
    receivedQuantity: String(line.receivedQuantity ?? line.orderedQuantity ?? line.plannedQuantity),
    unitCost: line.unitCost?.toString() ?? line.inventoryItem.unitCost?.toString() ?? "",
    notes: line.notes ?? "",
  });

  const isReceived = line.status === "received";

  return (
    <>
      <tr className={line.inventoryItem.lowStock ? "row--due" : ""}>
        <td>
          <div className="data-table__primary">{line.inventoryItem.name}</div>
          <div className="data-table__secondary">{line.inventoryItem.partNumber ?? "No part number"}</div>
        </td>
        <td>
          <span className={line.inventoryItem.quantityOnHand <= 0 ? "data-table__secondary" : ""}>
            {formatQuantity(line.inventoryItem.quantityOnHand, line.inventoryItem.unit)}
          </span>
        </td>
        <td>{formatQuantity(line.plannedQuantity, line.inventoryItem.unit)}</td>
        <td>{formatCurrency(line.unitCost, "—")}</td>
        <td>
          <span className={`status-chip status-chip--${isReceived ? "upcoming" : line.status === "ordered" ? "due" : "warning"}`}>
            {line.status}
          </span>
        </td>
        <td>
          {isReceived ? (
            <span className="data-table__secondary">
              {line.receivedQuantity ?? line.orderedQuantity ?? line.plannedQuantity}&nbsp;
              {line.inventoryItem.unit} @ {formatCurrency(line.unitCost, "—")}
            </span>
          ) : (
            <button
              type="button"
              className={`button button--ghost button--sm${editing ? " button--active" : ""}`}
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
            >
              {editing ? "Close" : "Update"}
            </button>
          )}
        </td>
      </tr>
      {editing && !isReceived && (
        <tr className="row--editing">
          <td colSpan={6} className="purchase-line-edit-cell">
            <form action={updateInventoryPurchaseLineAction} className="workbench-form">
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="purchaseId" value={purchaseId} />
              <input type="hidden" name="lineId" value={line.id} />
              <input type="hidden" name="inventoryItemId" value={line.inventoryItemId} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className="workbench-grid">
                <label className="field">
                  <span>Planned Quantity</span>
                  <input
                    type="number" min="0.01" step="0.01" name="plannedQuantity"
                    value={editState.plannedQuantity}
                    onChange={(e) => setEditState((s) => ({ ...s, plannedQuantity: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Ordered Quantity</span>
                  <input
                    type="number" min="0.01" step="0.01" name="orderedQuantity"
                    value={editState.orderedQuantity}
                    onChange={(e) => setEditState((s) => ({ ...s, orderedQuantity: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Receive Quantity</span>
                  <input
                    type="number" min="0.01" step="0.01" name="receivedQuantity"
                    value={editState.receivedQuantity}
                    onChange={(e) => setEditState((s) => ({ ...s, receivedQuantity: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Unit Cost</span>
                  <input
                    type="number" min="0" step="0.01" name="unitCost"
                    value={editState.unitCost}
                    onChange={(e) => setEditState((s) => ({ ...s, unitCost: e.target.value }))}
                  />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea
                    name="notes" rows={2}
                    value={editState.notes}
                    onChange={(e) => setEditState((s) => ({ ...s, notes: e.target.value }))}
                    placeholder="PO number, substitution notes, delivery details"
                  />
                </label>
              </div>
              <div className="purchase-line-edit-actions">
                <button type="button" className="button button--ghost button--sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <div className="purchase-line-edit-actions__submit">
                  <button type="submit" name="status" value="ordered" className="button button--ghost button--sm">
                    {line.status === "ordered" ? "Update Order" : "Mark Ordered"}
                  </button>
                  <button type="submit" name="status" value="received" className="button button--primary button--sm">
                    Receive Stock
                  </button>
                </div>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export function InventoryShoppingListSection({ householdId, shoppingList, redirectTo }: InventoryShoppingListSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className="panel">
      <div className="panel__header" style={{ cursor: "pointer" }} onClick={() => setCollapsed((v) => !v)}>
        <div>
          <h2>Shopping List / Reorder Cart <span className="panel__collapse-indicator">{collapsed ? "▸" : "▾"}</span></h2>
          <div className="data-table__secondary">
            {shoppingList.lineCount} line{shoppingList.lineCount === 1 ? "" : "s"} across {shoppingList.supplierCount} supplier{shoppingList.supplierCount === 1 ? "" : "s"}
            {shoppingList.totalEstimatedCost !== null ? ` • ${formatCurrency(shoppingList.totalEstimatedCost, "$0.00")} estimated` : ""}
          </div>
        </div>
        <div className="panel__header-actions" onClick={(e) => e.stopPropagation()}>
          <form action={generateInventoryShoppingListAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <button type="submit" className="button button--primary button--sm">Generate Shopping List</button>
          </form>
        </div>
      </div>
      {!collapsed && (
        <div className="panel__body">
          {shoppingList.purchaseCount === 0 ? (
            <p className="panel__empty">No active reorder carts yet. Generate one from the low-stock watchlist or use Quick Restock below.</p>
          ) : (
          <div className="purchase-group-list">
            {shoppingList.purchases.map((purchase) => (
              <section key={purchase.id} className="purchase-group">
                <div className="purchase-group__header">
                  <div className="purchase-group__identity">
                    <strong className="purchase-group__name">{purchase.supplierName ?? "No supplier specified"}</strong>
                    <span className={`status-chip status-chip--${purchase.status === "ordered" ? "due" : "upcoming"}`}>
                      {purchase.status}
                    </span>
                  </div>
                  <div className="purchase-group__meta">
                    {purchase.lineCount} line{purchase.lineCount === 1 ? "" : "s"}
                    {purchase.totalEstimatedCost !== null ? ` • ${formatCurrency(purchase.totalEstimatedCost, "$0.00")}` : ""}
                  </div>
                  {purchase.supplierUrl ? (
                    <a href={purchase.supplierUrl} target="_blank" rel="noreferrer" className="button button--ghost button--sm purchase-group__supplier-link">
                      Open Supplier ↗
                    </a>
                  ) : null}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Current Stock</th>
                      <th>Planned Buy</th>
                      <th>Unit Cost</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.lines.map((line) => (
                      <PurchaseLineRow
                        key={line.id}
                        householdId={householdId}
                        purchaseId={purchase.id}
                        line={line}
                        redirectTo={redirectTo}
                      />
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
        </div>
      )}
    </section>
  );
}