"use client";
import type { HobbyDetail, HobbyPreset, HobbyStatus, HobbySessionLifecycleMode } from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import { useState, type JSX, type FormEvent } from "react";
import {
  defaultWorkflowStages,
  HobbyWorkflowStageEditor,
  toWorkflowStageDrafts,
  type WorkflowStageDraft,
} from "./hobby-workflow-stage-editor";

type HobbyWorkbenchProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  presets: HobbyPreset[];
  initialHobby?: Pick<HobbyDetail, "id" | "name" | "description" | "status" | "lifecycleMode" | "hobbyType" | "notes" | "statusPipeline" | "inventoryLinks"> | null;
};

const hobbyStatusOptions: { value: HobbyStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function HobbyWorkbench({
  mode,
  action,
  householdId,
  presets,
  initialHobby = null,
}: HobbyWorkbenchProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(initialHobby?.name ?? "");
  const [description, setDescription] = useState(initialHobby?.description ?? "");
  const [status, setStatus] = useState<HobbyStatus>(initialHobby?.status ?? "active");
  const [lifecycleMode, setLifecycleMode] = useState<HobbySessionLifecycleMode>(initialHobby?.lifecycleMode ?? "binary");
  const [hobbyType, setHobbyType] = useState(initialHobby?.hobbyType ?? "");
  const [notes, setNotes] = useState(initialHobby?.notes ?? "");
  const [pipelineSteps, setPipelineSteps] = useState<WorkflowStageDraft[]>(toWorkflowStageDrafts(initialHobby?.statusPipeline));
  const [selectedPresetKey, setSelectedPresetKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = presets.find((p) => p.key === selectedPresetKey);

  const handlePresetChange = (key: string) => {
    setSelectedPresetKey(key);
    const preset = presets.find((p) => p.key === key);
    if (preset) {
      if (preset.description && !description) {
        setDescription(preset.description);
      }
      setLifecycleMode(preset.lifecycleMode);
      setHobbyType(preset.label);
      setPipelineSteps(toWorkflowStageDrafts(preset.pipelineSteps));
    }
  };

  const handleLifecycleModeChange = (nextMode: HobbySessionLifecycleMode) => {
    setLifecycleMode(nextMode);
    if (nextMode === "pipeline" && pipelineSteps.length === 0) {
      setPipelineSteps(defaultWorkflowStages());
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      if (initialHobby?.id) {
        formData.set("hobbyId", initialHobby.id);
      }
      formData.set("name", name);
      formData.set("description", description);
      formData.set("status", status);
      formData.set("lifecycleMode", lifecycleMode);
      formData.set("hobbyType", hobbyType);
      formData.set("notes", notes);
      formData.set("statusPipelineJson", JSON.stringify(pipelineSteps.map((step, index) => ({
        ...(step.id ? { id: step.id } : {}),
        label: step.label.trim() || `Step ${index + 1}`,
        description: step.description.trim() || null,
        instructions: step.instructions.trim() || null,
        futureNotes: step.futureNotes.trim() || null,
        fieldDefinitions: step.fieldDefinitions.map((field, fieldIndex) => ({
          ...field,
          key: field.key.trim(),
          label: field.label.trim(),
          helpText: field.helpText?.trim() || undefined,
          unit: field.unit?.trim() || undefined,
          group: field.group?.trim() || undefined,
          placeholder: field.placeholder?.trim() || undefined,
          order: field.order ?? fieldIndex,
          options: field.options.map((option) => option.trim()).filter(Boolean),
        })).filter((field) => field.key && field.label),
        checklistTemplates: step.checklistTemplates.map((item, itemIndex) => ({
          title: item.title.trim(),
          sortOrder: item.sortOrder ?? itemIndex,
        })).filter((item) => item.title),
        supplyTemplates: step.supplyTemplates.map((item, itemIndex) => ({
          inventoryItemId: item.inventoryItemId ?? null,
          name: item.name.trim(),
          quantityNeeded: item.quantityNeeded,
          unit: item.unit.trim(),
          isRequired: item.isRequired ?? true,
          notes: item.notes?.trim() || null,
          sortOrder: item.sortOrder ?? itemIndex,
        })).filter((item) => item.name && item.unit && item.quantityNeeded > 0),
        sortOrder: index,
        color: step.color.trim() || null,
        isFinal: step.isFinal,
      }))));
      if (selectedPresetKey) {
        formData.set("presetKey", selectedPresetKey);
      }
      await action(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode === "create" ? "create" : "update"} hobby.`);
      setSubmitting(false);
    }
  };

  return (
    <form className="workbench-form" onSubmit={handleSubmit}>
      <section className="workbench-section">
        <div className="workbench-section__head">
          <h3>Core Identity</h3>
        </div>

        <div className="workbench-grid">
          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Hobby Name <span className="workbench-field__required">*</span></span>
            <input
              type="text"
              className="workbench-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beer Brewing"
              required
            />
          </label>

          {mode === "create" ? (
            <label className="workbench-field workbench-field--wide">
              <span className="workbench-field__label">Hobby Preset</span>
              <select
                className="workbench-field__input"
                value={selectedPresetKey}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">None — start from scratch</option>
                {presets.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="workbench-field">
            <span className="workbench-field__label">Hobby Type</span>
            <input
              type="text"
              className="workbench-field__input"
              value={hobbyType}
              onChange={(e) => setHobbyType(e.target.value)}
              placeholder="e.g. Brewing, Pottery, Woodworking"
            />
          </label>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Description</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this hobby about?"
            />
          </label>

          <label className="workbench-field">
            <span className="workbench-field__label">Status</span>
            <select
              className="workbench-field__input"
              value={status}
              onChange={(e) => setStatus(e.target.value as HobbyStatus)}
            >
              {hobbyStatusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <fieldset className="workbench-field workbench-fieldset">
            <legend className="workbench-field__label">Session Lifecycle</legend>
            <div className="workbench-radio-group">
              <label className="workbench-radio">
                <input
                  type="radio"
                  name="lifecycleMode"
                  value="binary"
                  checked={lifecycleMode === "binary"}
                  onChange={() => handleLifecycleModeChange("binary")}
                />
                <span>Simple (Active / Completed)</span>
              </label>
              <label className="workbench-radio">
                <input
                  type="radio"
                  name="lifecycleMode"
                  value="pipeline"
                  checked={lifecycleMode === "pipeline"}
                  onChange={() => handleLifecycleModeChange("pipeline")}
                />
                <span>Pipeline (Multi-step workflow)</span>
              </label>
            </div>
          </fieldset>

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Notes</span>
            <textarea
              className="workbench-field__input workbench-field__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add setup notes, process reminders, or household conventions."
            />
          </label>
        </div>
      </section>

      {lifecycleMode === "pipeline" ? (
        <HobbyWorkflowStageEditor
          stages={pipelineSteps}
          inventoryLinks={initialHobby?.inventoryLinks ?? []}
          onChange={setPipelineSteps}
        />
      ) : null}

      {mode === "create" && selectedPreset && (
        <section className="workbench-section">
          <div className="workbench-section__head">
            <h3>What this preset includes</h3>
          </div>
          <div className="workbench-details">
            <div className="kv-grid">
              <span className="kv-grid__label">Lifecycle</span>
              <span className="kv-grid__value">{selectedPreset.lifecycleMode === "pipeline" ? "Pipeline" : "Simple"}</span>
              {selectedPreset.pipelineSteps.length > 0 && (
                <>
                  <span className="kv-grid__label">Workflow Stages</span>
                  <span className="kv-grid__value">{selectedPreset.pipelineSteps.map((s) => s.label).join(" → ")}</span>
                  <span className="kv-grid__label">Stage Tools</span>
                  <span className="kv-grid__value">
                    {selectedPreset.pipelineSteps.reduce((count, stage) => count + stage.checklistTemplates.length + stage.supplyTemplates.length + stage.fieldDefinitions.length, 0)} stage assets across checklists, supply needs, and logging fields
                  </span>
                </>
              )}
              <span className="kv-grid__label">Metrics</span>
              <span className="kv-grid__value">{selectedPreset.metricTemplates.length} ({selectedPreset.metricTemplates.map((m) => m.name).join(", ")})</span>
              <span className="kv-grid__label">Inventory Categories</span>
              <span className="kv-grid__value">{selectedPreset.inventoryCategories.length} ({selectedPreset.inventoryCategories.join(", ")})</span>
              {selectedPreset.recipeFields.length > 0 && (
                <>
                  <span className="kv-grid__label">Recipe Fields</span>
                  <span className="kv-grid__value">{selectedPreset.recipeFields.length} custom fields</span>
                </>
              )}
              {selectedPreset.suggestedEquipment.length > 0 && (
                <>
                  <span className="kv-grid__label">Suggested Equipment</span>
                  <span className="kv-grid__value">{selectedPreset.suggestedEquipment.join(", ")}</span>
                </>
              )}
              {selectedPreset.starterRecipes.length > 0 && (
                <>
                  <span className="kv-grid__label">Starter Recipes</span>
                  <span className="kv-grid__value">{selectedPreset.starterRecipes.map((r) => r.name).join(", ")}</span>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {error && <p className="workbench-error">{error}</p>}

      <div className="workbench-bar">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting || !name.trim()}
        >
          {submitting ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create Hobby" : "Save Hobby")}
        </button>
      </div>
    </form>
  );
}
