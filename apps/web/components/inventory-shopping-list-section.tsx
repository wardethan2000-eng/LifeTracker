"use client";

import type { InventoryPurchaseLine, InventoryShoppingListSummary } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { generateInventoryShoppingListAction, updateInventoryPurchaseLineAction } from "../app/actions";
import { deleteInventoryPurchase, updateInventoryPurchase } from "../lib/api";
import { formatCurrency } from "../lib/formatters";
import { useToast } from "./toast-provider";
import { useCoalescedRefresh } from "./use-coalesced-refresh";

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
          <span className={`pill ${isReceived ? "pill--success" : line.status === "ordered" ? "pill--warning" : "pill--muted"}`}>
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

type PurchaseEditFormProps = {
  purchase: { supplierName: string | null; notes: string | null };
  onSave: (data: { supplierName?: string; notes?: string }) => void;
  onCancel: () => void;
};

function PurchaseEditForm({ purchase, onSave, onCancel }: PurchaseEditFormProps): JSX.Element {
  const [supplierName, setSupplierName] = useState(purchase.supplierName ?? "");
  const [notes, setNotes] = useState(purchase.notes ?? "");

  return (
    <div className="purchase-group__edit" style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
      <div className="form-grid" style={{ marginBottom: 12 }}>
        <label className="field">
          <span>Supplier Name</span>
          <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="AutoZone, Amazon, etc." />
        </label>
        <label className="field field--full">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="PO number, delivery notes..." />
        </label>
      </div>
      <div className="inline-actions inline-actions--end">
        <button type="button" className="button button--ghost button--sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="button button--primary button--sm" onClick={() => onSave({ supplierName: supplierName || undefined, notes: notes || undefined })}>Save</button>
      </div>
    </div>
  );
}

export function InventoryShoppingListSection({ householdId, shoppingList, redirectTo }: InventoryShoppingListSectionProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const requestRefresh = useCoalescedRefresh();
  const { pushToast } = useToast();

  const searchLower = purchaseSearch.trim().toLowerCase();
  const filteredPurchases = searchLower
    ? shoppingList.purchases.filter(
        (purchase) =>
          (purchase.supplierName ?? "").toLowerCase().includes(searchLower) ||
          purchase.lines.some((line) => line.inventoryItem.name.toLowerCase().includes(searchLower))
      )
    : shoppingList.purchases;

  const handleDeletePurchase = useCallback(async (purchaseId: string) => {
    try {
      await deleteInventoryPurchase(householdId, purchaseId);
      pushToast({ message: "Purchase deleted." });
      requestRefresh();
    } catch {
      pushToast({ message: "Failed to delete purchase.", tone: "danger" });
    }
  }, [householdId, pushToast, requestRefresh]);

  const handleUpdatePurchase = useCallback(async (purchaseId: string, data: { supplierName?: string; notes?: string }) => {
    try {
      await updateInventoryPurchase(householdId, purchaseId, data);
      pushToast({ message: "Purchase updated." });
      setEditingPurchaseId(null);
      requestRefresh();
    } catch {
      pushToast({ message: "Failed to update purchase.", tone: "danger" });
    }
  }, [householdId, pushToast, requestRefresh]);

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
          <>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
              <input
                type="search"
                placeholder="Search by supplier or item name…"
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 360 }}
                className="input"
              />
            </div>
          <div className="purchase-group-list">
            {filteredPurchases.length === 0 ? (
              <p className="panel__empty">No purchases match "{purchaseSearch}".</p>
            ) : filteredPurchases.map((purchase) => (
              <section key={purchase.id} className="purchase-group">
                <div className="purchase-group__header">
                  <div className="purchase-group__identity">
                    <strong className="purchase-group__name">{purchase.supplierName ?? "No supplier specified"}</strong>
                    <span className={`pill ${purchase.status === "ordered" ? "pill--warning" : "pill--success"}`}>
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
                  <div className="purchase-group__actions">
                    <button
                      type="button"
                      className="button button--ghost button--sm"
                      onClick={() => setEditingPurchaseId(editingPurchaseId === purchase.id ? null : purchase.id)}
                    >
                      {editingPurchaseId === purchase.id ? "Cancel" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--sm"
                      style={{ color: "var(--red, #dc2626)" }}
                      onClick={() => { void handleDeletePurchase(purchase.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingPurchaseId === purchase.id && (
                  <PurchaseEditForm
                    purchase={purchase}
                    onSave={(data) => { void handleUpdatePurchase(purchase.id, data); }}
                    onCancel={() => setEditingPurchaseId(null)}
                  />
                )}
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
          </>
        )}
        </div>
      )}
    </section>
  );
}