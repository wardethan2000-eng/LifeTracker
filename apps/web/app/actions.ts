"use server";

import type {
  AcceptInvitationInput,
  AssetCategory,
  AssetFieldDefinition,
  AssetTypeSource,
  AssetVisibility,
  CompleteMaintenanceScheduleInput,
  CreateAssetInput,
  CreateCommentInput,
  CreateConditionAssessmentInput,
  CreateInvitationInput,
  CreateMaintenanceLogInput,
  CreateMaintenanceScheduleInput,
  CreateProjectAssetInput,
  CreateProjectExpenseInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  CreatePresetProfileInput,
  CreateServiceProviderInput,
  CreateUsageMetricEntryInput,
  CreateUsageMetricInput,
  MaintenanceTrigger,
  PresetScheduleTemplate,
  PresetUsageMetricTemplate,
  ProjectStatus,
  ProjectTaskStatus,
  UpdateCommentInput,
  UpdateServiceProviderInput,
  UpdateProjectExpenseInput,
  UpdateProjectInput,
  UpdateProjectTaskInput,
  UpdateUsageMetricInput
} from "@lifekeeper/types";
import {
  assetCustomFieldsSchema,
  assetFieldDefinitionsSchema,
  presetScheduleTemplateSchema,
  presetUsageMetricTemplateSchema
} from "@lifekeeper/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  acceptInvitation,
  addProjectAsset,
  applyPreset,
  archiveAsset,
  completeSchedule,
  createComment,
  createInvitation,
  createMetricEntry,
  createProject,
  createProjectExpense,
  createProjectTask,
  createMetric,
  createAsset,
  createHousehold,
  createMaintenanceLog,
  createPresetProfile,
  createSchedule,
  createServiceProvider,
  deleteComment,
  deleteMetric,
  deleteProject,
  deleteProjectExpense,
  deleteProjectTask,
  deleteServiceProvider,
  deleteSchedule,
  enqueueNotificationScan,
  markNotificationRead,
  recordConditionAssessment,
  removeProjectAsset,
  revokeInvitation,
  restoreAsset,
  softDeleteAsset,
  unarchiveAsset,
  updateAsset,
  updateComment,
  updateProject,
  updateProjectExpense,
  updateProjectStatus,
  updateProjectTask,
  updateSchedule,
  updateServiceProvider,
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

const getOptionalBoolean = (formData: FormData, key: string): boolean | undefined => {
  const value = getOptionalString(formData, key);

  if (value === undefined) {
    return undefined;
  }

  return value === "true" || value === "on" || value === "1";
};

const getRepeatedStrings = (formData: FormData, key: string): string[] => formData
  .getAll(key)
  .map((value) => typeof value === "string" ? value.trim() : "")
  .filter((value, index, values) => index < values.length);

const parseJsonField = <T>(
  formData: FormData,
  key: string,
  schema: { parse: (value: unknown) => T },
  fallback: T
): T => {
  const raw = getOptionalString(formData, key);

  if (!raw) {
    return fallback;
  }

  return schema.parse(JSON.parse(raw));
};

const toPresetFieldTemplate = (field: AssetFieldDefinition) => ({
  ...field,
  options: field.options.map((option) => option.value)
});

const parsePresetTags = (value: string | undefined): string[] => value
  ? value.split(",").map((item) => item.trim()).filter(Boolean)
  : [];

type AssetProfilePayload = {
  fieldDefinitions: AssetFieldDefinition[];
  fieldValues: CreateAssetInput["customFields"];
  assetTypeSource: AssetTypeSource;
  assetTypeVersion: number;
  assetTypeKey: string | undefined;
  assetTypeLabel: string | undefined;
  assetTypeDescription: string | undefined;
  presetSource: "library" | "custom" | undefined;
  presetKey: string | undefined;
  presetProfileId: string | undefined;
  metricTemplates: PresetUsageMetricTemplate[];
  scheduleTemplates: PresetScheduleTemplate[];
};

const parseAssetProfilePayload = (formData: FormData): AssetProfilePayload => {
  const assetTypeVersion = getOptionalNumber(formData, "assetTypeVersion") ?? 1;
  const assetTypeSource = (getOptionalString(formData, "assetTypeSource") as AssetTypeSource | undefined) ?? "manual";
  const presetSource = getOptionalString(formData, "presetSource");

  return {
    fieldDefinitions: parseJsonField(formData, "fieldDefinitionsJson", assetFieldDefinitionsSchema, []),
    fieldValues: parseJsonField(formData, "fieldValuesJson", assetCustomFieldsSchema, {}),
    assetTypeSource,
    assetTypeVersion,
    assetTypeKey: getOptionalString(formData, "assetTypeKey"),
    assetTypeLabel: getOptionalString(formData, "assetTypeLabel"),
    assetTypeDescription: getOptionalString(formData, "assetTypeDescription"),
    presetSource: presetSource === "library" || presetSource === "custom" ? presetSource : undefined,
    presetKey: getOptionalString(formData, "presetKey"),
    presetProfileId: getOptionalString(formData, "presetProfileId"),
    metricTemplates: parseJsonField(formData, "metricTemplatesJson", presetUsageMetricTemplateSchema.array(), []),
    scheduleTemplates: parseJsonField(formData, "scheduleTemplatesJson", presetScheduleTemplateSchema.array(), [])
  };
};

const maybeCreatePresetProfileFromForm = async (
  formData: FormData,
  category: AssetCategory,
  fieldDefinitions: AssetFieldDefinition[],
  metricTemplates: PresetUsageMetricTemplate[],
  scheduleTemplates: PresetScheduleTemplate[]
): Promise<void> => {
  if (!getOptionalBoolean(formData, "saveAsPreset")) {
    return;
  }

  const householdId = getRequiredString(formData, "householdId");
  const label = getRequiredString(formData, "presetLabel");
  const input: CreatePresetProfileInput = {
    label,
    category,
    tags: parsePresetTags(getOptionalString(formData, "presetTags")),
    suggestedCustomFields: fieldDefinitions.map(toPresetFieldTemplate),
    metricTemplates,
    scheduleTemplates
  };

  const key = getOptionalString(formData, "presetKeyOverride");
  const description = getOptionalString(formData, "presetDescription");

  if (key !== undefined) {
    input.key = key;
  }

  if (description !== undefined) {
    input.description = description;
  }

  await createPresetProfile(householdId, input);
};

const toIsoString = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
};

const buildStructuredAssetInput = (formData: FormData): Partial<CreateAssetInput> => {
  const input: Partial<CreateAssetInput> = {};

  const parentAssetId = getOptionalString(formData, "parentAssetId");
  const conditionScore = getOptionalNumber(formData, "conditionScore");

  const purchasePrice = getOptionalNumber(formData, "purchaseDetails.price");
  const purchaseVendor = getOptionalString(formData, "purchaseDetails.vendor");
  const purchaseCondition = getOptionalString(formData, "purchaseDetails.condition");
  const purchaseFinancing = getOptionalString(formData, "purchaseDetails.financing");
  const purchaseReceiptRef = getOptionalString(formData, "purchaseDetails.receiptRef");

  const warrantyProvider = getOptionalString(formData, "warrantyDetails.provider");
  const warrantyPolicyNumber = getOptionalString(formData, "warrantyDetails.policyNumber");
  const warrantyStartDate = toIsoString(getOptionalString(formData, "warrantyDetails.startDate"));
  const warrantyEndDate = toIsoString(getOptionalString(formData, "warrantyDetails.endDate"));
  const warrantyCoverageType = getOptionalString(formData, "warrantyDetails.coverageType");
  const warrantyNotes = getOptionalString(formData, "warrantyDetails.notes");

  const locationPropertyName = getOptionalString(formData, "locationDetails.propertyName");
  const locationBuilding = getOptionalString(formData, "locationDetails.building");
  const locationRoom = getOptionalString(formData, "locationDetails.room");
  const locationLatitude = getOptionalNumber(formData, "locationDetails.latitude");
  const locationLongitude = getOptionalNumber(formData, "locationDetails.longitude");
  const locationNotes = getOptionalString(formData, "locationDetails.notes");

  const insuranceProvider = getOptionalString(formData, "insuranceDetails.provider");
  const insurancePolicyNumber = getOptionalString(formData, "insuranceDetails.policyNumber");
  const insuranceCoverageAmount = getOptionalNumber(formData, "insuranceDetails.coverageAmount");
  const insuranceDeductible = getOptionalNumber(formData, "insuranceDetails.deductible");
  const insuranceRenewalDate = toIsoString(getOptionalString(formData, "insuranceDetails.renewalDate"));
  const insuranceNotes = getOptionalString(formData, "insuranceDetails.notes");

  const dispositionMethod = getOptionalString(formData, "dispositionDetails.method");
  const dispositionDate = toIsoString(getOptionalString(formData, "dispositionDetails.date"));
  const dispositionSalePrice = getOptionalNumber(formData, "dispositionDetails.salePrice");
  const dispositionBuyerInfo = getOptionalString(formData, "dispositionDetails.buyerInfo");
  const dispositionNotes = getOptionalString(formData, "dispositionDetails.notes");

  if (parentAssetId) {
    input.parentAssetId = parentAssetId;
  }

  if (conditionScore !== undefined) {
    input.conditionScore = conditionScore;
  }

  if (
    purchasePrice !== undefined
    || purchaseVendor
    || purchaseCondition
    || purchaseFinancing
    || purchaseReceiptRef
  ) {
    input.purchaseDetails = {
      ...(purchasePrice !== undefined ? { price: purchasePrice } : {}),
      ...(purchaseVendor ? { vendor: purchaseVendor } : {}),
      ...(purchaseCondition ? { condition: purchaseCondition as "new" | "used" | "refurbished" } : {}),
      ...(purchaseFinancing ? { financing: purchaseFinancing } : {}),
      ...(purchaseReceiptRef ? { receiptRef: purchaseReceiptRef } : {})
    };
  }

  if (
    warrantyProvider
    || warrantyPolicyNumber
    || warrantyStartDate
    || warrantyEndDate
    || warrantyCoverageType
    || warrantyNotes
  ) {
    input.warrantyDetails = {
      ...(warrantyProvider ? { provider: warrantyProvider } : {}),
      ...(warrantyPolicyNumber ? { policyNumber: warrantyPolicyNumber } : {}),
      ...(warrantyStartDate ? { startDate: warrantyStartDate } : {}),
      ...(warrantyEndDate ? { endDate: warrantyEndDate } : {}),
      ...(warrantyCoverageType ? { coverageType: warrantyCoverageType } : {}),
      ...(warrantyNotes ? { notes: warrantyNotes } : {})
    };
  }

  if (
    locationPropertyName
    || locationBuilding
    || locationRoom
    || locationLatitude !== undefined
    || locationLongitude !== undefined
    || locationNotes
  ) {
    input.locationDetails = {
      ...(locationPropertyName ? { propertyName: locationPropertyName } : {}),
      ...(locationBuilding ? { building: locationBuilding } : {}),
      ...(locationRoom ? { room: locationRoom } : {}),
      ...(locationLatitude !== undefined ? { latitude: locationLatitude } : {}),
      ...(locationLongitude !== undefined ? { longitude: locationLongitude } : {}),
      ...(locationNotes ? { notes: locationNotes } : {})
    };
  }

  if (
    insuranceProvider
    || insurancePolicyNumber
    || insuranceCoverageAmount !== undefined
    || insuranceDeductible !== undefined
    || insuranceRenewalDate
    || insuranceNotes
  ) {
    input.insuranceDetails = {
      ...(insuranceProvider ? { provider: insuranceProvider } : {}),
      ...(insurancePolicyNumber ? { policyNumber: insurancePolicyNumber } : {}),
      ...(insuranceCoverageAmount !== undefined ? { coverageAmount: insuranceCoverageAmount } : {}),
      ...(insuranceDeductible !== undefined ? { deductible: insuranceDeductible } : {}),
      ...(insuranceRenewalDate ? { renewalDate: insuranceRenewalDate } : {}),
      ...(insuranceNotes ? { notes: insuranceNotes } : {})
    };
  }

  if (
    dispositionMethod
    || dispositionDate
    || dispositionSalePrice !== undefined
    || dispositionBuyerInfo
    || dispositionNotes
  ) {
    input.dispositionDetails = {
      ...(dispositionMethod ? { method: dispositionMethod as "sold" | "donated" | "scrapped" | "recycled" | "lost" } : {}),
      ...(dispositionDate ? { date: dispositionDate } : {}),
      ...(dispositionSalePrice !== undefined ? { salePrice: dispositionSalePrice } : {}),
      ...(dispositionBuyerInfo ? { buyerInfo: dispositionBuyerInfo } : {}),
      ...(dispositionNotes ? { notes: dispositionNotes } : {})
    };
  }

  return input;
};

const buildLogPartsInput = (formData: FormData): NonNullable<CreateMaintenanceLogInput["parts"]> => {
  const partNames = getRepeatedStrings(formData, "partName");
  const partNumbers = getRepeatedStrings(formData, "partNumber");
  const quantities = getRepeatedStrings(formData, "partQuantity");
  const unitCosts = getRepeatedStrings(formData, "partUnitCost");
  const suppliers = getRepeatedStrings(formData, "partSupplier");
  const notes = getRepeatedStrings(formData, "partNotes");

  return partNames
    .map((name, index) => {
      if (!name) {
        return null;
      }

      const quantityValue = quantities[index] ? Number(quantities[index]) : 1;
      const unitCostValue = unitCosts[index] ? Number(unitCosts[index]) : undefined;

      if (Number.isNaN(quantityValue)) {
        throw new Error("partQuantity must be a number.");
      }

      if (unitCosts[index] && Number.isNaN(unitCostValue)) {
        throw new Error("partUnitCost must be a number.");
      }

      return {
        name,
        ...(partNumbers[index] ? { partNumber: partNumbers[index] } : {}),
        quantity: quantityValue,
        ...(unitCostValue !== undefined ? { unitCost: unitCostValue } : {}),
        ...(suppliers[index] ? { supplier: suppliers[index] } : {}),
        ...(notes[index] ? { notes: notes[index] } : {})
      };
    })
    .filter((part): part is NonNullable<typeof part> => part !== null);
};

const revalidateAssetPaths = (assetId: string): void => {
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
};

const revalidateServiceProviderPaths = (householdId: string): void => {
  revalidatePath("/");
  revalidatePath("/service-providers");
  revalidatePath(`/service-providers?householdId=${householdId}`);
};

const revalidateActivityPaths = (householdId: string): void => {
  revalidatePath("/");
  revalidatePath("/activity");
  revalidatePath(`/activity?householdId=${householdId}`);
};

const revalidateInvitationPaths = (householdId: string): void => {
  revalidatePath("/");
  revalidatePath("/invitations");
  revalidatePath(`/invitations?householdId=${householdId}`);
};

const revalidateProjectPaths = (householdId: string, projectId?: string): void => {
  revalidatePath("/");
  revalidatePath(`/projects?householdId=${householdId}`);
  revalidatePath("/projects");

  if (projectId) {
    revalidatePath(`/projects/${projectId}?householdId=${householdId}`);
    revalidatePath(`/projects/${projectId}`);
  }
};

export async function createHouseholdAction(formData: FormData): Promise<void> {
  const household = await createHousehold({
    name: getRequiredString(formData, "name")
  });

  revalidatePath("/");
  redirect(`/?householdId=${household.id}`);
}

export async function createAssetAction(formData: FormData): Promise<void> {
  let profile: AssetProfilePayload;
  let input: CreateAssetInput;

  try {
    profile = parseAssetProfilePayload(formData);
  } catch (error) {
    console.error("[createAssetAction] Failed to parse profile payload:", error);
    throw error;
  }

  try {
    input = {
      householdId: getRequiredString(formData, "householdId"),
      name: getRequiredString(formData, "name"),
      category: getRequiredString(formData, "category") as AssetCategory,
      visibility: (getOptionalString(formData, "visibility") as AssetVisibility | undefined) ?? "shared",
      assetTypeSource: profile.assetTypeSource,
      assetTypeVersion: profile.assetTypeVersion,
      fieldDefinitions: profile.fieldDefinitions,
      customFields: profile.fieldValues
    };
  } catch (error) {
    console.error("[createAssetAction] Failed to build input:", error);
    throw error;
  }

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

  if (profile.assetTypeKey) {
    input.assetTypeKey = profile.assetTypeKey;
  }

  if (profile.assetTypeLabel) {
    input.assetTypeLabel = profile.assetTypeLabel;
  }

  if (profile.assetTypeDescription) {
    input.assetTypeDescription = profile.assetTypeDescription;
  }

  Object.assign(input, buildStructuredAssetInput(formData));

  let asset;
  try {
    asset = await createAsset(input);
  } catch (error) {
    console.error("[createAssetAction] API createAsset failed:", error);
    throw error;
  }

  if (profile.presetSource === "library" && profile.presetKey) {
    try {
      await applyPreset(asset.id, {
        source: "library",
        presetKey: profile.presetKey
      });
    } catch (error) {
      console.error("[createAssetAction] applyPreset (library) failed:", error);
    }
  }

  if (profile.presetSource === "custom" && profile.presetProfileId) {
    try {
      await applyPreset(asset.id, {
        source: "custom",
        presetProfileId: profile.presetProfileId
      });
    } catch (error) {
      console.error("[createAssetAction] applyPreset (custom) failed:", error);
    }
  }

  await maybeCreatePresetProfileFromForm(
    formData,
    input.category,
    profile.fieldDefinitions,
    profile.metricTemplates,
    profile.scheduleTemplates
  );

  revalidateAssetPaths(asset.id);
  redirect(`/assets/${asset.id}`);
}

export async function updateAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const profile = parseAssetProfilePayload(formData);
  const input: CreateAssetInput = {
    householdId: getRequiredString(formData, "householdId"),
    name: getRequiredString(formData, "name"),
    category: getRequiredString(formData, "category") as AssetCategory,
    visibility: (getOptionalString(formData, "visibility") as AssetVisibility | undefined) ?? "shared",
    assetTypeSource: profile.assetTypeSource,
    assetTypeVersion: profile.assetTypeVersion,
    fieldDefinitions: profile.fieldDefinitions,
    customFields: profile.fieldValues
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

  if (profile.assetTypeKey) {
    input.assetTypeKey = profile.assetTypeKey;
  }

  if (profile.assetTypeLabel) {
    input.assetTypeLabel = profile.assetTypeLabel;
  }

  if (profile.assetTypeDescription) {
    input.assetTypeDescription = profile.assetTypeDescription;
  }

  Object.assign(input, buildStructuredAssetInput(formData));

  await updateAsset(assetId, input);
  await maybeCreatePresetProfileFromForm(
    formData,
    input.category,
    profile.fieldDefinitions,
    profile.metricTemplates,
    profile.scheduleTemplates
  );

  revalidateAssetPaths(assetId);
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
  revalidateAssetPaths(assetId);
}

export async function deleteMetricAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const metricId = getRequiredString(formData, "metricId");

  await deleteMetric(assetId, metricId);
  revalidateAssetPaths(assetId);
}

export async function createMetricEntryAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const metricId = getRequiredString(formData, "metricId");
  const input: CreateUsageMetricEntryInput = {
    value: getRequiredString(formData, "value") ? Number(getRequiredString(formData, "value")) : 0,
    source: getOptionalString(formData, "source") ?? "manual"
  };

  if (Number.isNaN(input.value)) {
    throw new Error("value must be a number.");
  }

  const recordedAt = toIsoString(getOptionalString(formData, "recordedAt"));
  const notes = getOptionalString(formData, "notes");

  if (recordedAt) {
    input.recordedAt = recordedAt;
  }

  if (notes) {
    input.notes = notes;
  }

  await createMetricEntry(assetId, metricId, input);
  revalidateAssetPaths(assetId);
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
  revalidateAssetPaths(assetId);
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
  const serviceProviderId = getOptionalString(formData, "serviceProviderId");
  const parts = buildLogPartsInput(formData);

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

  if (serviceProviderId) {
    input.serviceProviderId = serviceProviderId;
  }

  if (parts.length > 0) {
    input.parts = parts;
  }

  await createMaintenanceLog(assetId, input);
  revalidateAssetPaths(assetId);
}

export async function applyPresetToAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await applyPreset(assetId, {
    source: "library",
    presetKey: getRequiredString(formData, "presetKey")
  });
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
  revalidateAssetPaths(assetId);
}

export async function recordConditionAssessmentAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const input: CreateConditionAssessmentInput = {
    score: getRequiredString(formData, "score") ? Number(getRequiredString(formData, "score")) : 0
  };

  if (Number.isNaN(input.score)) {
    throw new Error("score must be a number.");
  }

  const notes = getOptionalString(formData, "notes");

  if (notes) {
    input.notes = notes;
  }

  await recordConditionAssessment(assetId, input);
  revalidateAssetPaths(assetId);
}

export async function createCommentAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const householdId = getOptionalString(formData, "householdId");
  const input: CreateCommentInput = {
    body: getRequiredString(formData, "body")
  };

  const parentCommentId = getOptionalString(formData, "parentCommentId");

  if (parentCommentId) {
    input.parentCommentId = parentCommentId;
  }

  await createComment(assetId, input);
  revalidateAssetPaths(assetId);

  if (householdId) {
    revalidateActivityPaths(householdId);
  }
}

export async function updateCommentAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const commentId = getRequiredString(formData, "commentId");
  const input: UpdateCommentInput = {
    body: getRequiredString(formData, "body")
  };

  await updateComment(assetId, commentId, input);
  revalidateAssetPaths(assetId);
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const commentId = getRequiredString(formData, "commentId");
  const householdId = getOptionalString(formData, "householdId");

  await deleteComment(assetId, commentId);
  revalidateAssetPaths(assetId);

  if (householdId) {
    revalidateActivityPaths(householdId);
  }
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

export async function archiveAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await archiveAsset(assetId);
  revalidatePath("/");
  revalidatePath("/assets");
  redirect("/assets");
}

export async function unarchiveAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await unarchiveAsset(assetId);
  revalidatePath("/");
  revalidatePath(`/assets/${assetId}`);
}

export async function softDeleteAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await softDeleteAsset(assetId);
  revalidatePath("/");
  revalidatePath("/assets");
  redirect("/assets");
}

export async function restoreAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await restoreAsset(assetId);
  revalidateAssetPaths(assetId);
}

export async function createServiceProviderAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const input: CreateServiceProviderInput = {
    name: getRequiredString(formData, "name")
  };

  const specialty = getOptionalString(formData, "specialty");
  const phone = getOptionalString(formData, "phone");
  const email = getOptionalString(formData, "email");
  const website = getOptionalString(formData, "website");
  const address = getOptionalString(formData, "address");
  const rating = getOptionalNumber(formData, "rating");
  const notes = getOptionalString(formData, "notes");

  if (specialty) input.specialty = specialty;
  if (phone) input.phone = phone;
  if (email) input.email = email;
  if (website) input.website = website;
  if (address) input.address = address;
  if (rating !== undefined) input.rating = rating;
  if (notes) input.notes = notes;

  await createServiceProvider(householdId, input);
  revalidateServiceProviderPaths(householdId);
}

export async function updateServiceProviderAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const providerId = getRequiredString(formData, "providerId");
  const input: UpdateServiceProviderInput = {
    name: getRequiredString(formData, "name")
  };

  const specialty = getOptionalString(formData, "specialty");
  const phone = getOptionalString(formData, "phone");
  const email = getOptionalString(formData, "email");
  const website = getOptionalString(formData, "website");
  const address = getOptionalString(formData, "address");
  const rating = getOptionalNumber(formData, "rating");
  const notes = getOptionalString(formData, "notes");

  if (specialty) input.specialty = specialty;
  if (phone) input.phone = phone;
  if (email) input.email = email;
  if (website) input.website = website;
  if (address) input.address = address;
  if (rating !== undefined) input.rating = rating;
  if (notes) input.notes = notes;

  await updateServiceProvider(householdId, providerId, input);
  revalidateServiceProviderPaths(householdId);
}

export async function deleteServiceProviderAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const providerId = getRequiredString(formData, "providerId");

  await deleteServiceProvider(householdId, providerId);
  revalidateServiceProviderPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function createInvitationAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const input: CreateInvitationInput = {
    email: getRequiredString(formData, "email"),
    expirationHours: getOptionalNumber(formData, "expirationHours") ?? 72
  };

  await createInvitation(householdId, input);
  revalidateInvitationPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const invitationId = getRequiredString(formData, "invitationId");

  await revokeInvitation(householdId, invitationId);
  revalidateInvitationPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const input: AcceptInvitationInput = {
    token: getRequiredString(formData, "token")
  };

  const household = await acceptInvitation(input);
  revalidateInvitationPaths(household.id);
  revalidateActivityPaths(household.id);
  redirect(`/invitations?householdId=${household.id}`);
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const input: CreateProjectInput = {
    name: getRequiredString(formData, "name"),
    status: (getOptionalString(formData, "status") as ProjectStatus | undefined) ?? "planning"
  };

  const description = getOptionalString(formData, "description");
  const startDate = toIsoString(getOptionalString(formData, "startDate"));
  const targetEndDate = toIsoString(getOptionalString(formData, "targetEndDate"));
  const budgetAmount = getOptionalNumber(formData, "budgetAmount");
  const notes = getOptionalString(formData, "notes");

  if (description) {
    input.description = description;
  }

  if (startDate) {
    input.startDate = startDate;
  }

  if (targetEndDate) {
    input.targetEndDate = targetEndDate;
  }

  if (budgetAmount !== undefined) {
    input.budgetAmount = budgetAmount;
  }

  if (notes) {
    input.notes = notes;
  }

  const project = await createProject(householdId, input);
  revalidateProjectPaths(householdId, project.id);
  redirect(`/projects/${project.id}?householdId=${householdId}`);
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: UpdateProjectInput = {
    name: getRequiredString(formData, "name"),
    status: getRequiredString(formData, "status") as ProjectStatus
  };

  const description = getOptionalString(formData, "description");
  const startDate = toIsoString(getOptionalString(formData, "startDate"));
  const targetEndDate = toIsoString(getOptionalString(formData, "targetEndDate"));
  const budgetAmount = getOptionalNumber(formData, "budgetAmount");
  const notes = getOptionalString(formData, "notes");

  if (description) {
    input.description = description;
  }

  if (startDate) {
    input.startDate = startDate;
  }

  if (targetEndDate) {
    input.targetEndDate = targetEndDate;
  }

  if (budgetAmount !== undefined) {
    input.budgetAmount = budgetAmount;
  }

  if (notes) {
    input.notes = notes;
  }

  await updateProject(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectStatusAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const status = getRequiredString(formData, "status") as ProjectStatus;

  await updateProjectStatus(householdId, projectId, status);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");

  await deleteProject(householdId, projectId);
  revalidateProjectPaths(householdId);
  redirect(`/projects?householdId=${householdId}`);
}

export async function addProjectAssetAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateProjectAssetInput = {
    assetId: getRequiredString(formData, "assetId")
  };

  const role = getOptionalString(formData, "role");
  const notes = getOptionalString(formData, "notes");

  if (role) {
    input.role = role;
  }

  if (notes) {
    input.notes = notes;
  }

  await addProjectAsset(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function removeProjectAssetAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const projectAssetId = getRequiredString(formData, "projectAssetId");

  await removeProjectAsset(householdId, projectId, projectAssetId);
  revalidateProjectPaths(householdId, projectId);
}

export async function createProjectTaskAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateProjectTaskInput = {
    title: getRequiredString(formData, "title"),
    status: (getOptionalString(formData, "status") as ProjectTaskStatus | undefined) ?? "pending"
  };

  const description = getOptionalString(formData, "description");
  const assignedToId = getOptionalString(formData, "assignedToId");
  const dueDate = toIsoString(getOptionalString(formData, "dueDate"));
  const estimatedCost = getOptionalNumber(formData, "estimatedCost");
  const actualCost = getOptionalNumber(formData, "actualCost");
  const sortOrder = getOptionalNumber(formData, "sortOrder");

  if (description) {
    input.description = description;
  }

  if (assignedToId) {
    input.assignedToId = assignedToId;
  }

  if (dueDate) {
    input.dueDate = dueDate;
  }

  if (estimatedCost !== undefined) {
    input.estimatedCost = estimatedCost;
  }

  if (actualCost !== undefined) {
    input.actualCost = actualCost;
  }

  if (sortOrder !== undefined) {
    input.sortOrder = sortOrder;
  }

  await createProjectTask(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectTaskAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");
  const input: UpdateProjectTaskInput = {
    title: getRequiredString(formData, "title"),
    status: getRequiredString(formData, "status") as ProjectTaskStatus
  };

  const description = getOptionalString(formData, "description");
  const assignedToId = getOptionalString(formData, "assignedToId");
  const dueDate = toIsoString(getOptionalString(formData, "dueDate"));
  const estimatedCost = getOptionalNumber(formData, "estimatedCost");
  const actualCost = getOptionalNumber(formData, "actualCost");
  const sortOrder = getOptionalNumber(formData, "sortOrder");

  if (description) {
    input.description = description;
  }

  if (assignedToId) {
    input.assignedToId = assignedToId;
  }

  if (dueDate) {
    input.dueDate = dueDate;
  }

  if (estimatedCost !== undefined) {
    input.estimatedCost = estimatedCost;
  }

  if (actualCost !== undefined) {
    input.actualCost = actualCost;
  }

  if (sortOrder !== undefined) {
    input.sortOrder = sortOrder;
  }

  if (input.status === "completed") {
    input.completedAt = new Date().toISOString();
  }

  await updateProjectTask(householdId, projectId, taskId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectTaskAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");

  await deleteProjectTask(householdId, projectId, taskId);
  revalidateProjectPaths(householdId, projectId);
}

export async function createProjectExpenseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateProjectExpenseInput = {
    description: getRequiredString(formData, "description"),
    amount: getRequiredString(formData, "amount") ? Number(getRequiredString(formData, "amount")) : 0
  };

  if (Number.isNaN(input.amount)) {
    throw new Error("amount must be a number.");
  }

  const category = getOptionalString(formData, "category");
  const date = toIsoString(getOptionalString(formData, "date"));
  const taskId = getOptionalString(formData, "taskId");
  const notes = getOptionalString(formData, "notes");

  if (category) {
    input.category = category;
  }

  if (date) {
    input.date = date;
  }

  if (taskId) {
    input.taskId = taskId;
  }

  if (notes) {
    input.notes = notes;
  }

  await createProjectExpense(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectExpenseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const expenseId = getRequiredString(formData, "expenseId");
  const input: UpdateProjectExpenseInput = {
    description: getRequiredString(formData, "description"),
    amount: getRequiredString(formData, "amount") ? Number(getRequiredString(formData, "amount")) : 0
  };

  if (Number.isNaN(input.amount)) {
    throw new Error("amount must be a number.");
  }

  const category = getOptionalString(formData, "category");
  const date = toIsoString(getOptionalString(formData, "date"));
  const taskId = getOptionalString(formData, "taskId");
  const notes = getOptionalString(formData, "notes");

  if (category) {
    input.category = category;
  }

  if (date) {
    input.date = date;
  }

  if (taskId) {
    input.taskId = taskId;
  }

  if (notes) {
    input.notes = notes;
  }

  await updateProjectExpense(householdId, projectId, expenseId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectExpenseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const expenseId = getRequiredString(formData, "expenseId");

  await deleteProjectExpense(householdId, projectId, expenseId);
  revalidateProjectPaths(householdId, projectId);
}