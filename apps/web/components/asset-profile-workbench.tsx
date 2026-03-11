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
  { value: "yard", label: "Yard" },
  { value: "workshop", label: "Workshop" },
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
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "url", label: "URL" }
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
          <option value="">Select</option>
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
          placeholder={field.placeholder ?? "Enter value"}
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

  const [category, setCategory] = useState<AssetCategory>(initialAsset?.category ?? initialBlueprint?.category ?? "vehicle");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(initialBlueprint?.id ?? "");
  const [fieldDefinitions, setFieldDefinitions] = useState<AssetFieldDefinition[]>(
    initialAsset?.fieldDefinitions.length
      ? initialAsset.fieldDefinitions
      : initialBlueprint?.fieldDefinitions ?? []
  );
  const [fieldValues, setFieldValues] = useState<Record<string, AssetFieldValue>>(
    initialAsset
      ? buildFieldValueMap(initialAsset.fieldDefinitions, initialAsset.customFields)
      : buildFieldValueMap(initialBlueprint?.fieldDefinitions ?? [])
  );
  const [assetTypeLabel, setAssetTypeLabel] = useState(initialAsset?.assetTypeLabel ?? initialBlueprint?.label ?? "");
  const [assetTypeDescription, setAssetTypeDescription] = useState(initialAsset?.assetTypeDescription ?? initialBlueprint?.description ?? "");
  const [metricTemplates, setMetricTemplates] = useState<PresetUsageMetricTemplate[]>(initialBlueprint?.metricTemplates ?? []);
  const [scheduleTemplates, setScheduleTemplates] = useState<PresetScheduleTemplate[]>(initialBlueprint?.scheduleTemplates ?? []);
  const [saveAsPreset, setSaveAsPreset] = useState(false);

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
      setFieldDefinitions([]);
      setFieldValues({});
      return;
    }

    setCategory(nextBlueprint.category);
    setAssetTypeLabel(nextBlueprint.label);
    setAssetTypeDescription(nextBlueprint.description ?? "");
    setMetricTemplates(nextBlueprint.metricTemplates);
    setScheduleTemplates(nextBlueprint.scheduleTemplates);
    setFieldDefinitions(nextBlueprint.fieldDefinitions);
    setFieldValues(buildFieldValueMap(nextBlueprint.fieldDefinitions));
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

      <section className="panel panel--studio">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Asset intake</p>
            <h2>{submitLabel}</h2>
          </div>
          <p className="ops-panel__copy">Choose a reusable asset blueprint or build one inline. The field schema below becomes part of the asset record.</p>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Name</span>
            <input type="text" name="name" defaultValue={initialAsset?.name ?? ""} placeholder="Primary vehicle" required />
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
            <span>Visibility</span>
            <select name="visibility" defaultValue={initialAsset?.visibility ?? "shared"}>
              <option value="shared">Shared</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <label className="field">
            <span>Manufacturer</span>
            <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder="Ford" />
          </label>

          <label className="field">
            <span>Model</span>
            <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder="F-150" />
          </label>

          <label className="field">
            <span>Serial number</span>
            <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="Optional" />
          </label>

          <label className="field">
            <span>Purchase date</span>
            <input type="date" name="purchaseDate" defaultValue={initialAsset?.purchaseDate ? initialAsset.purchaseDate.slice(0, 10) : ""} />
          </label>

          <label className="field field--full">
            <span>Description</span>
            <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Notes, location context, trim, ownership details, or operational scope" />
          </label>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Asset type</p>
            <h2>Blueprint and form version</h2>
          </div>
          <p className="ops-panel__copy">Library presets provide structured starting points. Household presets are your reusable custom asset types.</p>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Starting blueprint</span>
            <select value={selectedBlueprintId} onChange={(event) => handleBlueprintChange(event.target.value)}>
              <option value="">Blank custom asset</option>
              <optgroup label="Library blueprints">
                {libraryBlueprints.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
              <optgroup label="Household blueprints">
                {customBlueprints.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="field">
            <span>Asset type label</span>
            <input
              type="text"
              value={assetTypeLabel}
              onChange={(event) => setAssetTypeLabel(event.target.value)}
              placeholder="Tow vehicle / boiler / camera rig"
            />
          </label>

          <label className="field">
            <span>Asset type key</span>
            <input type="text" value={assetTypeKey} readOnly />
          </label>

          <label className="field field--full">
            <span>Type description</span>
            <textarea
              rows={3}
              value={assetTypeDescription}
              onChange={(event) => setAssetTypeDescription(event.target.value)}
              placeholder="What this asset type covers, what details matter, and how it should be maintained"
            />
          </label>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Detail fields</p>
            <h2>Structured asset schema</h2>
          </div>
          <button type="button" className="button button--ghost" onClick={addFieldDefinition}>Add field</button>
        </div>

        {fieldDefinitions.length === 0 ? (
          <p className="empty-state">No detail fields yet. Add fields for whatever matters to this asset type: configuration, location, consumables, compliance data, URLs, or owner notes.</p>
        ) : (
          <div className="asset-studio__field-stack">
            {fieldDefinitions.map((field, index) => {
              const baseId = `${inputIdPrefix}-${index}`;
              const optionsValue = field.options.map((option) => option.value).join(", ");

              return (
                <article key={`${baseId}-${index}`} className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <p className="eyebrow">Field {index + 1}</p>
                      <h3>{field.label || "Untitled field"}</h3>
                    </div>
                    <button type="button" className="button button--subtle" onClick={() => removeFieldDefinition(index)}>Remove</button>
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
                        placeholder="VIN"
                      />
                    </label>

                    <label className="field">
                      <span>Key</span>
                      <input
                        id={`${baseId}-key`}
                        type="text"
                        value={field.key}
                        onChange={(event) => updateFieldDefinition(index, { key: slugify(event.target.value) })}
                        placeholder="vin"
                      />
                    </label>

                    <label className="field">
                      <span>Type</span>
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

                    <label className="field">
                      <span>Group</span>
                      <input
                        type="text"
                        value={field.group ?? ""}
                        onChange={(event) => updateFieldDefinition(index, { group: event.target.value || undefined })}
                        placeholder="Identity / service / storage"
                      />
                    </label>

                    <label className="field">
                      <span>Unit</span>
                      <input
                        type="text"
                        value={field.unit ?? ""}
                        onChange={(event) => updateFieldDefinition(index, { unit: event.target.value || undefined })}
                        placeholder="miles / amps / gallons"
                      />
                    </label>

                    <label className="field">
                      <span>Placeholder</span>
                      <input
                        type="text"
                        value={field.placeholder ?? ""}
                        onChange={(event) => updateFieldDefinition(index, { placeholder: event.target.value || undefined })}
                        placeholder="Enter a value"
                      />
                    </label>

                    <label className="field field--full">
                      <span>Help text</span>
                      <input
                        type="text"
                        value={field.helpText ?? ""}
                        onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value || undefined })}
                        placeholder="Explain what belongs in this field"
                      />
                    </label>

                    {field.type === "select" || field.type === "multiselect" ? (
                      <label className="field field--full">
                        <span>Options</span>
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
                    ) : null}

                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateFieldDefinition(index, { required: event.target.checked })}
                      />
                      <span>Required</span>
                    </label>

                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={field.wide}
                        onChange={(event) => updateFieldDefinition(index, { wide: event.target.checked })}
                      />
                      <span>Wide field</span>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Current values</p>
            <h2>Fill the asset details</h2>
          </div>
          <p className="ops-panel__copy">These values are stored against the resolved schema above, so each asset can have a rich detail surface without hardcoding every asset type.</p>
        </div>

        {fieldDefinitions.length === 0 ? (
          <p className="empty-state">Add schema fields first, then fill their values here.</p>
        ) : (
          <div className="form-grid">
            {fieldDefinitions.map((field, index) => (
              <label key={`${field.key}-${index}`} className={`field${field.wide ? " field--full" : ""}`}>
                <span>{field.label}</span>
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
        )}
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Reusable form</p>
            <h2>Save as household blueprint</h2>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={saveAsPreset} onChange={(event) => setSaveAsPreset(event.target.checked)} />
            <span>Save this schema as a reusable asset type</span>
          </label>
        </div>

        {saveAsPreset ? (
          <div className="form-grid">
            <label className="field">
              <span>Blueprint label</span>
              <input type="text" name="presetLabel" defaultValue={assetTypeLabel} placeholder="Tow vehicle profile" required={saveAsPreset} />
            </label>

            <label className="field">
              <span>Optional key override</span>
              <input type="text" name="presetKeyOverride" defaultValue={assetTypeKey} placeholder="tow-vehicle-profile" />
            </label>

            <label className="field field--full">
              <span>Description</span>
              <textarea name="presetDescription" rows={3} defaultValue={assetTypeDescription} placeholder="What this type is for and which details it expects" />
            </label>

            <label className="field field--full">
              <span>Tags</span>
              <input type="text" name="presetTags" placeholder="vehicle, towing, fleet" />
            </label>
          </div>
        ) : null}
      </section>

      <div className="inline-actions inline-actions--end">
        <button type="submit" className="button button--primary">{submitLabel}</button>
      </div>
    </form>
  );
}
