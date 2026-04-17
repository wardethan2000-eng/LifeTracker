"use client";

import type { AssetCategory, LibraryPreset, CustomPresetProfile } from "@aegis/types";
import type { JSX } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAsset, applyLibraryPreset, applyPreset } from "../lib/api";

const CATEGORY_TILES: Array<{ value: AssetCategory; emoji: string; label: string }> = [
  { value: "vehicle", emoji: "🚗", label: "Vehicle" },
  { value: "home", emoji: "🏠", label: "Home System" },
  { value: "appliance", emoji: "🔌", label: "Appliance" },
  { value: "hvac", emoji: "❄️", label: "HVAC" },
  { value: "yard", emoji: "🌿", label: "Yard & Garden" },
  { value: "workshop", emoji: "🔧", label: "Workshop" },
  { value: "marine", emoji: "⛵", label: "Marine" },
  { value: "aircraft", emoji: "✈️", label: "Aircraft" },
  { value: "technology", emoji: "💻", label: "Technology" },
  { value: "utility", emoji: "⚡", label: "Utility" },
  { value: "other", emoji: "📦", label: "Other" },
];

const CATEGORY_QUICK_FIELDS: Record<AssetCategory, Array<{ name: string; label: string; placeholder: string }>> = {
  vehicle: [
    { name: "manufacturer", label: "Make", placeholder: "e.g. Ford, Toyota" },
    { name: "model", label: "Model", placeholder: "e.g. F-150, Camry" },
  ],
  marine: [
    { name: "manufacturer", label: "Make", placeholder: "e.g. Sea Ray, Yamaha" },
    { name: "model", label: "Model", placeholder: "e.g. 270 Sundeck" },
  ],
  aircraft: [
    { name: "manufacturer", label: "Make", placeholder: "e.g. Cessna, Piper" },
    { name: "model", label: "Model", placeholder: "e.g. 172 Skyhawk" },
  ],
  home: [
    { name: "model", label: "System / Type", placeholder: "e.g. Roof, Electrical panel" },
  ],
  appliance: [
    { name: "manufacturer", label: "Brand", placeholder: "e.g. Whirlpool, LG" },
    { name: "model", label: "Model", placeholder: "e.g. WTW8000DW" },
  ],
  hvac: [
    { name: "manufacturer", label: "Brand", placeholder: "e.g. Carrier, Trane" },
    { name: "model", label: "Model", placeholder: "e.g. 24ACC636A003" },
  ],
  yard: [
    { name: "manufacturer", label: "Brand", placeholder: "e.g. Husqvarna, John Deere" },
    { name: "model", label: "Model", placeholder: "e.g. MZ61" },
  ],
  workshop: [
    { name: "manufacturer", label: "Brand", placeholder: "e.g. DeWalt, Milwaukee" },
    { name: "model", label: "Model", placeholder: "e.g. DWE7491RS" },
  ],
  technology: [
    { name: "manufacturer", label: "Manufacturer", placeholder: "e.g. Apple, Dell" },
    { name: "model", label: "Model", placeholder: "e.g. MacBook Pro M3" },
  ],
  utility: [
    { name: "manufacturer", label: "Provider", placeholder: "e.g. Duke Energy, City Water" },
    { name: "model", label: "Account / Meter", placeholder: "e.g. Account #12345" },
  ],
  other: [
    { name: "manufacturer", label: "Manufacturer", placeholder: "Optional" },
    { name: "model", label: "Model", placeholder: "Optional" },
  ],
};

type WizardStep = 1 | 2 | 3;

type AssetCreationWizardProps = {
  householdId: string;
  libraryPresets: LibraryPreset[];
  customPresets: CustomPresetProfile[];
  initialParentAssetId?: string | undefined;
};

export function AssetCreationWizard({
  householdId,
  libraryPresets,
  customPresets,
  initialParentAssetId,
}: AssetCreationWizardProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("__blank__");
  const [selectedPresetSource, setSelectedPresetSource] = useState<"library" | "custom">("library");
  const [name, setName] = useState("");
  const [quickFields, setQuickFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const categoryPresets = selectedCategory
    ? libraryPresets.filter((p) => p.category === selectedCategory)
    : [];
  const customCategoryPresets = selectedCategory
    ? customPresets.filter((p) => p.category === selectedCategory)
    : [];

  const quickFieldDefs = selectedCategory ? (CATEGORY_QUICK_FIELDS[selectedCategory] ?? []) : [];

  const handleCategorySelect = (cat: AssetCategory): void => {
    setSelectedCategory(cat);
    setSelectedPresetKey("__blank__");
    setStep(2);
  };

  const handlePresetSelect = (key: string, source: "library" | "custom"): void => {
    setSelectedPresetKey(key);
    setSelectedPresetSource(source);
    setStep(3);
  };

  const handleSubmit = (): void => {
    if (!selectedCategory || !name.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const asset = await createAsset({
          householdId,
          name: name.trim(),
          category: selectedCategory,
          visibility: "shared",
          manufacturer: quickFields.manufacturer?.trim() || undefined,
          model: quickFields.model?.trim() || undefined,
          assetTypeSource: selectedPresetKey === "__blank__" ? "manual" : selectedPresetSource,
          assetTypeVersion: 1,
          fieldDefinitions: [],
          customFields: {},
          ...(initialParentAssetId ? { parentAssetId: initialParentAssetId } : {}),
        });

        if (selectedPresetKey !== "__blank__") {
          try {
            if (selectedPresetSource === "library") {
              await applyLibraryPreset(asset.id, selectedPresetKey);
            } else {
              await applyPreset(asset.id, { source: "custom", presetProfileId: selectedPresetKey });
            }
          } catch {
            // Non-fatal: preset application failure should not block navigation
          }
        }

        router.push(`/assets/${asset.id}?wizard=1`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create asset. Please try again.");
      }
    });
  };

  const selectedPresetLabel = (() => {
    if (selectedPresetKey === "__blank__") return "Starting blank";
    const lib = libraryPresets.find((p) => p.key === selectedPresetKey);
    if (lib) return lib.label;
    const custom = customPresets.find((p) => p.id === selectedPresetKey);
    return custom?.label ?? "Custom";
  })();

  return (
    <div className="wizard">
      {/* Step indicators */}
      <div className="wizard__steps" aria-label="Creation steps">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`wizard__step${step === n ? " wizard__step--active" : ""}${step > n ? " wizard__step--done" : ""}`}
            onClick={() => {
              if (n < step) setStep(n);
            }}
            disabled={n >= step}
            aria-current={step === n ? "step" : undefined}
          >
            <span className="wizard__step-num">{step > n ? "✓" : n}</span>
            <span className="wizard__step-label">
              {n === 1 ? "Category" : n === 2 ? "Template" : "Details"}
            </span>
          </button>
        ))}
      </div>

      <div className="wizard__body">
        {/* Step 1: Category */}
        {step === 1 && (
          <div className="wizard__panel">
            <h2 className="wizard__heading">What type of asset are you adding?</h2>
            <p className="wizard__subheading">Pick the category that fits best. This shapes the maintenance templates we suggest.</p>
            <div className="wizard-tiles">
              {CATEGORY_TILES.map((tile) => (
                <button
                  key={tile.value}
                  type="button"
                  className="wizard-tile"
                  onClick={() => handleCategorySelect(tile.value)}
                >
                  <span className="wizard-tile__emoji" aria-hidden="true">{tile.emoji}</span>
                  <span className="wizard-tile__label">{tile.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Preset selection */}
        {step === 2 && selectedCategory && (
          <div className="wizard__panel">
            <h2 className="wizard__heading">Choose a starting template</h2>
            <p className="wizard__subheading">Templates pre-load maintenance schedules and metrics so you don&rsquo;t have to set them up from scratch.</p>
            <div className="wizard-tiles wizard-tiles--presets">
              {categoryPresets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`wizard-tile wizard-tile--preset${selectedPresetKey === preset.key ? " wizard-tile--selected" : ""}`}
                  onClick={() => handlePresetSelect(preset.key, "library")}
                >
                  <span className="wizard-tile__label">{preset.label}</span>
                  <span className="wizard-tile__meta">
                    {preset.scheduleTemplates.length > 0 && (
                      <span>{preset.scheduleTemplates.length} schedules</span>
                    )}
                    {preset.metricTemplates.length > 0 && (
                      <span>{preset.metricTemplates.length} metrics</span>
                    )}
                  </span>
                  {preset.description && (
                    <span className="wizard-tile__description">{preset.description}</span>
                  )}
                </button>
              ))}
              {customCategoryPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`wizard-tile wizard-tile--preset${selectedPresetKey === preset.id ? " wizard-tile--selected" : ""}`}
                  onClick={() => handlePresetSelect(preset.id, "custom")}
                >
                  <span className="wizard-tile__label">{preset.label}</span>
                  <span className="wizard-tile__meta wizard-tile__meta--custom">Custom template</span>
                </button>
              ))}
              <button
                type="button"
                className={`wizard-tile wizard-tile--blank${selectedPresetKey === "__blank__" ? " wizard-tile--selected" : ""}`}
                onClick={() => handlePresetSelect("__blank__", "library")}
              >
                <span className="wizard-tile__emoji" aria-hidden="true">✦</span>
                <span className="wizard-tile__label">Start blank</span>
                <span className="wizard-tile__description">Set up schedules and metrics manually later</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Name + quick fields + submit */}
        {step === 3 && selectedCategory && (
          <div className="wizard__panel wizard__panel--submit">
            <h2 className="wizard__heading">Name your asset</h2>
            <p className="wizard__subheading">
              <span className="wizard__breadcrumb">
                {CATEGORY_TILES.find((t) => t.value === selectedCategory)?.label}
                {selectedPresetLabel !== "Starting blank" && (
                  <> &rsaquo; {selectedPresetLabel}</>
                )}
              </span>
            </p>

            <div className="wizard__fields">
              <label className="field field--required">
                <span>Asset name *</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. "Main Truck", "Upstairs AC"`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      handleSubmit();
                    }
                  }}
                />
              </label>

              {quickFieldDefs.map((field) => (
                <label key={field.name} className="field">
                  <span>{field.label}</span>
                  <input
                    type="text"
                    value={quickFields[field.name] ?? ""}
                    onChange={(e) =>
                      setQuickFields((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>

            {error && <p className="inline-error" role="alert">{error}</p>}

            <div className="wizard__submit-row">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setStep(2)}
                disabled={isPending}
              >
                ← Back
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={handleSubmit}
                disabled={isPending || !name.trim()}
              >
                {isPending ? "Creating…" : "Create Asset →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
