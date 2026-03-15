"use client";

import type { JSX, ReactNode } from "react";
import { useMemo, useState } from "react";
import { createInventoryItemAction } from "../app/actions";
import { LinkPreviewDialog } from "./link-preview-dialog";

type InventoryPrefill = {
  name?: string;
  partNumber?: string;
  manufacturer?: string;
  unitCost?: string;
  preferredSupplier?: string;
  supplierUrl?: string;
};

type InventorySectionProps = {
  householdId: string;
  totalCount: number;
  categoryOptions: string[];
  children: ReactNode;
};

const commonCategoryOptions = [
  "Filters",
  "Fluids & Lubricants",
  "Fasteners",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Paint & Finishes",
  "Cleaning Supplies",
  "Lawn & Garden",
  "Tools & Consumables",
  "Safety Gear",
  "General Hardware"
] as const;

const customCategoryValue = "__custom__";

export function InventorySection({ householdId, totalCount, categoryOptions, children }: InventorySectionProps): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [prefill, setPrefill] = useState<InventoryPrefill>({});
  const [prefillKey, setPrefillKey] = useState(0);
  const [showLinkPreview, setShowLinkPreview] = useState(false);

  const mergedCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const values: string[] = [];

    for (const option of [...commonCategoryOptions, ...categoryOptions]) {
      const normalized = option.trim();

      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      values.push(normalized);
    }

    return values;
  }, [categoryOptions]);

  const resolvedCategory = selectedCategory === customCategoryValue ? customCategory.trim() : selectedCategory;
  const showCustomCategoryField = selectedCategory === customCategoryValue;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Universal Inventory ({totalCount})</h2>
          <div className="data-table__secondary">Household-wide stock, organized by category across assets, projects, and shared supplies</div>
        </div>
        <div className="panel__header-actions">
          <button
            type="button"
            className="button button--sm"
            onClick={() => setShowLinkPreview(true)}
          >
            Add from Link
          </button>
          <button
            type="button"
            className={`button button--primary button--sm${showForm ? " button--active" : ""}`}
            onClick={() => setShowForm((current) => !current)}
          >
            {showForm ? "Close Menu" : "Add to Inventory"}
          </button>
        </div>
      </div>

      {showLinkPreview && (
        <LinkPreviewDialog
          householdId={householdId}
          onConfirm={(data) => {
            const priceRaw = data.fields.price?.replace(/[^\d.]/g, "") ?? "";
            setPrefill({
              name: data.fields.name ?? "",
              partNumber: data.fields.partNumber ?? data.fields.sku ?? "",
              manufacturer: data.fields.brand ?? "",
              unitCost: priceRaw || undefined,
              preferredSupplier: data.retailer ?? "",
              supplierUrl: data.sourceUrl ?? "",
            });
            setPrefillKey((k) => k + 1);
            setShowLinkPreview(false);
            setShowForm(true);
          }}
          onCancel={() => setShowLinkPreview(false)}
        />
      )}

      {showForm && (
        <div className="panel__body--padded inventory-create-panel">
          <form action={createInventoryItemAction} key={prefillKey}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="category" value={resolvedCategory} />
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input type="text" name="name" placeholder="Oil filter" required defaultValue={prefill.name ?? ""} />
              </label>
              <label className="field">
                <span>Part Number</span>
                <input type="text" name="partNumber" placeholder="FL-500S" defaultValue={prefill.partNumber ?? ""} />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {mergedCategoryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={customCategoryValue}>Create custom category</option>
                </select>
              </label>
              <label className="field">
                <span>Manufacturer</span>
                <input type="text" name="manufacturer" placeholder="Motorcraft" defaultValue={prefill.manufacturer ?? ""} />
              </label>
              {showCustomCategoryField && (
                <label className="field field--full">
                  <span>Custom Category</span>
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(event) => setCustomCategory(event.target.value)}
                    placeholder="Seasonal Decor"
                    required={showCustomCategoryField}
                  />
                </label>
              )}
              <label className="field">
                <span>Starting Stock</span>
                <input type="number" name="quantityOnHand" min="0" step="0.01" placeholder="2" />
              </label>
              <label className="field">
                <span>Unit</span>
                <input type="text" name="unit" placeholder="each, quarts, feet" defaultValue="each" />
              </label>
              <label className="field">
                <span>Reorder When At</span>
                <input type="number" name="reorderThreshold" min="0" step="0.01" placeholder="1" />
              </label>
              <label className="field">
                <span>Usually Buy</span>
                <input type="number" name="reorderQuantity" min="0" step="0.01" placeholder="2" />
              </label>
              <label className="field">
                <span>Last Price</span>
                <input type="number" name="unitCost" min="0" step="0.01" placeholder="8.97" defaultValue={prefill.unitCost ?? ""} />
              </label>
              <label className="field">
                <span>Supplier</span>
                <input type="text" name="preferredSupplier" placeholder="AutoZone" defaultValue={prefill.preferredSupplier ?? ""} />
              </label>
              <label className="field field--full">
                <span>Supplier Link</span>
                <input type="url" name="supplierUrl" placeholder="https://..." defaultValue={prefill.supplierUrl ?? ""} />
              </label>
              <label className="field field--full">
                <span>Storage Location</span>
                <input type="text" name="storageLocation" placeholder="Garage shelf 2" />
              </label>
              <label className="field field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Compatible with both trucks, keep one spare on hand" />
              </label>
            </div>
            <div className="inline-actions inline-actions--end" style={{ marginTop: 20 }}>
              <button type="button" className="button button--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="button button--primary">Add to Inventory</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel__body">{children}</div>
    </section>
  );
}