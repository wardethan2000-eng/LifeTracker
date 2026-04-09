"use client";

import { useState, useTransition } from "react";
import type { JSX } from "react";
import type { InventoryItemSummary } from "@lifekeeper/types";
import { createProjectPhaseSupplyAction } from "../app/actions";
import { formatQuantity } from "../lib/formatters";
import { LinkPreviewDialog } from "./link-preview-dialog";

type Props = {
  householdId: string;
  projectId: string;
  phaseId: string;
  inventoryItems: InventoryItemSummary[];
  categorySuggestions?: string[];
};

type SupplyPrefill = {
  name: string;
  description: string;
  estimatedUnitCost: string;
  supplier: string;
  supplierUrl: string;
  imageUrl: string;
};

const emptyPrefill: SupplyPrefill = { name: "", description: "", estimatedUnitCost: "", supplier: "", supplierUrl: "", imageUrl: "" };

export function ProjectSupplyCreateForm({ householdId, projectId, phaseId, inventoryItems, categorySuggestions = [] }: Props): JSX.Element {
  const [prefill, setPrefill] = useState<SupplyPrefill>(emptyPrefill);
  const [prefillKey, setPrefillKey] = useState(0);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const categoryListId = `project-supply-category-${phaseId}`;

  return (
    <div className="panel__body--padded">
      {showLinkPreview && (
        <LinkPreviewDialog
          householdId={householdId}
          onConfirm={(data) => {
            const priceRaw = data.fields.price?.replace(/[^\d.]/g, "") ?? "";
            setPrefill({
              name: data.fields.name ?? "",
              description: data.fields.description ?? "",
              estimatedUnitCost: priceRaw,
              supplier: data.retailer ?? "",
              supplierUrl: data.sourceUrl ?? "",
              imageUrl: data.imageUrl ?? "",
            });
            setPrefillKey((k) => k + 1);
            setShowLinkPreview(false);
          }}
          onCancel={() => setShowLinkPreview(false)}
        />
      )}
      <form
        key={prefillKey}
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            try {
              await createProjectPhaseSupplyAction(formData);
              setPrefill(emptyPrefill);
              setPrefillKey((k) => k + 1);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to add supply. Please try again.");
            }
          });
        }}
      >
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phaseId" value={phaseId} />
        <div className="form-grid">
          <label className="field field--full">
            <span>Supply Name</span>
            <input name="name" placeholder="1/2 in. drywall sheets" required defaultValue={prefill.name ?? ""} />
          </label>
          <label className="field field--full">
            <span>Description</span>
            <textarea name="description" rows={2} placeholder="Sizing, brand preference, finish, or substitution notes" defaultValue={prefill.description ?? ""} />
          </label>
          <label className="field">
            <span>Category</span>
            <>
              <input name="category" list={categoryListId} placeholder="Materials, decor, logistics" />
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
            <span>Quantity Needed</span>
            <input name="quantityNeeded" type="number" min="0" step="0.01" defaultValue="1" required />
          </label>
          <label className="field">
            <span>Unit</span>
            <input name="unit" defaultValue="each" />
          </label>
          <label className="field">
            <span>Estimated Unit Cost</span>
            <input name="estimatedUnitCost" type="number" min="0" step="0.01" defaultValue={prefill.estimatedUnitCost ?? ""} />
          </label>
          <label className="field">
            <span>Supplier</span>
            <input name="supplier" defaultValue={prefill.supplier ?? ""} />
          </label>
          <label className="field">
            <span>Supplier URL</span>
            <input name="supplierUrl" type="url" defaultValue={prefill.supplierUrl ?? ""} />
          </label>
          <label className="field field--full">
            <span>Image URL</span>
            <input name="imageUrl" type="url" defaultValue={prefill.imageUrl ?? ""} placeholder="https://example.com/product-image.jpg" />
          </label>
          <label className="field">
            <span>Linked Inventory Item</span>
            <select name="inventoryItemId" defaultValue="">
              <option value="">None</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {formatQuantity(item.quantityOnHand, item.unit)} on hand</option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button type="button" className="button" onClick={() => setShowLinkPreview(true)} disabled={isPending}>
            Add from Link
          </button>
          <button type="submit" className="button button--primary" disabled={isPending}>
            {isPending ? "Adding…" : "Add Supply"}
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </form>
    </div>
  );
}
