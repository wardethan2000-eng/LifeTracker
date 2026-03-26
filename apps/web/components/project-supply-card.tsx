"use client";

import type { JSX } from "react";
import { useState, useTransition } from "react";
import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import {
  deleteProjectPhaseSupplyAction,
  toggleProjectPhaseSupplyPurchasedAction,
  updateProjectPhaseSupplyCategoryAction,
  updateProjectPhaseSupplyAction
} from "../app/actions";
import { formatCurrency, formatQuantity } from "../lib/formatters";
import { type DragHandleProps } from "./ui/sortable-list";

type ProjectSupplyCardProps = {
  householdId: string;
  projectId: string;
  phaseId: string;
  supply: ProjectPhaseSupply;
  inventoryItems?: InventoryItemSummary[];
  linkedInventoryItem?: InventoryItemSummary;
  phaseName?: string;
  openPhaseHref?: string;
  categories?: string[];
  onCategoryChange?: (supplyId: string, category: string | null) => void;
  onCategoryCreated?: (name: string) => void;
  dragHandleProps?: DragHandleProps;
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

export function ProjectSupplyCard({
  householdId,
  projectId,
  phaseId,
  supply,
  inventoryItems = [],
  linkedInventoryItem,
  phaseName,
  categories = [],
  onCategoryChange,
  dragHandleProps,
}: ProjectSupplyCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const quantityRemaining = getQuantityRemaining(supply);
  const estimatedRemainingCost = supply.estimatedUnitCost != null
    ? supply.estimatedUnitCost * quantityRemaining
    : null;

  const stateLabel = getSupplyStateLabel(supply);
  const pillClass = supply.isProcured ? "pill--success" : stateLabel === "Stocked" ? "pill--muted" : "pill--warning";

  const handleDelete = () => {
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", phaseId);
        fd.set("supplyId", supply.id);
        await deleteProjectPhaseSupplyAction(fd);
      })();
    });
  };

  const handleTogglePurchased = () => {
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", phaseId);
        fd.set("supplyId", supply.id);
        fd.set("isProcured", supply.isProcured ? "false" : "true");
        await toggleProjectPhaseSupplyPurchasedAction(fd);
      })();
    });
  };

  const handleCategoryChange = (newCategory: string) => {
    const category = newCategory === "" ? null : newCategory;
    onCategoryChange?.(supply.id, category);
    startTransition(() => {
      void (async () => {
        const fd = new FormData();
        fd.set("householdId", householdId);
        fd.set("projectId", projectId);
        fd.set("phaseId", phaseId);
        fd.set("supplyId", supply.id);
        fd.set("category", category ?? "");
        await updateProjectPhaseSupplyCategoryAction(fd);
      })();
    });
  };

  return (
    <div className={`supply-row${isEditing ? " supply-row--expanded" : ""}${supply.isProcured ? " supply-row--purchased" : ""}${isPending ? " supply-row--pending" : ""}`}>
      <div className="supply-row__summary">
        {dragHandleProps ? (
          <span
            ref={(el: HTMLSpanElement | null) => dragHandleProps.ref(el)}
            role={dragHandleProps.role}
            tabIndex={dragHandleProps.tabIndex}
            aria-roledescription={dragHandleProps["aria-roledescription"]}
            aria-describedby={dragHandleProps["aria-describedby"]}
            aria-pressed={dragHandleProps["aria-pressed"]}
            aria-disabled={dragHandleProps["aria-disabled"]}
            onKeyDown={dragHandleProps.onKeyDown}
            onPointerDown={dragHandleProps.onPointerDown}
            className="drag-handle"
          />
        ) : null}
        <button
          type="button"
          className="button button--ghost button--xs supply-row__toggle"
          onClick={handleTogglePurchased}
          title={supply.isProcured ? "Mark unpurchased" : "Mark purchased"}
        >
          {supply.isProcured ? "\u2713" : "\u25CB"}
        </button>
        <span className="supply-row__name">{supply.name}</span>
        <span className={`pill pill--sm ${pillClass}`}>{stateLabel}</span>
        {phaseName ? <span className="supply-row__phase">{phaseName}</span> : null}
        <span className="supply-row__qty">{formatQuantity(quantityRemaining, supply.unit)} remaining</span>
        {estimatedRemainingCost != null && estimatedRemainingCost > 0 ? (
          <span className="supply-row__cost">{formatCurrency(estimatedRemainingCost, "-")}</span>
        ) : null}
        {supply.supplier ? <span className="supply-row__supplier">{supply.supplier}</span> : null}
        {linkedInventoryItem?.storageLocation ? (
          <span className="supply-row__supplier" title="Storage location">📍 {linkedInventoryItem.storageLocation}</span>
        ) : null}
        <div className="supply-row__actions">
          <select
            className="supply-row__category-select"
            value={supply.category ?? ""}
            onChange={(e) => handleCategoryChange(e.currentTarget.value)}
            title="Category"
          >
            <option value="">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="button"
            className="button button--ghost button--xs"
            onClick={() => setIsEditing((v) => !v)}
            title="Edit"
          >
            Edit
          </button>
          {isDeleting ? (
            <span className="supply-row__delete-confirm">
              <button type="button" className="button button--danger button--xs" onClick={handleDelete} disabled={isPending}>
                {isPending ? "..." : "Confirm"}
              </button>
              <button type="button" className="button button--ghost button--xs" onClick={() => setIsDeleting(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="button button--danger button--xs" onClick={() => setIsDeleting(true)}>Delete</button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="supply-row__editor">
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
                  <input name="category" list={`supply-cat-${supply.id}`} defaultValue={supply.category ?? ""} placeholder="Materials, hardware, finishes" />
                  {categories.length > 0 ? (
                    <datalist id={`supply-cat-${supply.id}`}>
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
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
                <span>Qty Needed</span>
                <input name="quantityNeeded" type="number" min="0" step="0.01" defaultValue={String(supply.quantityNeeded)} required />
              </label>
              <label className="field">
                <span>Qty On Hand</span>
                <input name="quantityOnHand" type="number" min="0" step="0.01" defaultValue={String(supply.quantityOnHand)} />
              </label>
              <label className="field">
                <span>Est. Unit Cost</span>
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
                <span>Linked Inventory</span>
                <select name="inventoryItemId" defaultValue={supply.inventoryItemId ?? ""}>
                  <option value="">None</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                  ))}
                </select>
              </label>
              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={2} defaultValue={supply.description ?? ""} />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={2} defaultValue={supply.notes ?? ""} />
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button type="submit" className="button button--sm">Save</button>
              <button type="button" className="button button--ghost button--sm" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
