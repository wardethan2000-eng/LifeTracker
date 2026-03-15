"use client";
import type { HobbyPreset, HobbyStatus, HobbySessionLifecycleMode } from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import { useState, type JSX, type FormEvent } from "react";

type HobbyWorkbenchProps = {
  action: (formData: FormData) => Promise<void>;
  householdId: string;
  presets: HobbyPreset[];
};

const hobbyStatusOptions: { value: HobbyStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function HobbyWorkbench({ action, householdId, presets }: HobbyWorkbenchProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<HobbyStatus>("active");
  const [lifecycleMode, setLifecycleMode] = useState<HobbySessionLifecycleMode>("binary");
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
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("name", name);
      if (description) formData.set("description", description);
      formData.set("status", status);
      formData.set("lifecycleMode", lifecycleMode);
      if (selectedPresetKey) {
        formData.set("presetKey", selectedPresetKey);
        formData.set("hobbyType", selectedPreset?.label ?? selectedPresetKey);
      }
      await action(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create hobby.");
      setSubmitting(false);
    }
  };

  return (
    <form className="workbench-form" onSubmit={handleSubmit}>
      <section className="workbench-section">
        <h2 className="workbench-section__title">Core Identity</h2>

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

          <label className="workbench-field workbench-field--wide">
            <span className="workbench-field__label">Hobby Type (Preset)</span>
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

          <fieldset className="workbench-field">
            <legend className="workbench-field__label">Session Lifecycle</legend>
            <div className="workbench-radio-group">
              <label className="workbench-radio">
                <input
                  type="radio"
                  name="lifecycleMode"
                  value="binary"
                  checked={lifecycleMode === "binary"}
                  onChange={() => setLifecycleMode("binary")}
                />
                <span>Simple (Active / Completed)</span>
              </label>
              <label className="workbench-radio">
                <input
                  type="radio"
                  name="lifecycleMode"
                  value="pipeline"
                  checked={lifecycleMode === "pipeline"}
                  onChange={() => setLifecycleMode("pipeline")}
                />
                <span>Pipeline (Multi-step workflow)</span>
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      {selectedPreset && (
        <section className="workbench-section">
          <h2 className="workbench-section__title">What this preset includes</h2>
          <div className="workbench-details">
            <div className="kv-grid">
              <span className="kv-grid__label">Lifecycle</span>
              <span className="kv-grid__value">{selectedPreset.lifecycleMode === "pipeline" ? "Pipeline" : "Simple"}</span>
              {selectedPreset.pipelineSteps.length > 0 && (
                <>
                  <span className="kv-grid__label">Pipeline Steps</span>
                  <span className="kv-grid__value">{selectedPreset.pipelineSteps.map((s) => s.label).join(" → ")}</span>
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
          {submitting ? "Creating…" : "Create Hobby"}
        </button>
      </div>
    </form>
  );
}
