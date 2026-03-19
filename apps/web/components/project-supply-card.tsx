"use client";

import Link from "next/link";
import type { DragEventHandler, JSX } from "react";
import { useState } from "react";
import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import {
  allocateSupplyFromInventoryAction,
  createProjectPurchaseRequestsAction,
  deleteProjectPhaseSupplyAction,
  updateProjectPhaseSupplyAction
} from "../app/actions";
import { formatCurrency, formatQuantity, formatQuantityValue } from "../lib/formatters";

type ProjectSupplyCardProps = {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  inventoryItems?: InventoryItemSummary[];
  linkedInventoryItem?: InventoryItemSummary;
  phaseName?: string;
  openPhaseHref?: string;
  categorySuggestions?: string[];
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
};

const getQuantityRemaining = (supply: ProjectPhaseSupply): number => Math.max(0, Number((supply.quantityNeeded - supply.quantityOnHand).toFixed(2)));

const getSupplyStateLabel = (supply: ProjectPhaseSupply): string => {
  const quantityRemaining = getQuantityRemaining(supply);

  if (supply.isProcured) {
    return "Purchased";
  }

  if (quantityRemaining === 0) {
    return "Stocked";
  }

  if (supply.quantityOnHand > 0) {
    return "Partial";
  }

  return "Needs Purchase";
};

function SupplyToggleForm({
  householdId,
  projectId,
  phaseId,
  supply,
  fieldName,
  nextValue,
  label,
}: {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  fieldName: "isProcured" | "isStaged";
  nextValue: boolean;
  label: string;
}): JSX.Element {
  return (
    <form action={updateProjectPhaseSupplyAction}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="phaseId" value={phaseId} />
      <input type="hidden" name="supplyId" value={supply.id} />
      <input type="hidden" name="name" value={supply.name} />
      <input type="hidden" name={fieldName} value={nextValue ? "true" : "false"} />
      <button type="submit" className="button button--ghost button--sm">{label}</button>
    </form>
  );
}

export function ProjectSupplyCard({
  householdId,
  projectId,
  phaseId,
  supply,
  inventoryItems = [],
  linkedInventoryItem,
  phaseName,
  openPhaseHref,
  categorySuggestions = [],
  draggable = false,
  onDragStart,
  onDragEnd,
}: ProjectSupplyCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const quantityRemaining = getQuantityRemaining(supply);
  const allocatableQuantity = linkedInventoryItem
    ? Math.max(0, Math.min(quantityRemaining, linkedInventoryItem.quantityOnHand))
    : 0;
  const estimatedRemainingCost = supply.estimatedUnitCost != null
    ? supply.estimatedUnitCost * quantityRemaining
    : null;
  const categoryListId = `project-supply-card-category-${supply.id}`;
  const categoryLabel = supply.category?.trim() || "Uncategorized";

  return (
    <div
      className="project-supply-card"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="project-supply-card__header">
        <div className="project-supply-card__identity">
          <div className="project-supply-card__title-row">
            <h4>{supply.name}</h4>
            <span className="pill pill--muted">{categoryLabel}</span>
            <span className={`pill ${supply.isProcured ? "pill--success" : "pill--warning"}`}>{getSupplyStateLabel(supply)}</span>
            <span className={`pill ${supply.isStaged ? "pill--info" : "pill--muted"}`}>{supply.isStaged ? "Staged" : "Not staged"}</span>
            {supply.activePurchaseRequest ? <span className="pill pill--info">Request {supply.activePurchaseRequest.purchaseStatus}</span> : null}
          </div>
          <div className="project-supply-card__meta">
            {phaseName ? (openPhaseHref ? <Link href={openPhaseHref} className="text-link">{phaseName}</Link> : <span>{phaseName}</span>) : null}
            {linkedInventoryItem ? <span>Linked inventory: {linkedInventoryItem.name}</span> : null}
            {supply.supplier ? <span>Supplier: {supply.supplier}</span> : null}
          </div>
        </div>
        <div className="project-supply-card__actions">
          {openPhaseHref ? <Link href={openPhaseHref} className="button button--ghost button--sm">Open Phase</Link> : null}
          {allocatableQuantity > 0 ? (
            <form action={allocateSupplyFromInventoryAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phaseId} />
              <input type="hidden" name="supplyId" value={supply.id} />
              <input type="hidden" name="quantity" value={String(allocatableQuantity)} />
              <button type="submit" className="button button--ghost button--sm">Use Stock</button>
            </form>
          ) : null}
          {!supply.activePurchaseRequest && quantityRemaining > 0 ? (
            <form action={createProjectPurchaseRequestsAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="supplyIdsJson" value={JSON.stringify([supply.id])} />
              <button type="submit" className="button button--ghost button--sm">Request Purchase</button>
            </form>
          ) : null}
          <SupplyToggleForm
            householdId={householdId}
            projectId={projectId}
            phaseId={phaseId}
            supply={supply}
            fieldName="isProcured"
            nextValue={!supply.isProcured}
            label={supply.isProcured ? "Mark Unpurchased" : "Mark Purchased"}
          />
          <SupplyToggleForm
            householdId={householdId}
            projectId={projectId}
            phaseId={phaseId}
            supply={supply}
            fieldName="isStaged"
            nextValue={!supply.isStaged}
            label={supply.isStaged ? "Mark Unstaged" : "Mark Staged"}
          />
          <button type="button" className="button button--secondary button--sm" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? "Close Editor" : "Edit"}
          </button>
        </div>
      </div>

      <div className="project-supply-card__metrics">
        <div>
          <span>Needed</span>
          <strong>{formatQuantity(supply.quantityNeeded, supply.unit)}</strong>
        </div>
        <div>
          <span>On hand</span>
          <strong>{formatQuantity(supply.quantityOnHand, supply.unit)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{formatQuantity(quantityRemaining, supply.unit)}</strong>
        </div>
        <div>
          <span>Estimated remaining</span>
          <strong>{formatCurrency(estimatedRemainingCost, "-")}</strong>
        </div>
      </div>

      {supply.description ? <p className="project-supply-card__description">{supply.description}</p> : null}
      {supply.notes ? <p className="project-supply-card__notes">{supply.notes}</p> : null}

      {isEditing ? (
        <div className="project-supply-card__editor">
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
              <label className="field">
                <span>Category</span>
                <>
                  <input name="category" list={categoryListId} defaultValue={supply.category ?? ""} placeholder="Materials, decor, logistics" />
                  {categorySuggestions.length > 0 ? (
                    <datalist id={categoryListId}>
                      {categorySuggestions.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              </label>
              <label className="field">
                <span>Unit</span>
                <input name="unit" defaultValue={supply.unit} />
              </label>
              <label className="field">
                <span>Quantity Needed</span>
                <input name="quantityNeeded" type="number" min="0" step="0.01" defaultValue={String(supply.quantityNeeded)} required />
              </label>
              <label className="field">
                <span>Quantity On Hand</span>
                <input name="quantityOnHand" type="number" min="0" step="0.01" defaultValue={String(supply.quantityOnHand)} />
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
                    <option key={item.id} value={item.id}>{item.name} · {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Purchased</span>
                <select name="isProcured" defaultValue={supply.isProcured ? "true" : "false"}>
                  <option value="false">Not purchased</option>
                  <option value="true">Purchased</option>
                </select>
              </label>
              <label className="field">
                <span>Staged</span>
                <select name="isStaged" defaultValue={supply.isStaged ? "true" : "false"}>
                  <option value="false">Not staged</option>
                  <option value="true">Staged</option>
                </select>
              </label>
              <label className="field">
                <span>Sort Order</span>
                <input name="sortOrder" type="number" step="1" defaultValue={supply.sortOrder ?? ""} />
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={2} defaultValue={supply.description ?? ""} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} defaultValue={supply.notes ?? ""} placeholder={`Need ${formatQuantityValue(quantityRemaining)} ${supply.unit} more`} />
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="button">Save Supply</button>
              <button type="button" className="button button--ghost" onClick={() => setIsEditing(false)}>Close</button>
            </div>
          </form>

          <form action={deleteProjectPhaseSupplyAction} className="inline-actions inline-actions--end" style={{ marginTop: 12 }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <input type="hidden" name="supplyId" value={supply.id} />
            <button type="submit" className="button button--danger">Delete Supply</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
