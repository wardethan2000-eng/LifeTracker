import type { Asset, Prisma, PrismaClient, UsageMetric } from "@prisma/client";
import { presetLibrary } from "@lifekeeper/presets";
import {
  assetFieldDefinitionsSchema,
  customPresetProfileSchema,
  maintenanceTriggerSchema,
  presetCustomFieldTemplateSchema,
  presetScheduleTemplateSchema,
  presetUsageMetricTemplateSchema,
  type ApplyPresetInput,
  type MaintenanceTrigger,
  type PresetDefinition
} from "@lifekeeper/types";
import { recalculateScheduleFields } from "./schedule-state.js";

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const customFieldTemplatesArraySchema = presetCustomFieldTemplateSchema.array();
const metricTemplatesArraySchema = presetUsageMetricTemplateSchema.array();
const scheduleTemplatesArraySchema = presetScheduleTemplateSchema.array();

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

const normalizePresetFieldDefinition = (field: PresetDefinition["suggestedCustomFields"][number], index: number) => ({
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

export const slugifyPresetKey = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120);

export const getLibraryPresetByKey = (presetKey: string): PresetDefinition | undefined => presetLibrary.find((preset) => preset.key === presetKey);

export const toCustomPresetProfileResponse = (profile: {
  id: string;
  householdId: string;
  createdById: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  tags: string[];
  customFieldTemplates: Prisma.JsonValue;
  metricTemplates: Prisma.JsonValue;
  scheduleTemplates: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => customPresetProfileSchema.parse({
  id: profile.id,
  householdId: profile.householdId,
  createdById: profile.createdById,
  source: "custom",
  key: profile.key,
  label: profile.name,
  category: profile.category,
  description: profile.description,
  tags: profile.tags,
  suggestedCustomFields: customFieldTemplatesArraySchema.parse(profile.customFieldTemplates),
  metricTemplates: metricTemplatesArraySchema.parse(profile.metricTemplates),
  scheduleTemplates: scheduleTemplatesArraySchema.parse(profile.scheduleTemplates),
  createdAt: profile.createdAt.toISOString(),
  updatedAt: profile.updatedAt.toISOString()
});

const buildTriggerFromTemplate = (
  triggerTemplate: PresetDefinition["scheduleTemplates"][number]["triggerTemplate"],
  metricKeyToId: Map<string, string>
): MaintenanceTrigger => {
  switch (triggerTemplate.type) {
    case "interval":
      return maintenanceTriggerSchema.parse(triggerTemplate);
    case "seasonal":
      return maintenanceTriggerSchema.parse(triggerTemplate);
    case "one_time":
      return maintenanceTriggerSchema.parse(triggerTemplate);
    case "usage": {
      const metricId = metricKeyToId.get(triggerTemplate.metricKey);

      if (!metricId) {
        throw new Error(`Missing metric mapping for ${triggerTemplate.metricKey}.`);
      }

      return maintenanceTriggerSchema.parse({
        type: "usage",
        metricId,
        intervalValue: triggerTemplate.intervalValue,
        leadTimeValue: triggerTemplate.leadTimeValue
      });
    }
    case "compound": {
      const metricId = metricKeyToId.get(triggerTemplate.metricKey);

      if (!metricId) {
        throw new Error(`Missing metric mapping for ${triggerTemplate.metricKey}.`);
      }

      return maintenanceTriggerSchema.parse({
        type: "compound",
        intervalDays: triggerTemplate.intervalDays,
        metricId,
        intervalValue: triggerTemplate.intervalValue,
        logic: triggerTemplate.logic,
        leadTimeDays: triggerTemplate.leadTimeDays,
        leadTimeValue: triggerTemplate.leadTimeValue
      });
    }
  }
};

const metricLookupKey = (name: string, unit: string): string => `${name.toLowerCase()}::${unit.toLowerCase()}`;

const regulatoryPresetPattern = /\b(regulatory|compliance|legal|required|mandated|faa|14\s*cfr|health\s*code|vgb)\b/i;

const isRegulatoryPresetSchedule = (scheduleTemplate: PresetDefinition["scheduleTemplates"][number]): boolean => {
  if (scheduleTemplate.isRegulatory) {
    return true;
  }

  const haystack = [
    scheduleTemplate.name,
    scheduleTemplate.description,
    ...scheduleTemplate.tags
  ].filter((value): value is string => Boolean(value));

  return haystack.some((value) => regulatoryPresetPattern.test(value));
};

export const applyPresetToAsset = async (
  prisma: PrismaExecutor,
  asset: Pick<Asset, "id" | "householdId" | "category" | "fieldDefinitions" | "customFields">,
  preset: PresetDefinition,
  options: Pick<ApplyPresetInput, "mergeCustomFields" | "skipExistingMetrics" | "skipExistingSchedules"> & {
    sourceLabel: string;
  }
) => {
  if (asset.category !== preset.category && asset.category !== "other") {
    throw new Error("Preset category does not match the target asset category.");
  }

  const existingMetrics = await prisma.usageMetric.findMany({
    where: { assetId: asset.id }
  });
  const existingSchedules = await prisma.maintenanceSchedule.findMany({
    where: { assetId: asset.id }
  });

  const assetCustomFields = ((asset.customFields as Record<string, unknown> | null) ?? {});
  const existingFieldDefinitions = assetFieldDefinitionsSchema.parse(asset.fieldDefinitions ?? []);
  const nextFieldDefinitions = [...existingFieldDefinitions];
  const knownFieldKeys = new Set(existingFieldDefinitions.map((field) => field.key));
  let mergedFieldCount = 0;
  const nextCustomFields: Record<string, unknown> = { ...assetCustomFields };

  if (options.mergeCustomFields) {
    for (const [index, field] of preset.suggestedCustomFields.entries()) {
      if (!knownFieldKeys.has(field.key)) {
        nextFieldDefinitions.push(normalizePresetFieldDefinition(field, index));
        knownFieldKeys.add(field.key);
      }

      if (!(field.key in nextCustomFields)) {
        nextCustomFields[field.key] = field.defaultValue ?? null;
        mergedFieldCount += 1;
      }
    }
  }

  const assetUpdateData: Prisma.AssetUpdateInput = {
    assetTypeKey: preset.key,
    assetTypeLabel: preset.label,
    assetTypeSource: options.sourceLabel.startsWith("custom:") ? "custom" : "library",
    assetTypeVersion: 1,
    fieldDefinitions: toInputJsonValue(nextFieldDefinitions),
    customFields: toInputJsonValue(nextCustomFields)
  };

  if (preset.description !== undefined) {
    assetUpdateData.assetTypeDescription = preset.description;
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: assetUpdateData
  });

  const metricKeyToId = new Map<string, string>();
  const existingMetricsByIdentity = new Map(existingMetrics.map((metric) => [metricLookupKey(metric.name, metric.unit), metric]));
  let metricsCreated = 0;
  let metricsReused = 0;

  for (const metricTemplate of preset.metricTemplates) {
    const existingMetric = existingMetricsByIdentity.get(metricLookupKey(metricTemplate.name, metricTemplate.unit));

    if (existingMetric && options.skipExistingMetrics) {
      metricKeyToId.set(metricTemplate.key, existingMetric.id);
      metricsReused += 1;
      continue;
    }

    const metric = await prisma.usageMetric.create({
      data: {
        assetId: asset.id,
        name: metricTemplate.name,
        unit: metricTemplate.unit,
        currentValue: metricTemplate.startingValue
      }
    });

    metricKeyToId.set(metricTemplate.key, metric.id);
    existingMetricsByIdentity.set(metricLookupKey(metric.name, metric.unit), metric);
    metricsCreated += 1;
  }

  let schedulesCreated = 0;
  let schedulesSkipped = 0;
  const existingScheduleNames = new Set(existingSchedules.map((schedule) => schedule.name.toLowerCase()));
  const currentMetrics = await prisma.usageMetric.findMany({
    where: { assetId: asset.id },
    select: {
      id: true,
      currentValue: true,
      name: true,
      unit: true
    }
  });
  const metricById = new Map(currentMetrics.map((metric) => [metric.id, metric]));

  for (const scheduleTemplate of preset.scheduleTemplates) {
    if (options.skipExistingSchedules && existingScheduleNames.has(scheduleTemplate.name.toLowerCase())) {
      schedulesSkipped += 1;
      continue;
    }

    const triggerConfig = buildTriggerFromTemplate(scheduleTemplate.triggerTemplate, metricKeyToId);
    const metricId = triggerConfig.type === "usage" || triggerConfig.type === "compound"
      ? triggerConfig.metricId
      : null;
    const metric = metricId ? metricById.get(metricId) ?? null : null;
    const recalculated = recalculateScheduleFields({
      triggerConfig,
      lastCompletedAt: null,
      metric: metric ? { id: metric.id, currentValue: metric.currentValue } : null
    });

    const data: Prisma.MaintenanceScheduleUncheckedCreateInput = {
      assetId: asset.id,
      metricId,
      name: scheduleTemplate.name,
      triggerType: triggerConfig.type,
      triggerConfig: toInputJsonValue(triggerConfig),
      notificationConfig: toInputJsonValue(scheduleTemplate.notificationConfig),
      presetKey: options.sourceLabel,
      isRegulatory: isRegulatoryPresetSchedule(scheduleTemplate),
      nextDueAt: recalculated.nextDueAt,
      nextDueMetricValue: recalculated.nextDueMetricValue
    };

    if (scheduleTemplate.description !== undefined) {
      data.description = scheduleTemplate.description;
    }

    await prisma.maintenanceSchedule.create({ data });

    existingScheduleNames.add(scheduleTemplate.name.toLowerCase());
    schedulesCreated += 1;
  }

  return {
    mergedFieldCount,
    metricsCreated,
    metricsReused,
    schedulesCreated,
    schedulesSkipped
  };
};
