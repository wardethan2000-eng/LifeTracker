"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { InventoryItemSummary, ProjectPhaseSupply } from "@lifekeeper/types";
import {
  allocateSupplyFromInventoryAction,
  deleteProjectPhaseSupplyAction,
  updateProjectPhaseSupplyCategoryAction,
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
  categories?: string[];
  onCategoryChange?: (supplyId: string, category: string | null) => void;
  onCategoryCreated?: (name: string) => void;
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
  openPhaseHref,
  categories = [],
  onCategoryChange,
  onCategoryCreated,
}: ProjectSupplyCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const quantityRemaining = getQuantityRemaining(supply);
  const allocatableQuantity = linkedInventoryItem
    ? Math.max(0, Math.min(quantityRemaining, linkedInventoryItem.quantityOnHand))
    : 0;
  const estimatedRemainingCost = supply.estimatedUnitCost != null
    ? supply.estimatedUnitCost * quantityRemaining
    : null;

  useEffect(() => {
    if (!showCategoryMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
        setIsCreatingCategory(false);
        setNewCatName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCategoryMenu]);

  const handleCategorySelect = (category: string | null) => {
    const current = supply.category?.trim() || null;
    if (current === category) {
      setShowCategoryMenu(false);
      return;
    }
    onCategoryChange?.(supply.id, category);
    setShowCategoryMenu(false);
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

  const handleCreateAndAssign = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    onCategoryCreated?.(trimmed);
    handleCategorySelect(trimmed);
    setNewCatName("");
    setIsCreatingCategory(false);
  };

  const stateLabel = getSupplyStateLabel(supply);
  const pillClass = supply.isProcured ? "pill--success" : stateLabel === "Stocked" ? "pill--muted" : "pill--warning";

  if (isEditing) {
    return (
      <div className="supply-item supply-item--editing">
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
        {supply.inventoryItemId ? (
          <div className="supply-item__inventory-note">
            <span>Linked to inventory · </span>
            <form action={updateProjectPhaseSupplyAction} style={{ display: "inline" }}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phaseId} />
              <input type="hidden" name="supplyId" value={supply.id} />
              <input type="hidden" name="name" value={supply.name} />
              <input type="hidden" name="inventoryItemId" value="" />
              <button type="submit" className="button--link">Unlink</button>
            </form>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`supply-item${supply.isProcured ? " supply-item--purchased" : ""}`}>
      <div className="supply-item__row">
        <span className="supply-item__name">{supply.name}</span>
        <span className={`pill pill--sm ${pillClass}`}>{stateLabel}</span>
        <div className="supply-item__details">
          {phaseName ? (
            openPhaseHref
              ? <Link href={openPhaseHref} className="text-link supply-item__phase">{phaseName}</Link>
              : <span className="supply-item__phase">{phaseName}</span>
          ) : null}
          <span className="supply-item__qty">
            {formatQuantity(quantityRemaining, supply.unit)} remaining
            {supply.quantityNeeded > 0 ? ` of ${formatQuantity(supply.quantityNeeded, supply.unit)}` : ""}
          </span>
          {estimatedRemainingCost != null && estimatedRemainingCost > 0 ? (
            <span className="supply-item__cost">{formatCurrency(estimatedRemainingCost, "-")}</span>
          ) : null}
          {supply.supplier ? <span className="supply-item__supplier">{supply.supplier}</span> : null}
          {linkedInventoryItem ? (
            <span className="supply-item__inv-tag">{linkedInventoryItem.name} ({formatQuantity(linkedInventoryItem.quantityOnHand, linkedInventoryItem.unit)})</span>
          ) : null}
        </div>
        <div className="supply-item__actions">
          <div className="supply-category-dropdown" ref={menuRef}>
            <button
              type="button"
              className="button button--ghost button--xs"
              onClick={() => setShowCategoryMenu((v) => !v)}
            >
              {supply.category ?? "Category"}
            </button>
            {showCategoryMenu ? (
              <div className="supply-category-dropdown__menu">
                <button
                  type="button"
                  className={`supply-category-dropdown__item${!supply.category ? " supply-category-dropdown__item--active" : ""}`}
                  onClick={() => handleCategorySelect(null)}
                >
                  Uncategorized
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`supply-category-dropdown__item${supply.category === cat ? " supply-category-dropdown__item--active" : ""}`}
                    onClick={() => handleCategorySelect(cat)}
                  >
                    {cat}
                  </button>
                ))}
                <div className="supply-category-dropdown__divider" />
                {isCreatingCategory ? (
                  <div className="supply-category-dropdown__create">
                    <input
                      autoFocus
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleCreateAndAssign(); }
                        if (e.key === "Escape") { setIsCreatingCategory(false); setNewCatName(""); }
                      }}
                      placeholder="Category name"
                    />
                    <button type="button" className="button button--ghost button--sm" onClick={handleCreateAndAssign}>Add</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="supply-category-dropdown__item supply-category-dropdown__item--create"
                    onClick={() => setIsCreatingCategory(true)}
                  >
                    + Create Category
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <form action={updateProjectPhaseSupplyAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <input type="hidden" name="supplyId" value={supply.id} />
            <input type="hidden" name="name" value={supply.name} />
            <input type="hidden" name="isProcured" value={supply.isProcured ? "false" : "true"} />
            <button type="submit" className="button button--ghost button--xs">
              {supply.isProcured ? "Unpurchase" : "Purchased"}
            </button>
          </form>
          {allocatableQuantity > 0 ? (
            <form action={allocateSupplyFromInventoryAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phaseId} />
              <input type="hidden" name="supplyId" value={supply.id} />
              <input type="hidden" name="quantity" value={String(allocatableQuantity)} />
              <button type="submit" className="button button--ghost button--xs" title={`Use ${formatQuantityValue(allocatableQuantity)} ${supply.unit} from inventory`}>Use Stock</button>
            </form>
          ) : null}
          <button type="button" className="button button--ghost button--xs" onClick={() => setIsEditing(true)}>Edit</button>
          {isDeleting ? (
            <>
              <form action={deleteProjectPhaseSupplyAction}>
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="phaseId" value={phaseId} />
                <input type="hidden" name="supplyId" value={supply.id} />
                <button type="submit" className="button button--danger button--xs">Confirm</button>
              </form>
              <button type="button" className="button button--ghost button--xs" onClick={() => setIsDeleting(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="button button--danger button--xs" onClick={() => setIsDeleting(true)}>Delete</button>
          )}
        </div>
      </div>
      {supply.description ? <p className="supply-item__desc">{supply.description}</p> : null}
      {supply.notes ? <p className="supply-item__notes">{supply.notes}</p> : null}
    </div>
  );
}
