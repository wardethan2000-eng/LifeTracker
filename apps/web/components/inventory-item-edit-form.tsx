"use client";

import type { BarcodeLookupResult, InventoryItemSummary, UpdateInventoryItemInput } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { updateInventoryItem } from "../lib/api";
import { normalizeExternalUrl } from "../lib/url";
import { BarcodeLookupField } from "./barcode-lookup-field";
import { InlineError } from "./inline-error";

type InventoryItemEditFormProps = {
  householdId: string;
  item: InventoryItemSummary;
  onSaved: () => void;
  onCancel: () => void;
};

export function InventoryItemEditForm({ householdId, item, onSaved, onCancel }: InventoryItemEditFormProps): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemType, setItemType] = useState<"consumable" | "equipment">(item.itemType === "equipment" ? "equipment" : "consumable");

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    const form = document.getElementById("inventory-edit-form") as HTMLFormElement | null;

    if (!form) {
      return;
    }

    const setIfEmpty = (name: string, value: string | null) => {
      if (!value) {
        return;
      }

      const input = form.elements.namedItem(name) as HTMLInputElement | null;

      if (input && !input.value.trim()) {
        input.value = value;
      }
    };

    if (result.found) {
      setIfEmpty("name", result.productName);
      setIfEmpty("manufacturer", result.brand);
      setIfEmpty("partNumber", result.barcode);
      setIfEmpty("description", result.description);
      setIfEmpty("category", result.category);
    } else {
      setIfEmpty("partNumber", result.barcode);
    }
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    const getString = (name: string): string | undefined => {
      const value = (data.get(name) as string | null)?.trim();
      return value || undefined;
    };

    const getNumber = (name: string): number | undefined => {
      const raw = (data.get(name) as string | null)?.trim();

      if (!raw) {
        return undefined;
      }

      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const input: UpdateInventoryItemInput = {};
    const name = getString("name");

    if (name) {
      input.name = name;
    }

    input.itemType = itemType;

    const conditionStatus = getString("conditionStatus");
    input.conditionStatus = conditionStatus || null;

    const partNumber = getString("partNumber");
    if (partNumber !== undefined) {
      input.partNumber = partNumber;
    }

    const description = getString("description");
    if (description !== undefined) {
      input.description = description;
    }

    const category = getString("category");
    if (category !== undefined) {
      input.category = category;
    }

    const manufacturer = getString("manufacturer");
    if (manufacturer !== undefined) {
      input.manufacturer = manufacturer;
    }

    const unit = getString("unit");
    if (unit !== undefined) {
      input.unit = unit;
    }

    const quantityOnHand = getNumber("quantityOnHand");
    if (quantityOnHand !== undefined) {
      input.quantityOnHand = quantityOnHand;
    }

    const reorderThreshold = getNumber("reorderThreshold");
    if (reorderThreshold !== undefined) {
      input.reorderThreshold = reorderThreshold;
    }

    const reorderQuantity = getNumber("reorderQuantity");
    if (reorderQuantity !== undefined) {
      input.reorderQuantity = reorderQuantity;
    }

    const preferredSupplier = getString("preferredSupplier");
    if (preferredSupplier !== undefined) {
      input.preferredSupplier = preferredSupplier;
    }

    const supplierUrl = getString("supplierUrl");
    if (supplierUrl !== undefined) {
      const normalizedSupplierUrl = normalizeExternalUrl(supplierUrl);

      if (!normalizedSupplierUrl) {
        setSaving(false);
        setError("Supplier Link must be a valid URL.");
        return;
      }

      input.supplierUrl = normalizedSupplierUrl;
    }

    const unitCost = getNumber("unitCost");
    if (unitCost !== undefined) {
      input.unitCost = unitCost;
    }

    const storageLocation = getString("storageLocation");
    if (storageLocation !== undefined) {
      input.storageLocation = storageLocation;
    }

    const notes = getString("notes");
    if (notes !== undefined) {
      input.notes = notes;
    }

    try {
      await updateInventoryItem(householdId, item.id, input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }, [householdId, item.id, onSaved]);

  return (
    <form id="inventory-edit-form" onSubmit={handleSubmit} className="form-grid">
      <div className="field field--full" style={{ marginBottom: 8 }}>
        <span style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--ink-muted)" }}>Look Up by Barcode</span>
        <BarcodeLookupField onResult={handleBarcodeResult} />
      </div>
      <div className="field field--full inventory-type-toggle" style={{ marginBottom: 8 }}>
        <span className="inventory-type-toggle__label">Item Type</span>
        <div className="inventory-type-toggle__options">
          <button type="button" className={`inventory-type-toggle__btn${itemType === "consumable" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setItemType("consumable")}>Consumable</button>
          <button type="button" className={`inventory-type-toggle__btn${itemType === "equipment" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setItemType("equipment")}>Equipment</button>
        </div>
      </div>
      <label className="field">
        <span>Name</span>
        <input type="text" name="name" defaultValue={item.name} required />
      </label>
      <label className="field">
        <span>Part Number</span>
        <input type="text" name="partNumber" defaultValue={item.partNumber ?? ""} />
      </label>
      <label className="field">
        <span>Category</span>
        <input type="text" name="category" defaultValue={item.category ?? ""} />
      </label>
      <label className="field">
        <span>Manufacturer</span>
        <input type="text" name="manufacturer" defaultValue={item.manufacturer ?? ""} />
      </label>
      <label className="field">
        <span>Unit</span>
        <input type="text" name="unit" defaultValue={item.unit} />
      </label>
      <label className="field">
        <span>On Hand</span>
        <input type="number" name="quantityOnHand" min="0" step="0.01" defaultValue={item.quantityOnHand} />
      </label>
      {itemType === "equipment" && (
        <label className="field">
          <span>Condition</span>
          <select name="conditionStatus" defaultValue={item.conditionStatus ?? ""}>
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
            <input type="number" name="reorderThreshold" min="0" step="0.01" defaultValue={item.reorderThreshold ?? ""} />
          </label>
          <label className="field">
            <span>Usually Buy</span>
            <input type="number" name="reorderQuantity" min="0" step="0.01" defaultValue={item.reorderQuantity ?? ""} />
          </label>
        </>
      )}
      <label className="field">
        <span>Last Price</span>
        <input type="number" name="unitCost" min="0" step="0.01" defaultValue={item.unitCost ?? ""} />
      </label>
      <label className="field">
        <span>Supplier</span>
        <input type="text" name="preferredSupplier" defaultValue={item.preferredSupplier ?? ""} />
      </label>
      <label className="field field--full">
        <span>Supplier Link</span>
        <input type="text" name="supplierUrl" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} defaultValue={item.supplierUrl ?? ""} />
      </label>
      <label className="field field--full">
        <span>Storage Location</span>
        <input type="text" name="storageLocation" defaultValue={item.storageLocation ?? ""} />
      </label>
      <label className="field field--full">
        <span>Description</span>
        <textarea name="description" rows={2} defaultValue={item.description ?? ""} />
      </label>
      <label className="field field--full">
        <span>Notes</span>
        <textarea name="notes" rows={3} defaultValue={item.notes ?? ""} />
      </label>
      <InlineError message={error} className="field field--full" size="sm" />
      <div className="inline-actions inline-actions--end field field--full">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
      </div>
    </form>
  );
}
