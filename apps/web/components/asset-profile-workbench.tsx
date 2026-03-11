"use client";

import type {
  Asset,
  AssetCategory,
  AssetFieldDefinition,
  AssetFieldType,
  AssetFieldValue,
  AssetTypeSource,
  CustomPresetProfile,
  LibraryPreset,
  PresetScheduleTemplate,
  PresetUsageMetricTemplate
} from "@lifekeeper/types";
import type { JSX } from "react";
import { useId, useState } from "react";

type AssetProfileWorkbenchProps = {
  action: (formData: FormData) => void | Promise<void>;
  householdId: string;
  submitLabel: string;
  libraryPresets: LibraryPreset[];
  customPresets: CustomPresetProfile[];
  initialAsset?: Asset;
};

type Blueprint = {
  id: string;
  source: "library" | "custom";
  key: string;
  presetProfileId?: string;
  label: string;
  category: AssetCategory;
  description: string | undefined;
  fieldDefinitions: AssetFieldDefinition[];
  metricTemplates: PresetUsageMetricTemplate[];
  scheduleTemplates: PresetScheduleTemplate[];
};

const categoryOptions: Array<{ value: AssetCategory; label: string }> = [
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "marine", label: "Marine" },
  { value: "yard", label: "Yard & Garden" },
  { value: "workshop", label: "Workshop & Tools" },
  { value: "appliance", label: "Appliance" },
  { value: "hvac", label: "HVAC" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" }
];

const fieldTypeOptions: Array<{ value: AssetFieldType; label: string }> = [
  { value: "string", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "url", label: "Link / URL" }
];

const commonDefaultFields: AssetFieldDefinition[] = [
  {
    key: "purchase-price",
    label: "Purchase Price",
    type: "currency",
    required: false,
    wide: false,
    order: 0,
    options: [],
    defaultValue: null,
    unit: "$",
    placeholder: "0.00",
    group: "Purchase & Warranty",
  },
  {
    key: "warranty-expiration",
    label: "Warranty Expiration",
    type: "date",
    required: false,
    wide: false,
    order: 1,
    options: [],
    defaultValue: null,
    group: "Purchase & Warranty",
  },
  {
    key: "where-purchased",
    label: "Where Purchased",
    type: "string",
    required: false,
    wide: false,
    order: 2,
    options: [],
    defaultValue: null,
    placeholder: "Home Depot, Amazon, dealer, etc.",
    group: "Purchase & Warranty",
  },
  {
    key: "storage-location",
    label: "Storage Location",
    type: "string",
    required: false,
    wide: false,
    order: 3,
    options: [],
    defaultValue: null,
    placeholder: "Garage, Shed, Basement, Closet, etc.",
    group: "Location & Condition",
  },
  {
    key: "condition",
    label: "Condition",
    type: "select",
    required: false,
    wide: false,
    order: 4,
    options: [
      { label: "New", value: "new" },
      { label: "Excellent", value: "excellent" },
      { label: "Good", value: "good" },
      { label: "Fair", value: "fair" },
      { label: "Poor", value: "poor" },
      { label: "Needs Repair", value: "needs-repair" },
    ],
    defaultValue: null,
    group: "Location & Condition",
  },
];

const slugify = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

const toAssetFieldDefinition = (field: LibraryPreset["suggestedCustomFields"][number] | CustomPresetProfile["suggestedCustomFields"][number], index: number): AssetFieldDefinition => ({
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,
  helpText: field.helpText,
  placeholder: field.placeholder,
  unit: field.unit,
  group: field.group,
  wide: field.wide,
  order: field.order ?? index,
  options: field.options.map((option) => ({
    label: option,
    value: option
  })),
  defaultValue: field.defaultValue
});

const buildDefaultFieldValue = (field: AssetFieldDefinition): AssetFieldValue => {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  switch (field.type) {
    case "boolean":
      return false;
    case "multiselect":
      return [];
    default:
      return null;
  }
};

const buildFieldValueMap = (
  fieldDefinitions: AssetFieldDefinition[],
  existingValues?: Record<string, AssetFieldValue>
): Record<string, AssetFieldValue> => {
  const nextValues: Record<string, AssetFieldValue> = {};

  for (const field of fieldDefinitions) {
    const hasExistingValue = existingValues
      ? Object.prototype.hasOwnProperty.call(existingValues, field.key)
      : false;

    nextValues[field.key] = hasExistingValue
      ? existingValues![field.key]!
      : buildDefaultFieldValue(field);
  }

  return nextValues;
};

const createFieldDefinition = (): AssetFieldDefinition => ({
  key: "",
  label: "",
  type: "string",
  required: false,
  wide: false,
  order: 0,
  options: [],
  defaultValue: null
});

const mergeFieldDefinitions = (
  templateFields: AssetFieldDefinition[],
  defaults: AssetFieldDefinition[]
): AssetFieldDefinition[] => {
  const templateKeys = new Set(templateFields.map((f) => f.key));
  const extraDefaults = defaults.filter((f) => !templateKeys.has(f.key));
  return [...templateFields, ...extraDefaults].map((f, i) => ({ ...f, order: i }));
};

const renderFieldValueInput = (
  field: AssetFieldDefinition,
  value: AssetFieldValue,
  onChange: (nextValue: AssetFieldValue) => void
): JSX.Element => {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={4}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? "Enter details"}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
    case "currency":
      return (
        <input
          type="number"
          step="0.01"
          value={typeof value === "number" ? String(value) : ""}
          placeholder={field.placeholder ?? "0"}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        />
      );
    case "boolean":
      return (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
      );
    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Select...</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    case "multiselect":
      return (
        <select
          multiple
          value={Array.isArray(value) ? value : []}
          onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    case "url":
      return (
        <input
          type="url"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? "https://"}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
};

export function AssetProfileWorkbench({
  action,
  householdId,
  submitLabel,
  libraryPresets,
  customPresets,
  initialAsset
}: AssetProfileWorkbenchProps): JSX.Element {
  const inputIdPrefix = useId();
  const libraryBlueprints: Blueprint[] = libraryPresets.map((preset) => ({
    id: `library:${preset.key}`,
    source: "library",
    key: preset.key,
    label: preset.label,
    category: preset.category,
    description: preset.description,
    fieldDefinitions: preset.suggestedCustomFields.map(toAssetFieldDefinition),
    metricTemplates: preset.metricTemplates,
    scheduleTemplates: preset.scheduleTemplates
  }));
  const customBlueprints: Blueprint[] = customPresets.map((preset) => ({
    id: `custom:${preset.id}`,
    source: "custom",
    key: preset.key,
    presetProfileId: preset.id,
    label: preset.label,
    category: preset.category,
    description: preset.description ?? undefined,
    fieldDefinitions: preset.suggestedCustomFields.map(toAssetFieldDefinition),
    metricTemplates: preset.metricTemplates,
    scheduleTemplates: preset.scheduleTemplates
  }));
  const blueprintOptions = [...libraryBlueprints, ...customBlueprints];

  const initialBlueprint = initialAsset?.assetTypeSource === "library"
    ? libraryBlueprints.find((preset) => preset.key === initialAsset.assetTypeKey)
    : initialAsset?.assetTypeSource === "custom"
      ? customBlueprints.find((preset) => preset.key === initialAsset.assetTypeKey)
      : undefined;

  const initialFieldDefs = initialAsset
    ? (initialAsset.fieldDefinitions.length ? initialAsset.fieldDefinitions : commonDefaultFields)
    : initialBlueprint
      ? mergeFieldDefinitions(initialBlueprint.fieldDefinitions, commonDefaultFields)
      : commonDefaultFields;

  const [category, setCategory] = useState<AssetCategory>(initialAsset?.category ?? initialBlueprint?.category ?? "vehicle");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(initialBlueprint?.id ?? "");
  const [fieldDefinitions, setFieldDefinitions] = useState<AssetFieldDefinition[]>(initialFieldDefs);
  const [fieldValues, setFieldValues] = useState<Record<string, AssetFieldValue>>(
    initialAsset
      ? buildFieldValueMap(initialFieldDefs, initialAsset.customFields)
      : buildFieldValueMap(initialFieldDefs)
  );
  const [assetTypeLabel, setAssetTypeLabel] = useState(initialAsset?.assetTypeLabel ?? initialBlueprint?.label ?? "");
  const [assetTypeDescription, setAssetTypeDescription] = useState(initialAsset?.assetTypeDescription ?? initialBlueprint?.description ?? "");
  const [metricTemplates, setMetricTemplates] = useState<PresetUsageMetricTemplate[]>(initialBlueprint?.metricTemplates ?? []);
  const [scheduleTemplates, setScheduleTemplates] = useState<PresetScheduleTemplate[]>(initialBlueprint?.scheduleTemplates ?? []);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedBlueprint = blueprintOptions.find((preset) => preset.id === selectedBlueprintId);
  const assetTypeSource: AssetTypeSource = selectedBlueprint
    ? selectedBlueprint.source
    : fieldDefinitions.length > 0
      ? "inline"
      : "manual";
  const assetTypeKey = selectedBlueprint?.key ?? (assetTypeLabel ? slugify(assetTypeLabel) : "");

  const handleBlueprintChange = (nextId: string): void => {
    setSelectedBlueprintId(nextId);

    const nextBlueprint = blueprintOptions.find((preset) => preset.id === nextId);

    if (!nextBlueprint) {
      setMetricTemplates([]);
      setScheduleTemplates([]);
      setAssetTypeLabel("");
      setAssetTypeDescription("");
      setFieldDefinitions(commonDefaultFields);
      setFieldValues(buildFieldValueMap(commonDefaultFields));
      return;
    }

    setCategory(nextBlueprint.category);
    setAssetTypeLabel(nextBlueprint.label);
    setAssetTypeDescription(nextBlueprint.description ?? "");
    setMetricTemplates(nextBlueprint.metricTemplates);
    setScheduleTemplates(nextBlueprint.scheduleTemplates);
    const merged = mergeFieldDefinitions(nextBlueprint.fieldDefinitions, commonDefaultFields);
    setFieldDefinitions(merged);
    setFieldValues(buildFieldValueMap(merged));
  };

  const updateFieldDefinition = (index: number, update: Partial<AssetFieldDefinition>): void => {
    setFieldDefinitions((currentDefinitions) => {
      const nextDefinitions = [...currentDefinitions];
      const previousField = nextDefinitions[index];

      if (!previousField) {
        return currentDefinitions;
      }

      const nextField: AssetFieldDefinition = {
        ...previousField,
        ...update,
        order: index
      };

      nextDefinitions[index] = nextField;

      if (update.key !== undefined && update.key !== previousField.key) {
        const nextKey = update.key;

        setFieldValues((currentValues) => {
          const nextValues = { ...currentValues };
          const existingValue = nextValues[previousField.key];
          delete nextValues[previousField.key];
          nextValues[nextKey] = existingValue ?? buildDefaultFieldValue(nextField);
          return nextValues;
        });
      }

      if (update.type !== undefined) {
        setFieldValues((currentValues) => ({
          ...currentValues,
          [nextField.key]: buildDefaultFieldValue(nextField)
        }));
      }

      return nextDefinitions;
    });
  };

  const removeFieldDefinition = (index: number): void => {
    setFieldDefinitions((currentDefinitions) => {
      const nextDefinitions = [...currentDefinitions];
      const [removedField] = nextDefinitions.splice(index, 1);

      if (!removedField) {
        return currentDefinitions;
      }

      setFieldValues((currentValues) => {
        const nextValues = { ...currentValues };
        delete nextValues[removedField.key];
        return nextValues;
      });

      return nextDefinitions.map((field, fieldIndex) => ({
        ...field,
        order: fieldIndex
      }));
    });
  };

  const addFieldDefinition = (): void => {
    setFieldDefinitions((currentDefinitions) => {
      const nextField = {
        ...createFieldDefinition(),
        order: currentDefinitions.length
      };

      setFieldValues((currentValues) => ({
        ...currentValues,
        [nextField.key]: buildDefaultFieldValue(nextField)
      }));

      return [...currentDefinitions, nextField];
    });
  };

  const fieldDefinitionJson = JSON.stringify(fieldDefinitions.map((field, index) => ({
    ...field,
    order: index,
    options: field.options.filter((option) => option.value.trim().length > 0)
  })).filter((field) => field.key.trim().length > 0 && field.label.trim().length > 0));

  const fieldValuesJson = JSON.stringify(
    Object.fromEntries(
      fieldDefinitions
        .filter((field) => field.key.trim().length > 0)
        .map((field) => [field.key, fieldValues[field.key] ?? buildDefaultFieldValue(field)])
    )
  );

  return (
    <form action={action} className="asset-studio">
      {initialAsset ? <input type="hidden" name="assetId" value={initialAsset.id} /> : null}
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="fieldDefinitionsJson" value={fieldDefinitionJson} />
      <input type="hidden" name="fieldValuesJson" value={fieldValuesJson} />
      <input type="hidden" name="assetTypeSource" value={assetTypeSource} />
      <input type="hidden" name="assetTypeVersion" value="1" />
      <input type="hidden" name="assetTypeKey" value={assetTypeKey} />
      <input type="hidden" name="assetTypeLabel" value={assetTypeLabel} />
      <input type="hidden" name="assetTypeDescription" value={assetTypeDescription} />
      <input type="hidden" name="presetSource" value={selectedBlueprint?.source ?? ""} />
      <input type="hidden" name="presetKey" value={selectedBlueprint?.source === "library" ? selectedBlueprint.key : ""} />
      <input type="hidden" name="presetProfileId" value={selectedBlueprint?.source === "custom" ? selectedBlueprint.presetProfileId ?? "" : ""} />
      <input type="hidden" name="metricTemplatesJson" value={JSON.stringify(metricTemplates)} />
      <input type="hidden" name="scheduleTemplatesJson" value={JSON.stringify(scheduleTemplates)} />
      <input type="hidden" name="saveAsPreset" value={saveAsPreset ? "true" : "false"} />

      {/* ── Section 1: Basic Information ── */}
      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Basic Information</h2>
          <button type="submit" className="button button--primary">{submitLabel}</button>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Asset Name *</span>
            <input type="text" name="name" defaultValue={initialAsset?.name ?? ""} placeholder='e.g. "Riding Mower", "Water Heater", "Family SUV"' required />
          </label>

          <label className="field">
            <span>Category</span>
            <select name="category" value={category} onChange={(event) => setCategory(event.target.value as AssetCategory)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Start from Template</span>
            <select value={selectedBlueprintId} onChange={(event) => handleBlueprintChange(event.target.value)}>
              <option value="">None (blank)</option>
              {libraryBlueprints.length > 0 && (
                <optgroup label="Built-in Templates">
                  {libraryBlueprints.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </optgroup>
              )}
              {customBlueprints.length > 0 && (
                <optgroup label="My Templates">
                  {customBlueprints.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <small>Templates pre-fill extra fields for common asset types</small>
          </label>
        </div>
      </section>

      {/* ── Section 2: Asset Details ── */}
      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Details</h2>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Manufacturer / Brand</span>
            <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder='e.g. "Honda", "Samsung", "DeWalt"' />
          </label>

          <label className="field">
            <span>Model</span>
            <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder='e.g. "HRX217", "RF28R7351SR"' />
          </label>

          <label className="field">
            <span>Serial Number</span>
            <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="For warranty claims and service records" />
          </label>

          <label className="field">
            <span>Purchase Date</span>
            <input type="date" name="purchaseDate" defaultValue={initialAsset?.purchaseDate ? initialAsset.purchaseDate.slice(0, 10) : ""} />
          </label>

          <label className="field">
            <span>Visibility</span>
            <select name="visibility" defaultValue={initialAsset?.visibility ?? "shared"}>
              <option value="shared">Shared (visible to household)</option>
              <option value="personal">Personal (only you)</option>
            </select>
          </label>

          <label className="field field--full">
            <span>Notes</span>
            <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Anything helpful: where it&#39;s installed, special considerations, included accessories..." />
          </label>
        </div>
      </section>

      {/* ── Section 3: Extra details from field definitions ── */}
      {fieldDefinitions.length > 0 && (
        <section className="panel panel--studio">
          <div className="panel-header">
            <h2>Additional Details</h2>
          </div>

          <div className="form-grid">
            {fieldDefinitions.map((field, index) => (
              <label key={`${field.key}-${index}`} className={`field${field.wide ? " field--full" : ""}`}>
                <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                  setFieldValues((currentValues) => ({
                    ...currentValues,
                    [field.key]: nextValue
                  }));
                })}
                {field.helpText ? <small>{field.helpText}</small> : null}
              </label>
            ))}
          </div>
        </section>
      )}

      {/* ── Advanced Section (collapsed by default) ── */}
      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Advanced</h2>
          <button type="button" className="button button--ghost button--sm" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>
        </div>

        {showAdvanced && (
          <div className="asset-studio" style={{ gap: 16 }}>
            {/* Custom field editor */}
            <div>
              <div className="panel-header" style={{ paddingBottom: 8 }}>
                <h3>Customize Fields</h3>
                <button type="button" className="button button--ghost button--sm" onClick={addFieldDefinition}>+ Add field</button>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 12px" }}>
                Add, remove, or edit the extra detail fields for this asset. Changes here update the &ldquo;Additional Details&rdquo; section above.
              </p>

              {fieldDefinitions.length === 0 ? (
                <p className="empty-state">No extra fields. Click &ldquo;+ Add field&rdquo; to add one.</p>
              ) : (
                <div className="asset-studio__field-stack">
                  {fieldDefinitions.map((field, index) => {
                    const baseId = `${inputIdPrefix}-${index}`;
                    const optionsValue = field.options.map((option) => option.value).join(", ");

                    return (
                      <article key={`${baseId}-${index}`} className="asset-studio__field-card">
                        <div className="asset-studio__field-card-header">
                          <h3>{field.label || "Untitled field"}</h3>
                          <button type="button" className="button button--subtle button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                        </div>

                        <div className="form-grid">
                          <label className="field">
                            <span>Label</span>
                            <input
                              id={`${baseId}-label`}
                              type="text"
                              value={field.label}
                              onChange={(event) => updateFieldDefinition(index, {
                                label: event.target.value,
                                key: field.key || slugify(event.target.value)
                              })}
                              placeholder='e.g. "VIN", "Fuel Type", "Filter Size"'
                            />
                          </label>

                          <label className="field">
                            <span>Field Type</span>
                            <select
                              id={`${baseId}-type`}
                              value={field.type}
                              onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}
                            >
                              {fieldTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          {(field.type === "select" || field.type === "multiselect") && (
                            <label className="field field--full">
                              <span>Options (comma separated)</span>
                              <input
                                type="text"
                                value={optionsValue}
                                onChange={(event) => updateFieldDefinition(index, {
                                  options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((option) => ({
                                    label: option,
                                    value: option
                                  }))
                                })}
                                placeholder="gasoline, diesel, electric"
                              />
                            </label>
                          )}

                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(event) => updateFieldDefinition(index, { required: event.target.checked })}
                            />
                            <span>Required</span>
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save as template */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div className="panel-header" style={{ paddingBottom: 8 }}>
                <h3>Save as Reusable Template</h3>
                <label className="checkbox-field">
                  <input type="checkbox" checked={saveAsPreset} onChange={(event) => setSaveAsPreset(event.target.checked)} />
                  <span>Save this setup as a template</span>
                </label>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 12px" }}>
                Re-use these fields next time you add a similar asset.
              </p>

              {saveAsPreset && (
                <div className="form-grid">
                  <label className="field">
                    <span>Template Name</span>
                    <input type="text" name="presetLabel" defaultValue={assetTypeLabel} placeholder='e.g. "My Vehicle Profile"' required={saveAsPreset} />
                  </label>

                  <label className="field field--full">
                    <span>Description</span>
                    <textarea name="presetDescription" rows={2} defaultValue={assetTypeDescription} placeholder="What this template is for" />
                  </label>

                  <label className="field field--full">
                    <span>Tags (comma separated)</span>
                    <input type="text" name="presetTags" placeholder="vehicle, outdoor, power-tool" />
                  </label>
                  <input type="hidden" name="presetKeyOverride" value={assetTypeKey} />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Submit ── */}
      <div className="inline-actions inline-actions--end">
        <button type="submit" className="button button--primary" style={{ padding: "12px 32px", fontSize: "1rem" }}>{submitLabel}</button>
      </div>
    </form>
  );
}
