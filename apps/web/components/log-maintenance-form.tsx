"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { BarcodeLookupResult } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  maintenanceLogFormSchema,
  type MaintenanceLogFormValues,
  type MaintenanceLogResolvedValues
} from "../lib/validation/forms";
import { BarcodeLookupField } from "./barcode-lookup-field";
import { InlineError } from "./inline-error";

type LogMaintenanceFormProps = {
  householdId: string;
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

export function LogMaintenanceForm({ householdId, assetId, schedules, createLogAction }: LogMaintenanceFormProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<MaintenanceLogFormValues, unknown, MaintenanceLogResolvedValues>({
    resolver: zodResolver(maintenanceLogFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      scheduleId: "",
      title: "",
      completedAt: "",
      usageValue: "",
      cost: "",
      serviceProviderId: "",
      notes: "",
      applyLinkedParts: true,
      parts: [createEmptyPart()]
    }
  });
  const { fields, append, remove } = useFieldArray({ control, name: "parts" });
  const selectedScheduleId = watch("scheduleId") ?? "";
  const applyLinkedParts = watch("applyLinkedParts") ?? true;

  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

  const addPart = useCallback(() => {
    append(createEmptyPart());
  }, [append]);

  const removePart = useCallback((index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  }, [fields.length, remove]);

  const handleBarcodeResult = useCallback((result: BarcodeLookupResult) => {
    const currentParts = watch("parts") ?? [];
    const emptyIndex = currentParts.findIndex((part) => !(part.name ?? "").trim());
    const targetIndex = emptyIndex >= 0 ? emptyIndex : Math.max(currentParts.length - 1, 0);

    if (result.found && result.productName) {
      const currentName = currentParts[targetIndex]?.name ?? "";
      if (!currentName.trim()) {
        setValue(`parts.${targetIndex}.name`, result.productName, { shouldValidate: true, shouldDirty: true });
      }
    }

    if (result.barcode) {
      const currentPartNumber = typeof currentParts[targetIndex]?.partNumber === "string"
        ? currentParts[targetIndex]?.partNumber
        : "";
      if (!currentPartNumber.trim()) {
        setValue(`parts.${targetIndex}.partNumber`, result.barcode, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [setValue, watch]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("assetId", assetId);
      formData.set("applyLinkedParts", values.applyLinkedParts ? "true" : "false");
      if (values.scheduleId) formData.set("scheduleId", values.scheduleId);
      if (values.title) formData.set("title", values.title);
      if (values.completedAt) formData.set("completedAt", values.completedAt);
      if (values.usageValue !== undefined) formData.set("usageValue", String(values.usageValue));
      if (values.cost !== undefined) formData.set("cost", String(values.cost));
      if (values.serviceProviderId) formData.set("serviceProviderId", values.serviceProviderId);
      if (values.notes) formData.set("notes", values.notes);

      for (const part of values.parts ?? []) {
        formData.append("partName", part.name ?? "");
        formData.append("partNumber", part.partNumber ?? "");
        formData.append("partQuantity", part.quantity === "" ? "" : String(part.quantity));
        formData.append("partUnitCost", part.unitCost === "" || part.unitCost === undefined ? "" : String(part.unitCost));
        formData.append("partSupplier", part.supplier ?? "");
        formData.append("partNotes", part.notes ?? "");
      }

      await Promise.resolve(createLogAction(formData));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add log entry.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="form-grid">
      <label className="field field--full">
        <span>Schedule</span>
        <select {...register("scheduleId")} onChange={(event) => {
          register("scheduleId").onChange(event);
          const nextScheduleId = event.target.value;

          if (!nextScheduleId) {
            setValue("applyLinkedParts", false, { shouldDirty: true });
            return;
          }

          setValue("applyLinkedParts", true, { shouldDirty: true });
        }}>
          <option value="">No linked schedule</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
          ))}
        </select>
        <InlineError message={errors.scheduleId?.message} size="sm" />
      </label>
      {selectedSchedule ? (
        <div className="field field--full schedule-card__linked-parts">
          <label className="schedule-card__linked-parts-toggle">
            <input
              type="checkbox"
              checked={applyLinkedParts}
              onChange={(event) => setValue("applyLinkedParts", event.target.checked, { shouldDirty: true })}
            />
            <span>Auto-consume inventory linked to {selectedSchedule.name}</span>
          </label>
          <p className="data-table__secondary">When enabled, schedule-linked parts are added to the log and deducted from inventory automatically.</p>
        </div>
      ) : null}
      <label className="field field--full">
        <span>Title</span>
        <input type="text" placeholder="Brake inspection" {...register("title")} />
        <InlineError message={errors.title?.message} size="sm" />
      </label>
      <label className="field">
        <span>Completed At</span>
        <input type="datetime-local" {...register("completedAt")} />
        <InlineError message={errors.completedAt?.message} size="sm" />
      </label>
      <label className="field">
        <span>Usage Value</span>
        <input type="number" step="0.1" {...register("usageValue")} />
        <InlineError message={errors.usageValue?.message} size="sm" />
      </label>
      <label className="field">
        <span>Cost</span>
        <input type="number" step="0.01" {...register("cost")} />
        <InlineError message={errors.cost?.message} size="sm" />
      </label>
      <label className="field">
        <span>Service Provider Id</span>
        <input type="text" placeholder="Optional structured provider id" {...register("serviceProviderId")} />
        <InlineError message={errors.serviceProviderId?.message} size="sm" />
      </label>
      <label className="field field--full">
        <span>Notes</span>
        <textarea rows={3} placeholder="Service notes or findings" {...register("notes")} />
        <InlineError message={errors.notes?.message} size="sm" />
      </label>
      <div className="field field--full" style={{ marginBottom: 8 }}>
        <span style={{ display: "block", marginBottom: 4, fontSize: "0.85rem", color: "var(--ink-muted)" }}>Look Up Part by Barcode</span>
        <BarcodeLookupField onResult={handleBarcodeResult} />
      </div>

      <div className="field field--full log-parts">
        <div className="log-parts__header">
          <span>Parts Used</span>
          <span className="log-parts__count">{fields.length} row{fields.length === 1 ? "" : "s"}</span>
        </div>

        <div className="log-parts__list">
          {fields.map((part, index) => (
            <div key={part.id} className={`log-parts__row${index > 0 ? " log-parts__row--separated" : ""}`}>
              <div className="log-parts__row-head">
                <strong>Part {index + 1}</strong>
                {fields.length > 1 ? (
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
                <label className="field"><span>Part Name</span><input type="text" placeholder="Oil filter" {...register(`parts.${index}.name`)} /> <InlineError message={errors.parts?.[index]?.name?.message} size="sm" /></label>
                <label className="field"><span>Part Number</span><input type="text" placeholder="FL-500S" {...register(`parts.${index}.partNumber`)} /> <InlineError message={errors.parts?.[index]?.partNumber?.message} size="sm" /></label>
                <label className="field"><span>Quantity</span><input type="number" step="0.1" placeholder="1" {...register(`parts.${index}.quantity`)} /> <InlineError message={errors.parts?.[index]?.quantity?.message} size="sm" /></label>
                <label className="field"><span>Unit Cost</span><input type="number" step="0.01" placeholder="8.97" {...register(`parts.${index}.unitCost`)} /> <InlineError message={errors.parts?.[index]?.unitCost?.message} size="sm" /></label>
                <label className="field"><span>Supplier</span><input type="text" placeholder="AutoZone" {...register(`parts.${index}.supplier`)} /> <InlineError message={errors.parts?.[index]?.supplier?.message} size="sm" /></label>
                <label className="field field--full"><span>Part Notes</span><textarea rows={2} placeholder="Optional part note" {...register(`parts.${index}.notes`)} /> <InlineError message={errors.parts?.[index]?.notes?.message} size="sm" /></label>
              </div>
            </div>
          ))}
        </div>

        <div className="log-parts__actions">
          <button type="button" className="button button--secondary" onClick={addPart}>Add Part</button>
        </div>
      </div>

      <InlineError message={error} className="field field--full" size="sm" />

      <button type="submit" className="button button--primary">Add Log Entry</button>
    </form>
  );
}
