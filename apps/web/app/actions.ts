"use server";

import type {
  AssetCategory,
  AssetVisibility,
  CompleteMaintenanceScheduleInput,
  CreateAssetInput,
  CreateMaintenanceLogInput,
  CreateMaintenanceScheduleInput,
  CreateUsageMetricInput,
  MaintenanceTrigger,
  UpdateUsageMetricInput
} from "@lifekeeper/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  applyLibraryPreset,
  completeSchedule,
  createMetric,
  createAsset,
  createHousehold,
  createMaintenanceLog,
  createSchedule,
  deleteSchedule,
  enqueueNotificationScan,
  markNotificationRead,
  updateSchedule,
  updateMetric
} from "../lib/api";

const getString = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const getOptionalString = (formData: FormData, key: string): string | undefined => {
  const value = getString(formData, key);
  return value.length > 0 ? value : undefined;
};

const getRequiredString = (formData: FormData, key: string): string => {
  const value = getString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
};

const getOptionalNumber = (formData: FormData, key: string): number | undefined => {
  const value = getOptionalString(formData, key);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`${key} must be a number.`);
  }

  return parsed;
};

const toIsoString = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
};

export async function createHouseholdAction(formData: FormData): Promise<void> {
  const household = await createHousehold({
    name: getRequiredString(formData, "name")
  });

  revalidatePath("/");
  redirect(`/?householdId=${household.id}`);
}

export async function createAssetAction(formData: FormData): Promise<void> {
  const input: CreateAssetInput = {
    householdId: getRequiredString(formData, "householdId"),
    name: getRequiredString(formData, "name"),
    category: getRequiredString(formData, "category") as AssetCategory,
    visibility: (getOptionalString(formData, "visibility") as AssetVisibility | undefined) ?? "shared",
    customFields: {}
  };

  const description = getOptionalString(formData, "description");
  const manufacturer = getOptionalString(formData, "manufacturer");
  const model = getOptionalString(formData, "model");
  const serialNumber = getOptionalString(formData, "serialNumber");
  const purchaseDate = toIsoString(getOptionalString(formData, "purchaseDate"));

  if (description) {
    input.description = description;
  }

  if (manufacturer) {
    input.manufacturer = manufacturer;
  }

  if (model) {
    input.model = model;
  }

  if (serialNumber) {
    input.serialNumber = serialNumber;
  }

  if (purchaseDate) {
    input.purchaseDate = purchaseDate;
  }

  const asset = await createAsset(input);
  const presetKey = getOptionalString(formData, "presetKey");

  if (presetKey) {
    await applyLibraryPreset(asset.id, presetKey);
  }

  revalidatePath("/");
  revalidatePath(`/assets/${asset.id}`);
  redirect(`/assets/${asset.id}`);
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  await markNotificationRead(getRequiredString(formData, "notificationId"));
  revalidatePath("/");
}

export async function enqueueNotificationScanAction(formData: FormData): Promise<void> {
  await enqueueNotificationScan(getRequiredString(formData, "householdId"));
  revalidatePath("/");
}

export async function updateMetricAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const metricId = getRequiredString(formData, "metricId");
  const input: UpdateUsageMetricInput = {
    currentValue: getOptionalNumber(formData, "currentValue"),
    lastRecordedAt: toIsoString(getOptionalString(formData, "lastRecordedAt"))
  };

  await updateMetric(assetId, metricId, input);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function completeScheduleAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");
  const input: CompleteMaintenanceScheduleInput = {
    metadata: {}
  };

  const title = getOptionalString(formData, "title");
  const notes = getOptionalString(formData, "notes");
  const completedAt = toIsoString(getOptionalString(formData, "completedAt"));
  const usageValue = getOptionalNumber(formData, "usageValue");
  const cost = getOptionalNumber(formData, "cost");

  if (title) {
    input.title = title;
  }

  if (notes) {
    input.notes = notes;
  }

  if (completedAt) {
    input.completedAt = completedAt;
  }

  if (usageValue !== undefined) {
    input.usageValue = usageValue;
  }

  if (cost !== undefined) {
    input.cost = cost;
  }

  await completeSchedule(assetId, scheduleId, input);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function createLogAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const input: CreateMaintenanceLogInput = {
    metadata: {}
  };

  const scheduleId = getOptionalString(formData, "scheduleId");
  const title = getOptionalString(formData, "title");
  const notes = getOptionalString(formData, "notes");
  const completedAt = toIsoString(getOptionalString(formData, "completedAt"));
  const usageValue = getOptionalNumber(formData, "usageValue");
  const cost = getOptionalNumber(formData, "cost");

  if (scheduleId) {
    input.scheduleId = scheduleId;
  }

  if (title) {
    input.title = title;
  }

  if (notes) {
    input.notes = notes;
  }

  if (completedAt) {
    input.completedAt = completedAt;
  }

  if (usageValue !== undefined) {
    input.usageValue = usageValue;
  }

  if (cost !== undefined) {
    input.cost = cost;
  }

  await createMaintenanceLog(assetId, input);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function applyPresetToAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await applyLibraryPreset(assetId, getRequiredString(formData, "presetKey"));
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function createMetricAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const input: CreateUsageMetricInput = {
    name: getRequiredString(formData, "name"),
    unit: getRequiredString(formData, "unit"),
    currentValue: getOptionalNumber(formData, "currentValue") ?? 0
  };

  const lastRecordedAt = toIsoString(getOptionalString(formData, "lastRecordedAt"));

  if (lastRecordedAt) {
    input.lastRecordedAt = lastRecordedAt;
  }

  await createMetric(assetId, input);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

const buildTriggerConfig = (formData: FormData): MaintenanceTrigger => {
  const type = getRequiredString(formData, "triggerType");
  const metricId = getOptionalString(formData, "metricId");
  const intervalDays = getOptionalNumber(formData, "intervalDays");
  const leadTimeDays = getOptionalNumber(formData, "leadTimeDays") ?? 0;
  const intervalValue = getOptionalNumber(formData, "intervalValue");
  const leadTimeValue = getOptionalNumber(formData, "leadTimeValue") ?? 0;
  const month = getOptionalNumber(formData, "month");
  const day = getOptionalNumber(formData, "day");
  const dueAt = toIsoString(getOptionalString(formData, "dueAt"));
  const logic = getOptionalString(formData, "logic") ?? "whichever_first";

  switch (type) {
    case "interval":
      if (!intervalDays) {
        throw new Error("intervalDays is required for interval schedules.");
      }

      return {
        type: "interval",
        intervalDays,
        leadTimeDays
      };
    case "usage":
      if (!metricId || !intervalValue) {
        throw new Error("metricId and intervalValue are required for usage schedules.");
      }

      return {
        type: "usage",
        metricId,
        intervalValue,
        leadTimeValue
      };
    case "seasonal":
      if (!month || !day) {
        throw new Error("month and day are required for seasonal schedules.");
      }

      return {
        type: "seasonal",
        month,
        day,
        leadTimeDays
      };
    case "compound":
      if (!metricId || !intervalDays || !intervalValue) {
        throw new Error("metricId, intervalDays, and intervalValue are required for compound schedules.");
      }

      return {
        type: "compound",
        intervalDays,
        metricId,
        intervalValue,
        logic: logic === "whichever_last" ? "whichever_last" : "whichever_first",
        leadTimeDays,
        leadTimeValue
      };
    case "one_time":
      if (!dueAt) {
        throw new Error("dueAt is required for one-time schedules.");
      }

      return {
        type: "one_time",
        dueAt,
        leadTimeDays
      };
    default:
      throw new Error("Unsupported trigger type.");
  }
};

export async function createScheduleAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const input: CreateMaintenanceScheduleInput = {
    assetId,
    name: getRequiredString(formData, "name"),
    triggerConfig: buildTriggerConfig(formData),
    notificationConfig: {
      channels: getString(formData, "digest") === "on" ? ["push", "digest"] : ["push"],
      sendAtDue: true,
      digest: getString(formData, "digest") === "on"
    }
  };

  const description = getOptionalString(formData, "description");
  const metricId = getOptionalString(formData, "metricId");

  if (description) {
    input.description = description;
  }

  if (metricId) {
    input.metricId = metricId;
  }

  await createSchedule(assetId, input);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function toggleScheduleActiveAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");
  const isActive = getRequiredString(formData, "isActive") === "true";

  await updateSchedule(assetId, scheduleId, { isActive });
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");

  await deleteSchedule(assetId, scheduleId);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}