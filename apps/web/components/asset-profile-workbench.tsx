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
  PresetUsageMetricTemplate,
  SpaceResponse
} from "@lifekeeper/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import {
  assetProfileFormSchema,
  type AssetProfileFormValues,
  type AssetProfileResolvedValues
} from "../lib/validation/forms";
import { AssetProfileWorkbenchAside } from "./asset-profile-workbench-aside";
import { AssetProfileWorkbenchCoreIdentitySection } from "./asset-profile-workbench-core-identity-section";
import { AssetProfileWorkbenchCustomFieldsSection } from "./asset-profile-workbench-custom-fields-section";
import { AssetProfileWorkbenchMaintenanceSchedulesSection } from "./asset-profile-workbench-maintenance-schedules-section";
import { AssetProfileWorkbenchUsageMetricsSection } from "./asset-profile-workbench-usage-metrics-section";
import { InlineError } from "./inline-error";
import { toHouseholdDateTimeInputValue, fromHouseholdDateTimeInput } from "../lib/date-input-utils";
import { useTimezone } from "../lib/timezone-context";

type AssetProfileWorkbenchProps = {
  action: (formData: FormData) => void | Promise<void>;
  householdId: string;
  householdAssets: Asset[];
  submitLabel: string;
  libraryPresets: LibraryPreset[];
  customPresets: CustomPresetProfile[];
  initialAsset?: Asset;
  initialParentAssetId?: string;
  spaces?: SpaceResponse[];
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

  return trigger.dueAt
    ? `One-time on ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(trigger.dueAt))}`
    : "One-time";
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
  initialAsset,
  initialParentAssetId,
  spaces = [],
}: AssetProfileWorkbenchProps): JSX.Element {
  const { timezone } = useTimezone();
  const toLocalDateTimeValue = (v: string | undefined) => toHouseholdDateTimeInputValue(v, timezone);
  const toOptionalIsoStringTz = (v: string): string | undefined => fromHouseholdDateTimeInput(v, timezone) ?? undefined;
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
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    const lastRecordedAt = toOptionalIsoStringTz(draft.lastRecordedAt);

    return {
      ...toPresetMetricTemplate(draft),
      enabled: draft.enabled,
      currentValue: draft.currentValue,
      ...(lastRecordedAt ? { lastRecordedAt } : {})
    };
  }));
  const scheduleDraftsJson = JSON.stringify(scheduleDrafts.map((draft) => {
    const lastCompletedAt = toOptionalIsoStringTz(draft.lastCompletedAt);
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

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<AssetProfileFormValues, unknown, AssetProfileResolvedValues>({
    resolver: zodResolver(assetProfileFormSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      householdId,
      name: initialAsset?.name ?? "",
      category: initialAsset?.category ?? initialBlueprint?.category ?? "vehicle",
      visibility: initialAsset?.visibility ?? "shared",
      description: initialAsset?.description ?? "",
      manufacturer: initialAsset?.manufacturer ?? "",
      model: initialAsset?.model ?? "",
      serialNumber: initialAsset?.serialNumber ?? "",
      purchaseDate: initialAsset?.purchaseDate ? initialAsset.purchaseDate.slice(0, 10) : "",
      parentAssetId: initialAsset?.parentAssetId ?? initialParentAssetId ?? "",
      conditionScore: initialAsset?.conditionScore ?? undefined,
      saveAsPreset: false,
      presetLabel: initialAsset?.assetTypeLabel ?? initialBlueprint?.label ?? "",
      presetDescription: initialAsset?.assetTypeDescription ?? initialBlueprint?.description ?? "",
      presetTags: "",
      fieldDefinitionsJson: fieldDefinitionJson,
      fieldValuesJson,
      metricDraftsJson,
      scheduleDraftsJson
    }
  });

  useEffect(() => {
    setValue("householdId", householdId, { shouldValidate: false });
    setValue("category", category, { shouldValidate: false });
    setValue("saveAsPreset", saveAsPreset, { shouldValidate: false });
    setValue("presetLabel", assetTypeLabel, { shouldValidate: false });
    setValue("presetDescription", assetTypeDescription, { shouldValidate: false });
    setValue("fieldDefinitionsJson", fieldDefinitionJson, { shouldValidate: false });
    setValue("fieldValuesJson", fieldValuesJson, { shouldValidate: false });
    setValue("metricDraftsJson", metricDraftsJson, { shouldValidate: false });
    setValue("scheduleDraftsJson", scheduleDraftsJson, { shouldValidate: false });
  }, [
    assetTypeDescription,
    assetTypeLabel,
    category,
    fieldDefinitionJson,
    fieldValuesJson,
    householdId,
    metricDraftsJson,
    saveAsPreset,
    scheduleDraftsJson,
    setValue
  ]);

  const submitForm = handleSubmit(async (values, event) => {
    const validated = assetProfileFormSchema.safeParse({
      ...values,
      householdId,
      category,
      saveAsPreset,
      presetLabel: values.presetLabel ?? assetTypeLabel,
      presetDescription: values.presetDescription ?? assetTypeDescription,
      fieldDefinitionsJson: fieldDefinitionJson,
      fieldValuesJson,
      metricDraftsJson,
      scheduleDraftsJson
    });

    if (!validated.success) {
      setSubmitError("Fix the highlighted asset fields before saving.");

      for (const issue of validated.error.issues) {
        const path = issue.path[0];

        if (typeof path === "string") {
          setError(path as keyof AssetProfileResolvedValues, { message: issue.message });
        }
      }

      return;
    }

    setSubmitError(null);
    const form = event?.currentTarget as HTMLFormElement | undefined;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    formData.set("householdId", householdId);
    formData.set("category", category);
    formData.set("saveAsPreset", saveAsPreset ? "true" : "false");
    formData.set("fieldDefinitionsJson", fieldDefinitionJson);
    formData.set("fieldValuesJson", fieldValuesJson);
    formData.set("metricDraftsJson", metricDraftsJson);
    formData.set("scheduleDraftsJson", scheduleDraftsJson);

    await action(formData);
  });

  return (
    <form className="workbench-form" noValidate onSubmit={submitForm}>
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
        <div className="resource-layout__primary">
          <AssetProfileWorkbenchCoreIdentitySection
            initialAsset={initialAsset}
            category={category}
            templateLabel={templateLabel}
            templateDescription={templateDescription}
            selectedBlueprintId={selectedBlueprintId}
            selectedBlueprint={selectedBlueprint}
            categoryOptions={categoryOptions}
            categoryLibraryBlueprints={categoryLibraryBlueprints}
            categoryCustomBlueprints={categoryCustomBlueprints}
            availableParentAssets={availableParentAssets}
            register={register}
            errors={errors}
            onCategoryChange={handleCategoryChange}
            onBlueprintChange={handleBlueprintChange}
          />

          <AssetProfileWorkbenchCustomFieldsSection
            inputIdPrefix={inputIdPrefix}
            fieldDefinitions={fieldDefinitions}
            fieldValues={fieldValues}
            detailSections={detailSections}
            lifecycleSectionNames={LIFECYCLE_SECTION_NAMES}
            groupedFieldDefinitions={groupedFieldDefinitions}
            unsectionedFieldDefinitions={unsectionedFieldDefinitions}
            customFieldSearchItems={customFieldSearchItems}
            availableSuggestedFields={availableSuggestedFields}
            detailPickerValue={detailPickerValue}
            detailTargetSection={detailTargetSection}
            newSectionName={newSectionName}
            expandedFieldEditors={expandedFieldEditors}
            fieldTypeOptions={fieldTypeOptions}
            setDetailPickerValue={setDetailPickerValue}
            setDetailTargetSection={setDetailTargetSection}
            setNewSectionName={setNewSectionName}
            setFieldValues={setFieldValues}
            toggleFieldEditor={toggleFieldEditor}
            handleFieldLabelChange={handleFieldLabelChange}
            updateFieldDefinition={updateFieldDefinition}
            removeFieldDefinition={removeFieldDefinition}
            removeSection={removeSection}
            addFieldDefinition={addFieldDefinition}
            addSuggestedField={addSuggestedField}
            addSection={addSection}
            addFieldDefinitionToSection={addFieldDefinitionToSection}
            getFieldTypeLabel={getFieldTypeLabel}
            buildDefaultFieldValue={buildDefaultFieldValue}
            renderFieldValueInput={renderFieldValueInput}
          />

          <AssetProfileWorkbenchUsageMetricsSection
            isCreateMode={isCreateMode}
            metricDrafts={metricDrafts}
            metricTemplates={metricTemplates}
            onAddMetricDraft={addMetricDraft}
            onUpdateMetricDraft={updateMetricDraft}
            onToggleMetricEnabled={(index, enabled, metricKey) => {
              updateMetricDraft(index, { enabled });

              if (!enabled) {
                setScheduleDrafts((current) => current.map((scheduleDraft) => (
                  getScheduleMetricKey(scheduleDraft) === metricKey
                    ? { ...scheduleDraft, enabled: false }
                    : scheduleDraft
                )));
              }
            }}
          />

          <AssetProfileWorkbenchMaintenanceSchedulesSection
            isCreateMode={isCreateMode}
            scheduleDrafts={scheduleDrafts}
            scheduleTemplates={scheduleTemplates}
            metricDrafts={metricDrafts}
            enabledMetricKeys={enabledMetricKeys}
            onAddScheduleDraft={addScheduleDraft}
            onUpdateScheduleDraft={updateScheduleDraft}
            onSetScheduleTriggerTemplate={setScheduleTriggerTemplate}
            getScheduleMetricKey={getScheduleMetricKey}
            createTriggerTemplate={createTriggerTemplate}
            toLocalDateTimeValue={toLocalDateTimeValue}
            toOptionalIsoString={toOptionalIsoStringTz}
            formatPresetTriggerSummary={formatPresetTriggerSummary}
          />

          <div className="workbench-bar">
            <InlineError message={submitError} size="sm" />
            <button type="submit" className="button button--primary" disabled={isSubmitting}>{submitLabel}</button>
          </div>
        </div>

        <AssetProfileWorkbenchAside
          initialAsset={initialAsset}
          saveAsPreset={saveAsPreset}
          assetTypeLabel={assetTypeLabel}
          assetTypeDescription={assetTypeDescription}
          assetTypeKey={assetTypeKey}
          register={register}
          errors={errors}
          onSaveAsPresetChange={setSaveAsPreset}
          spaces={spaces}
        />
      </div>
    </form>
  );
}
