"use client";

import type { BarcodeLookupResult } from "@lifekeeper/types";
import type { JSX, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { createInventoryItemAction } from "../app/actions";
import { BarcodeLookupField } from "./barcode-lookup-field";
import { LinkPreviewDialog } from "./link-preview-dialog";
import { normalizeExternalUrl } from "../lib/url";

type InventoryPrefill = {
  name?: string | undefined;
  partNumber?: string | undefined;
  manufacturer?: string | undefined;
  unitCost?: string | undefined;
  preferredSupplier?: string | undefined;
  supplierUrl?: string | undefined;
};

type InventorySectionProps = {
  householdId: string;
  totalCount: number;
  categoryOptions: string[];
  actions?: ReactNode;
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

export function InventorySection({ householdId, totalCount, categoryOptions, actions, children }: InventorySectionProps): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [prefill, setPrefill] = useState<InventoryPrefill>({});
  const [prefillKey, setPrefillKey] = useState(0);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [supplierUrlInput, setSupplierUrlInput] = useState("");
  const [itemType, setItemType] = useState<"consumable" | "equipment">("consumable");

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

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    if (result.found) {
      setPrefill((prev) => ({
        ...prev,
        name: result.productName ?? prev.name ?? "",
        manufacturer: result.brand ?? prev.manufacturer ?? "",
        partNumber: result.barcode
      }));

      if (result.category) {
        const match = mergedCategoryOptions.find(
          (opt) => opt.toLowerCase() === result.category!.toLowerCase()
        );

        if (match) {
          setSelectedCategory(match);
        } else {
          setSelectedCategory(customCategoryValue);
          setCustomCategory(result.category);
        }
      }
    } else {
      setPrefill((prev) => ({ ...prev, partNumber: result.barcode }));
    }

    setPrefillKey((k) => k + 1);
    setShowForm(true);
  }, [mergedCategoryOptions]);

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
          {actions}
          <button
            type="button"
            className={`button button--primary button--sm${showForm ? " button--active" : ""}`}
            onClick={() => setShowForm((current) => !current)}
          >
            {showForm ? "Cancel" : "Add to Inventory"}
          </button>
        </div>
      </div>

      {showLinkPreview && (
        <LinkPreviewDialog
          householdId={householdId}
          initialUrl={supplierUrlInput}
          autoFetchOnOpen={Boolean(normalizeExternalUrl(supplierUrlInput))}
          onConfirm={(data) => {
            const priceRaw = data.fields.price?.replace(/[^\d.]/g, "") ?? "";
            const nextSupplierUrl = data.sourceUrl ?? "";
            setPrefill({
              name: data.fields.name ?? "",
              partNumber: data.fields.partNumber ?? data.fields.sku ?? "",
              manufacturer: data.fields.brand ?? "",
              unitCost: priceRaw || undefined,
              preferredSupplier: data.retailer ?? "",
              supplierUrl: nextSupplierUrl,
            });
            setSupplierUrlInput(nextSupplierUrl);
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
            <input type="hidden" name="itemType" value={itemType} />
            <div className="inventory-type-toggle" style={{ marginBottom: 16 }}>
              <span className="inventory-type-toggle__label">Item Type</span>
              <div className="inventory-type-toggle__options">
                <button type="button" className={`inventory-type-toggle__btn${itemType === "consumable" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setItemType("consumable")}>Consumable <span className="inventory-type-toggle__hint">supplies, ingredients, parts</span></button>
                <button type="button" className={`inventory-type-toggle__btn${itemType === "equipment" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setItemType("equipment")}>Equipment <span className="inventory-type-toggle__hint">tools, instruments, gear</span></button>
              </div>
            </div>
            <div className="barcode-lookup-row" style={{ marginBottom: 16 }}>
              <label className="field field--full">
                <span>Quick Add by Barcode</span>
                <BarcodeLookupField onResult={handleBarcodeResult} />
              </label>
            </div>
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
              {itemType === "equipment" && (
                <label className="field">
                  <span>Condition</span>
                  <select name="conditionStatus" defaultValue="">
                    <option value="">No condition set</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="needs_replacement">Needs Replacement</option>
                  </select>
                </label>
              )}
              {itemType === "consumable" && (
                <>
                  <label className="field">
                    <span>Reorder When At</span>
                    <input type="number" name="reorderThreshold" min="0" step="0.01" placeholder="1" />
                  </label>
                  <label className="field">
                    <span>Usually Buy</span>
                    <input type="number" name="reorderQuantity" min="0" step="0.01" placeholder="2" />
                  </label>
                </>
              )}
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
                <div className="field-action-row">
                  <input
                    type="text"
                    name="supplierUrl"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="amazon.com/... or https://..."
                    value={supplierUrlInput}
                    onChange={(event) => setSupplierUrlInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="button button--sm"
                    onClick={() => setShowLinkPreview(true)}
                    disabled={!supplierUrlInput.trim()}
                  >
                    Add from Link
                  </button>
                </div>
                <small>Paste a product URL here, then import the product details.</small>
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