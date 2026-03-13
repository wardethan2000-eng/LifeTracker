"use server";

import type {
  AcceptInvitationInput,
  AllocateProjectInventoryInput,
  AssetCategory,
  AssetFieldDefinition,
  AssetTransferType,
  AssetTypeSource,
  AssetVisibility,
  CompleteMaintenanceScheduleInput,
  CreateAssetInput,
  CreateAssetTransferInput,
  CreateCommentInput,
  CreateConditionAssessmentInput,
  CreateInvitationInput,
  CreateInventoryItemInput,
  CreateMaintenanceLogInput,
  CreateMaintenanceScheduleInput,
  CreateProjectAssetInput,
  CreateProjectBudgetCategoryInput,
  CreateProjectExpenseInput,
  CreateProjectPhaseChecklistItemInput,
  CreateProjectPhaseInput,
  CreateProjectPhaseSupplyInput,
  CreateProjectInventoryItemInput,
  CreateProjectInput,
  CreateProjectTaskChecklistItemInput,
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
  UpdateProjectBudgetCategoryInput,
  UpdateProjectInventoryItemInput,
  UpdateProjectPhaseChecklistItemInput,
  UpdateProjectPhaseInput,
  UpdateProjectPhaseSupplyInput,
  UpdateServiceProviderInput,
  UpdateProjectExpenseInput,
  UpdateProjectInput,
  UpdateProjectTaskChecklistItemInput,
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
  allocateProjectInventory,
  allocateSupplyFromInventory,
  applyPreset,
  archiveAsset,
  completeSchedule,
  createComment,
  createInvitation,
  createAssetTransfer,
  createMetricEntry,
  createProject,
  createProjectBudgetCategory,
  createProjectExpense,
  createProjectPhase,
  createPhaseChecklistItem,
  createProjectPhaseSupply,
  createProjectTask,
  createTaskChecklistItem,
  createMetric,
  createAsset,
  createHousehold,
  createInventoryItem,
  createMaintenanceLog,
  createPresetProfile,
  createProjectInventoryItem,
  createSchedule,
  createServiceProvider,
  deleteComment,
  deleteMetric,
  deleteProject,
  deleteProjectBudgetCategory,
  deleteProjectExpense,
  deleteProjectPhase,
  deleteProjectInventoryItem,
  deletePhaseChecklistItem,
  deleteProjectPhaseSupply,
  deleteProjectTask,
  deleteTaskChecklistItem,
  deleteServiceProvider,
  deleteSchedule,
  enqueueNotificationScan,
  markNotificationRead,
  recordConditionAssessment,
  removeProjectAsset,
  reorderProjectPhases,
  revokeInvitation,
  restoreAsset,
  softDeleteAsset,
  unarchiveAsset,
  updateAsset,
  updateComment,
  updateProject,
  updateProjectBudgetCategory,
  updateProjectExpense,
  updateProjectInventoryItem,
  updateProjectPhase,
  updatePhaseChecklistItem,
  updateProjectPhaseSupply,
  updateProjectStatus,
  updateProjectTask,
  updateTaskChecklistItem,
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

const getNullableString = (formData: FormData, key: string): string | null => {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
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

const getNullableNumber = (formData: FormData, key: string): number | null => {
  const value = getString(formData, key);

  if (!value) {
    return null;
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

const toNullableIsoString = (value: string | null): string | null => {
  if (!value) {
    return null;
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

const revalidateInventoryPaths = (householdId: string): void => {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath(`/inventory?householdId=${householdId}`);
};

export async function createHouseholdAction(formData: FormData): Promise<void> {
  const household = await createHousehold({
    name: getRequiredString(formData, "name")
  });

  revalidatePath("/");
  redirect(`/?householdId=${household.id}`);
}

export async function createInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const input: CreateInventoryItemInput = {
    name: getRequiredString(formData, "name"),
    quantityOnHand: getOptionalNumber(formData, "quantityOnHand") ?? 0,
    unit: getOptionalString(formData, "unit") ?? "each"
  };

  const partNumber = getOptionalString(formData, "partNumber");
  const category = getOptionalString(formData, "category");
  const manufacturer = getOptionalString(formData, "manufacturer");
  const reorderThreshold = getOptionalNumber(formData, "reorderThreshold");
  const reorderQuantity = getOptionalNumber(formData, "reorderQuantity");
  const preferredSupplier = getOptionalString(formData, "preferredSupplier");
  const supplierUrl = getOptionalString(formData, "supplierUrl");
  const unitCost = getOptionalNumber(formData, "unitCost");
  const storageLocation = getOptionalString(formData, "storageLocation");
  const notes = getOptionalString(formData, "notes");

  if (partNumber) {
    input.partNumber = partNumber;
  }

  if (category) {
    input.category = category;
  }

  if (manufacturer) {
    input.manufacturer = manufacturer;
  }

  if (reorderThreshold !== undefined) {
    input.reorderThreshold = reorderThreshold;
  }

  if (reorderQuantity !== undefined) {
    input.reorderQuantity = reorderQuantity;
  }

  if (preferredSupplier) {
    input.preferredSupplier = preferredSupplier;
  }

  if (supplierUrl) {
    input.supplierUrl = supplierUrl;
  }

  if (unitCost !== undefined) {
    input.unitCost = unitCost;
  }

  if (storageLocation) {
    input.storageLocation = storageLocation;
  }

  if (notes) {
    input.notes = notes;
  }

  await createInventoryItem(householdId, input);
  revalidateInventoryPaths(householdId);
  redirect(`/inventory?householdId=${householdId}`);
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

export async function transferAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const currentHouseholdId = getRequiredString(formData, "householdId");
  const transferType = getRequiredString(formData, "transferType") as AssetTransferType;
  const input: CreateAssetTransferInput = {
    transferType,
    toUserId: transferType === "household_transfer"
      ? getRequiredString(formData, "householdTransferToUserId")
      : getRequiredString(formData, "reassignmentToUserId")
  };

  const toHouseholdId = getOptionalString(formData, "toHouseholdId");
  const reason = getOptionalString(formData, "reason");
  const notes = getOptionalString(formData, "notes");

  if (transferType === "household_transfer") {
    input.toHouseholdId = getRequiredString(formData, "toHouseholdId");
  } else if (toHouseholdId) {
    input.toHouseholdId = toHouseholdId;
  }

  if (reason) {
    input.reason = reason;
  }

  if (notes) {
    input.notes = notes;
  }

  await createAssetTransfer(assetId, input);
  revalidateAssetPaths(assetId);
  revalidateActivityPaths(currentHouseholdId);

  if (transferType === "household_transfer") {
    redirect("/assets");
  }
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

  const rawSuggestedPhases = getOptionalString(formData, "suggestedPhasesJson");
  if (rawSuggestedPhases) {
    const suggestedPhases = JSON.parse(rawSuggestedPhases) as string[];

    for (const [index, phaseName] of suggestedPhases.entries()) {
      if (!phaseName || !phaseName.trim()) {
        continue;
      }

      await createProjectPhase(householdId, project.id, {
        name: phaseName.trim(),
        status: "pending",
        sortOrder: index
      });
    }
  }

  revalidateProjectPaths(householdId, project.id);
  redirect(`/projects/${project.id}?householdId=${householdId}`);
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: UpdateProjectInput = {
    name: getRequiredString(formData, "name"),
    status: getRequiredString(formData, "status") as ProjectStatus,
    description: getNullableString(formData, "description"),
    startDate: toNullableIsoString(getNullableString(formData, "startDate")),
    targetEndDate: toNullableIsoString(getNullableString(formData, "targetEndDate")),
    budgetAmount: getNullableNumber(formData, "budgetAmount"),
    notes: getNullableString(formData, "notes")
  };

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
    status: getRequiredString(formData, "status") as ProjectTaskStatus,
    description: getNullableString(formData, "description"),
    assignedToId: getNullableString(formData, "assignedToId"),
    dueDate: toNullableIsoString(getNullableString(formData, "dueDate")),
    estimatedCost: getNullableNumber(formData, "estimatedCost"),
    actualCost: getNullableNumber(formData, "actualCost"),
    sortOrder: getNullableNumber(formData, "sortOrder"),
    completedAt: null
  };

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
  const serviceProviderId = getOptionalString(formData, "serviceProviderId");
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

  if (serviceProviderId) {
    input.serviceProviderId = serviceProviderId;
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
    amount: getRequiredString(formData, "amount") ? Number(getRequiredString(formData, "amount")) : 0,
    category: getNullableString(formData, "category"),
    date: toNullableIsoString(getNullableString(formData, "date")),
    taskId: getNullableString(formData, "taskId"),
    serviceProviderId: getNullableString(formData, "serviceProviderId"),
    notes: getNullableString(formData, "notes")
  };

  if (Number.isNaN(input.amount)) {
    throw new Error("amount must be a number.");
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

export async function createProjectPhaseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const status = getOptionalString(formData, "status");
  const input: CreateProjectPhaseInput = {
    name: getRequiredString(formData, "name"),
    status: (status as CreateProjectPhaseInput["status"] | undefined) ?? "pending"
  };

  const description = getOptionalString(formData, "description");
  const sortOrder = getOptionalNumber(formData, "sortOrder");
  const startDate = toIsoString(getOptionalString(formData, "startDate"));
  const targetEndDate = toIsoString(getOptionalString(formData, "targetEndDate"));
  const budgetAmount = getOptionalNumber(formData, "budgetAmount");
  const notes = getOptionalString(formData, "notes");

  if (description) input.description = description;
  if (status) input.status = status as CreateProjectPhaseInput["status"];
  if (sortOrder !== undefined) input.sortOrder = sortOrder;
  if (startDate) input.startDate = startDate;
  if (targetEndDate) input.targetEndDate = targetEndDate;
  if (budgetAmount !== undefined) input.budgetAmount = budgetAmount;
  if (notes) input.notes = notes;

  await createProjectPhase(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectPhaseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const input: UpdateProjectPhaseInput = {
    name: getRequiredString(formData, "name"),
    status: getRequiredString(formData, "status") as UpdateProjectPhaseInput["status"],
    description: getNullableString(formData, "description"),
    sortOrder: getOptionalNumber(formData, "sortOrder"),
    startDate: toIsoString(getOptionalString(formData, "startDate")),
    targetEndDate: toIsoString(getOptionalString(formData, "targetEndDate")),
    budgetAmount: getOptionalNumber(formData, "budgetAmount"),
    notes: getNullableString(formData, "notes")
  };

  const actualEndDate = toIsoString(getOptionalString(formData, "actualEndDate"));
  if (actualEndDate) {
    input.actualEndDate = actualEndDate;
  }

  await updateProjectPhase(householdId, projectId, phaseId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectPhaseAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");

  await deleteProjectPhase(householdId, projectId, phaseId);
  revalidateProjectPaths(householdId, projectId);
}

export async function reorderProjectPhasesAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const rawPhaseIds = getRequiredString(formData, "phaseIds");
  const phaseIds = JSON.parse(rawPhaseIds) as string[];

  await reorderProjectPhases(householdId, projectId, phaseIds);
  revalidateProjectPaths(householdId, projectId);
}

export async function createPhaseChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const input: CreateProjectPhaseChecklistItemInput = {
    title: getRequiredString(formData, "title")
  };

  const sortOrder = getOptionalNumber(formData, "sortOrder");
  if (sortOrder !== undefined) input.sortOrder = sortOrder;

  await createPhaseChecklistItem(householdId, projectId, phaseId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updatePhaseChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const checklistItemId = getRequiredString(formData, "checklistItemId");
  const input: UpdateProjectPhaseChecklistItemInput = {
    title: getOptionalString(formData, "title"),
    isCompleted: getOptionalBoolean(formData, "isCompleted"),
    sortOrder: getNullableNumber(formData, "sortOrder")
  };

  await updatePhaseChecklistItem(householdId, projectId, phaseId, checklistItemId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deletePhaseChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const checklistItemId = getRequiredString(formData, "checklistItemId");

  await deletePhaseChecklistItem(householdId, projectId, phaseId, checklistItemId);
  revalidateProjectPaths(householdId, projectId);
}

export async function createTaskChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");
  const input: CreateProjectTaskChecklistItemInput = {
    title: getRequiredString(formData, "title")
  };

  const sortOrder = getOptionalNumber(formData, "sortOrder");
  if (sortOrder !== undefined) input.sortOrder = sortOrder;

  await createTaskChecklistItem(householdId, projectId, taskId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateTaskChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");
  const checklistItemId = getRequiredString(formData, "checklistItemId");
  const input: UpdateProjectTaskChecklistItemInput = {
    title: getOptionalString(formData, "title"),
    isCompleted: getOptionalBoolean(formData, "isCompleted"),
    sortOrder: getNullableNumber(formData, "sortOrder")
  };

  await updateTaskChecklistItem(householdId, projectId, taskId, checklistItemId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteTaskChecklistItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");
  const checklistItemId = getRequiredString(formData, "checklistItemId");

  await deleteTaskChecklistItem(householdId, projectId, taskId, checklistItemId);
  revalidateProjectPaths(householdId, projectId);
}

export async function createProjectBudgetCategoryAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateProjectBudgetCategoryInput = {
    name: getRequiredString(formData, "name")
  };

  const budgetAmount = getOptionalNumber(formData, "budgetAmount");
  const sortOrder = getOptionalNumber(formData, "sortOrder");
  const notes = getOptionalString(formData, "notes");

  if (budgetAmount !== undefined) input.budgetAmount = budgetAmount;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;
  if (notes) input.notes = notes;

  await createProjectBudgetCategory(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectBudgetCategoryAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const categoryId = getRequiredString(formData, "categoryId");
  const input: UpdateProjectBudgetCategoryInput = {
    name: getRequiredString(formData, "name"),
    budgetAmount: getOptionalNumber(formData, "budgetAmount"),
    sortOrder: getOptionalNumber(formData, "sortOrder"),
    notes: getNullableString(formData, "notes")
  };

  await updateProjectBudgetCategory(householdId, projectId, categoryId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectBudgetCategoryAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const categoryId = getRequiredString(formData, "categoryId");

  await deleteProjectBudgetCategory(householdId, projectId, categoryId);
  revalidateProjectPaths(householdId, projectId);
}

export async function createProjectPhaseSupplyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const quantityNeeded = getOptionalNumber(formData, "quantityNeeded");

  if (quantityNeeded === undefined) {
    throw new Error("quantityNeeded is required.");
  }

  const input: CreateProjectPhaseSupplyInput = {
    name: getRequiredString(formData, "name"),
    quantityNeeded,
    quantityOnHand: 0,
    unit: "each",
    isProcured: false,
    isStaged: false
  };

  const description = getOptionalString(formData, "description");
  const quantityOnHand = getOptionalNumber(formData, "quantityOnHand");
  const unit = getOptionalString(formData, "unit");
  const estimatedUnitCost = getOptionalNumber(formData, "estimatedUnitCost");
  const actualUnitCost = getOptionalNumber(formData, "actualUnitCost");
  const supplier = getOptionalString(formData, "supplier");
  const supplierUrl = getOptionalString(formData, "supplierUrl");
  const isProcured = getOptionalBoolean(formData, "isProcured");
  const isStaged = getOptionalBoolean(formData, "isStaged");
  const inventoryItemId = getOptionalString(formData, "inventoryItemId");
  const notes = getOptionalString(formData, "notes");
  const sortOrder = getOptionalNumber(formData, "sortOrder");

  if (description) input.description = description;
  if (quantityOnHand !== undefined) input.quantityOnHand = quantityOnHand;
  if (unit) input.unit = unit;
  if (estimatedUnitCost !== undefined) input.estimatedUnitCost = estimatedUnitCost;
  if (actualUnitCost !== undefined) input.actualUnitCost = actualUnitCost;
  if (supplier) input.supplier = supplier;
  if (supplierUrl) input.supplierUrl = supplierUrl;
  if (isProcured !== undefined) input.isProcured = isProcured;
  if (isStaged !== undefined) input.isStaged = isStaged;
  if (inventoryItemId) input.inventoryItemId = inventoryItemId;
  if (notes) input.notes = notes;
  if (sortOrder !== undefined) input.sortOrder = sortOrder;

  await createProjectPhaseSupply(householdId, projectId, phaseId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectPhaseSupplyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyId = getRequiredString(formData, "supplyId");
  const input: UpdateProjectPhaseSupplyInput = {
    name: getRequiredString(formData, "name"),
    description: getNullableString(formData, "description"),
    quantityNeeded: getOptionalNumber(formData, "quantityNeeded"),
    quantityOnHand: getOptionalNumber(formData, "quantityOnHand"),
    unit: getOptionalString(formData, "unit"),
    estimatedUnitCost: getOptionalNumber(formData, "estimatedUnitCost"),
    actualUnitCost: getOptionalNumber(formData, "actualUnitCost"),
    supplier: getNullableString(formData, "supplier"),
    supplierUrl: getNullableString(formData, "supplierUrl"),
    isProcured: getOptionalBoolean(formData, "isProcured"),
    isStaged: getOptionalBoolean(formData, "isStaged"),
    inventoryItemId: getOptionalString(formData, "inventoryItemId"),
    notes: getNullableString(formData, "notes"),
    sortOrder: getOptionalNumber(formData, "sortOrder")
  };

  await updateProjectPhaseSupply(householdId, projectId, phaseId, supplyId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectPhaseSupplyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyId = getRequiredString(formData, "supplyId");

  await deleteProjectPhaseSupply(householdId, projectId, phaseId, supplyId);
  revalidateProjectPaths(householdId, projectId);
}

export async function allocateSupplyFromInventoryAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyId = getRequiredString(formData, "supplyId");
  const quantity = getOptionalNumber(formData, "quantity");

  if (quantity === undefined) {
    throw new Error("quantity is required.");
  }

  const input: AllocateProjectInventoryInput = {
    quantity
  };

  const unitCost = getOptionalNumber(formData, "unitCost");
  const notes = getOptionalString(formData, "notes");

  if (unitCost !== undefined) input.unitCost = unitCost;
  if (notes) input.notes = notes;

  await allocateSupplyFromInventory(householdId, projectId, phaseId, supplyId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function createProjectInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const quantityNeeded = getOptionalNumber(formData, "quantityNeeded");

  if (quantityNeeded === undefined) {
    throw new Error("quantityNeeded is required.");
  }

  const input: CreateProjectInventoryItemInput = {
    inventoryItemId: getRequiredString(formData, "inventoryItemId"),
    quantityNeeded
  };

  const budgetedUnitCost = getOptionalNumber(formData, "budgetedUnitCost");
  const notes = getOptionalString(formData, "notes");

  if (budgetedUnitCost !== undefined) {
    input.budgetedUnitCost = budgetedUnitCost;
  }

  if (notes) {
    input.notes = notes;
  }

  await createProjectInventoryItem(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const quantityNeeded = getOptionalNumber(formData, "quantityNeeded");

  if (quantityNeeded === undefined) {
    throw new Error("quantityNeeded is required.");
  }

  const input: UpdateProjectInventoryItemInput = {
    quantityNeeded,
    budgetedUnitCost: getNullableNumber(formData, "budgetedUnitCost"),
    notes: getNullableString(formData, "notes")
  };

  await updateProjectInventoryItem(householdId, projectId, inventoryItemId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function allocateProjectInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const quantity = getOptionalNumber(formData, "quantity");

  if (quantity === undefined) {
    throw new Error("quantity is required.");
  }

  const input: AllocateProjectInventoryInput = {
    quantity
  };

  const unitCost = getOptionalNumber(formData, "unitCost");
  const notes = getOptionalString(formData, "notes");

  if (unitCost !== undefined) {
    input.unitCost = unitCost;
  }

  if (notes) {
    input.notes = notes;
  }

  await allocateProjectInventory(householdId, projectId, inventoryItemId, input);
  revalidateProjectPaths(householdId, projectId);
  revalidateInventoryPaths(householdId);
}

export async function deleteProjectInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");

  await deleteProjectInventoryItem(householdId, projectId, inventoryItemId);
  revalidateProjectPaths(householdId, projectId);
}