"use client";

import type { InventoryItemSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { createQuickRestockAction } from "../app/actions";

type InventoryQuickRestockProps = {
  householdId: string;
  items: InventoryItemSummary[];
  lowStockItemIds: string[];
  redirectTo: string;
};

type DraftLine = {
  selected: boolean;
  quantity: string;
  unitCost: string;
  notes: string;
};

const getDefaultQuantity = (item: InventoryItemSummary): string => String(item.reorderQuantity ?? 1);

export function InventoryQuickRestock({ householdId, items, lowStockItemIds, redirectTo }: InventoryQuickRestockProps): JSX.Element {
  const [filter, setFilter] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
  const deferredFilter = useDeferredValue(filter);
  const lowStockIdSet = useMemo(() => new Set(lowStockItemIds), [lowStockItemIds]);

  const visibleItems = useMemo(() => {
    const normalizedFilter = deferredFilter.trim().toLowerCase();
    const sorted = [...items].sort((left, right) => {
      const leftLowStock = lowStockIdSet.has(left.id) ? 0 : 1;
      const rightLowStock = lowStockIdSet.has(right.id) ? 0 : 1;

      if (leftLowStock !== rightLowStock) {
        return leftLowStock - rightLowStock;
      }

      return left.name.localeCompare(right.name);
    });

    if (!normalizedFilter) {
      return sorted;
    }

    return sorted.filter((item) => [item.name, item.partNumber, item.category, item.preferredSupplier]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedFilter)));
  }, [deferredFilter, items, lowStockIdSet]);

  const payload = items.flatMap((item) => {
    const draft = drafts[item.id];

    if (!draft?.selected) {
      return [];
    }

    const quantity = Number(draft.quantity);
    const unitCost = draft.unitCost.trim() ? Number(draft.unitCost) : undefined;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{
      inventoryItemId: item.id,
      quantity,
      ...(unitCost !== undefined && Number.isFinite(unitCost) ? { unitCost } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {})
    }];
  });

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Quick Restock</h2>
          <div className="data-table__secondary">Select multiple items, enter quantities and checkout prices once, and create all restock transactions in one batch.</div>
        </div>
      </div>
      <div className="panel__body">
        <form action={createQuickRestockAction} className="workbench-form">
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="itemsPayload" value={JSON.stringify(payload)} />
          <div className="workbench-grid" style={{ marginBottom: 16 }}>
            <label className="field">
              <span>Supplier</span>
              <input type="text" name="supplierName" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="AutoZone" />
            </label>
            <label className="field">
              <span>Supplier Link</span>
              <input type="url" name="supplierUrl" value={supplierUrl} onChange={(event) => setSupplierUrl(event.target.value)} placeholder="https://..." />
            </label>
            <label className="field">
              <span>Received On</span>
              <input type="date" name="receivedAt" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
            </label>
            <label className="field field--full">
              <span>Batch Notes</span>
              <textarea name="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Receipt number, store visit, or delivery notes" />
            </label>
            <label className="field field--full">
              <span>Filter Items</span>
              <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by name, part number, category, or supplier" />
            </label>
          </div>

          {visibleItems.length === 0 ? (
            <p className="panel__empty">No inventory items matched the current filter.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Add</th>
                  <th>Item</th>
                  <th>On Hand</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const draft = drafts[item.id] ?? {
                    selected: false,
                    quantity: getDefaultQuantity(item),
                    unitCost: item.unitCost?.toString() ?? "",
                    notes: ""
                  };

                  return (
                    <tr key={item.id} className={lowStockIdSet.has(item.id) ? "row--due" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              selected: event.target.checked
                            }
                          }))}
                        />
                      </td>
                      <td>
                        <div className="data-table__primary">{item.name}</div>
                        <div className="data-table__secondary">{[item.partNumber, item.preferredSupplier].filter(Boolean).join(" • ") || item.category || "Inventory item"}</div>
                      </td>
                      <td>{item.quantityOnHand} {item.unit}</td>
                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              quantity: event.target.value,
                              selected: true
                            }
                          }))}
                          style={{ width: 96 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.unitCost}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              unitCost: event.target.value,
                              selected: true
                            }
                          }))}
                          style={{ width: 96 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={draft.notes}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              notes: event.target.value,
                              selected: true
                            }
                          }))}
                          placeholder="Optional line note"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="inline-actions inline-actions--end" style={{ marginTop: 16 }}>
            <button type="submit" className="button button--primary" disabled={payload.length === 0}>Create Restock Batch</button>
          </div>
        </form>
      </div>
    </section>
  );
}