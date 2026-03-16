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
import { Fragment, useId, useState } from "react";
import { Card } from "./card";
import {
  conditionSummary,
  dispositionSummary,
  insuranceSummary,
  locationSummary,
  purchaseSummary,
  warrantySummary
} from "./card-summary-line";
import { CollapsibleCard } from "./collapsible-card";
import { CompactFieldPreview } from "./compact-field-preview";
import { CompactMetricPreview } from "./compact-metric-preview";
import { CompactSchedulePreview } from "./compact-schedule-preview";
import { ExpandableCard } from "./expandable-card";
import { SectionFilterBar, SectionFilterChildren, SectionFilterProvider, SectionFilterToggle } from "./section-filter";

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

type MetricTemplateDraft = PresetUsageMetricTemplate & {
  enabled: boolean;
  currentValue: number;
  lastRecordedAt: string;
};

type ScheduleTemplateDraft = PresetScheduleTemplate & {
  enabled: boolean;
  lastCompletedAt: string;
  usageValue: string;
};

type CoreDetailField = {
  id: string;
  section?: string;
  render: () => JSX.Element;
};

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

const LIFECYCLE_SECTION_NAMES: readonly string[] = [
  "Hierarchy & Condition",
  "Purchase Details",
  "Warranty",
  "Location & Property",
  "Insurance",
  "Disposition"
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

const buildUniqueTemplateKey = (
  preferred: string,
  existingKeys: string[],
  fallbackPrefix: string
): string => {
  const normalizedExistingKeys = new Set(existingKeys.map((value) => slugify(value)).filter(Boolean));
  const baseKey = slugify(preferred) || fallbackPrefix;

  if (!normalizedExistingKeys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  let candidate = `${baseKey}-${suffix}`;

  while (normalizedExistingKeys.has(candidate)) {
    suffix += 1;
    candidate = `${baseKey}-${suffix}`;
  }

  return candidate;
};

const createMetricDraft = (existingKeys: string[]): MetricTemplateDraft => ({
  key: buildUniqueTemplateKey("usage-metric", existingKeys, "metric"),
  name: "New Metric",
  unit: "hours",
  startingValue: 0,
  allowManualEntry: true,
  helpText: undefined,
  enabled: true,
  currentValue: 0,
  lastRecordedAt: ""
});

const createTriggerTemplate = (
  type: PresetScheduleTemplate["triggerTemplate"]["type"],
  fallbackMetricKey?: string
): PresetScheduleTemplate["triggerTemplate"] => {
  switch (type) {
    case "interval":
      return {
        type: "interval",
        intervalDays: 30,
        leadTimeDays: 7
      };
    case "usage":
      return {
        type: "usage",
        metricKey: fallbackMetricKey ?? "usage-metric",
        intervalValue: 100,
        leadTimeValue: 10
      };
    case "seasonal":
      return {
        type: "seasonal",
        month: 3,
        day: 1,
        leadTimeDays: 14
      };
    case "compound":
      return {
        type: "compound",
        metricKey: fallbackMetricKey ?? "usage-metric",
        intervalDays: 90,
        intervalValue: 100,
        logic: "whichever_first",
        leadTimeDays: 14,
        leadTimeValue: 10
      };
    case "one_time":
      return {
        type: "one_time",
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        leadTimeDays: 7
      };
    default:
      return {
        type: "interval",
        intervalDays: 30,
        leadTimeDays: 7
      };
  }
};

const createScheduleDraft = (existingKeys: string[]): ScheduleTemplateDraft => ({
  key: buildUniqueTemplateKey("maintenance-schedule", existingKeys, "schedule"),
  name: "New Schedule",
  description: undefined,
  triggerTemplate: createTriggerTemplate("interval"),
  isRegulatory: false,
  notificationConfig: {
    channels: ["push"],
    sendAtDue: true,
    digest: false
  },
  tags: [],
  quickLogLabel: undefined,
  enabled: true,
  lastCompletedAt: "",
  usageValue: ""
});

const toOptionalIsoString = (value: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
};

const toLocalDateTimeValue = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  const pad = (input: number): string => String(input).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toMetricTemplateDraft = (template: PresetUsageMetricTemplate): MetricTemplateDraft => ({
  ...template,
  enabled: true,
  currentValue: template.startingValue,
  lastRecordedAt: ""
});

const toScheduleTemplateDraft = (template: PresetScheduleTemplate): ScheduleTemplateDraft => ({
  ...template,
  enabled: true,
  lastCompletedAt: "",
  usageValue: ""
});

const toPresetMetricTemplate = (draft: MetricTemplateDraft): PresetUsageMetricTemplate => ({
  key: draft.key,
  name: draft.name,
  unit: draft.unit,
  startingValue: draft.startingValue,
  allowManualEntry: draft.allowManualEntry,
  helpText: draft.helpText
});

const toPresetScheduleTemplate = (draft: ScheduleTemplateDraft): PresetScheduleTemplate => ({
  key: draft.key,
  name: draft.name,
  description: draft.description,
  triggerTemplate: draft.triggerTemplate,
  isRegulatory: draft.isRegulatory,
  notificationConfig: draft.notificationConfig,
  tags: draft.tags,
  quickLogLabel: draft.quickLogLabel
});

const getScheduleMetricKey = (template: Pick<PresetScheduleTemplate, "triggerTemplate">): string | undefined => {
  if (template.triggerTemplate.type === "usage" || template.triggerTemplate.type === "compound") {
    return template.triggerTemplate.metricKey;
  }

  return undefined;
};

const formatPresetTriggerSummary = (template: Pick<PresetScheduleTemplate, "triggerTemplate">): string => {
  const trigger = template.triggerTemplate;

  if (trigger.type === "interval") {
    return `Every ${trigger.intervalDays} days`;
  }

  if (trigger.type === "usage") {
    return `Every ${trigger.intervalValue.toLocaleString()} ${trigger.metricKey}`;
  }

  if (trigger.type === "seasonal") {
    return `Seasonal on ${trigger.month}/${trigger.day}`;
  }

  if (trigger.type === "compound") {
    return `Every ${trigger.intervalDays} days or ${trigger.intervalValue.toLocaleString()} ${trigger.metricKey}`;
  }

  return trigger.dueAt ? `One-time on ${toLocalDateTimeValue(trigger.dueAt) || trigger.dueAt}` : "One-time";
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
  const isCreateMode = !initialAsset;

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
  const [metricDrafts, setMetricDrafts] = useState<MetricTemplateDraft[]>(
    initialBlueprint?.metricTemplates.map(toMetricTemplateDraft) ?? []
  );
  const [scheduleDrafts, setScheduleDrafts] = useState<ScheduleTemplateDraft[]>(
    initialBlueprint?.scheduleTemplates.map(toScheduleTemplateDraft) ?? []
  );
  const [saveAsPreset, setSaveAsPreset] = useState(false);
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
  const metricTemplates = metricDrafts
    .filter((draft) => draft.enabled)
    .map(toPresetMetricTemplate);
  const scheduleTemplates = scheduleDrafts
    .filter((draft) => draft.enabled)
    .map(toPresetScheduleTemplate);
  const assetTypeKey = selectedBlueprint?.key ?? (assetTypeLabel ? slugify(assetTypeLabel) : "");
  const dynamicSections = getDistinctGroups(fieldDefinitions);
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
  const enabledMetricKeys = new Set(metricDrafts.filter((draft) => draft.enabled).map((draft) => draft.key));
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
  const customFieldSearchItems = fieldDefinitions.map((field, index) => ({
    index,
    key: field.key,
    label: field.label,
    group: field.group?.trim() ?? "",
    type: getFieldTypeLabel(field.type)
  }));

  const handleBlueprintChange = (nextId: string): void => {
    setSelectedBlueprintId(nextId);
    setDetailPickerValue("");
    setDetailTargetSection("");
    setNewSectionName("");
    setManualSections([]);
    setExpandedFieldEditors([]);

    const nextBlueprint = blueprintOptions.find((preset) => preset.id === nextId);

    if (!nextBlueprint) {
      setMetricDrafts([]);
      setScheduleDrafts([]);
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
    setMetricDrafts(nextBlueprint.metricTemplates.map(toMetricTemplateDraft));
    setScheduleDrafts(nextBlueprint.scheduleTemplates.map(toScheduleTemplateDraft));
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

  const addFieldDefinitionToSection = (sectionName: string): void => {
    setFieldDefinitions((currentDefinitions) => {
      const nextKey = buildUniqueFieldKey("custom-detail", currentDefinitions.map((field) => field.key), "detail");
      const nextField: AssetFieldDefinition = {
        ...createFieldDefinition(),
        key: nextKey,
        group: sectionName,
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

  const updateMetricDraft = (index: number, update: Partial<MetricTemplateDraft>): void => {
    setMetricDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index
        ? { ...draft, ...update }
        : draft
    )));
  };

  const addMetricDraft = (): void => {
    setMetricDrafts((current) => [...current, createMetricDraft(current.map((draft) => draft.key))]);
  };

  const updateScheduleDraft = (index: number, update: Partial<ScheduleTemplateDraft>): void => {
    setScheduleDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index
        ? { ...draft, ...update }
        : draft
    )));
  };

  const setScheduleTriggerTemplate = (
    index: number,
    triggerTemplate: PresetScheduleTemplate["triggerTemplate"]
  ): void => {
    setScheduleDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index
        ? { ...draft, triggerTemplate }
        : draft
    )));
  };

  const addScheduleDraft = (): void => {
    setScheduleDrafts((current) => [...current, createScheduleDraft(current.map((draft) => draft.key))]);
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

  const metricDraftsJson = JSON.stringify(metricDrafts.map((draft) => {
    const lastRecordedAt = toOptionalIsoString(draft.lastRecordedAt);

    return {
      ...toPresetMetricTemplate(draft),
      enabled: draft.enabled,
      currentValue: draft.currentValue,
      ...(lastRecordedAt ? { lastRecordedAt } : {})
    };
  }));
  const scheduleDraftsJson = JSON.stringify(scheduleDrafts.map((draft) => {
    const lastCompletedAt = toOptionalIsoString(draft.lastCompletedAt);
    const usageValue = draft.usageValue.trim().length > 0 ? Number(draft.usageValue) : undefined;

    return {
      ...toPresetScheduleTemplate(draft),
      enabled: draft.enabled,
      ...(lastCompletedAt ? { lastCompletedAt } : {}),
      ...(usageValue !== undefined && !Number.isNaN(usageValue) ? { usageValue } : {})
    };
  }));
  const templateLabel = category === "aircraft" ? "Aircraft Subcategory" : "Start from Template";
  const templateDescription = selectedBlueprint?.description
    ?? (category === "aircraft"
      ? "Choose the aircraft family that matches the asset so the details, metrics, and maintenance profile fit the mission and systems on board."
      : "Templates can pre-fill recommended details for common asset types.");

  const renderSectionCustomFields = (sectionName: string): JSX.Element => {
    const sectionFields = groupedFieldDefinitions[sectionName] ?? [];
    return (
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        {sectionFields.length > 0 && (
          <table className="workbench-table" style={{ marginBottom: '6px' }}>
            <tbody>
              {sectionFields.map(({ field, index }) => {
                const isExpanded = expandedFieldEditors.includes(index);
                const optionsValue = field.options.map((opt) => opt.value).join(", ");
                return (
                  <Fragment key={`lc-${field.key}-${index}`}>
                    <tr className={isExpanded ? "workbench-table__row--active" : undefined}>
                      <td style={{ fontWeight: 500 }}>{field.label || <em style={{ color: 'var(--ink-muted)', fontStyle: 'normal' }}>New field</em>}</td>
                      <td style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>{getFieldTypeLabel(field.type)}</td>
                      <td>
                        {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                          setFieldValues((current) => ({ ...current, [field.key]: nextValue }));
                        })}
                      </td>
                      <td>
                        <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                          {isExpanded ? "Done" : "Edit"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="workbench-table__edit">
                        <td colSpan={4}>
                          <div className="workbench-grid" style={{ padding: '8px 4px' }}>
                            <label className="field"><span>Label</span><input type="text" value={field.label} onChange={(evt) => handleFieldLabelChange(index, evt.target.value)} /></label>
                            <label className="field"><span>Format</span><select value={field.type} onChange={(evt) => updateFieldDefinition(index, { type: evt.target.value as AssetFieldType })}>{fieldTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                            <label className="field"><span>Unit</span><input type="text" value={field.unit ?? ""} onChange={(evt) => updateFieldDefinition(index, { unit: evt.target.value.trim() || undefined })} /></label>
                            {(field.type === "select" || field.type === "multiselect") && (
                              <label className="field field--full"><span>Options (comma separated)</span><input type="text" value={optionsValue} onChange={(evt) => updateFieldDefinition(index, { options: evt.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((o) => ({ label: o, value: o })) })} /></label>
                            )}
                            <label className="field field--full"><span>Help text</span><input type="text" value={field.helpText ?? ""} onChange={(evt) => updateFieldDefinition(index, { helpText: evt.target.value.trim() || undefined })} /></label>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                              <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                              <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>Done</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <button type="button" className="button button--ghost button--sm" onClick={() => addFieldDefinitionToSection(sectionName)}>+ Add field</button>
      </div>
    );
  };

  return (
    <form action={action} className="workbench-form">
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
      <input type="hidden" name="metricDraftsJson" value={metricDraftsJson} />
      <input type="hidden" name="scheduleDraftsJson" value={scheduleDraftsJson} />
      <input type="hidden" name="saveAsPreset" value={saveAsPreset ? "true" : "false"} />

      <datalist id={`${inputIdPrefix}-detail-sections`}>
        {detailSections.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      <div className="resource-layout">
        {/* â”€â”€ Primary Column â”€â”€ */}
        <div className="resource-layout__primary">

          {/* Card 1: Core Identity */}
          <Card title="Core Identity">
            <div className="workbench-grid">
              <label className="field field--full">
                <span>Asset Name *</span>
                <input type="text" name="name" defaultValue={initialAsset?.name ?? ""} placeholder='e.g. "Riding Mower", "Family SUV"' required />
              </label>

              <label className="field">
                <span>Category</span>
                <select name="category" value={category} onChange={(event) => handleCategoryChange(event.target.value as AssetCategory)}>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{templateLabel}</span>
                <select value={selectedBlueprintId} onChange={(event) => handleBlueprintChange(event.target.value)}>
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
                {selectedBlueprint ? <small>{templateDescription}</small> : null}
              </label>

              <label className="field">
                <span>Manufacturer / Brand</span>
                <input type="text" name="manufacturer" defaultValue={initialAsset?.manufacturer ?? ""} placeholder='e.g. "Honda", "Samsung"' />
              </label>
              <label className="field">
                <span>Model</span>
                <input type="text" name="model" defaultValue={initialAsset?.model ?? ""} placeholder='e.g. "HRX217"' />
              </label>
              <label className="field">
                <span>Serial Number</span>
                <input type="text" name="serialNumber" defaultValue={initialAsset?.serialNumber ?? ""} placeholder="For warranty claims" />
              </label>
              <label className="field">
                <span>Parent Asset</span>
                <select name="parentAssetId" defaultValue={initialAsset?.parentAssetId ?? ""}>
                  <option value="">No parent asset</option>
                  {availableParentAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </select>
              </label>
              <label className="field field--full">
                <span>Description & Notes</span>
                <textarea name="description" rows={3} defaultValue={initialAsset?.description ?? ""} placeholder="Anything helpful..." />
              </label>
            </div>
          </Card>

          {/* Card 2: Custom Fields (expandable) */}
          <SectionFilterProvider items={customFieldSearchItems} keys={["label", "group", "type"]} placeholder="Filter custom fields by label, section, or type">
            <ExpandableCard
              title="Custom Fields"
              modalTitle="Custom Field Definitions"
              actions={<SectionFilterToggle />}
              headerContent={<SectionFilterBar />}
              previewContent={<CompactFieldPreview fieldDefinitions={fieldDefinitions} />}
            >
              <SectionFilterChildren<(typeof customFieldSearchItems)[number]>>
                {(filteredFieldItems) => {
                  const filteredIndexes = new Set(filteredFieldItems.map((item) => item.index));
                  const filteredUnsectionedFieldDefinitions = unsectionedFieldDefinitions.filter(({ index }) => filteredIndexes.has(index));
                  const filteredGroupedFieldDefinitions = detailSections
                    .filter((sectionName) => !LIFECYCLE_SECTION_NAMES.includes(sectionName))
                    .map((sectionName) => ({
                      sectionName,
                      fields: (groupedFieldDefinitions[sectionName] ?? []).filter(({ index }) => filteredIndexes.has(index))
                    }))
                    .filter(({ fields }) => fields.length > 0);

                  return (
                    <div>
              {/* Field picker toolbar */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
                <label className="field" style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <span>Add built-in field</span>
                  <select value={detailPickerValue} onChange={(event) => setDetailPickerValue(event.target.value)}>
                    <option value="">Select built-in detail...</option>
                    {availableSuggestedFields.map((field) => (
                      <option key={field.key} value={field.key}>{field.label}{field.group ? ` (${field.group})` : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ flex: '0 1 180px', minWidth: 0 }}>
                  <span>Section</span>
                  <input
                    type="text"
                    list={`${inputIdPrefix}-detail-sections`}
                    value={detailTargetSection}
                    onChange={(event) => setDetailTargetSection(event.target.value)}
                    placeholder="Optional section..."
                  />
                </label>
                <div style={{ display: 'flex', gap: '6px', paddingBottom: '1px' }}>
                  <button type="button" className="button button--secondary button--sm" onClick={addSuggestedField} disabled={!detailPickerValue}>Add Field</button>
                  <button type="button" className="button button--ghost button--sm" onClick={addFieldDefinition}>+ Custom</button>
                </div>
              </div>

              {/* Add new section row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>New section name</span>
                  <input type="text" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="e.g. Specifications" />
                </label>
                <button type="button" className="button button--ghost button--sm" style={{ paddingBottom: '1px' }} onClick={addSection} disabled={!newSectionName.trim()}>+ Add Section</button>
              </div>

              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th style={{ width: '72px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {fieldDefinitions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="workbench-table__empty">No custom fields yet - add one above</td>
                    </tr>
                  ) : null}

                  {fieldDefinitions.length > 0 && filteredFieldItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="workbench-table__empty">No custom fields match that search.</td>
                    </tr>
                  ) : null}

                  {filteredUnsectionedFieldDefinitions.map(({ field, index }) => {
                    const isExpanded = expandedFieldEditors.includes(index);
                    const optionsValue = field.options.map((opt) => opt.value).join(", ");
                    return (
                      <Fragment key={`row-${field.key}-${index}`}>
                        <tr className={isExpanded ? "workbench-table__row--active" : undefined}>
                          <td style={{ fontWeight: 500 }}>{field.label || <em style={{ color: 'var(--ink-muted)', fontStyle: 'normal' }}>New field</em>}</td>
                          <td style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>{getFieldTypeLabel(field.type)}</td>
                          <td>
                            {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                              setFieldValues((current) => ({ ...current, [field.key]: nextValue }));
                            })}
                          </td>
                          <td>
                            <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                              {isExpanded ? "Done" : "Edit"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="workbench-table__edit">
                            <td colSpan={4}>
                              <div className="workbench-grid" style={{ padding: '8px 4px' }}>
                                <label className="field"><span>Label</span><input type="text" value={field.label} onChange={(evt) => handleFieldLabelChange(index, evt.target.value)} placeholder="e.g. VIN" /></label>
                                <label className="field"><span>Format</span><select value={field.type} onChange={(evt) => updateFieldDefinition(index, { type: evt.target.value as AssetFieldType })}>{fieldTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                                <label className="field"><span>Section</span><input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(evt) => updateFieldDefinition(index, { group: evt.target.value.trim() || undefined })} /></label>
                                <label className="field"><span>Unit</span><input type="text" value={field.unit ?? ""} onChange={(evt) => updateFieldDefinition(index, { unit: evt.target.value.trim() || undefined })} /></label>
                                {(field.type === "select" || field.type === "multiselect") && (
                                  <label className="field field--full"><span>Options (comma separated)</span><input type="text" value={optionsValue} onChange={(evt) => updateFieldDefinition(index, { options: evt.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((o) => ({ label: o, value: o })) })} /></label>
                                )}
                                <label className="field field--full"><span>Help text</span><input type="text" value={field.helpText ?? ""} onChange={(evt) => updateFieldDefinition(index, { helpText: evt.target.value.trim() || undefined })} /></label>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                                  <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                                  <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>Done</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {filteredGroupedFieldDefinitions.map(({ sectionName: groupLabel, fields }) => {
                    return (
                      <Fragment key={`section-${groupLabel}`}>
                        <tr className="workbench-table__section-head">
                          <td colSpan={3}>{groupLabel}</td>
                          <td>
                            <button type="button" className="button button--ghost button--xs" onClick={() => removeSection(groupLabel)} title="Remove section">x Remove</button>
                          </td>
                        </tr>
                        {fields.map(({ field, index }) => {
                          const isExpanded = expandedFieldEditors.includes(index);
                          const optionsValue = field.options.map((opt) => opt.value).join(", ");
                          return (
                            <Fragment key={`row-${field.key}-${index}`}>
                              <tr className={isExpanded ? "workbench-table__row--active" : undefined}>
                                <td style={{ fontWeight: 500 }}>{field.label || <em style={{ color: 'var(--ink-muted)', fontStyle: 'normal' }}>New field</em>}</td>
                                <td style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>{getFieldTypeLabel(field.type)}</td>
                                <td>
                                  {renderFieldValueInput(field, fieldValues[field.key] ?? buildDefaultFieldValue(field), (nextValue) => {
                                    setFieldValues((current) => ({ ...current, [field.key]: nextValue }));
                                  })}
                                </td>
                                <td>
                                  <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>
                                    {isExpanded ? "Done" : "Edit"}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="workbench-table__edit">
                                  <td colSpan={4}>
                                    <div className="workbench-grid" style={{ padding: '8px 4px' }}>
                                      <label className="field"><span>Label</span><input type="text" value={field.label} onChange={(evt) => handleFieldLabelChange(index, evt.target.value)} /></label>
                                      <label className="field"><span>Format</span><select value={field.type} onChange={(evt) => updateFieldDefinition(index, { type: evt.target.value as AssetFieldType })}>{fieldTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
                                      <label className="field"><span>Section</span><input type="text" list={`${inputIdPrefix}-detail-sections`} value={field.group ?? ""} onChange={(evt) => updateFieldDefinition(index, { group: evt.target.value.trim() || undefined })} /></label>
                                      <label className="field"><span>Unit</span><input type="text" value={field.unit ?? ""} onChange={(evt) => updateFieldDefinition(index, { unit: evt.target.value.trim() || undefined })} /></label>
                                      {(field.type === "select" || field.type === "multiselect") && (
                                        <label className="field field--full"><span>Options (comma separated)</span><input type="text" value={optionsValue} onChange={(evt) => updateFieldDefinition(index, { options: evt.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((o) => ({ label: o, value: o })) })} /></label>
                                      )}
                                      <label className="field field--full"><span>Help text</span><input type="text" value={field.helpText ?? ""} onChange={(evt) => updateFieldDefinition(index, { helpText: evt.target.value.trim() || undefined })} /></label>
                                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                                        <button type="button" className="button button--danger button--sm" onClick={() => removeFieldDefinition(index)}>Remove</button>
                                        <button type="button" className="button button--ghost button--sm" onClick={() => toggleFieldEditor(index)}>Done</button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
                    </div>
                  );
                }}
              </SectionFilterChildren>
            </ExpandableCard>
          </SectionFilterProvider>

          {/* Card 3: Usage Metrics (expandable) */}
          <ExpandableCard
            title="Usage Metrics"
            modalTitle="Usage Metric Templates"
            previewContent={<CompactMetricPreview metricTemplates={metricTemplates} />}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', margin: 0, flex: '1 1 320px' }}>
                {isCreateMode
                  ? 'Choose which preset metrics to track and set their initial readings before the asset is created, or add your own metrics manually.'
                  : 'These template-derived metrics describe the preset profile. Live readings are managed in the asset Usage Metrics tab.'}
              </p>
              {isCreateMode ? <button type="button" className="button button--secondary button--sm" onClick={addMetricDraft}>+ Add Metric</button> : null}
            </div>
            {metricDrafts.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>No metrics yet - select a template in Core Identity to populate these, or add one manually.</p>
            ) : (
              <div className="workbench-table-wrap">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Use</th>
                      <th>Metric</th>
                      <th>Unit</th>
                      <th>Current Value</th>
                      <th>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricDrafts.map((draft, index) => (
                      <tr key={draft.key}>
                        <td className="workbench-table__checkbox">
                          <input
                            type="checkbox"
                            checked={draft.enabled}
                            disabled={!isCreateMode}
                            aria-label={`Use metric ${draft.name}`}
                            onChange={(event) => {
                              const nextEnabled = event.target.checked;
                              updateMetricDraft(index, { enabled: nextEnabled });

                              if (!nextEnabled) {
                                setScheduleDrafts((current) => current.map((scheduleDraft) => (
                                  getScheduleMetricKey(scheduleDraft) === draft.key
                                    ? { ...scheduleDraft, enabled: false }
                                    : scheduleDraft
                                )));
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="workbench-table__control">
                            <input
                              type="text"
                              value={draft.name}
                              disabled={!isCreateMode || !draft.enabled}
                              onChange={(event) => updateMetricDraft(index, { name: event.target.value })}
                            />
                            {isCreateMode ? (
                              <input
                                type="text"
                                value={draft.helpText ?? ""}
                                disabled={!draft.enabled}
                                placeholder="Optional help text"
                                onChange={(event) => updateMetricDraft(index, { helpText: event.target.value.trim() || undefined })}
                              />
                            ) : null}
                            {draft.helpText ? <small className="workbench-table__hint">{draft.helpText}</small> : null}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={draft.unit}
                            disabled={!isCreateMode || !draft.enabled}
                            onChange={(event) => updateMetricDraft(index, { unit: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={draft.currentValue}
                            disabled={!isCreateMode || !draft.enabled}
                            onChange={(event) => updateMetricDraft(index, {
                              currentValue: event.target.value === '' ? 0 : Number(event.target.value)
                            })}
                          />
                        </td>
                        <td>
                          <input
                            type="datetime-local"
                            value={draft.lastRecordedAt}
                            disabled={!isCreateMode || !draft.enabled}
                            onChange={(event) => updateMetricDraft(index, { lastRecordedAt: event.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExpandableCard>

          {/* Card 4: Maintenance Schedules (expandable) */}
          <ExpandableCard
            title="Maintenance Schedules"
            modalTitle="Schedule Templates"
            previewContent={<CompactSchedulePreview scheduleTemplates={scheduleTemplates} />}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', margin: 0, flex: '1 1 320px' }}>
                {isCreateMode
                  ? 'Choose which preset schedules to create, rename them if needed, optionally record when they were last completed, or add your own schedules manually. Usage-based schedules can reference the metrics configured above.'
                  : 'These template-derived schedules describe the preset profile. Live schedules are managed in the asset Maintenance tab.'}
              </p>
              {isCreateMode ? <button type="button" className="button button--secondary button--sm" onClick={addScheduleDraft}>+ Add Schedule</button> : null}
            </div>
            {scheduleDrafts.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontStyle: 'italic', fontSize: '0.88rem' }}>No schedules yet - select a template in Core Identity to populate these, or add one manually.</p>
            ) : (
              <div className="workbench-table-wrap">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Use</th>
                      <th>Name</th>
                      <th>Trigger</th>
                      <th>Last Completed</th>
                      <th>Usage at Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleDrafts.map((draft, index) => {
                      const availableMetricOptions = metricDrafts.filter((metricDraft) => metricDraft.enabled);
                      const metricKey = getScheduleMetricKey(draft);
                      const dependsOnDisabledMetric = metricKey ? !enabledMetricKeys.has(metricKey) : false;
                      const isEnabled = draft.enabled && !dependsOnDisabledMetric;
                      const intervalTrigger = draft.triggerTemplate.type === "interval" ? draft.triggerTemplate : undefined;
                      const usageTrigger = draft.triggerTemplate.type === "usage" ? draft.triggerTemplate : undefined;
                      const seasonalTrigger = draft.triggerTemplate.type === "seasonal" ? draft.triggerTemplate : undefined;
                      const compoundTrigger = draft.triggerTemplate.type === "compound" ? draft.triggerTemplate : undefined;
                      const oneTimeTrigger = draft.triggerTemplate.type === "one_time" ? draft.triggerTemplate : undefined;

                      return (
                        <tr key={draft.key}>
                          <td className="workbench-table__checkbox">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              disabled={!isCreateMode || dependsOnDisabledMetric}
                              aria-label={`Use schedule ${draft.name}`}
                              onChange={(event) => updateScheduleDraft(index, { enabled: event.target.checked })}
                            />
                          </td>
                          <td>
                            <div className="workbench-table__control">
                              <input
                                type="text"
                                value={draft.name}
                                disabled={!isCreateMode || !isEnabled}
                                onChange={(event) => updateScheduleDraft(index, { name: event.target.value })}
                              />
                              {isCreateMode ? (
                                <input
                                  type="text"
                                  value={draft.description ?? ""}
                                  disabled={!isEnabled}
                                  placeholder="Optional description"
                                  onChange={(event) => updateScheduleDraft(index, { description: event.target.value.trim() || undefined })}
                                />
                              ) : null}
                              {metricKey ? (
                                <small className="workbench-table__hint">
                                  Depends on usage metric: {metricKey}
                                  {dependsOnDisabledMetric ? ' — enable that metric to create this schedule.' : ''}
                                </small>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="workbench-table__control">
                              <select
                                value={draft.triggerTemplate.type}
                                disabled={!isCreateMode || !isEnabled}
                                onChange={(event) => {
                                  const nextType = event.target.value as PresetScheduleTemplate["triggerTemplate"]["type"];
                                  const fallbackMetricKey = availableMetricOptions[0]?.key;
                                  setScheduleTriggerTemplate(index, createTriggerTemplate(nextType, fallbackMetricKey));
                                }}
                              >
                                <option value="interval">Interval</option>
                                <option value="usage" disabled={availableMetricOptions.length === 0}>Usage</option>
                                <option value="seasonal">Seasonal</option>
                                <option value="compound" disabled={availableMetricOptions.length === 0}>Compound</option>
                                <option value="one_time">One Time</option>
                              </select>
                              {intervalTrigger ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                  <label className="field">
                                    <span>Every Days</span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={intervalTrigger.intervalDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "interval",
                                        intervalDays: Math.max(1, Number(event.target.value) || 1),
                                        leadTimeDays: intervalTrigger.leadTimeDays,
                                        ...(intervalTrigger.anchorDate ? { anchorDate: intervalTrigger.anchorDate } : {})
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Days</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={intervalTrigger.leadTimeDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "interval",
                                        intervalDays: intervalTrigger.intervalDays,
                                        leadTimeDays: Math.max(0, Number(event.target.value) || 0),
                                        ...(intervalTrigger.anchorDate ? { anchorDate: intervalTrigger.anchorDate } : {})
                                      })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              {usageTrigger ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                                  <label className="field">
                                    <span>Metric</span>
                                    <select
                                      value={usageTrigger.metricKey}
                                      disabled={!isEnabled || availableMetricOptions.length === 0}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "usage",
                                        metricKey: event.target.value,
                                        intervalValue: usageTrigger.intervalValue,
                                        leadTimeValue: usageTrigger.leadTimeValue
                                      })}
                                    >
                                      {availableMetricOptions.map((metricDraft) => (
                                        <option key={metricDraft.key} value={metricDraft.key}>{metricDraft.name}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="field">
                                    <span>Interval Value</span>
                                    <input
                                      type="number"
                                      min="0.1"
                                      step="0.1"
                                      value={usageTrigger.intervalValue}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "usage",
                                        metricKey: usageTrigger.metricKey,
                                        intervalValue: Math.max(0.1, Number(event.target.value) || 0.1),
                                        leadTimeValue: usageTrigger.leadTimeValue
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Value</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={usageTrigger.leadTimeValue}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "usage",
                                        metricKey: usageTrigger.metricKey,
                                        intervalValue: usageTrigger.intervalValue,
                                        leadTimeValue: Math.max(0, Number(event.target.value) || 0)
                                      })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              {seasonalTrigger ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                                  <label className="field">
                                    <span>Month</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="12"
                                      step="1"
                                      value={seasonalTrigger.month}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "seasonal",
                                        month: Math.min(12, Math.max(1, Number(event.target.value) || 1)),
                                        day: seasonalTrigger.day,
                                        leadTimeDays: seasonalTrigger.leadTimeDays
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Day</span>
                                    <input
                                      type="number"
                                      min="1"
                                      max="31"
                                      step="1"
                                      value={seasonalTrigger.day}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "seasonal",
                                        month: seasonalTrigger.month,
                                        day: Math.min(31, Math.max(1, Number(event.target.value) || 1)),
                                        leadTimeDays: seasonalTrigger.leadTimeDays
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Days</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={seasonalTrigger.leadTimeDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "seasonal",
                                        month: seasonalTrigger.month,
                                        day: seasonalTrigger.day,
                                        leadTimeDays: Math.max(0, Number(event.target.value) || 0)
                                      })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              {compoundTrigger ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                  <label className="field">
                                    <span>Metric</span>
                                    <select
                                      value={compoundTrigger.metricKey}
                                      disabled={!isEnabled || availableMetricOptions.length === 0}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: event.target.value,
                                        intervalDays: compoundTrigger.intervalDays,
                                        intervalValue: compoundTrigger.intervalValue,
                                        logic: compoundTrigger.logic,
                                        leadTimeDays: compoundTrigger.leadTimeDays,
                                        leadTimeValue: compoundTrigger.leadTimeValue
                                      })}
                                    >
                                      {availableMetricOptions.map((metricDraft) => (
                                        <option key={metricDraft.key} value={metricDraft.key}>{metricDraft.name}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="field">
                                    <span>Logic</span>
                                    <select
                                      value={compoundTrigger.logic}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: compoundTrigger.metricKey,
                                        intervalDays: compoundTrigger.intervalDays,
                                        intervalValue: compoundTrigger.intervalValue,
                                        logic: event.target.value as "whichever_first" | "whichever_last",
                                        leadTimeDays: compoundTrigger.leadTimeDays,
                                        leadTimeValue: compoundTrigger.leadTimeValue
                                      })}
                                    >
                                      <option value="whichever_first">Whichever first</option>
                                      <option value="whichever_last">Whichever last</option>
                                    </select>
                                  </label>
                                  <label className="field">
                                    <span>Every Days</span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={compoundTrigger.intervalDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: compoundTrigger.metricKey,
                                        intervalDays: Math.max(1, Number(event.target.value) || 1),
                                        intervalValue: compoundTrigger.intervalValue,
                                        logic: compoundTrigger.logic,
                                        leadTimeDays: compoundTrigger.leadTimeDays,
                                        leadTimeValue: compoundTrigger.leadTimeValue
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Usage Interval</span>
                                    <input
                                      type="number"
                                      min="0.1"
                                      step="0.1"
                                      value={compoundTrigger.intervalValue}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: compoundTrigger.metricKey,
                                        intervalDays: compoundTrigger.intervalDays,
                                        intervalValue: Math.max(0.1, Number(event.target.value) || 0.1),
                                        logic: compoundTrigger.logic,
                                        leadTimeDays: compoundTrigger.leadTimeDays,
                                        leadTimeValue: compoundTrigger.leadTimeValue
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Days</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={compoundTrigger.leadTimeDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: compoundTrigger.metricKey,
                                        intervalDays: compoundTrigger.intervalDays,
                                        intervalValue: compoundTrigger.intervalValue,
                                        logic: compoundTrigger.logic,
                                        leadTimeDays: Math.max(0, Number(event.target.value) || 0),
                                        leadTimeValue: compoundTrigger.leadTimeValue
                                      })}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Value</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      value={compoundTrigger.leadTimeValue}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "compound",
                                        metricKey: compoundTrigger.metricKey,
                                        intervalDays: compoundTrigger.intervalDays,
                                        intervalValue: compoundTrigger.intervalValue,
                                        logic: compoundTrigger.logic,
                                        leadTimeDays: compoundTrigger.leadTimeDays,
                                        leadTimeValue: Math.max(0, Number(event.target.value) || 0)
                                      })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              {oneTimeTrigger ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                  <label className="field">
                                    <span>Due At</span>
                                    <input
                                      type="datetime-local"
                                      value={toLocalDateTimeValue(oneTimeTrigger.dueAt)}
                                      disabled={!isEnabled}
                                      onChange={(event) => {
                                        const nextDueAt = toOptionalIsoString(event.target.value);
                                        if (!nextDueAt) {
                                          return;
                                        }

                                        setScheduleTriggerTemplate(index, {
                                          type: "one_time",
                                          dueAt: nextDueAt,
                                          leadTimeDays: oneTimeTrigger.leadTimeDays
                                        });
                                      }}
                                    />
                                  </label>
                                  <label className="field">
                                    <span>Lead Days</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={oneTimeTrigger.leadTimeDays}
                                      disabled={!isEnabled}
                                      onChange={(event) => setScheduleTriggerTemplate(index, {
                                        type: "one_time",
                                        dueAt: oneTimeTrigger.dueAt,
                                        leadTimeDays: Math.max(0, Number(event.target.value) || 0)
                                      })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              <small className="workbench-table__hint">{formatPresetTriggerSummary(draft)}</small>
                              {draft.tags.length > 0 ? (
                                <small className="workbench-table__hint">{draft.tags.join(', ')}</small>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <input
                              type="datetime-local"
                              value={draft.lastCompletedAt}
                              disabled={!isCreateMode || !isEnabled}
                              onChange={(event) => updateScheduleDraft(index, { lastCompletedAt: event.target.value })}
                            />
                          </td>
                          <td>
                            {metricKey ? (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={draft.usageValue}
                                disabled={!isCreateMode || !isEnabled}
                                placeholder="Optional"
                                onChange={(event) => updateScheduleDraft(index, { usageValue: event.target.value })}
                              />
                            ) : (
                              <span style={{ color: 'var(--ink-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ExpandableCard>
        </div>

        {/* â”€â”€ Aside Column â”€â”€ */}
        <div className="resource-layout__aside">

          {/* Aside Card 1: Visibility */}
          <Card title="Visibility">
            <label className="field">
              <span>Who can see this asset</span>
              <select name="visibility" defaultValue={initialAsset?.visibility ?? "shared"}>
                <option value="shared">Shared (visible to household)</option>
                <option value="personal">Personal (only you)</option>
              </select>
            </label>
          </Card>

          {/* Aside Card 2: Save as Template */}
          <Card title="Template">
            <label className="checkbox-field">
              <input type="checkbox" checked={saveAsPreset} onChange={(event) => setSaveAsPreset(event.target.checked)} />
              <span>Save this setup as a reusable template</span>
            </label>
            {saveAsPreset && (
              <div className="workbench-grid" style={{ marginTop: '12px' }}>
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
          </Card>

          {/* ── Lifecycle aside cards (editing only) ── */}
          {initialAsset ? (
            <>
              <CollapsibleCard
                title="Purchase Details"
                summary={purchaseSummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field"><span>Purchase Date</span><input type="date" name="purchaseDate" defaultValue={initialAsset.purchaseDate ? initialAsset.purchaseDate.slice(0, 10) : ""} /></label>
                  <label className="field"><span>Purchase Price</span><input type="number" name="purchaseDetails.price" min="0" step="0.01" defaultValue={initialAsset.purchaseDetails?.price ?? ""} /></label>
                  <label className="field"><span>Vendor</span><input type="text" name="purchaseDetails.vendor" defaultValue={initialAsset.purchaseDetails?.vendor ?? ""} /></label>
                  <label className="field"><span>Condition at Purchase</span><select name="purchaseDetails.condition" defaultValue={initialAsset.purchaseDetails?.condition ?? ""}><option value="">Unknown</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
                  <label className="field"><span>Financing</span><input type="text" name="purchaseDetails.financing" defaultValue={initialAsset.purchaseDetails?.financing ?? ""} /></label>
                  <label className="field field--full"><span>Receipt Reference</span><input type="text" name="purchaseDetails.receiptRef" defaultValue={initialAsset.purchaseDetails?.receiptRef ?? ""} /></label>
                </div>
              </CollapsibleCard>

              <CollapsibleCard
                title="Warranty Info"
                summary={warrantySummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field"><span>Provider</span><input type="text" name="warrantyDetails.provider" defaultValue={initialAsset.warrantyDetails?.provider ?? ""} /></label>
                  <label className="field"><span>Policy / Contract</span><input type="text" name="warrantyDetails.policyNumber" defaultValue={initialAsset.warrantyDetails?.policyNumber ?? ""} /></label>
                  <label className="field"><span>Start Date</span><input type="date" name="warrantyDetails.startDate" defaultValue={initialAsset.warrantyDetails?.startDate ? initialAsset.warrantyDetails.startDate.slice(0, 10) : ""} /></label>
                  <label className="field"><span>End Date</span><input type="date" name="warrantyDetails.endDate" defaultValue={initialAsset.warrantyDetails?.endDate ? initialAsset.warrantyDetails.endDate.slice(0, 10) : ""} /></label>
                  <label className="field"><span>Coverage Type</span><input type="text" name="warrantyDetails.coverageType" defaultValue={initialAsset.warrantyDetails?.coverageType ?? ""} /></label>
                  <label className="field field--full"><span>Notes</span><textarea name="warrantyDetails.notes" rows={2} defaultValue={initialAsset.warrantyDetails?.notes ?? ""} /></label>
                </div>
              </CollapsibleCard>

              <CollapsibleCard
                title="Location Details"
                summary={locationSummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field"><span>Property</span><input type="text" name="locationDetails.propertyName" defaultValue={initialAsset.locationDetails?.propertyName ?? ""} /></label>
                  <label className="field"><span>Building</span><input type="text" name="locationDetails.building" defaultValue={initialAsset.locationDetails?.building ?? ""} /></label>
                  <label className="field"><span>Room / Area</span><input type="text" name="locationDetails.room" defaultValue={initialAsset.locationDetails?.room ?? ""} /></label>
                  <label className="field"><span>Latitude</span><input type="number" name="locationDetails.latitude" min="-90" max="90" step="0.000001" defaultValue={initialAsset.locationDetails?.latitude ?? ""} /></label>
                  <label className="field"><span>Longitude</span><input type="number" name="locationDetails.longitude" min="-180" max="180" step="0.000001" defaultValue={initialAsset.locationDetails?.longitude ?? ""} /></label>
                  <label className="field field--full"><span>Notes</span><textarea name="locationDetails.notes" rows={2} defaultValue={initialAsset.locationDetails?.notes ?? ""} /></label>
                </div>
              </CollapsibleCard>

              <CollapsibleCard
                title="Insurance Details"
                summary={insuranceSummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field"><span>Provider</span><input type="text" name="insuranceDetails.provider" defaultValue={initialAsset.insuranceDetails?.provider ?? ""} /></label>
                  <label className="field"><span>Policy Number</span><input type="text" name="insuranceDetails.policyNumber" defaultValue={initialAsset.insuranceDetails?.policyNumber ?? ""} /></label>
                  <label className="field"><span>Coverage Amount</span><input type="number" name="insuranceDetails.coverageAmount" min="0" step="0.01" defaultValue={initialAsset.insuranceDetails?.coverageAmount ?? ""} /></label>
                  <label className="field"><span>Deductible</span><input type="number" name="insuranceDetails.deductible" min="0" step="0.01" defaultValue={initialAsset.insuranceDetails?.deductible ?? ""} /></label>
                  <label className="field"><span>Renewal Date</span><input type="date" name="insuranceDetails.renewalDate" defaultValue={initialAsset.insuranceDetails?.renewalDate ? initialAsset.insuranceDetails.renewalDate.slice(0, 10) : ""} /></label>
                  <label className="field field--full"><span>Notes</span><textarea name="insuranceDetails.notes" rows={2} defaultValue={initialAsset.insuranceDetails?.notes ?? ""} /></label>
                </div>
              </CollapsibleCard>

              <CollapsibleCard
                title="Condition"
                summary={conditionSummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field">
                    <span>Condition Score (1–10)</span>
                    <input type="number" name="conditionScore" min="1" max="10" step="1" defaultValue={initialAsset.conditionScore ?? ""} placeholder="1-10" />
                  </label>
                </div>
              </CollapsibleCard>

              <CollapsibleCard
                title="Disposition"
                summary={dispositionSummary(initialAsset)}
              >
                <div className="workbench-grid">
                  <label className="field"><span>Method</span><select name="dispositionDetails.method" defaultValue={initialAsset.dispositionDetails?.method ?? ""}><option value="">None</option><option value="sold">Sold</option><option value="donated">Donated</option><option value="scrapped">Scrapped</option><option value="recycled">Recycled</option><option value="lost">Lost</option></select></label>
                  <label className="field"><span>Date</span><input type="date" name="dispositionDetails.date" defaultValue={initialAsset.dispositionDetails?.date ? initialAsset.dispositionDetails.date.slice(0, 10) : ""} /></label>
                  <label className="field"><span>Sale Price</span><input type="number" name="dispositionDetails.salePrice" min="0" step="0.01" defaultValue={initialAsset.dispositionDetails?.salePrice ?? ""} /></label>
                  <label className="field"><span>Buyer Info</span><input type="text" name="dispositionDetails.buyerInfo" defaultValue={initialAsset.dispositionDetails?.buyerInfo ?? ""} /></label>
                  <label className="field field--full"><span>Notes</span><textarea name="dispositionDetails.notes" rows={2} defaultValue={initialAsset.dispositionDetails?.notes ?? ""} /></label>
                </div>
              </CollapsibleCard>
            </>
          ) : null}
        </div>
      </div>

      {/* â”€â”€ Sticky Action Bar â”€â”€ */}
      <div className="workbench-bar">
        <div></div>
        <button type="submit" className="button button--primary">{submitLabel}</button>
      </div>
    </form>
  );
}
