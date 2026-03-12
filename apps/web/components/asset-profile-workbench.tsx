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
    const normalizedKey = field.key.trim().toLowerCase() || slugify(field.label);

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
  const availableParentAssets = householdAssets.filter((asset) => asset.id !== initialAsset?.id);
  const assetTypeSource: AssetTypeSource = selectedBlueprint
    ? selectedBlueprint.source
    : fieldDefinitions.length > 0
      ? "inline"
      : "manual";
  const assetTypeKey = selectedBlueprint?.key ?? (assetTypeLabel ? slugify(assetTypeLabel) : "");
  const coreDetailFields: CoreDetailField[] = [
    {
      id: "manufacturer",
      render: () => (
        <label className="field">
          <span>Manufacturer / Brand</span>
          <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder='e.g. "Honda", "Samsung", "DeWalt"' />
        </label>
      )
    },
    {
      id: "model",
      render: () => (
        <label className="field">
          <span>Model</span>
          <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder='e.g. "HRX217", "RF28R7351SR"' />
        </label>
      )
    },
    {
      id: "visibility",
      render: () => (
        <label className="field">
          <span>Visibility</span>
          <select name="visibility" defaultValue={initialAsset?.visibility ?? "shared"}>
            <option value="shared">Shared (visible to household)</option>
            <option value="personal">Personal (only you)</option>
          </select>
        </label>
      )
    },
    {
      id: "description",
      render: () => (
        <label className="field field--full">
          <span>Notes</span>
          <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Anything helpful: where it&#39;s installed, special considerations, included accessories..." />
        </label>
      )
    },
    {
      id: "serialNumber",
      render: () => (
        <label className="field">
          <span>Serial Number</span>
          <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="For warranty claims and service records" />
        </label>
      )
    },
    {
      id: "purchaseDate",
      render: () => (
        <label className="field">
          <span>Purchase Date</span>
          <input type="date" name="purchaseDate" defaultValue={initialAsset?.purchaseDate ? initialAsset.purchaseDate.slice(0, 10) : ""} />
        </label>
      )
    }
  ];
  const dynamicSections = getDistinctGroups(fieldDefinitions);
  const detailSections = Array.from(new Set([...dynamicSections, ...manualSections]));
  const suggestionPool = dedupeSuggestedFields([
    ...commonDefaultFields,
    ...sharedSuggestedFields,
    ...(categorySuggestedFields[category] ?? []),
    ...blueprintOptions
      .filter((preset) => preset.category === category)
      .flatMap((preset) => preset.fieldDefinitions)
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

  return (
    <form action={action} className={`asset-studio asset-studio--${layoutMode}`}>
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
          <div className="panel-header__actions">
            <select
              className="layout-mode-select"
              value={layoutMode}
              onChange={(event) => setLayoutMode(event.target.value as AssetLayoutMode)}
              aria-label="Page layout"
            >
              {assetLayoutModeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="submit" className="button button--primary">{submitLabel}</button>
          </div>
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
            <small>Templates can pre-fill recommended details for common asset types</small>
          </label>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Hierarchy & Structured Records</h2>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Parent Asset</span>
            <select name="parentAssetId" defaultValue={initialAsset?.parentAssetId ?? ""}>
              <option value="">No parent asset</option>
              {availableParentAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            <small>Use this to build asset hierarchies like property → system → component.</small>
          </label>

          <label className="field">
            <span>Condition Score</span>
            <input type="number" name="conditionScore" min="1" max="10" step="1" defaultValue={initialAsset?.conditionScore ?? ""} placeholder="1-10" />
            <small>Use the condition assessment form on the asset page to append history over time.</small>
          </label>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field"><span>Purchase Price</span><input type="number" name="purchaseDetails.price" min="0" step="0.01" defaultValue={initialAsset?.purchaseDetails?.price ?? ""} /></label>
          <label className="field"><span>Vendor</span><input type="text" name="purchaseDetails.vendor" defaultValue={initialAsset?.purchaseDetails?.vendor ?? ""} /></label>
          <label className="field"><span>Purchase Condition</span><select name="purchaseDetails.condition" defaultValue={initialAsset?.purchaseDetails?.condition ?? ""}><option value="">Unknown</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
          <label className="field"><span>Financing</span><input type="text" name="purchaseDetails.financing" defaultValue={initialAsset?.purchaseDetails?.financing ?? ""} /></label>
          <label className="field field--full"><span>Receipt Reference</span><input type="text" name="purchaseDetails.receiptRef" defaultValue={initialAsset?.purchaseDetails?.receiptRef ?? ""} /></label>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field"><span>Warranty Provider</span><input type="text" name="warrantyDetails.provider" defaultValue={initialAsset?.warrantyDetails?.provider ?? ""} /></label>
          <label className="field"><span>Policy / Contract</span><input type="text" name="warrantyDetails.policyNumber" defaultValue={initialAsset?.warrantyDetails?.policyNumber ?? ""} /></label>
          <label className="field"><span>Warranty Start</span><input type="date" name="warrantyDetails.startDate" defaultValue={initialAsset?.warrantyDetails?.startDate ? initialAsset.warrantyDetails.startDate.slice(0, 10) : ""} /></label>
          <label className="field"><span>Warranty End</span><input type="date" name="warrantyDetails.endDate" defaultValue={initialAsset?.warrantyDetails?.endDate ? initialAsset.warrantyDetails.endDate.slice(0, 10) : ""} /></label>
          <label className="field"><span>Coverage Type</span><input type="text" name="warrantyDetails.coverageType" defaultValue={initialAsset?.warrantyDetails?.coverageType ?? ""} /></label>
          <label className="field field--full"><span>Warranty Notes</span><textarea name="warrantyDetails.notes" rows={2} defaultValue={initialAsset?.warrantyDetails?.notes ?? ""} /></label>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field"><span>Property</span><input type="text" name="locationDetails.propertyName" defaultValue={initialAsset?.locationDetails?.propertyName ?? ""} /></label>
          <label className="field"><span>Building</span><input type="text" name="locationDetails.building" defaultValue={initialAsset?.locationDetails?.building ?? ""} /></label>
          <label className="field"><span>Room / Area</span><input type="text" name="locationDetails.room" defaultValue={initialAsset?.locationDetails?.room ?? ""} /></label>
          <label className="field"><span>Latitude</span><input type="number" name="locationDetails.latitude" min="-90" max="90" step="0.000001" defaultValue={initialAsset?.locationDetails?.latitude ?? ""} /></label>
          <label className="field"><span>Longitude</span><input type="number" name="locationDetails.longitude" min="-180" max="180" step="0.000001" defaultValue={initialAsset?.locationDetails?.longitude ?? ""} /></label>
          <label className="field field--full"><span>Location Notes</span><textarea name="locationDetails.notes" rows={2} defaultValue={initialAsset?.locationDetails?.notes ?? ""} /></label>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field"><span>Insurance Provider</span><input type="text" name="insuranceDetails.provider" defaultValue={initialAsset?.insuranceDetails?.provider ?? ""} /></label>
          <label className="field"><span>Policy Number</span><input type="text" name="insuranceDetails.policyNumber" defaultValue={initialAsset?.insuranceDetails?.policyNumber ?? ""} /></label>
          <label className="field"><span>Coverage Amount</span><input type="number" name="insuranceDetails.coverageAmount" min="0" step="0.01" defaultValue={initialAsset?.insuranceDetails?.coverageAmount ?? ""} /></label>
          <label className="field"><span>Deductible</span><input type="number" name="insuranceDetails.deductible" min="0" step="0.01" defaultValue={initialAsset?.insuranceDetails?.deductible ?? ""} /></label>
          <label className="field"><span>Renewal Date</span><input type="date" name="insuranceDetails.renewalDate" defaultValue={initialAsset?.insuranceDetails?.renewalDate ? initialAsset.insuranceDetails.renewalDate.slice(0, 10) : ""} /></label>
          <label className="field field--full"><span>Insurance Notes</span><textarea name="insuranceDetails.notes" rows={2} defaultValue={initialAsset?.insuranceDetails?.notes ?? ""} /></label>
        </div>

        <div className="form-grid" style={{ marginTop: 20 }}>
          <label className="field"><span>Disposition Method</span><select name="dispositionDetails.method" defaultValue={initialAsset?.dispositionDetails?.method ?? ""}><option value="">None</option><option value="sold">Sold</option><option value="donated">Donated</option><option value="scrapped">Scrapped</option><option value="recycled">Recycled</option><option value="lost">Lost</option></select></label>
          <label className="field"><span>Disposition Date</span><input type="date" name="dispositionDetails.date" defaultValue={initialAsset?.dispositionDetails?.date ? initialAsset.dispositionDetails.date.slice(0, 10) : ""} /></label>
          <label className="field"><span>Sale Price</span><input type="number" name="dispositionDetails.salePrice" min="0" step="0.01" defaultValue={initialAsset?.dispositionDetails?.salePrice ?? ""} /></label>
          <label className="field"><span>Buyer Info</span><input type="text" name="dispositionDetails.buyerInfo" defaultValue={initialAsset?.dispositionDetails?.buyerInfo ?? ""} /></label>
          <label className="field field--full"><span>Disposition Notes</span><textarea name="dispositionDetails.notes" rows={2} defaultValue={initialAsset?.dispositionDetails?.notes ?? ""} /></label>
        </div>
      </section>

      <datalist id={`${inputIdPrefix}-detail-sections`}>
        {detailSections.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Details</h2>
        </div>
        <p className="asset-studio__details-intro">
          Everything below is part of the asset details. Core info, template details, and custom details all use the same section layout.
        </p>

        <div className="asset-studio__detail-groups">
          <section className="asset-studio__detail-group">
            <div className="asset-studio__detail-grid">
              {coreDetailFields.map((field) => (
                <div key={field.id} className="asset-studio__detail-slot">
                  {field.render()}
                </div>
              ))}

              {unsectionedFieldDefinitions.map(({ field, index }) => {
                const optionsValue = field.options.map((option) => option.value).join(", ");
                const isExpanded = expandedFieldEditors.includes(index);

                return (
                  <article key={`${field.key}-${index}`} className="asset-studio__detail-slot">
                    <div className="asset-studio__detail-card-header">
                      <div>
                        <h4>{field.label || "New detail"}</h4>
                        <p>{getFieldTypeLabel(field.type)}{field.unit ? ` • ${field.unit}` : ""}</p>
                      </div>
                      <div className="inline-actions">
                        <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                          {isExpanded ? "Done" : "Edit"}
                        </button>
                        <button type="button" className="button button--subtle button--sm" onClick={() => removeFieldDefinition(index)}>
                          Remove
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <label className="field">
                        <span>Detail name</span>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(event) => handleFieldLabelChange(index, event.target.value)}
                          placeholder='e.g. "VIN", "Filter Size", "Paint Color"'
                        />
                      </label>
                    )}

                    {field.type === "boolean" ? (
                      <div className="asset-studio__detail-value asset-studio__detail-value--boolean">
                        {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                          setFieldValues((currentValues) => ({
                            ...currentValues,
                            [field.key]: nextValue
                          }));
                        })}
                      </div>
                    ) : (
                      <label className="field">
                        <span>Value</span>
                        {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                          setFieldValues((currentValues) => ({
                            ...currentValues,
                            [field.key]: nextValue
                          }));
                        })}
                      </label>
                    )}

                    {field.helpText ? <small>{field.helpText}</small> : null}

                    {isExpanded && (
                      <div className="asset-studio__detail-settings">
                        <label className="field">
                          <span>Value format</span>
                          <select
                            value={field.type}
                            onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}
                          >
                            {fieldTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>Section</span>
                          <input
                            type="text"
                            list={`${inputIdPrefix}-detail-sections`}
                            value={field.group ?? ""}
                            onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })}
                            placeholder="Optional"
                          />
                        </label>

                        <label className="field">
                          <span>Unit</span>
                          <input
                            type="text"
                            value={field.unit ?? ""}
                            onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })}
                            placeholder="miles, psi, qt"
                          />
                        </label>

                        {(field.type === "select" || field.type === "multiselect") && (
                          <label className="field field--full">
                            <span>Choice options</span>
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

                        <label className="field field--full">
                          <span>Description</span>
                          <input
                            type="text"
                            value={field.helpText ?? ""}
                            onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })}
                            placeholder="Optional notes about this detail"
                          />
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {detailSections.map((groupLabel) => {
            const fields = groupedFieldDefinitions[groupLabel] ?? [];
            const isEmpty = fields.length === 0;

            return (
              <section key={groupLabel} className="asset-studio__detail-group">
                <div className="asset-studio__detail-group-header">
                  <div>
                    <h3>{groupLabel}</h3>
                    <p>{fields.length} {fields.length === 1 ? "detail" : "details"}</p>
                  </div>
                  <button type="button" className="button button--subtle button--sm" onClick={() => removeSection(groupLabel)}>
                    Remove section
                  </button>
                </div>

                <div className="asset-studio__detail-grid">
                  {fields.map(({ field, index }) => {
                    const optionsValue = field.options.map((option) => option.value).join(", ");
                    const isExpanded = expandedFieldEditors.includes(index);

                    return (
                      <article key={`${field.key}-${index}`} className="asset-studio__detail-slot">
                        <div className="asset-studio__detail-card-header">
                          <div>
                            <h4>{field.label || "New detail"}</h4>
                            <p>{getFieldTypeLabel(field.type)}{field.unit ? ` • ${field.unit}` : ""}</p>
                          </div>
                          <div className="inline-actions">
                            <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                              {isExpanded ? "Done" : "Edit"}
                            </button>
                            <button type="button" className="button button--subtle button--sm" onClick={() => removeFieldDefinition(index)}>
                              Remove
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <label className="field">
                            <span>Detail name</span>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(event) => handleFieldLabelChange(index, event.target.value)}
                              placeholder='e.g. "VIN", "Filter Size", "Paint Color"'
                            />
                          </label>
                        )}

                        {field.type === "boolean" ? (
                          <div className="asset-studio__detail-value asset-studio__detail-value--boolean">
                            {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                              setFieldValues((currentValues) => ({
                                ...currentValues,
                                [field.key]: nextValue
                              }));
                            })}
                          </div>
                        ) : (
                          <label className="field">
                            <span>Value</span>
                            {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                              setFieldValues((currentValues) => ({
                                ...currentValues,
                                [field.key]: nextValue
                              }));
                            })}
                          </label>
                        )}

                        {field.helpText ? <small>{field.helpText}</small> : null}

                        {isExpanded && (
                          <div className="asset-studio__detail-settings">
                            <label className="field">
                              <span>Value format</span>
                              <select
                                value={field.type}
                                onChange={(event) => updateFieldDefinition(index, { type: event.target.value as AssetFieldType })}
                              >
                                {fieldTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>Section</span>
                              <input
                                type="text"
                                list={`${inputIdPrefix}-detail-sections`}
                                value={field.group ?? ""}
                                onChange={(event) => updateFieldDefinition(index, { group: event.target.value.trim() || undefined })}
                                placeholder="Optional"
                              />
                            </label>

                            <label className="field">
                              <span>Unit</span>
                              <input
                                type="text"
                                value={field.unit ?? ""}
                                onChange={(event) => updateFieldDefinition(index, { unit: event.target.value.trim() || undefined })}
                                placeholder="miles, psi, qt"
                              />
                            </label>

                            {(field.type === "select" || field.type === "multiselect") && (
                              <label className="field field--full">
                                <span>Choice options</span>
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

                            <label className="field field--full">
                              <span>Description</span>
                              <input
                                type="text"
                                value={field.helpText ?? ""}
                                onChange={(event) => updateFieldDefinition(index, { helpText: event.target.value.trim() || undefined })}
                                placeholder="Optional notes about this detail"
                              />
                            </label>
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {isEmpty ? (
                    <div className="asset-studio__detail-empty">
                      <p>No details in this section yet.</p>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        <div className="asset-studio__detail-builder asset-studio__detail-builder--footer">
          <div className="asset-studio__detail-builder-header">
            <div>
              <h3>Add Details</h3>
              <p>Add suggested fields, create custom ones, or create a new section and then place details into it.</p>
            </div>
          </div>

          <div className="asset-studio__detail-toolbar">
            <label className="field asset-studio__toolbar-field">
              <span>Add detail</span>
              <select value={detailPickerValue} onChange={(event) => setDetailPickerValue(event.target.value)}>
                <option value="">Choose a suggested detail</option>
                {availableSuggestedFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}{field.group ? ` (${field.group})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field asset-studio__toolbar-field asset-studio__toolbar-field--section">
              <span>Place in section</span>
              <select value={detailTargetSection} onChange={(event) => setDetailTargetSection(event.target.value)}>
                <option value="">No section</option>
                {detailSections.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </label>

            <button type="button" className="button button--ghost button--sm" onClick={addSuggestedField} disabled={!detailPickerValue}>
              Add detail
            </button>
            <button type="button" className="button button--ghost button--sm" onClick={addFieldDefinition}>
              New custom detail
            </button>
          </div>

          <div className="asset-studio__section-row">
            <label className="field asset-studio__toolbar-field">
              <span>Create section</span>
              <input
                type="text"
                value={newSectionName}
                onChange={(event) => setNewSectionName(event.target.value)}
                placeholder="Warranty, Accessories, Setup..."
              />
            </label>
            <button type="button" className="button button--ghost button--sm" onClick={addSection} disabled={!newSectionName.trim()}>
              Add section
            </button>
          </div>
        </div>
      </section>

      <section className="panel panel--studio">
        <div className="panel-header">
          <h2>Save as Template</h2>
          <label className="checkbox-field">
            <input type="checkbox" checked={saveAsPreset} onChange={(event) => setSaveAsPreset(event.target.checked)} />
            <span>Save this setup as a template</span>
          </label>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
          Re-use this exact detail structure the next time you add a similar asset.
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
      </section>

      {/* ── Submit ── */}
      <div className="inline-actions inline-actions--end">
        <button type="submit" className="button button--primary" style={{ padding: "12px 32px", fontSize: "1rem" }}>{submitLabel}</button>
      </div>
    </form>
  );
}
