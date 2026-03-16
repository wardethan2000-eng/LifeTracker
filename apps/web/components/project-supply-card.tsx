"use client";

import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import {
  allocateSupplyFromInventoryAction,
  deleteProjectPhaseSupplyAction,
  updateProjectPhaseSupplyAction
} from "../app/actions";
import { formatCurrency } from "../lib/formatters";

type ProjectSupplyCardProps = {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  linkedInventoryItem?: InventoryItemSummary;
};

export function ProjectSupplyCard({ householdId, projectId, phaseId, supply, linkedInventoryItem }: ProjectSupplyCardProps) {
  const canAllocate = Boolean(supply.inventoryItemId && linkedInventoryItem && linkedInventoryItem.quantityOnHand > 0);

  return (
    <div className="schedule-card">
      <form action={updateProjectPhaseSupplyAction}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phaseId" value={phaseId} />
        <input type="hidden" name="supplyId" value={supply.id} />

        <div className="schedule-card__summary" style={{ marginBottom: 16 }}>
          <div>
            <div className="data-table__primary">{supply.name}</div>
            <div className="data-table__secondary">
              Need {supply.quantityNeeded} {supply.unit} · On hand {supply.quantityOnHand} {supply.unit}
            </div>
            <div className="data-table__secondary">
              Est. {formatCurrency(supply.estimatedUnitCost, "No estimate")} · Actual {formatCurrency(supply.actualUnitCost, "Not captured")}
            </div>
            {supply.supplier ? (
              <div className="data-table__secondary">
                Supplier: {supply.supplier}
                {supply.supplierUrl ? <> · <a className="text-link" href={supply.supplierUrl} target="_blank" rel="noreferrer">Open link</a></> : null}
              </div>
            ) : null}
            {linkedInventoryItem ? (
              <div className="data-table__secondary">
                Linked inventory: {linkedInventoryItem.name} · {linkedInventoryItem.quantityOnHand} {linkedInventoryItem.unit} available
              </div>
            ) : null}
          </div>
          <div className="inline-actions">
            <span className="pill">{supply.isProcured ? "Procured" : "Not procured"}</span>
            <span className="pill">{supply.isStaged ? "Staged" : "Not staged"}</span>
          </div>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Name</span>
            <input name="name" defaultValue={supply.name} required />
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea name="description" rows={2} defaultValue={supply.description ?? ""} />
          </label>
          <label className="field">
            <span>Quantity Needed</span>
            <input name="quantityNeeded" type="number" min="0" step="0.01" defaultValue={supply.quantityNeeded} required />
          </label>
          <label className="field">
            <span>Quantity On Hand</span>
            <input name="quantityOnHand" type="number" min="0" step="0.01" defaultValue={supply.quantityOnHand} />
          </label>
          <label className="field">
            <span>Unit</span>
            <input name="unit" defaultValue={supply.unit} />
          </label>
          <label className="field">
            <span>Sort Order</span>
            <input name="sortOrder" type="number" step="1" defaultValue={supply.sortOrder ?? ""} />
          </label>
          <label className="field">
            <span>Estimated Unit Cost</span>
            <input name="estimatedUnitCost" type="number" min="0" step="0.01" defaultValue={supply.estimatedUnitCost ?? ""} />
          </label>
          <label className="field">
            <span>Actual Unit Cost</span>
            <input name="actualUnitCost" type="number" min="0" step="0.01" defaultValue={supply.actualUnitCost ?? ""} />
          </label>
          <label className="field">
            <span>Supplier</span>
            <input name="supplier" defaultValue={supply.supplier ?? ""} />
          </label>
          <label className="field">
            <span>Supplier URL</span>
            <input name="supplierUrl" type="url" defaultValue={supply.supplierUrl ?? ""} />
          </label>
          <label className="field">
            <span>Linked Inventory Item</span>
            <input name="inventoryItemId" defaultValue={supply.inventoryItemId ?? ""} placeholder="Inventory item id" />
          </label>
          <label className="field field--full">
            <span>Notes</span>
            <textarea name="notes" rows={2} defaultValue={supply.notes ?? ""} />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" name="isProcured" defaultChecked={supply.isProcured} />
            <span>Procured</span>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" name="isStaged" defaultChecked={supply.isStaged} />
            <span>Staged</span>
          </label>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="button button--ghost">Save Supply</button>
        </div>
      </form>

      {canAllocate ? (
        <form action={allocateSupplyFromInventoryAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phaseId} />
          <input type="hidden" name="supplyId" value={supply.id} />
          <div className="form-grid">
            <label className="field">
              <span>Allocate Quantity</span>
              <input name="quantity" type="number" min="0.01" step="0.01" max={linkedInventoryItem?.quantityOnHand ?? undefined} required />
            </label>
            <label className="field">
              <span>Actual Unit Cost</span>
              <input name="unitCost" type="number" min="0" step="0.01" placeholder={supply.actualUnitCost?.toString() ?? "Optional"} />
            </label>
            <label className="field field--full">
              <span>Allocation Notes</span>
              <textarea name="notes" rows={2} placeholder="Allocated from household stock for this phase." />
            </label>
          </div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="button">Allocate from Inventory</button>
          </div>
        </form>
      ) : null}

      <form action={deleteProjectPhaseSupplyAction} className="inline-actions inline-actions--end" style={{ marginTop: 16 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phaseId" value={phaseId} />
        <input type="hidden" name="supplyId" value={supply.id} />
        <button type="submit" className="button button--danger">Delete Supply</button>
      </form>
    </div>
  );
}