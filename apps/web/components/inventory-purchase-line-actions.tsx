"use client";

import type { InventoryPurchaseLine } from "@aegis/types";
import type { JSX } from "react";
import { useState } from "react";
import { updateInventoryPurchaseLineAction } from "../app/actions";
import { formatCurrency } from "../lib/formatters";
import { ExpandableCard } from "./expandable-card";

type InventoryPurchaseLineActionsProps = {
  householdId: string;
  purchaseId: string;
  line: InventoryPurchaseLine;
  redirectTo: string;
};

export function InventoryPurchaseLineActions({ householdId, purchaseId, line, redirectTo }: InventoryPurchaseLineActionsProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [plannedQuantity, setPlannedQuantity] = useState(String(line.plannedQuantity));
  const [orderedQuantity, setOrderedQuantity] = useState(String(line.orderedQuantity ?? line.plannedQuantity));
  const [receivedQuantity, setReceivedQuantity] = useState(String(line.receivedQuantity ?? line.orderedQuantity ?? line.plannedQuantity));
  const [unitCost, setUnitCost] = useState(line.unitCost?.toString() ?? line.inventoryItem.unitCost?.toString() ?? "");
  const [notes, setNotes] = useState(line.notes ?? "");

  if (line.status === "received") {
    return (
      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
        <span className="pill pill--success">Received</span>
        <span className="data-table__secondary">
          {line.receivedQuantity ?? line.orderedQuantity ?? line.plannedQuantity} @ {formatCurrency(line.unitCost, "—")}
        </span>
      </div>
    );
  }

  return (
    <ExpandableCard
      title={line.inventoryItem.name}
      modalTitle={`Update ${line.inventoryItem.name}`}
      open={open}
      onOpenChange={setOpen}
      previewContent={(
        <div className="compact-preview">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="compact-preview__pill">Plan {line.plannedQuantity} {line.inventoryItem.unit}</span>
            <span className="compact-preview__pill">Stock {line.inventoryItem.quantityOnHand} {line.inventoryItem.unit}</span>
            <span className="compact-preview__pill">{line.status === "ordered" ? "Ordered" : "Draft"}</span>
          </div>
          <p className="compact-preview__overflow">Adjust quantities, confirm order placement, or receive stock into inventory.</p>
        </div>
      )}
    >
      <form action={updateInventoryPurchaseLineAction} className="workbench-form">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="purchaseId" value={purchaseId} />
        <input type="hidden" name="lineId" value={line.id} />
        <input type="hidden" name="inventoryItemId" value={line.inventoryItemId} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="workbench-grid">
          <label className="field">
            <span>Planned Quantity</span>
            <input type="number" min="0.01" step="0.01" name="plannedQuantity" value={plannedQuantity} onChange={(event) => setPlannedQuantity(event.target.value)} />
          </label>
          <label className="field">
            <span>Ordered Quantity</span>
            <input type="number" min="0.01" step="0.01" name="orderedQuantity" value={orderedQuantity} onChange={(event) => setOrderedQuantity(event.target.value)} />
          </label>
          <label className="field">
            <span>Receive Quantity</span>
            <input type="number" min="0.01" step="0.01" name="receivedQuantity" value={receivedQuantity} onChange={(event) => setReceivedQuantity(event.target.value)} />
          </label>
          <label className="field">
            <span>Unit Cost</span>
            <input type="number" min="0" step="0.01" name="unitCost" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
          </label>
          <label className="field field--full">
            <span>Notes</span>
            <textarea name="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="PO number, substitution notes, delivery details" />
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <button type="button" className="button button--ghost" onClick={() => setOpen(false)}>Close</button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" name="status" value="ordered" className="button button--ghost">
              {line.status === "ordered" ? "Update Order" : "Mark Ordered"}
            </button>
            <button type="submit" name="status" value="received" className="button button--primary">
              Receive Stock
            </button>
          </div>
        </div>
      </form>
    </ExpandableCard>
  );
}