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
  householdAssets: Asset[];
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

type CoreDetailField = {
  id: string;
  section?: string;
  render: () => JSX.Element;
};

type AssetLayoutMode = "cards" | "compact" | "industrial";

const categoryOptions: Array<{ value: AssetCategory; label: string }> = [
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "marine", label: "Marine" },
  { value: "aircraft", label: "Aircraft" },
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

const assetLayoutModeOptions: Array<{ value: AssetLayoutMode; label: string }> = [
  { value: "cards", label: "Cards" },
  { value: "compact", label: "Compact" },
  { value: "industrial", label: "Dense" }
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

const sharedSuggestedFields: AssetFieldDefinition[] = [
  {
    key: "installed-date",
    label: "Installed Date",
    type: "date",
    required: false,
    wide: false,
    order: 5,
    options: [],
    defaultValue: null,
    group: "Location & Condition"
  },
  {
    key: "service-provider",
    label: "Service Provider",
    type: "string",
    required: false,
    wide: false,
    order: 6,
    options: [],
    defaultValue: null,
    placeholder: "Installer, dealer, contractor, shop",
    group: "Purchase & Warranty"
  },
  {
    key: "manual-link",
    label: "Manual / Reference Link",
    type: "url",
    required: false,
    wide: true,
    order: 7,
    options: [],
    defaultValue: null,
    placeholder: "https://",
    group: "Records"
  },
  {
    key: "parts-model",
    label: "Replacement Part Model",
    type: "string",
    required: false,
    wide: false,
    order: 8,
    options: [],
    defaultValue: null,
    placeholder: "Filter, battery, blade, belt, etc.",
    group: "Parts & Supplies"
  },
  {
    key: "service-notes",
    label: "Service Notes",
    type: "textarea",
    required: false,
    wide: true,
    order: 9,
    options: [],
    defaultValue: null,
    placeholder: "Preferred service intervals, known issues, special steps",
    group: "Records"
  }
];

const categorySuggestedFields: Partial<Record<AssetCategory, AssetFieldDefinition[]>> = {
  vehicle: [
    {
      key: "vin",
      label: "VIN",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Identifiers"
    },
    {
      key: "year",
      label: "Year",
      type: "number",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "license-plate",
      label: "License Plate",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Identifiers"
    },
    {
      key: "fuel-type",
      label: "Fuel Type",
      type: "select",
      required: false,
      wide: false,
      order: 3,
      options: [
        { label: "Gasoline", value: "gasoline" },
        { label: "Diesel", value: "diesel" },
        { label: "Hybrid", value: "hybrid" },
        { label: "Electric", value: "electric" },
        { label: "Other", value: "other" }
      ],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "registration-renewal",
      label: "Registration Renewal",
      type: "date",
      required: false,
      wide: false,
      order: 4,
      options: [],
      defaultValue: null,
      group: "Records"
    }
  ],
  home: [
    {
      key: "room-area",
      label: "Room / Area",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Location & Condition"
    },
    {
      key: "installer",
      label: "Installer",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Purchase & Warranty"
    },
    {
      key: "material-finish",
      label: "Material / Finish",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Specifications"
    }
  ],
  marine: [
    {
      key: "hull-id",
      label: "Hull ID",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Identifiers"
    },
    {
      key: "length",
      label: "Length",
      type: "number",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      unit: "ft",
      group: "Specifications"
    },
    {
      key: "dock-slip",
      label: "Dock / Slip",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Location & Condition"
    }
  ],
  aircraft: [],
  yard: [
    {
      key: "power-source",
      label: "Power Source",
      type: "select",
      required: false,
      wide: false,
      order: 0,
      options: [
        { label: "Gas", value: "gas" },
        { label: "Battery", value: "battery" },
        { label: "Corded", value: "corded" },
        { label: "Manual", value: "manual" }
      ],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "blade-size",
      label: "Blade Size",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Parts & Supplies"
    },
    {
      key: "seasonal-storage",
      label: "Seasonal Storage Prep",
      type: "textarea",
      required: false,
      wide: true,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Location & Condition"
    }
  ],
  workshop: [
    {
      key: "voltage",
      label: "Voltage",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "accessory-system",
      label: "Accessory System",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Parts & Supplies"
    },
    {
      key: "shop-location",
      label: "Shop Location",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Location & Condition"
    }
  ],
  appliance: [
    {
      key: "capacity",
      label: "Capacity",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "finish-color",
      label: "Finish / Color",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "filter-model",
      label: "Filter Model",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Parts & Supplies"
    }
  ],
  hvac: [
    {
      key: "filter-size",
      label: "Filter Size",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Parts & Supplies"
    },
    {
      key: "tonnage",
      label: "Tonnage",
      type: "number",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      unit: "tons",
      group: "Specifications"
    },
    {
      key: "thermostat-model",
      label: "Thermostat Model",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Specifications"
    }
  ],
  technology: [
    {
      key: "operating-system",
      label: "Operating System",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "storage-capacity",
      label: "Storage Capacity",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "memory-ram",
      label: "Memory / RAM",
      type: "string",
      required: false,
      wide: false,
      order: 2,
      options: [],
      defaultValue: null,
      group: "Specifications"
    }
  ],
  other: [
    {
      key: "size",
      label: "Size",
      type: "string",
      required: false,
      wide: false,
      order: 0,
      options: [],
      defaultValue: null,
      group: "Specifications"
    },
    {
      key: "material",
      label: "Material",
      type: "string",
      required: false,
      wide: false,
      order: 1,
      options: [],
      defaultValue: null,
      group: "Specifications"
    }
  ]
};

const slugify = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

const cloneFieldDefinition = (field: AssetFieldDefinition): AssetFieldDefinition => ({
  ...field,
  options: field.options.map((option) => ({ ...option }))
});

const cloneFieldDefinitions = (fields: AssetFieldDefinition[]): AssetFieldDefinition[] => fields.map((field, index) => ({
  ...cloneFieldDefinition(field),
  order: index
}));

const getDistinctGroups = (fields: AssetFieldDefinition[]): string[] => Array.from(
  new Set(
    fields
      .map((field) => field.group?.trim())
      .filter((group): group is string => Boolean(group))
  )
);

const buildUniqueFieldKey = (
  preferred: string,
  existingKeys: string[],
  fallbackLabel = "detail"
): string => {
  const baseKey = slugify(preferred) || slugify(fallbackLabel) || "detail";
  let nextKey = baseKey;
  let counter = 2;

  while (existingKeys.includes(nextKey)) {
    nextKey = `${baseKey}-${counter}`;
    counter += 1;
  }

  return nextKey;
};

const dedupeSuggestedFields = (fields: AssetFieldDefinition[]): AssetFieldDefinition[] => {
  const byKey = new Map<string, AssetFieldDefinition>();

  for (const field of fields) {
    const normalizedKey = slugify(field.key) || slugify(field.label);

    if (!normalizedKey || byKey.has(normalizedKey)) {
      continue;
    }

    byKey.set(normalizedKey, cloneFieldDefinition(field));
  }

  return Array.from(byKey.values());
};

const getFieldTypeLabel = (type: AssetFieldType): string => fieldTypeOptions.find((option) => option.value === type)?.label ?? type;

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

const mergeFieldDefinitions = (templateFields: AssetFieldDefinition[]): AssetFieldDefinition[] => cloneFieldDefinitions(templateFields);

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
  householdAssets,
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
    ? cloneFieldDefinitions(initialAsset.fieldDefinitions)
    : initialBlueprint
      ? mergeFieldDefinitions(initialBlueprint.fieldDefinitions)
      : [];

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
  const [layoutMode, setLayoutMode] = useState<AssetLayoutMode>("cards");
  const [detailPickerValue, setDetailPickerValue] = useState("");
  const [detailTargetSection, setDetailTargetSection] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [manualSections, setManualSections] = useState<string[]>([]);
  const [expandedFieldEditors, setExpandedFieldEditors] = useState<number[]>([]);

  const selectedBlueprint = blueprintOptions.find((preset) => preset.id === selectedBlueprintId);
  const categoryLibraryBlueprints = libraryBlueprints.filter((preset) => preset.category === category);
  const categoryCustomBlueprints = customBlueprints.filter((preset) => preset.category === category);
  const availableParentAssets = householdAssets.filter((asset) => asset.id !== initialAsset?.id);
  const assetTypeSource: AssetTypeSource = selectedBlueprint
    ? selectedBlueprint.source
    : fieldDefinitions.length > 0
      ? "inline"
      : "manual";
  const assetTypeKey = selectedBlueprint?.key ?? (assetTypeLabel ? slugify(assetTypeLabel) : "");
﻿  const dynamicSections = getDistinctGroups(fieldDefinitions);
  const detailSections = Array.from(new Set([...dynamicSections, ...manualSections]));
  const blueprintSuggestionFields = selectedBlueprint ? selectedBlueprint.fieldDefinitions : [];
  const suggestionPool = dedupeSuggestedFields(category === "aircraft" && selectedBlueprint
    ? [
      ...commonDefaultFields,
      ...sharedSuggestedFields,
      ...blueprintSuggestionFields
    ]
    : [
      ...commonDefaultFields,
      ...sharedSuggestedFields,
      ...(categorySuggestedFields[category] ?? []),
      ...blueprintSuggestionFields
    ]);
  const availableSuggestedFields = suggestionPool.filter((suggestion) => !fieldDefinitions.some((field) => field.key === suggestion.key));
  const groupedFieldDefinitions = fieldDefinitions.reduce<Record<string, Array<{ field: AssetFieldDefinition; index: number }>>>((groups, field, index) => {
    const key = field.group?.trim() || "General";

    if (!field.group?.trim()) {
      return groups;
    }

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push({ field, index });
    return groups;
  }, {});
  const unsectionedFieldDefinitions = fieldDefinitions
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !field.group?.trim());

  const handleBlueprintChange = (nextId: string): void => {
    setSelectedBlueprintId(nextId);
    setDetailPickerValue("");
    setDetailTargetSection("");
    setNewSectionName("");
    setManualSections([]);
    setExpandedFieldEditors([]);

    const nextBlueprint = blueprintOptions.find((preset) => preset.id === nextId);

    if (!nextBlueprint) {
      setMetricTemplates([]);
      setScheduleTemplates([]);
      setAssetTypeLabel("");
      setAssetTypeDescription("");
      const resetFields: AssetFieldDefinition[] = [];
      setFieldDefinitions(resetFields);
      setFieldValues(buildFieldValueMap(resetFields));
      return;
    }

    setCategory(nextBlueprint.category);
    setAssetTypeLabel(nextBlueprint.label);
    setAssetTypeDescription(nextBlueprint.description ?? "");
    setMetricTemplates(nextBlueprint.metricTemplates);
    setScheduleTemplates(nextBlueprint.scheduleTemplates);
    const merged = mergeFieldDefinitions(nextBlueprint.fieldDefinitions);
    setFieldDefinitions(merged);
    setFieldValues(buildFieldValueMap(merged));
  };

  const handleCategoryChange = (nextCategory: AssetCategory): void => {
    setCategory(nextCategory);

    if (selectedBlueprint && selectedBlueprint.category !== nextCategory) {
      handleBlueprintChange("");
    }
  };

  const removeSection = (sectionLabel: string): void => {
    setManualSections((current) => current.filter((section) => section !== sectionLabel));

    setFieldDefinitions((currentDefinitions) => currentDefinitions.map((field, index) => (
      field.group?.trim() === sectionLabel
        ? { ...field, group: undefined, order: index }
        : field
    )));

    setDetailTargetSection((current) => (current === sectionLabel ? "" : current));
  };

  const toggleFieldEditor = (index: number): void => {
    setExpandedFieldEditors((current) => current.includes(index)
      ? current.filter((value) => value !== index)
      : [...current, index]);
  };

  const handleFieldLabelChange = (index: number, nextLabel: string): void => {
    const currentField = fieldDefinitions[index];

    if (!currentField) {
      return;
    }

    const shouldRefreshKey = currentField.key.startsWith("custom-detail-");
    const nextKey = shouldRefreshKey
      ? buildUniqueFieldKey(nextLabel, fieldDefinitions.filter((_, fieldIndex) => fieldIndex !== index).map((field) => field.key), "detail")
      : currentField.key;

    updateFieldDefinition(index, {
      label: nextLabel,
      key: nextKey
    });
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

    setExpandedFieldEditors((current) => current
      .filter((value) => value !== index)
      .map((value) => (value > index ? value - 1 : value)));
  };

  const addFieldDefinition = (): void => {
    setFieldDefinitions((currentDefinitions) => {
      const nextKey = buildUniqueFieldKey("custom-detail", currentDefinitions.map((field) => field.key), "detail");
      const nextField = {
        ...createFieldDefinition(),
        key: nextKey,
        group: detailTargetSection || undefined,
        order: currentDefinitions.length
      };

      setFieldValues((currentValues) => ({
        ...currentValues,
        [nextField.key]: buildDefaultFieldValue(nextField)
      }));

      return [...currentDefinitions, nextField];
    });

    setExpandedFieldEditors((current) => [...current, fieldDefinitions.length]);
  };

  const addSuggestedField = (): void => {
    const nextSuggestion = availableSuggestedFields.find((field) => field.key === detailPickerValue);

    if (!nextSuggestion) {
      return;
    }

    setFieldDefinitions((currentDefinitions) => {
      const nextField = {
        ...cloneFieldDefinition(nextSuggestion),
        key: buildUniqueFieldKey(nextSuggestion.key, currentDefinitions.map((field) => field.key), nextSuggestion.label),
        group: detailTargetSection || undefined,
        order: currentDefinitions.length
      };

      setFieldValues((currentValues) => ({
        ...currentValues,
        [nextField.key]: buildDefaultFieldValue(nextField)
      }));

      return [...currentDefinitions, nextField];
    });

    setDetailPickerValue("");
  };

  const addSection = (): void => {
    const normalizedSection = newSectionName.trim();

    if (!normalizedSection || detailSections.includes(normalizedSection)) {
      return;
    }

    setManualSections((current) => [...current, normalizedSection]);
    setDetailTargetSection(normalizedSection);
    setNewSectionName("");
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
  const templateLabel = category === "aircraft" ? "Aircraft Subcategory" : "Start from Template";
  const templateDescription = selectedBlueprint?.description
    ?? (category === "aircraft"
      ? "Choose the aircraft family that matches the asset so the details, metrics, and maintenance profile fit the mission and systems on board."
      : "Templates can pre-fill recommended details for common asset types.");

﻿  return (
    <form action={action} className="asset-studio asset-studio--industrial">
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
          <h2>Core Identity</h2>
          <div className="panel-header__actions">
            <button type="submit" className="button button--primary">{submitLabel}</button>
          </div>
        </div>

        <div className="form-grid">
          <label className="field field--full">
            <span>Asset Name *</span>
            <input type="text" name="name" defaultValue={initialAsset?.name ?? ""} placeholder="e.g. &quot;Riding Mower&quot;, &quot;Family SUV&quot;" required />
          </label>

          <label className="field">
            <span>Category</span>
            <select name="category" value={category} onChange={(event) => handleCategoryChange(event.target.value as AssetCategory)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field field--full">
            <span>{templateLabel}</span>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <select style={{ flex: 1, maxWidth: '400px' }} value={selectedBlueprintId} onChange={(event) => handleBlueprintChange(event.target.value)}>
                <option value="">None (blank)</option>
                {categoryLibraryBlueprints.length > 0 && (
                  <optgroup label="Built-in Templates">
                    {categoryLibraryBlueprints.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </optgroup>
                )}
                {categoryCustomBlueprints.length > 0 && (
                  <optgroup label="My Templates">
                    {categoryCustomBlueprints.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <small style={{ flex: 2, padding: '4px', color: 'var(--ink-muted)' }}>{templateDescription}</small>
            </div>
          </label>

          <label className="field">
            <span>Manufacturer / Brand</span>
            <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder="e.g. &quot;Honda&quot;, &quot;Samsung&quot;" />
          </label>
          <label className="field">
            <span>Model</span>
            <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder="e.g. &quot;HRX217&quot;" />
          </label>
          <label className="field">
            <span>Serial Number</span>
            <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="For warranty claims" />
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
            <span>Description & Notes</span>
            <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Anything helpful..." />
          </label>
        </div>
      </section>

      <datalist id={`${inputIdPrefix}-detail-sections`}>
        {detailSections.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      {fieldDefinitions.length > 0 && (
        <section className="panel panel--studio">
          <div className="panel-header">
            <h2>Asset Specifications</h2>
          </div>
          <div className="asset-studio__detail-groups">
            {unsectionedFieldDefinitions.length > 0 && (
              <section className="asset-studio__detail-group">
                <div className="asset-studio__detail-grid">
                  {unsectionedFieldDefinitions.map(({ field, index }) => {
                    const optionsValue = field.options.map((option) => option.value).join(", ");
                    const isExpanded = expandedFieldEditors.includes(index);

                    return (
                      <article key={`${field.key}-${index}`} className="asset-studio__detail-slot" style={isExpanded ? { border: '1px solid var(--border)', background: 'var(--surface-sunken)', marginBottom: '8px' } : undefined}>
                        
                        <div className="asset-studio__detail-card-header">
                          <h4>{field.label || "New detail"}</h4>
                          <p>{field.helpText}</p>
                        </div>
                        
                        {isExpanded ? (
                          <label className="field" style={{ padding: '0 8px' }}>
                            <span>Detail name</span>
                            <input type="text" value={field.label} onChange={(event) => handleFieldLabelChange(index, event.target.value)} placeholder="e.g. &quot;VIN&quot;" />
                          </label>
                        ) : (
                          <div className={field.type === "boolean" ? "asset-studio__detail-value asset-studio__detail-value--boolean" : "field"}>
                            {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                              setFieldValues((currentValues) => ({...currentValues, [field.key]: nextValue}));
                            })}
                          </div>
                        )}
                        
                        <div className="inline-actions" style={{ paddingRight: '8px' }}>
                          <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                            {isExpanded ? "Done" : "Edit"}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="asset-studio__detail-settings grid-column-full" style={{ gridColumn: '1 / -1', padding: '1rem', background: 'var(--surface)', margin: '8px', border: '1px solid var(--border)', borderRadius: '4px', display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                            <label className="field">
                              <span>Format</span>
                              <select value={field.type} onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}>
                                {fieldTypeOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Section</span>
                              <input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })} />
                            </label>
                            <label className="field">
                              <span>Unit</span>
                              <input type="text" value={field.unit ?? ""} onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })} />
                            </label>
                            {(field.type === "select" || field.type === "multiselect") && (
                              <label className="field field--full">
                                <span>Options (comma separated)</span>
                                <input type="text" value={optionsValue} onChange={(event) => updateFieldDefinition(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((option) => ({label: option, value: option})) })} />
                              </label>
                            )}
                            <label className="field field--full" style={{ gridColumn: '1 / -1' }}>
                              <span>Help text</span>
                              <input type="text" value={field.helpText ?? ""} onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })} />
                            </label>
                            <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                              <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove Property</button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {detailSections.map((groupLabel) => {
              const fields = groupedFieldDefinitions[groupLabel] ?? [];
              if (fields.length === 0) return null;

              return (
                <section key={groupLabel} className="asset-studio__detail-group">
                  <div className="asset-studio__detail-group-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3>{groupLabel}</h3>
                    <button type="button" className="button button--ghost button--sm" onClick={() => removeSection(groupLabel)} style={{ padding: '0 4px', fontSize: '0.7rem' }}>Remove Section</button>
                  </div>

                  <div className="asset-studio__detail-grid">
                    {fields.map(({ field, index }) => {
                      const optionsValue = field.options.map((option) => option.value).join(", ");
                      const isExpanded = expandedFieldEditors.includes(index);

                      return (
                        <article key={`${field.key}-${index}`} className="asset-studio__detail-slot" style={isExpanded ? { border: '1px solid var(--border)', background: 'var(--surface-sunken)', marginBottom: '8px' } : undefined}>
                          
                          <div className="asset-studio__detail-card-header">
                            <h4>{field.label || "New detail"}</h4>
                            {field.helpText && <p>{field.helpText}</p>}
                          </div>
                          
                          {isExpanded ? (
                            <label className="field" style={{ padding: '0 8px' }}>
                              <span>Detail name</span>
                              <input type="text" value={field.label} onChange={(event) => handleFieldLabelChange(index, event.target.value)} />
                            </label>
                          ) : (
                            <div className={field.type === "boolean" ? "asset-studio__detail-value asset-studio__detail-value--boolean" : "field"}>
                              {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                                setFieldValues((currentValues) => ({...currentValues, [field.key]: nextValue}));
                              })}
                            </div>
                          )}
                          
                          <div className="inline-actions" style={{ paddingRight: '8px' }}>
                            <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                              {isExpanded ? "Done" : "Edit"}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="asset-studio__detail-settings grid-column-full" style={{ gridColumn: '1 / -1', padding: '1rem', background: 'var(--surface)', margin: '8px', border: '1px solid var(--border)', borderRadius: '4px', display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                              <label className="field">
                                <span>Format</span>
                                <select value={field.type} onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}>
                                  {fieldTypeOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Section</span>
                                <input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })} />
                              </label>
                              <label className="field">
                                <span>Unit</span>
                                <input type="text" value={field.unit ?? ""} onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })} />
                              </label>
                              {(field.type === "select" || field.type === "multiselect") && (
                                <label className="field field--full" style={{ gridColumn: '1 / -1' }}>
                                  <span>Options</span>
                                  <input type="text" value={optionsValue} onChange={(event) => updateFieldDefinition(index, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((option) => ({label: option, value: option})) })} />
                                </label>
                              )}
                              <label className="field field--full" style={{ gridColumn: '1 / -1' }}>
                                <span>Help text</span>
                                <input type="text" value={field.helpText ?? ""} onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })} />
                              </label>
                              <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
                                <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove Property</button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
            <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink-muted)' }}>Additional Details</div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select 
                style={{ flex: 1, minWidth: '200px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }} 
                value={detailPickerValue} 
                onChange={(event) => setDetailPickerValue(event.target.value)}
              >
                <option value="">Select built-in detail...</option>
                {availableSuggestedFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label} {field.group ? `(${field.group})` : ""}</option>
                ))}
              </select>
              <button type="button" className="button button--secondary" onClick={addSuggestedField} disabled={!detailPickerValue}>Add</button>
              
              <div style={{ width: '1px', height: '28px', background: 'var(--border)', margin: '0 4px' }} />
              
              <button type="button" className="button button--ghost" onClick={addFieldDefinition}>+ Custom Property</button>
            </div>
          </div>
        </section>
      )}

﻿      {/* Section 3: Lifecycle & Tracking */}
      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Lifecycle & Advanced Records</h2>
        </div>
        <p className="asset-studio__details-intro" style={{ marginBottom: '16px' }}>
          Expand sections to track location, purchase records, warranty status, and other lifetime details.
        </p>

        <div className="asset-studio__detail-groups">
          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Hierarchy & Condition</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field">
                <span>Parent Asset</span>
                <select name="parentAssetId" defaultValue={initialAsset?.parentAssetId ?? ""}>
                  <option value="">No parent asset</option>
                  {availableParentAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
                <small>Build hierarchies like property → system → component.</small>
              </label>
              <label className="field">
                <span>Condition Score</span>
                <input type="number" name="conditionScore" min="1" max="10" step="1" defaultValue={initialAsset?.conditionScore ?? ""} placeholder="1-10" />
              </label>
            </div>
          </details>

          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Purchase Details</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field"><span>Purchase Price</span><input type="number" name="purchaseDetails.price" min="0" step="0.01" defaultValue={initialAsset?.purchaseDetails?.price ?? ""} /></label>
              <label className="field"><span>Vendor</span><input type="text" name="purchaseDetails.vendor" defaultValue={initialAsset?.purchaseDetails?.vendor ?? ""} /></label>
              <label className="field"><span>Purchase Condition</span><select name="purchaseDetails.condition" defaultValue={initialAsset?.purchaseDetails?.condition ?? ""}><option value="">Unknown</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
              <label className="field"><span>Financing</span><input type="text" name="purchaseDetails.financing" defaultValue={initialAsset?.purchaseDetails?.financing ?? ""} /></label>
              <label className="field field--full"><span>Receipt Reference</span><input type="text" name="purchaseDetails.receiptRef" defaultValue={initialAsset?.purchaseDetails?.receiptRef ?? ""} /></label>
            </div>
          </details>

          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Warranty</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field"><span>Warranty Provider</span><input type="text" name="warrantyDetails.provider" defaultValue={initialAsset?.warrantyDetails?.provider ?? ""} /></label>
              <label className="field"><span>Policy / Contract</span><input type="text" name="warrantyDetails.policyNumber" defaultValue={initialAsset?.warrantyDetails?.policyNumber ?? ""} /></label>
              <label className="field"><span>Warranty Start</span><input type="date" name="warrantyDetails.startDate" defaultValue={initialAsset?.warrantyDetails?.startDate ? initialAsset.warrantyDetails.startDate.slice(0, 10) : ""} /></label>
              <label className="field"><span>Warranty End</span><input type="date" name="warrantyDetails.endDate" defaultValue={initialAsset?.warrantyDetails?.endDate ? initialAsset.warrantyDetails.endDate.slice(0, 10) : ""} /></label>
              <label className="field"><span>Coverage Type</span><input type="text" name="warrantyDetails.coverageType" defaultValue={initialAsset?.warrantyDetails?.coverageType ?? ""} /></label>
              <label className="field field--full"><span>Warranty Notes</span><textarea name="warrantyDetails.notes" rows={2} defaultValue={initialAsset?.warrantyDetails?.notes ?? ""} /></label>
            </div>
          </details>

          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Location & Property</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field"><span>Property</span><input type="text" name="locationDetails.propertyName" defaultValue={initialAsset?.locationDetails?.propertyName ?? ""} /></label>
              <label className="field"><span>Building</span><input type="text" name="locationDetails.building" defaultValue={initialAsset?.locationDetails?.building ?? ""} /></label>
              <label className="field"><span>Room / Area</span><input type="text" name="locationDetails.room" defaultValue={initialAsset?.locationDetails?.room ?? ""} /></label>
              <label className="field"><span>Latitude</span><input type="number" name="locationDetails.latitude" min="-90" max="90" step="0.000001" defaultValue={initialAsset?.locationDetails?.latitude ?? ""} /></label>
              <label className="field"><span>Longitude</span><input type="number" name="locationDetails.longitude" min="-180" max="180" step="0.000001" defaultValue={initialAsset?.locationDetails?.longitude ?? ""} /></label>
              <label className="field field--full"><span>Location Notes</span><textarea name="locationDetails.notes" rows={2} defaultValue={initialAsset?.locationDetails?.notes ?? ""} /></label>
            </div>
          </details>

          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Insurance</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field"><span>Insurance Provider</span><input type="text" name="insuranceDetails.provider" defaultValue={initialAsset?.insuranceDetails?.provider ?? ""} /></label>
              <label className="field"><span>Policy Number</span><input type="text" name="insuranceDetails.policyNumber" defaultValue={initialAsset?.insuranceDetails?.policyNumber ?? ""} /></label>
              <label className="field"><span>Coverage Amount</span><input type="number" name="insuranceDetails.coverageAmount" min="0" step="0.01" defaultValue={initialAsset?.insuranceDetails?.coverageAmount ?? ""} /></label>
              <label className="field"><span>Deductible</span><input type="number" name="insuranceDetails.deductible" min="0" step="0.01" defaultValue={initialAsset?.insuranceDetails?.deductible ?? ""} /></label>
              <label className="field"><span>Renewal Date</span><input type="date" name="insuranceDetails.renewalDate" defaultValue={initialAsset?.insuranceDetails?.renewalDate ? initialAsset.insuranceDetails.renewalDate.slice(0, 10) : ""} /></label>
              <label className="field field--full"><span>Insurance Notes</span><textarea name="insuranceDetails.notes" rows={2} defaultValue={initialAsset?.insuranceDetails?.notes ?? ""} /></label>
            </div>
          </details>

          <details className="asset-studio__detail-group">
            <summary className="asset-studio__detail-group-header" style={{ cursor: 'pointer', listStylePosition: 'inside' }}>
              <h3>Disposition</h3>
            </summary>
            <div className="form-grid" style={{ padding: '8px' }}>
              <label className="field"><span>Disposition Method</span><select name="dispositionDetails.method" defaultValue={initialAsset?.dispositionDetails?.method ?? ""}><option value="">None</option><option value="sold">Sold</option><option value="donated">Donated</option><option value="scrapped">Scrapped</option><option value="recycled">Recycled</option><option value="lost">Lost</option></select></label>
              <label className="field"><span>Disposition Date</span><input type="date" name="dispositionDetails.date" defaultValue={initialAsset?.dispositionDetails?.date ? initialAsset.dispositionDetails.date.slice(0, 10) : ""} /></label>
              <label className="field"><span>Sale Price</span><input type="number" name="dispositionDetails.salePrice" min="0" step="0.01" defaultValue={initialAsset?.dispositionDetails?.salePrice ?? ""} /></label>
              <label className="field"><span>Buyer Info</span><input type="text" name="dispositionDetails.buyerInfo" defaultValue={initialAsset?.dispositionDetails?.buyerInfo ?? ""} /></label>
              <label className="field field--full"><span>Disposition Notes</span><textarea name="dispositionDetails.notes" rows={2} defaultValue={initialAsset?.dispositionDetails?.notes ?? ""} /></label>
            </div>
          </details>

        </div>
      </section>

      <section className="panel panel--studio">
        <label className="checkbox-field">
          <input type="checkbox" checked={saveAsPreset} onChange={(event) => setSaveAsPreset(event.target.checked)} />
          <span>Save this setup as a template</span>
        </label>

        {saveAsPreset && (
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <label className="field">
              <span>Template Name</span>
              <input type="text" name="presetLabel" defaultValue={assetTypeLabel} placeholder="e.g. &quot;My Vehicle Profile&quot;" required={saveAsPreset} />
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
      </section>

      <div className="inline-actions inline-actions--end" style={{ marginTop: '2rem' }}>
        <button type="submit" className="button button--primary" style={{ padding: "12px 32px", fontSize: "1.1rem" }}>{submitLabel}</button>
      </div>
    </form>
  );
}
