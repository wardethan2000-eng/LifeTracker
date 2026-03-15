"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import {
  allocateSupplyFromInventoryAction,
  deleteProjectPhaseSupplyAction,
  updateProjectPhaseSupplyAction
} from "../app/actions";
import { ExpandModal } from "./expand-modal";

type ProjectSupplyRollupActionsProps = {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  inventoryItems: InventoryItemSummary[];
  openPhaseHref: string;
};

export function ProjectSupplyRollupActions({
  householdId,
  projectId,
  phaseId,
  supply,
  inventoryItems,
  openPhaseHref
}: ProjectSupplyRollupActionsProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const linkedInventoryItem = supply.inventoryItemId
    ? inventoryItems.find((item) => item.id === supply.inventoryItemId)
    : undefined;
  const quantityRemaining = Math.max(supply.quantityNeeded - supply.quantityOnHand, 0);
  const allocatableQuantity = Math.min(quantityRemaining, linkedInventoryItem?.quantityOnHand ?? 0);

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link href={openPhaseHref} className="button button--ghost button--sm">
          Open Phase
        </Link>
        <button type="button" className="button button--ghost button--sm" onClick={() => setIsEditing(true)}>
          Edit
        </button>
        <form action={updateProjectPhaseSupplyAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phaseId} />
          <input type="hidden" name="supplyId" value={supply.id} />
          <input type="hidden" name="name" value={supply.name} />
          <input type="hidden" name="isProcured" value={supply.isProcured ? "false" : "true"} />
          <button type="submit" className="button button--ghost button--sm">
            {supply.isProcured ? "Undo Procured" : "Mark Procured"}
          </button>
        </form>
        <form action={updateProjectPhaseSupplyAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phaseId} />
          <input type="hidden" name="supplyId" value={supply.id} />
          <input type="hidden" name="name" value={supply.name} />
          <input type="hidden" name="isStaged" value={supply.isStaged ? "false" : "true"} />
          <button type="submit" className="button button--ghost button--sm">
            {supply.isStaged ? "Unstage" : "Stage"}
          </button>
        </form>
        {allocatableQuantity > 0 ? (
          <form action={allocateSupplyFromInventoryAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <input type="hidden" name="supplyId" value={supply.id} />
            <input type="hidden" name="quantity" value={String(allocatableQuantity)} />
            <button type="submit" className="button button--ghost button--sm" title={`Allocate ${allocatableQuantity} ${supply.unit} from inventory`}>
              Use Stock
            </button>
          </form>
        ) : null}
        <form action={deleteProjectPhaseSupplyAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="phaseId" value={phaseId} />
          <input type="hidden" name="supplyId" value={supply.id} />
          <button type="submit" className="button button--danger button--sm">Delete</button>
        </form>
      </div>

      {isEditing ? (
        <ExpandModal title={`Edit Supply: ${supply.name}`} onClose={() => setIsEditing(false)}>
          <form action={updateProjectPhaseSupplyAction} className="workbench-form">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <input type="hidden" name="supplyId" value={supply.id} />
            <div className="workbench-grid">
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
                <select name="inventoryItemId" defaultValue={supply.inventoryItemId ?? ""}>
                  <option value="">None</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.quantityOnHand} {item.unit} on hand</option>
                  ))}
                </select>
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} defaultValue={supply.notes ?? ""} />
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
              <button type="submit" className="button">Save Supply</button>
              <button type="button" className="button button--ghost" onClick={() => setIsEditing(false)}>
                Close
              </button>
            </div>
          </form>
        </ExpandModal>
      ) : null}
    </>
  );
}