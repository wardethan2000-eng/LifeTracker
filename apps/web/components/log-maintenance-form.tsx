"use client";

import type { BarcodeLookupResult } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { BarcodeLookupField } from "./barcode-lookup-field";

type LogMaintenanceFormProps = {
  assetId: string;
  schedules: { id: string; name: string }[];
  createLogAction: (formData: FormData) => void;
};

export function LogMaintenanceForm({ assetId, schedules, createLogAction }: LogMaintenanceFormProps): JSX.Element {
  const [formKey, setFormKey] = useState(0);
  const partNameRef = useRef<HTMLInputElement>(null);
  const partNumberRef = useRef<HTMLInputElement>(null);

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    if (result.found && partNameRef.current) {
      partNameRef.current.value = result.productName ?? "";
    }

    if (partNumberRef.current) {
      partNumberRef.current.value = result.barcode;
    }
  }, []);

  return (
    <form action={createLogAction} className="form-grid" key={formKey}>
      <input type="hidden" name="assetId" value={assetId} />
      <label className="field field--full">
        <span>Schedule</span>
        <select name="scheduleId" defaultValue="">
          <option value="">No linked schedule</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
          ))}
        </select>
      </label>
      <label className="field field--full">
        <span>Title</span>
        <input type="text" name="title" placeholder="Brake inspection" required />
      </label>
      <label className="field">
        <span>Completed At</span>
        <input type="datetime-local" name="completedAt" required />
      </label>
      <label className="field">
        <span>Usage Value</span>
        <input type="number" name="usageValue" min="0" step="0.1" />
      </label>
      <label className="field">
        <span>Cost</span>
        <input type="number" name="cost" min="0" step="0.01" />
      </label>
      <label className="field">
        <span>Service Provider Id</span>
        <input type="text" name="serviceProviderId" placeholder="Optional structured provider id" />
      </label>
      <label className="field field--full">
        <span>Notes</span>
        <textarea name="notes" rows={3} placeholder="Service notes or findings" />
      </label>
      <div className="field field--full" style={{ marginBottom: 8 }}>
        <span style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--ink-muted)" }}>Look Up Part by Barcode</span>
        <BarcodeLookupField onResult={handleBarcodeResult} />
      </div>
      <label className="field"><span>Part Name</span><input ref={partNameRef} type="text" name="partName" placeholder="Oil filter" /></label>
      <label className="field"><span>Part Number</span><input ref={partNumberRef} type="text" name="partNumber" placeholder="FL-500S" /></label>
      <label className="field"><span>Quantity</span><input type="number" name="partQuantity" min="0" step="0.1" placeholder="1" /></label>
      <label className="field"><span>Unit Cost</span><input type="number" name="partUnitCost" min="0" step="0.01" placeholder="8.97" /></label>
      <label className="field"><span>Supplier</span><input type="text" name="partSupplier" placeholder="AutoZone" /></label>
      <label className="field field--full"><span>Part Notes</span><textarea name="partNotes" rows={2} placeholder="Optional part note" /></label>
      <button type="submit" className="button button--primary">Add Log Entry</button>
    </form>
  );
}
