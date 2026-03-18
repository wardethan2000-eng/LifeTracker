"use client";

import type { BarcodeLookupResult } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { BarcodeLookupField } from "./barcode-lookup-field";

type LogMaintenanceFormProps = {
  assetId: string;
  schedules: { id: string; name: string }[];
  createLogAction: (formData: FormData) => void;
};

type LogPartDraft = {
  name: string;
  partNumber: string;
  quantity: string;
  unitCost: string;
  supplier: string;
  notes: string;
};

const createEmptyPart = (): LogPartDraft => ({
  name: "",
  partNumber: "",
  quantity: "",
  unitCost: "",
  supplier: "",
  notes: "",
});

export function LogMaintenanceForm({ assetId, schedules, createLogAction }: LogMaintenanceFormProps): JSX.Element {
  const [parts, setParts] = useState<LogPartDraft[]>([createEmptyPart()]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [applyLinkedParts, setApplyLinkedParts] = useState(true);

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

  const updatePart = useCallback((index: number, field: keyof LogPartDraft, value: string) => {
    setParts((current) => current.map((part, partIndex) => (
      partIndex === index
        ? { ...part, [field]: value }
        : part
    )));
  }, []);

  const addPart = useCallback(() => {
    setParts((current) => [...current, createEmptyPart()]);
  }, []);

  const removePart = useCallback((index: number) => {
    setParts((current) => current.length === 1
      ? current
      : current.filter((_, partIndex) => partIndex !== index));
  }, []);

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    setParts((current) => {
      const emptyIndex = current.findIndex((part) => !part.name.trim());
      const targetIndex = emptyIndex >= 0 ? emptyIndex : current.length - 1;

      return current.map((part, partIndex) => {
        if (partIndex !== targetIndex) {
          return part;
        }

        return {
          ...part,
          name: result.found ? (result.productName ?? part.name) : part.name,
          partNumber: result.barcode || part.partNumber,
        };
      });
    });
  }, []);

  return (
    <form action={createLogAction} className="form-grid">
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="applyLinkedParts" value={applyLinkedParts ? "true" : "false"} />
      <label className="field field--full">
        <span>Schedule</span>
        <select name="scheduleId" value={selectedScheduleId} onChange={(event) => {
          const nextScheduleId = event.target.value;
          setSelectedScheduleId(nextScheduleId);

          if (!nextScheduleId) {
            setApplyLinkedParts(false);
            return;
          }

          setApplyLinkedParts(true);
        }}>
          <option value="">No linked schedule</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
          ))}
        </select>
      </label>
      {selectedSchedule ? (
        <div className="field field--full schedule-card__linked-parts">
          <label className="schedule-card__linked-parts-toggle">
            <input
              type="checkbox"
              checked={applyLinkedParts}
              onChange={(event) => setApplyLinkedParts(event.target.checked)}
            />
            <span>Auto-consume inventory linked to {selectedSchedule.name}</span>
          </label>
          <p className="data-table__secondary">When enabled, schedule-linked parts are added to the log and deducted from inventory automatically.</p>
        </div>
      ) : null}
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

      <div className="field field--full log-parts">
        <div className="log-parts__header">
          <span>Parts Used</span>
          <span className="log-parts__count">{parts.length} row{parts.length === 1 ? "" : "s"}</span>
        </div>

        <div className="log-parts__list">
          {parts.map((part, index) => (
            <div key={`part-row-${index}`} className={`log-parts__row${index > 0 ? " log-parts__row--separated" : ""}`}>
              <div className="log-parts__row-head">
                <strong>Part {index + 1}</strong>
                {parts.length > 1 ? (
                  <button
                    type="button"
                    className="button button--secondary button--sm log-parts__remove"
                    onClick={() => removePart(index)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="form-grid">
                <label className="field"><span>Part Name</span><input type="text" name="partName" placeholder="Oil filter" value={part.name} onChange={(event) => updatePart(index, "name", event.target.value)} /></label>
                <label className="field"><span>Part Number</span><input type="text" name="partNumber" placeholder="FL-500S" value={part.partNumber} onChange={(event) => updatePart(index, "partNumber", event.target.value)} /></label>
                <label className="field"><span>Quantity</span><input type="number" name="partQuantity" min="0" step="0.1" placeholder="1" value={part.quantity} onChange={(event) => updatePart(index, "quantity", event.target.value)} /></label>
                <label className="field"><span>Unit Cost</span><input type="number" name="partUnitCost" min="0" step="0.01" placeholder="8.97" value={part.unitCost} onChange={(event) => updatePart(index, "unitCost", event.target.value)} /></label>
                <label className="field"><span>Supplier</span><input type="text" name="partSupplier" placeholder="AutoZone" value={part.supplier} onChange={(event) => updatePart(index, "supplier", event.target.value)} /></label>
                <label className="field field--full"><span>Part Notes</span><textarea name="partNotes" rows={2} placeholder="Optional part note" value={part.notes} onChange={(event) => updatePart(index, "notes", event.target.value)} /></label>
              </div>
            </div>
          ))}
        </div>

        <div className="log-parts__actions">
          <button type="button" className="button button--secondary" onClick={addPart}>Add Part</button>
        </div>
      </div>

      <button type="submit" className="button button--primary">Add Log Entry</button>
    </form>
  );
}
