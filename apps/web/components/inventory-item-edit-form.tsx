"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { BarcodeLookupResult, InventoryItemSummary, UpdateInventoryItemInput } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { updateInventoryItemAction } from "../app/actions";
import {
  inventoryItemFormSchema,
  type InventoryItemFormValues,
  type InventoryItemResolvedValues
} from "../lib/validation/forms";
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
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<InventoryItemFormValues, unknown, InventoryItemResolvedValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      name: item.name,
      itemType: item.itemType === "equipment" ? "equipment" : "consumable",
      conditionStatus: item.conditionStatus ?? "",
      partNumber: item.partNumber ?? "",
      description: item.description ?? "",
      category: item.category ?? "",
      manufacturer: item.manufacturer ?? "",
      unit: item.unit,
      quantityOnHand: String(item.quantityOnHand),
      reorderThreshold: item.reorderThreshold !== null && item.reorderThreshold !== undefined ? String(item.reorderThreshold) : "",
      reorderQuantity: item.reorderQuantity !== null && item.reorderQuantity !== undefined ? String(item.reorderQuantity) : "",
      preferredSupplier: item.preferredSupplier ?? "",
      supplierUrl: item.supplierUrl ?? "",
      unitCost: item.unitCost !== null && item.unitCost !== undefined ? String(item.unitCost) : "",
      storageLocation: item.storageLocation ?? "",
      notes: item.notes ?? "",
      imageUrl: item.imageUrl ?? "",
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : ""
    }
  });
  const itemType = watch("itemType") === "equipment" ? "equipment" : "consumable";

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    const setIfEmpty = (name: string, value: string | null) => {
      if (!value) {
        return;
      }

      const current = watch(name as keyof InventoryItemFormValues);
      if (typeof current === "string" && !current.trim()) {
        setValue(name as keyof InventoryItemFormValues, value as never, { shouldValidate: true, shouldDirty: true });
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
  }, [setValue, watch]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    setError(null);

    const input: UpdateInventoryItemInput = {};

    if (values.name) {
      input.name = values.name;
    }

    input.itemType = itemType;
    input.conditionStatus = values.conditionStatus ?? null;

    if (values.partNumber !== undefined) input.partNumber = values.partNumber;
    if (values.description !== undefined) input.description = values.description;
    if (values.category !== undefined) input.category = values.category;
    if (values.manufacturer !== undefined) input.manufacturer = values.manufacturer;
    if (values.unit !== undefined) input.unit = values.unit;
    if (values.quantityOnHand !== undefined) input.quantityOnHand = values.quantityOnHand;
    if (values.reorderThreshold !== undefined) input.reorderThreshold = values.reorderThreshold;
    if (values.reorderQuantity !== undefined) input.reorderQuantity = values.reorderQuantity;
    if (values.preferredSupplier !== undefined) input.preferredSupplier = values.preferredSupplier;
    if (values.supplierUrl !== undefined) input.supplierUrl = values.supplierUrl;
    if (values.unitCost !== undefined) input.unitCost = values.unitCost;
    if (values.storageLocation !== undefined) input.storageLocation = values.storageLocation;
    if (values.notes !== undefined) input.notes = values.notes;
    if (values.imageUrl !== undefined) input.imageUrl = values.imageUrl || null;
    if (values.expiresAt !== undefined) input.expiresAt = values.expiresAt ? new Date(values.expiresAt).toISOString() : null;

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("inventoryItemId", item.id);

      formData.set("name", values.name ?? "");
      formData.set("itemType", itemType);
      formData.set("conditionStatus", values.conditionStatus ?? "");
      formData.set("partNumber", values.partNumber ?? "");
      formData.set("description", values.description ?? "");
      formData.set("category", values.category ?? "");
      formData.set("manufacturer", values.manufacturer ?? "");
      formData.set("unit", values.unit ?? "");
      formData.set("quantityOnHand", values.quantityOnHand === undefined ? "" : String(values.quantityOnHand));
      formData.set("reorderThreshold", values.reorderThreshold === undefined ? "" : String(values.reorderThreshold));
      formData.set("reorderQuantity", values.reorderQuantity === undefined ? "" : String(values.reorderQuantity));
      formData.set("preferredSupplier", values.preferredSupplier ?? "");
      formData.set("supplierUrl", values.supplierUrl ?? "");
      formData.set("unitCost", values.unitCost === undefined ? "" : String(values.unitCost));
      formData.set("storageLocation", values.storageLocation ?? "");
      formData.set("notes", values.notes ?? "");
      formData.set("imageUrl", values.imageUrl ?? "");
      formData.set("expiresAt", values.expiresAt ?? "");

      await updateInventoryItemAction(formData);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  });

  return (
    <form id="inventory-edit-form" onSubmit={onSubmit} noValidate className="form-grid">
      <div className="field field--full" style={{ marginBottom: 8 }}>
        <span style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--ink-muted)" }}>Look Up by Barcode</span>
        <BarcodeLookupField onResult={handleBarcodeResult} />
      </div>
      <div className="field field--full inventory-type-toggle" style={{ marginBottom: 8 }}>
        <span className="inventory-type-toggle__label">Item Type</span>
        <div className="inventory-type-toggle__options">
          <button type="button" className={`inventory-type-toggle__btn${itemType === "consumable" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setValue("itemType", "consumable", { shouldValidate: true, shouldDirty: true })}>Consumable</button>
          <button type="button" className={`inventory-type-toggle__btn${itemType === "equipment" ? " inventory-type-toggle__btn--active" : ""}`} onClick={() => setValue("itemType", "equipment", { shouldValidate: true, shouldDirty: true })}>Equipment</button>
        </div>
        <InlineError message={errors.itemType?.message} size="sm" />
      </div>
      <label className="field">
        <span>Name</span>
        <input type="text" {...register("name")} />
        <InlineError message={errors.name?.message} size="sm" />
      </label>
      <label className="field">
        <span>Part Number</span>
        <input type="text" {...register("partNumber")} />
        <InlineError message={errors.partNumber?.message} size="sm" />
      </label>
      <label className="field">
        <span>Category</span>
        <input type="text" {...register("category")} />
        <InlineError message={errors.category?.message} size="sm" />
      </label>
      <label className="field">
        <span>Manufacturer</span>
        <input type="text" {...register("manufacturer")} />
        <InlineError message={errors.manufacturer?.message} size="sm" />
      </label>
      <label className="field">
        <span>Unit</span>
        <input type="text" {...register("unit")} />
        <InlineError message={errors.unit?.message} size="sm" />
      </label>
      <label className="field">
        <span>On Hand</span>
        <input type="number" step="0.01" {...register("quantityOnHand")} />
        <InlineError message={errors.quantityOnHand?.message} size="sm" />
      </label>
      {itemType === "equipment" && (
        <label className="field">
          <span>Condition</span>
          <select {...register("conditionStatus")}>
            <option value="">No condition set</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="needs_repair">Needs Repair</option>
            <option value="needs_replacement">Needs Replacement</option>
          </select>
          <InlineError message={errors.conditionStatus?.message} size="sm" />
        </label>
      )}
      {itemType === "consumable" && (
        <>
          <label className="field">
            <span>Reorder When At</span>
            <input type="number" step="0.01" {...register("reorderThreshold")} />
            <InlineError message={errors.reorderThreshold?.message} size="sm" />
          </label>
          <label className="field">
            <span>Usually Buy</span>
            <input type="number" step="0.01" {...register("reorderQuantity")} />
            <InlineError message={errors.reorderQuantity?.message} size="sm" />
          </label>
        </>
      )}
      <label className="field">
        <span>Last Price</span>
        <input type="number" step="0.01" {...register("unitCost")} />
        <InlineError message={errors.unitCost?.message} size="sm" />
      </label>
      <label className="field">
        <span>Supplier</span>
        <input type="text" {...register("preferredSupplier")} />
        <InlineError message={errors.preferredSupplier?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Supplier Link</span>
        <input type="text" {...register("supplierUrl")} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <InlineError message={errors.supplierUrl?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Image URL</span>
        <input type="url" {...register("imageUrl")} placeholder="https://example.com/product-image.jpg" />
        <InlineError message={errors.imageUrl?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Storage Location</span>
        <input type="text" {...register("storageLocation")} />
        <InlineError message={errors.storageLocation?.message} size="sm" />
      </label>
      <label className="field">
        <span>Expiration Date</span>
        <input type="date" {...register("expiresAt")} />
        <InlineError message={errors.expiresAt?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Description</span>
        <textarea rows={2} {...register("description")} />
        <InlineError message={errors.description?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Notes</span>
        <textarea rows={3} {...register("notes")} />
        <InlineError message={errors.notes?.message} size="sm" />
      </label>
      <InlineError message={error} className="field field--full" size="sm" />
      <div className="inline-actions inline-actions--end field field--full">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
      </div>
    </form>
  );
}
