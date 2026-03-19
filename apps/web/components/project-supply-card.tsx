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
import { ConfirmActionForm } from "./confirm-action-form";

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

  return (
    <div className="project-supply-card">
      <div className="project-supply-card__header">
        <div className="project-supply-card__identity">
          <div className="project-supply-card__title-row">
            <h4>{supply.name}</h4>
            <span className={`pill ${supply.isProcured ? "pill--success" : "pill--warning"}`}>{getSupplyStateLabel(supply)}</span>
          </div>
          <div className="project-supply-card__meta">
            {phaseName ? (openPhaseHref ? <Link href={openPhaseHref} className="text-link">{phaseName}</Link> : <span>{phaseName}</span>) : null}
            {linkedInventoryItem
              ? <span className="project-supply-card__inventory-link">ðŸ“¦ {linkedInventoryItem.name} Â· {formatQuantity(linkedInventoryItem.quantityOnHand, linkedInventoryItem.unit)} available</span>
              : null}
            {supply.supplier ? <span>{supply.supplier}</span> : null}
          </div>
        </div>
        <div className="project-supply-card__actions">
          <div className="supply-category-dropdown" ref={menuRef}>
            <button
              type="button"
              className="button button--ghost button--sm"
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
          {allocatableQuantity > 0 ? (
            <form action={allocateSupplyFromInventoryAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phaseId" value={phaseId} />
              <input type="hidden" name="supplyId" value={supply.id} />
              <input type="hidden" name="quantity" value={String(allocatableQuantity)} />
              <button type="submit" className="button button--ghost button--sm" title={`Use ${formatQuantityValue(allocatableQuantity)} ${supply.unit} from inventory`}>Use Stock</button>
            </form>
          ) : null}
          <form action={updateProjectPhaseSupplyAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phaseId" value={phaseId} />
            <input type="hidden" name="supplyId" value={supply.id} />
            <input type="hidden" name="name" value={supply.name} />
            <input type="hidden" name="isProcured" value={supply.isProcured ? "false" : "true"} />
            <button type="submit" className="button button--ghost button--sm">
              {supply.isProcured ? "Mark Unpurchased" : "Mark Purchased"}
            </button>
          </form>
          <button type="button" className="button button--ghost button--sm" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? "Close" : "Edit"}
          </button>
          <ConfirmActionForm
            action={deleteProjectPhaseSupplyAction}
            hiddenFields={[
              { name: "householdId", value: householdId },
              { name: "projectId", value: projectId },
              { name: "phaseId", value: phaseId },
              { name: "supplyId", value: supply.id }
            ]}
            prompt="Delete this supply?"
            triggerLabel="Delete"
            confirmLabel="Yes, delete"
            className="inline-actions"
            triggerClassName="button button--danger button--sm"
            confirmClassName="button button--danger button--sm"
            cancelClassName="button button--ghost button--sm"
          />
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
                    <option key={item.id} value={item.id}>{item.name} Â· {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
                  ))}
                </select>
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
              <button type="submit" className="button">Save</button>
              <button type="button" className="button button--ghost" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </form>

          {supply.inventoryItemId ? (
            <div className="project-supply-card__inventory-note">
              <span>Linked to inventory Â· </span>
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
      ) : null}

    </div>
  );
}
