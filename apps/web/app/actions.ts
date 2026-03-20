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
  CreateAssetTimelineEntryInput,
  CreateAssetTransferInput,
  CreateCommentInput,
  CreateConditionAssessmentInput,
  CreateInvitationInput,
  CreateInventoryItemInput,
  CreateSpaceInput,
  CreateMaintenanceLogInput,
  CreateMaintenanceScheduleInput,
  CreateProjectAssetInput,
  UpdateProjectAssetInput,
  CreateProjectBudgetCategoryInput,
  CreateProjectExpenseInput,
  CreateProjectNoteInput,
  CreateProjectPhaseChecklistItemInput,
  CreateProjectPhaseInput,
  CreateProjectPhaseSupplyInput,
  CreateProjectPurchaseRequestInput,
  CreateProjectTemplateInput,
  CreateProjectInventoryItemInput,
  CreateProjectInput,
  CreateProjectTaskChecklistItemInput,
  CreateProjectTaskInput,
  CreateQuickTodoInput,
  CreatePresetProfileInput,
  CreateServiceProviderInput,
  CreateUsageMetricEntryInput,
  CreateUsageMetricInput,
  CreateHobbyInput,
  CreateHobbyRecipeInput,
  CreateHobbySeriesInput,
  CreateHobbySessionInput,
  HobbySessionLifecycleMode,
  HobbyStatus,
  MaintenanceTrigger,
  PresetScheduleTemplate,
  PresetUsageMetricTemplate,
  ProjectStatus,
  ProjectTaskStatus,
  CreateQuickRestockInput,
  UpdateCommentInput,
  UpdateAssetTimelineEntryInput,
  UpdateProjectBudgetCategoryInput,
  UpdateProjectInventoryItemInput,
  UpdateProjectNoteInput,
  UpdateProjectPhaseChecklistItemInput,
  UpdateProjectPhaseInput,
  UpdateProjectPhaseSupplyInput,
  UpdateServiceProviderInput,
  UpdateProjectExpenseInput,
  UpdateProjectInput,
  UpdateProjectTaskChecklistItemInput,
  UpdateProjectTaskInput,
  CloneProjectInput,
  InstantiateProjectTemplateInput,
  UpdateHobbyInput,
  UpdateHobbyRecipeInput,
  UpdateInventoryItemInput,
  UpdateInventoryPurchaseLineInput,
  UpdateSpaceGeneralItemInput,
  AddSpaceItemInput,
  MoveSpaceInput,
  SpaceContentsResponse,
  SpaceGeneralItemInput,
  UpdateSpaceInput,
  UpdateUsageMetricInput
} from "@lifekeeper/types";
import {
  assetCustomFieldsSchema,
  assetFieldDefinitionsSchema,
  createHobbyRecipeIngredientInputSchema,
  createHobbyRecipeStepInputSchema,
  hobbyPresetPipelineStepSchema,
  presetScheduleTemplateSchema,
  presetUsageMetricTemplateSchema
} from "@lifekeeper/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getProjectBlueprintByKey,
  isSeededProjectBlueprint,
  type SeededProjectBlueprint
} from "../lib/project-blueprints";
import {
  broadcastRealtimeEvent,
  createRealtimeEvent,
  type RealtimeEventType
} from "../lib/realtime-events";
import {
  acceptInvitation,
  addProjectAsset,
  updateProjectAsset,
  allocateProjectInventory,
  advanceHobbySession,
  allocateSupplyFromInventory,
  applyPreset,
  archiveAsset,
  completeSchedule,
  createComment,
  createInventoryComment,
  createEntry,
  createAssetTimelineEntry,
  createInvitation,
  createAssetTransfer,
  createMetricEntry,
  createProject,
  createProjectBudgetCategory,
  createProjectExpense,
  createProjectNote,
  createProjectPhase,
  createPhaseChecklistItem,
  createProjectPhaseSupply,
  createProjectPurchaseRequests,
  createProjectTemplate,
  createProjectTask,
  createQuickTodo,
  createTaskChecklistItem,
  createMetric,
  createAsset,
  createHousehold,
  createHobby,
  createHobbyRecipe,
  createHobbySeries,
  createHobbySession,
  createInventoryItem,
  createSpace as createSpaceRequest,
  createQuickRestockBatch,
  createMaintenanceLog,
  createPresetProfile,
  createProjectInventoryItem,
  createSchedule,
  createServiceProvider,
  cloneProject,
  deleteInventoryItem,
  deleteGeneralItem as deleteGeneralItemRequest,
  deleteSpace as deleteSpaceRequest,
  deleteComment,
  deleteEntry,
  deleteInventoryComment,
  deleteAssetTimelineEntry,
  deleteHobby,
  deleteHobbyRecipe,
  deleteHobbySeries,
  deleteMetric,
  deleteHobbySession,
  deleteProject,
  deleteProjectBudgetCategory,
  deleteProjectExpense,
  deleteProjectNote,
  updateInventoryPurchaseLine,
  deleteProjectPhase,
  deleteProjectInventoryItem,
  deletePhaseChecklistItem,
  deleteProjectPhaseSupply,
  deleteProjectTask,
  deleteTaskChecklistItem,
  deleteServiceProvider,
  deleteSchedule,
  generateInventoryShoppingList,
  getProjectDetail,
  getSpaceContents as getSpaceContentsRequest,
  markNotificationRead,
  markNotificationUnread,
  recordConditionAssessment,
  removeProjectAsset,
  reorderProjectPhases,
  reorderProjectPhaseSupplies,
  revokeInvitation,
  restoreAsset,
  restoreSpace as restoreSpaceRequest,
  softDeleteAsset,
  unarchiveAsset,
  updateAsset,
  updateGeneralItem as updateGeneralItemRequest,
  updateInventoryItem,
  updateSpace as updateSpaceRequest,
  updateComment,
  updateInventoryComment,
  updateEntry,
  updateAssetTimelineEntry,
  updateHobby,
  updateHobbyRecipe,
  updateHobbySeries,
  updateProject,
  updateProjectBudgetCategory,
  updateProjectExpense,
  updateProjectNote,
  updateProjectInventoryItem,
  updateProjectPhase,
  updatePhaseChecklistItem,
  updateProjectPhaseSupply,
  updateProjectStatus,
  updateProjectTask,
  updateTaskChecklistItem,
  instantiateProjectTemplate,
  linkHobbySeriesSession,
  promoteTask,
  updateSchedule,
  updateServiceProvider,
  updateMetric,
  addGeneralItemToSpace as addGeneralItemToSpaceRequest,
  addItemToSpace as addItemToSpaceRequest,
  moveSpace as moveSpaceRequest,
  removeItemFromSpace as removeItemFromSpaceRequest
} from "../lib/api";
import { normalizeExternalUrl } from "../lib/url";
import { buildAssetEntryPayload as buildAssetEntryDetails, buildProjectEntryPayload as buildProjectEntryDetails } from "@lifekeeper/utils";

const emitRealtimeEvent = async (
  householdId: string | undefined,
  type: RealtimeEventType,
  entityId: string
): Promise<void> => {
  if (!householdId) {
    return;
  }

  broadcastRealtimeEvent(createRealtimeEvent(type, householdId, entityId));
};

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

const getOptionalNormalizedUrl = (formData: FormData, key: string): string | undefined => {
  const value = getOptionalString(formData, key);

  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeExternalUrl(value);

  if (!normalized) {
    throw new Error(`${key} must be a valid URL.`);
  }

  return normalized;
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
  metricDrafts: MetricDraftPayload[];
  scheduleDrafts: ScheduleDraftPayload[];
};

type MetricDraftPayload = PresetUsageMetricTemplate & {
  enabled: boolean;
  currentValue: number;
  lastRecordedAt?: string;
};

type ScheduleDraftPayload = PresetScheduleTemplate & {
  enabled: boolean;
  lastCompletedAt?: string;
  usageValue?: number;
};

const parseMetricDrafts = (formData: FormData): MetricDraftPayload[] => parseJsonField(formData, "metricDraftsJson", {
  parse: (value: unknown): MetricDraftPayload[] => {
    if (!Array.isArray(value)) {
      throw new Error("metricDraftsJson must be an array.");
    }

    return value.map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error("Invalid metric draft.");
      }

      const record = entry as Record<string, unknown>;
      const template = presetUsageMetricTemplateSchema.parse(entry);
      const currentValue = typeof record.currentValue === "number" && Number.isFinite(record.currentValue)
        ? record.currentValue
        : template.startingValue;

      return {
        ...template,
        enabled: typeof record.enabled === "boolean" ? record.enabled : true,
        currentValue,
        ...(typeof record.lastRecordedAt === "string" ? { lastRecordedAt: record.lastRecordedAt } : {})
      };
    });
  }
}, []);

const parseScheduleDrafts = (formData: FormData): ScheduleDraftPayload[] => parseJsonField(formData, "scheduleDraftsJson", {
  parse: (value: unknown): ScheduleDraftPayload[] => {
    if (!Array.isArray(value)) {
      throw new Error("scheduleDraftsJson must be an array.");
    }

    return value.map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error("Invalid schedule draft.");
      }

      const record = entry as Record<string, unknown>;
      const template = presetScheduleTemplateSchema.parse(entry);
      const usageValue = typeof record.usageValue === "number" && Number.isFinite(record.usageValue)
        ? record.usageValue
        : undefined;

      return {
        ...template,
        enabled: typeof record.enabled === "boolean" ? record.enabled : true,
        ...(typeof record.lastCompletedAt === "string" ? { lastCompletedAt: record.lastCompletedAt } : {}),
        ...(usageValue !== undefined ? { usageValue } : {})
      };
    });
  }
}, []);

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
    scheduleTemplates: parseJsonField(formData, "scheduleTemplatesJson", presetScheduleTemplateSchema.array(), []),
    metricDrafts: parseMetricDrafts(formData),
    scheduleDrafts: parseScheduleDrafts(formData)
  };
};

const buildTriggerFromPresetTemplate = (
  triggerTemplate: PresetScheduleTemplate["triggerTemplate"],
  metricIdByKey: Map<string, string>
): MaintenanceTrigger | null => {
  switch (triggerTemplate.type) {
    case "interval":
      return {
        type: "interval",
        intervalDays: triggerTemplate.intervalDays,
        ...(triggerTemplate.anchorDate ? { anchorDate: triggerTemplate.anchorDate } : {}),
        leadTimeDays: triggerTemplate.leadTimeDays
      };
    case "usage": {
      const metricId = metricIdByKey.get(triggerTemplate.metricKey);

      if (!metricId) {
        return null;
      }

      return {
        type: "usage",
        metricId,
        intervalValue: triggerTemplate.intervalValue,
        leadTimeValue: triggerTemplate.leadTimeValue
      };
    }
    case "seasonal":
      return {
        type: "seasonal",
        month: triggerTemplate.month,
        day: triggerTemplate.day,
        leadTimeDays: triggerTemplate.leadTimeDays
      };
    case "compound": {
      const metricId = metricIdByKey.get(triggerTemplate.metricKey);

      if (!metricId) {
        return null;
      }

      return {
        type: "compound",
        intervalDays: triggerTemplate.intervalDays,
        metricId,
        intervalValue: triggerTemplate.intervalValue,
        logic: triggerTemplate.logic,
        leadTimeDays: triggerTemplate.leadTimeDays,
        leadTimeValue: triggerTemplate.leadTimeValue
      };
    }
    case "one_time":
      return {
        type: "one_time",
        dueAt: triggerTemplate.dueAt,
        leadTimeDays: triggerTemplate.leadTimeDays
      };
    default:
      return null;
  }
};

const createAssetAutomationFromDrafts = async (assetId: string, profile: AssetProfilePayload): Promise<void> => {
  const metricIdByKey = new Map<string, string>();

  for (const draft of profile.metricDrafts.filter((entry) => entry.enabled)) {
    const createdMetric = await createMetric(assetId, {
      name: draft.name,
      unit: draft.unit,
      currentValue: draft.currentValue,
      ...(draft.lastRecordedAt ? { lastRecordedAt: draft.lastRecordedAt } : {})
    });

    metricIdByKey.set(draft.key, createdMetric.id);
  }

  for (const draft of profile.scheduleDrafts.filter((entry) => entry.enabled)) {
    const triggerConfig = buildTriggerFromPresetTemplate(draft.triggerTemplate, metricIdByKey);

    if (!triggerConfig) {
      continue;
    }

    const metricKey = draft.triggerTemplate.type === "usage" || draft.triggerTemplate.type === "compound"
      ? draft.triggerTemplate.metricKey
      : undefined;
    const metricId = metricKey ? metricIdByKey.get(metricKey) : undefined;

    const createdSchedule = await createSchedule(assetId, {
      assetId,
      name: draft.name,
      triggerConfig,
      notificationConfig: draft.notificationConfig,
      ...(draft.description ? { description: draft.description } : {}),
      ...(metricId ? { metricId } : {})
    });

    if (draft.lastCompletedAt) {
      const completionInput: CompleteMaintenanceScheduleInput = {
        completedAt: draft.lastCompletedAt,
        applyLinkedParts: true,
        metadata: {}
      };

      if (draft.usageValue !== undefined) {
        completionInput.usageValue = draft.usageValue;
      }

      await completeSchedule(assetId, createdSchedule.id, completionInput);
    }
  }
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toRelativeTargetDate = (
  targetEndDate: string | undefined,
  daysBeforeTarget: number | undefined
): string | undefined => {
  if (targetEndDate === undefined || daysBeforeTarget === undefined) {
    return undefined;
  }

  const anchor = new Date(targetEndDate);
  return new Date(anchor.getTime() - (daysBeforeTarget * MS_PER_DAY)).toISOString();
};

const buildProjectWorkspaceHref = (
  householdId: string,
  projectId: string,
  focusPhaseId?: string
): string => focusPhaseId
  ? `/projects/${projectId}?householdId=${householdId}&focusPhaseId=${focusPhaseId}#phase-${focusPhaseId}`
  : `/projects/${projectId}?householdId=${householdId}`;

const resolveProjectWorkspaceHref = async (
  householdId: string,
  projectId: string,
  focusPhaseId?: string
): Promise<string> => {
  if (focusPhaseId) {
    return buildProjectWorkspaceHref(householdId, projectId, focusPhaseId);
  }

  try {
    const project = await getProjectDetail(householdId, projectId);
    return buildProjectWorkspaceHref(householdId, projectId, project.phases[0]?.id);
  } catch {
    return buildProjectWorkspaceHref(householdId, projectId);
  }
};

const seedProjectFromBlueprint = async (
  householdId: string,
  projectId: string,
  blueprint: SeededProjectBlueprint,
  targetEndDate?: string
): Promise<string | undefined> => {
  const phaseIdByKey = new Map<string, string>();
  const taskIdByKey = new Map<string, string>();
  let firstPhaseId: string | undefined;

  for (const [index, phase] of blueprint.seed.phases.entries()) {
    const createdPhase = await createProjectPhase(householdId, projectId, {
      name: phase.name,
      description: phase.description,
      status: "pending",
      sortOrder: index,
      startDate: toRelativeTargetDate(targetEndDate, phase.startDaysBeforeTarget),
      targetEndDate: toRelativeTargetDate(targetEndDate, phase.targetDaysBeforeTarget),
      notes: phase.notes
    });

    if (firstPhaseId === undefined) {
      firstPhaseId = createdPhase.id;
    }

    phaseIdByKey.set(phase.key, createdPhase.id);

    for (const [checklistIndex, title] of (phase.checklist ?? []).entries()) {
      await createPhaseChecklistItem(householdId, projectId, createdPhase.id, {
        title,
        sortOrder: checklistIndex
      });
    }
  }

  for (const category of blueprint.seed.budgetCategories) {
    await createProjectBudgetCategory(householdId, projectId, category);
  }

  for (const note of blueprint.seed.notes) {
    await createProjectNote(householdId, projectId, {
      ...note,
      isPinned: note.isPinned ?? false
    });
  }

  for (const [index, task] of blueprint.seed.tasks.entries()) {
    const predecessorTaskIds = (task.predecessorKeys ?? [])
      .map((key) => taskIdByKey.get(key))
      .filter((value): value is string => value !== undefined);

    const createdTask = await createProjectTask(householdId, projectId, {
      title: task.title,
      description: task.description,
      status: task.status ?? "pending",
      taskType: task.taskType ?? "full",
      phaseId: task.phaseKey ? phaseIdByKey.get(task.phaseKey) : undefined,
      dueDate: toRelativeTargetDate(targetEndDate, task.dueDaysBeforeTarget),
      estimatedHours: task.estimatedHours,
      estimatedCost: task.estimatedCost,
      sortOrder: index,
      predecessorTaskIds: predecessorTaskIds.length > 0 ? predecessorTaskIds : undefined
    });

    taskIdByKey.set(task.key, createdTask.id);

    for (const [checklistIndex, title] of (task.checklist ?? []).entries()) {
      await createTaskChecklistItem(householdId, projectId, createdTask.id, {
        title,
        sortOrder: checklistIndex
      });
    }
  }

  for (const [index, supply] of blueprint.seed.supplies.entries()) {
    const phaseId = phaseIdByKey.get(supply.phaseKey);

    if (!phaseId) {
      continue;
    }

    await createProjectPhaseSupply(householdId, projectId, phaseId, {
      name: supply.name,
      description: supply.description,
      quantityNeeded: supply.quantityNeeded,
      quantityOnHand: supply.quantityOnHand,
      unit: supply.unit,
      estimatedUnitCost: supply.estimatedUnitCost,
      actualUnitCost: supply.actualUnitCost,
      supplier: supply.supplier,
      supplierUrl: supply.supplierUrl,
      isProcured: supply.isProcured ?? false,
      isStaged: supply.isStaged ?? false,
      inventoryItemId: supply.inventoryItemId,
      notes: supply.notes,
      sortOrder: supply.sortOrder ?? index
    });
  }

  return firstPhaseId;
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
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
};

const revalidateDashboardPath = (): void => {
  revalidatePath("/");
};

const revalidateServiceProviderPaths = (householdId: string): void => {
  revalidatePath("/service-providers");
  revalidatePath(`/service-providers?householdId=${householdId}`);
};

const revalidateActivityPaths = (householdId: string): void => {
  revalidatePath("/activity");
  revalidatePath(`/activity?householdId=${householdId}`);
};

const revalidateInvitationPaths = (householdId: string): void => {
  revalidatePath("/invitations");
  revalidatePath(`/invitations?householdId=${householdId}`);
};

const revalidateProjectPaths = (householdId: string, projectId?: string): void => {
  revalidatePath(`/projects?householdId=${householdId}`);
  revalidatePath("/projects");

  if (projectId) {
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath(`/projects/${projectId}/phases`);
    revalidatePath(`/projects/${projectId}/supplies`);
    revalidatePath(`/projects/${projectId}/tasks`);
  }
};

const revalidateHobbyRecipePaths = (hobbyId: string, recipeId?: string): void => {
  revalidatePath("/hobbies");
  revalidatePath(`/hobbies/${hobbyId}`);

  if (recipeId) {
    revalidatePath(`/hobbies/${hobbyId}/recipes/${recipeId}`);
  }
};

const revalidateHobbySessionPaths = (hobbyId: string, sessionId?: string): void => {
  revalidatePath("/hobbies");
  revalidatePath(`/hobbies/${hobbyId}`);
  revalidatePath(`/hobbies/${hobbyId}/sessions/new`);

  if (sessionId) {
    revalidatePath(`/hobbies/${hobbyId}/sessions/${sessionId}`);
  }
};

const revalidateHobbySeriesPaths = (hobbyId: string, seriesId?: string): void => {
  revalidatePath("/hobbies");
  revalidatePath(`/hobbies/${hobbyId}`);
  revalidatePath(`/hobbies/${hobbyId}/series/new`);

  if (seriesId) {
    revalidatePath(`/hobbies/${hobbyId}/series/${seriesId}`);
    revalidatePath(`/hobbies/${hobbyId}/series/${seriesId}/compare`);
  }
};

const revalidateHobbyPaths = (hobbyId?: string): void => {
  revalidatePath("/hobbies");

  if (hobbyId) {
    revalidatePath(`/hobbies/${hobbyId}`);
    revalidatePath(`/hobbies/${hobbyId}/edit`);
    revalidatePath(`/hobbies/${hobbyId}/sessions/new`);
    revalidatePath(`/hobbies/${hobbyId}/series/new`);
  }
};

const revalidateInventoryPaths = (householdId: string): void => {
  revalidatePath("/inventory");
  revalidatePath(`/inventory?householdId=${householdId}`);
};

const revalidateInventoryDetailPath = (inventoryItemId: string): void => {
  revalidatePath(`/inventory/${inventoryItemId}`);
};

const revalidateSpacePaths = (householdId: string, spaceId?: string): void => {
  revalidateInventoryPaths(householdId);
  revalidatePath(`/inventory?householdId=${householdId}&tab=spaces`);
  revalidatePath("/inventory");

  if (spaceId) {
    revalidatePath(`/inventory/spaces/${spaceId}`);
    revalidatePath(`/inventory/spaces/${spaceId}?householdId=${householdId}`);
  }
};

const revalidateServiceProviderDetailPath = (providerId: string): void => {
  revalidatePath(`/service-providers/${providerId}`);
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

  const itemType = getOptionalString(formData, "itemType");
  const conditionStatus = getOptionalString(formData, "conditionStatus");
  const partNumber = getOptionalString(formData, "partNumber");
  const category = getOptionalString(formData, "category");
  const manufacturer = getOptionalString(formData, "manufacturer");
  const reorderThreshold = getOptionalNumber(formData, "reorderThreshold");
  const reorderQuantity = getOptionalNumber(formData, "reorderQuantity");
  const preferredSupplier = getOptionalString(formData, "preferredSupplier");
  const supplierUrl = getOptionalNormalizedUrl(formData, "supplierUrl");
  const unitCost = getOptionalNumber(formData, "unitCost");
  const storageLocation = getOptionalString(formData, "storageLocation");
  const notes = getOptionalString(formData, "notes");

  if (itemType === "consumable" || itemType === "equipment") {
    input.itemType = itemType;
  }

  if (conditionStatus) {
    input.conditionStatus = conditionStatus;
  }

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

  const item = await createInventoryItem(householdId, input);
  await emitRealtimeEvent(householdId, "inventory.changed", item.id);
  revalidateInventoryPaths(householdId);
  redirect(`/inventory?householdId=${householdId}`);
}

export async function updateInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const input: UpdateInventoryItemInput = {};

  const name = getOptionalString(formData, "name");
  const itemType = getOptionalString(formData, "itemType");
  const conditionStatus = formData.has("conditionStatus") ? getString(formData, "conditionStatus") : undefined;
  const partNumber = formData.has("partNumber") ? getNullableString(formData, "partNumber") : undefined;
  const description = formData.has("description") ? getNullableString(formData, "description") : undefined;
  const category = formData.has("category") ? getNullableString(formData, "category") : undefined;
  const manufacturer = formData.has("manufacturer") ? getNullableString(formData, "manufacturer") : undefined;
  const unit = getOptionalString(formData, "unit");
  const quantityOnHand = getOptionalNumber(formData, "quantityOnHand");
  const reorderThreshold = formData.has("reorderThreshold") ? getNullableNumber(formData, "reorderThreshold") : undefined;
  const reorderQuantity = formData.has("reorderQuantity") ? getNullableNumber(formData, "reorderQuantity") : undefined;
  const preferredSupplier = formData.has("preferredSupplier") ? getNullableString(formData, "preferredSupplier") : undefined;
  const supplierUrl = formData.has("supplierUrl") ? (getOptionalNormalizedUrl(formData, "supplierUrl") ?? null) : undefined;
  const storageLocation = formData.has("storageLocation") ? getNullableString(formData, "storageLocation") : undefined;
  const unitCost = formData.has("unitCost") ? getNullableNumber(formData, "unitCost") : undefined;
  const notes = formData.has("notes") ? getNullableString(formData, "notes") : undefined;

  if (name) {
    input.name = name;
  }

  if (itemType === "consumable" || itemType === "equipment") {
    input.itemType = itemType;
  }

  if (conditionStatus !== undefined) {
    input.conditionStatus = conditionStatus || null;
  }

  if (partNumber !== undefined) {
    input.partNumber = partNumber ?? undefined;
  }

  if (description !== undefined) {
    input.description = description ?? undefined;
  }

  if (category !== undefined) {
    input.category = category ?? undefined;
  }

  if (manufacturer !== undefined) {
    input.manufacturer = manufacturer ?? undefined;
  }

  if (unit !== undefined) {
    input.unit = unit;
  }

  if (quantityOnHand !== undefined) {
    input.quantityOnHand = quantityOnHand;
  }

  if (reorderThreshold !== undefined) {
    input.reorderThreshold = reorderThreshold ?? undefined;
  }

  if (reorderQuantity !== undefined) {
    input.reorderQuantity = reorderQuantity ?? undefined;
  }

  if (preferredSupplier !== undefined) {
    input.preferredSupplier = preferredSupplier ?? undefined;
  }

  if (storageLocation !== undefined) {
    input.storageLocation = storageLocation ?? undefined;
  }

  if (unitCost !== undefined) {
    input.unitCost = unitCost ?? undefined;
  }

  if (notes !== undefined) {
    input.notes = notes ?? undefined;
  }

  if (supplierUrl !== undefined) {
    input.supplierUrl = supplierUrl ?? undefined;
  }
  await updateInventoryItem(householdId, inventoryItemId, input);
  await emitRealtimeEvent(householdId, "inventory.changed", inventoryItemId);
  revalidateInventoryPaths(householdId);
  revalidateInventoryDetailPath(inventoryItemId);
}

export async function deleteInventoryItemAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const redirectTo = getOptionalString(formData, "redirectTo");

  await deleteInventoryItem(householdId, inventoryItemId);
  await emitRealtimeEvent(householdId, "inventory.changed", inventoryItemId);
  revalidateInventoryPaths(householdId);
  revalidateInventoryDetailPath(inventoryItemId);
  redirect(redirectTo ?? `/inventory?householdId=${householdId}`);
}

export async function createSpace(householdId: string, data: CreateSpaceInput) {
  const space = await createSpaceRequest(householdId, data);
  revalidateSpacePaths(householdId, space.id);
  return space;
}

export async function updateSpace(householdId: string, spaceId: string, data: UpdateSpaceInput) {
  const space = await updateSpaceRequest(householdId, spaceId, data);
  revalidateSpacePaths(householdId, space.id);
  return space;
}

export async function deleteSpace(householdId: string, spaceId: string): Promise<void> {
  await deleteSpaceRequest(householdId, spaceId);
  revalidateSpacePaths(householdId, spaceId);
}

export async function restoreSpace(householdId: string, spaceId: string) {
  const space = await restoreSpaceRequest(householdId, spaceId);
  revalidateSpacePaths(householdId, space.id);
  return space;
}

export async function moveSpace(householdId: string, spaceId: string, newParentSpaceId: string | null) {
  const input: MoveSpaceInput = { newParentSpaceId };
  const space = await moveSpaceRequest(householdId, spaceId, input);
  revalidateSpacePaths(householdId, space.id);
  return space;
}

export async function addItemToSpace(householdId: string, spaceId: string, data: AddSpaceItemInput) {
  const link = await addItemToSpaceRequest(householdId, spaceId, data);
  revalidateSpacePaths(householdId, spaceId);
  revalidateInventoryDetailPath(data.inventoryItemId);
  return link;
}

export async function removeItemFromSpace(householdId: string, spaceId: string, inventoryItemId: string): Promise<void> {
  await removeItemFromSpaceRequest(householdId, spaceId, inventoryItemId);
  revalidateSpacePaths(householdId, spaceId);
  revalidateInventoryDetailPath(inventoryItemId);
}

export async function addGeneralItemToSpace(householdId: string, spaceId: string, data: SpaceGeneralItemInput) {
  const item = await addGeneralItemToSpaceRequest(householdId, spaceId, data);
  revalidateSpacePaths(householdId, spaceId);
  return item;
}

export async function updateGeneralItem(
  householdId: string,
  spaceId: string,
  generalItemId: string,
  data: UpdateSpaceGeneralItemInput
) {
  const item = await updateGeneralItemRequest(householdId, spaceId, generalItemId, data);
  revalidateSpacePaths(householdId, spaceId);
  return item;
}

export async function deleteGeneralItem(householdId: string, spaceId: string, generalItemId: string): Promise<void> {
  await deleteGeneralItemRequest(householdId, spaceId, generalItemId);
  revalidateSpacePaths(householdId, spaceId);
}

export async function getSpaceContents(householdId: string, spaceId: string): Promise<SpaceContentsResponse> {
  return getSpaceContentsRequest(householdId, spaceId);
}

export async function generateInventoryShoppingListAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");

  await generateInventoryShoppingList(householdId);
  revalidateInventoryPaths(householdId);
  revalidatePath("/analytics");
  redirect(`/inventory?householdId=${householdId}`);
}

export async function updateInventoryPurchaseLineAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const purchaseId = getRequiredString(formData, "purchaseId");
  const lineId = getRequiredString(formData, "lineId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const status = getOptionalString(formData, "status");
  const redirectTo = getOptionalString(formData, "redirectTo") ?? `/inventory?householdId=${householdId}`;

  const input: UpdateInventoryPurchaseLineInput = {};
  const plannedQuantity = getOptionalNumber(formData, "plannedQuantity");
  const orderedQuantity = getOptionalNumber(formData, "orderedQuantity");
  const receivedQuantity = getOptionalNumber(formData, "receivedQuantity");
  const unitCost = getOptionalNumber(formData, "unitCost");
  const notes = getOptionalString(formData, "notes");

  if (plannedQuantity !== undefined) {
    input.plannedQuantity = plannedQuantity;
  }

  if (orderedQuantity !== undefined) {
    input.orderedQuantity = orderedQuantity;
  }

  if (receivedQuantity !== undefined) {
    input.receivedQuantity = receivedQuantity;
  }

  if (unitCost !== undefined) {
    input.unitCost = unitCost;
  }

  if (notes !== undefined) {
    input.notes = notes;
  }

  if (status === "draft" || status === "ordered" || status === "received") {
    input.status = status;
  }

  await updateInventoryPurchaseLine(householdId, purchaseId, lineId, input);
  revalidateInventoryPaths(householdId);
  revalidateInventoryDetailPath(inventoryItemId);
  revalidatePath("/analytics");
  redirect(redirectTo);
}

export async function createQuickRestockAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const redirectTo = getOptionalString(formData, "redirectTo") ?? `/inventory?householdId=${householdId}`;
  const itemsPayload = getRequiredString(formData, "itemsPayload");
  const parsedItems = JSON.parse(itemsPayload) as CreateQuickRestockInput["items"];

  const input: CreateQuickRestockInput = {
    items: parsedItems
  };

  const supplierName = getOptionalString(formData, "supplierName");
  const supplierUrl = getOptionalNormalizedUrl(formData, "supplierUrl");
  const notes = getOptionalString(formData, "notes");
  const receivedAt = toIsoString(getOptionalString(formData, "receivedAt"));

  if (supplierName) {
    input.supplierName = supplierName;
  }

  if (supplierUrl) {
    input.supplierUrl = supplierUrl;
  }

  if (notes) {
    input.notes = notes;
  }

  if (receivedAt) {
    input.receivedAt = receivedAt;
  }

  const purchase = await createQuickRestockBatch(householdId, input);
  revalidateInventoryPaths(householdId);
  revalidatePath("/analytics");

  for (const line of purchase.lines) {
    revalidateInventoryDetailPath(line.inventoryItemId);
  }

  redirect(redirectTo);
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

  try {
    await createAssetAutomationFromDrafts(asset.id, profile);
  } catch (error) {
    console.error("[createAssetAction] Failed to create metric/schedule drafts:", error);
  }

  await maybeCreatePresetProfileFromForm(
    formData,
    input.category,
    profile.fieldDefinitions,
    profile.metricTemplates,
    profile.scheduleTemplates
  );

  await emitRealtimeEvent(input.householdId, "asset.updated", asset.id);
  revalidateAssetPaths(asset.id);
  revalidateDashboardPath();
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

  await emitRealtimeEvent(input.householdId, "asset.updated", assetId);
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
  revalidatePath("/notifications");
}

export async function markNotificationsReadAction(formData: FormData): Promise<void> {
  const notificationIds = formData
    .getAll("notificationId")
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);

  await Promise.all(notificationIds.map((notificationId) => markNotificationRead(notificationId)));
  revalidatePath("/notifications");
}

export async function markNotificationUnreadAction(formData: FormData): Promise<void> {
  await markNotificationUnread(getRequiredString(formData, "notificationId"));
  revalidatePath("/notifications");
}

export async function markNotificationsUnreadAction(formData: FormData): Promise<void> {
  const notificationIds = formData
    .getAll("notificationId")
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);

  await Promise.all(notificationIds.map((notificationId) => markNotificationUnread(notificationId)));
  revalidatePath("/notifications");
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
  revalidatePath("/maintenance");
  revalidateDashboardPath();
}

export async function completeScheduleAction(formData: FormData): Promise<void> {
  const householdId = getOptionalString(formData, "householdId");
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");
  const input: CompleteMaintenanceScheduleInput = {
    applyLinkedParts: getOptionalString(formData, "applyLinkedParts") !== "false",
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
  await emitRealtimeEvent(householdId, "maintenance.completed", scheduleId);
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
  revalidateDashboardPath();
}

export async function createLogAction(formData: FormData): Promise<void> {
  const householdId = getOptionalString(formData, "householdId");
  const assetId = getRequiredString(formData, "assetId");
  const input: CreateMaintenanceLogInput = {
    applyLinkedParts: getOptionalString(formData, "applyLinkedParts") !== "false",
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
  await emitRealtimeEvent(householdId, "maintenance.completed", assetId);
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
  revalidateDashboardPath();
}

export async function applyPresetToAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  await applyPreset(assetId, {
    source: "library",
    presetKey: getRequiredString(formData, "presetKey")
  });
  revalidateAssetPaths(assetId);
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
  const householdId = getOptionalString(formData, "householdId");
  const input: UpdateCommentInput = {
    body: getRequiredString(formData, "body")
  };

  await updateComment(assetId, commentId, input);
  revalidateAssetPaths(assetId);

  if (householdId) {
    revalidateActivityPaths(householdId);
  }
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

export async function createInventoryCommentAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const input: CreateCommentInput = {
    body: getRequiredString(formData, "body")
  };

  const parentCommentId = getOptionalString(formData, "parentCommentId");

  if (parentCommentId) {
    input.parentCommentId = parentCommentId;
  }

  await createInventoryComment(householdId, inventoryItemId, input);
  revalidateInventoryDetailPath(inventoryItemId);
  revalidateInventoryPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function updateInventoryCommentAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const commentId = getRequiredString(formData, "commentId");
  const input: UpdateCommentInput = {
    body: getRequiredString(formData, "body")
  };

  await updateInventoryComment(householdId, inventoryItemId, commentId, input);
  revalidateInventoryDetailPath(inventoryItemId);
  revalidateInventoryPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function deleteInventoryCommentAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const inventoryItemId = getRequiredString(formData, "inventoryItemId");
  const commentId = getRequiredString(formData, "commentId");

  await deleteInventoryComment(householdId, inventoryItemId, commentId);
  revalidateInventoryDetailPath(inventoryItemId);
  revalidateInventoryPaths(householdId);
  revalidateActivityPaths(householdId);
}

export async function createTimelineEntryAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const householdId = getOptionalString(formData, "householdId");
  const tags = getOptionalString(formData, "tags")
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const input: CreateAssetTimelineEntryInput = {
    title: getRequiredString(formData, "title"),
    entryDate: toIsoString(getRequiredString(formData, "entryDate")) ?? new Date().toISOString()
  };

  const description = getOptionalString(formData, "description");
  const category = getOptionalString(formData, "category");
  const cost = getOptionalNumber(formData, "cost");
  const vendor = getOptionalString(formData, "vendor");

  if (description) {
    input.description = description;
  }

  if (category) {
    input.category = category;
  }

  if (cost !== undefined) {
    input.cost = cost;
  }

  if (vendor) {
    input.vendor = vendor;
  }

  if (tags && tags.length > 0) {
    input.tags = tags;
  }

  if (!householdId) {
    await createAssetTimelineEntry(assetId, input);
  } else {
    const entryDetails = buildAssetEntryDetails({
      title: input.title,
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(cost !== undefined ? { cost } : {}),
      ...(vendor !== undefined ? { vendor } : {}),
      ...(tags !== undefined ? { tags } : {})
    });

    await createEntry(householdId, {
      title: input.title,
      body: entryDetails.body,
      entryDate: input.entryDate,
      entityType: "asset",
      entityId: assetId,
      entryType: entryDetails.entryType,
      measurements: entryDetails.measurements,
      tags: entryDetails.tags,
      flags: [],
      attachmentName: entryDetails.attachmentName
    });
  }

  revalidateAssetPaths(assetId);

  if (householdId) {
    revalidateActivityPaths(householdId);
  }
}

export async function updateTimelineEntryAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const entryId = getRequiredString(formData, "entryId");
  const householdId = getOptionalString(formData, "householdId");
  const sourceSystem = getOptionalString(formData, "sourceSystem") ?? "legacy";
  const input: UpdateAssetTimelineEntryInput = {};

  const title = getOptionalString(formData, "title");
  const description = getOptionalString(formData, "description");
  const entryDate = toIsoString(getOptionalString(formData, "entryDate"));
  const category = getOptionalString(formData, "category");
  const cost = getOptionalNumber(formData, "cost");
  const vendor = getOptionalString(formData, "vendor");
  const tags = getOptionalString(formData, "tags")
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (title) {
    input.title = title;
  }

  if (description) {
    input.description = description;
  }

  if (entryDate) {
    input.entryDate = entryDate;
  }

  if (category) {
    input.category = category;
  }

  if (cost !== undefined) {
    input.cost = cost;
  }

  if (vendor) {
    input.vendor = vendor;
  }

  if (tags && tags.length > 0) {
    input.tags = tags;
  }

  if (sourceSystem === "entry") {
    const entryDetails = buildAssetEntryDetails({
      title: title ?? getRequiredString(formData, "title"),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(cost !== undefined ? { cost } : {}),
      ...(vendor !== undefined ? { vendor } : {}),
      ...(tags !== undefined ? { tags } : {})
    });

    if (!householdId) {
      throw new Error("householdId is required to update entry-backed asset notes.");
    }

    await updateEntry(householdId, entryId, {
      ...(title ? { title } : {}),
      ...(entryDate ? { entryDate } : {}),
      entryType: entryDetails.entryType,
      body: entryDetails.body,
      measurements: entryDetails.measurements,
      tags: entryDetails.tags,
      attachmentName: entryDetails.attachmentName
    });
  } else {
    await updateAssetTimelineEntry(assetId, entryId, input);
  }

  revalidateAssetPaths(assetId);

  if (householdId) {
    revalidateActivityPaths(householdId);
  }
}

export async function deleteTimelineEntryAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const entryId = getRequiredString(formData, "entryId");
  const householdId = getOptionalString(formData, "householdId");
  const sourceSystem = getOptionalString(formData, "sourceSystem") ?? "legacy";

  if (sourceSystem === "entry") {
    if (!householdId) {
      throw new Error("householdId is required to delete entry-backed asset notes.");
    }

    await deleteEntry(householdId, entryId);
  } else {
    await deleteAssetTimelineEntry(assetId, entryId);
  }

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

  const estimatedCost = getOptionalNumber(formData, "estimatedCost");
  const estimatedMinutes = getOptionalNumber(formData, "estimatedMinutes");

  if (estimatedCost !== undefined) {
    input.estimatedCost = estimatedCost;
  }

  if (estimatedMinutes !== undefined) {
    input.estimatedMinutes = Math.trunc(estimatedMinutes);
  }

  await createSchedule(assetId, input);
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
}

export async function toggleScheduleActiveAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");
  const isActive = getRequiredString(formData, "isActive") === "true";

  await updateSchedule(assetId, scheduleId, { isActive });
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
  revalidateDashboardPath();
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const scheduleId = getRequiredString(formData, "scheduleId");

  await deleteSchedule(assetId, scheduleId);
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
  revalidateDashboardPath();
}

export async function archiveAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const householdId = getOptionalString(formData, "householdId");
  const redirectTo = getOptionalString(formData, "redirectTo");
  await archiveAsset(assetId);
  await emitRealtimeEvent(householdId, "asset.updated", assetId);
  revalidatePath("/assets");
  revalidatePath("/maintenance");
  revalidateDashboardPath();
  if (redirectTo !== "none") {
    redirect(redirectTo ?? "/assets");
  }
}

export async function unarchiveAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const householdId = getOptionalString(formData, "householdId");
  await unarchiveAsset(assetId);
  await emitRealtimeEvent(householdId, "asset.updated", assetId);
  revalidateAssetPaths(assetId);
  revalidatePath("/maintenance");
}

export async function softDeleteAssetAction(formData: FormData): Promise<void> {
  const assetId = getRequiredString(formData, "assetId");
  const householdId = getOptionalString(formData, "householdId");
  const redirectTo = getOptionalString(formData, "redirectTo");
  await softDeleteAsset(assetId);
  await emitRealtimeEvent(householdId, "asset.updated", assetId);
  revalidatePath("/assets");
  revalidatePath("/maintenance");
  revalidateDashboardPath();
  if (redirectTo !== "none") {
    redirect(redirectTo ?? "/assets");
  }
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
  revalidateServiceProviderDetailPath(providerId);
}

export async function deleteServiceProviderAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const providerId = getRequiredString(formData, "providerId");
  const redirectTo = getOptionalString(formData, "redirectTo");

  await deleteServiceProvider(householdId, providerId);
  revalidateServiceProviderPaths(householdId);
  revalidateServiceProviderDetailPath(providerId);
  revalidateActivityPaths(householdId);

  if (redirectTo) {
    redirect(redirectTo);
  }
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
  const blueprint = getProjectBlueprintByKey(getOptionalString(formData, "templateKey"));
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

  const parentProjectId = getOptionalString(formData, "parentProjectId");
  if (parentProjectId) {
    input.parentProjectId = parentProjectId;
  }

  const project = await createProject(householdId, input);

  if (isSeededProjectBlueprint(blueprint)) {
    const firstPhaseId = await seedProjectFromBlueprint(householdId, project.id, blueprint, input.targetEndDate);
    revalidateProjectPaths(householdId, project.id);
    redirect(buildProjectWorkspaceHref(householdId, project.id, firstPhaseId));
  }

  const rawSuggestedPhases = getOptionalString(formData, "suggestedPhasesJson");
  let firstPhaseId: string | undefined;
  if (rawSuggestedPhases) {
    let suggestedPhases: string[] = [];

    try {
      const parsed = JSON.parse(rawSuggestedPhases) as unknown;
      if (Array.isArray(parsed)) {
        suggestedPhases = parsed
          .filter((phaseName): phaseName is string => typeof phaseName === "string")
          .map((phaseName) => phaseName.trim())
          .filter((phaseName) => phaseName.length > 0);
      }
    } catch {
      suggestedPhases = [];
    }

    for (const [index, phaseName] of suggestedPhases.entries()) {
      const createdPhase = await createProjectPhase(householdId, project.id, {
        name: phaseName,
        status: "pending",
        sortOrder: index
      });

      if (firstPhaseId === undefined) {
        firstPhaseId = createdPhase.id;
      }
    }
  }

  revalidateProjectPaths(householdId, project.id);
  redirect(buildProjectWorkspaceHref(householdId, project.id, firstPhaseId));
}

export async function createProjectFromTemplateAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const templateId = getRequiredString(formData, "templateId");
  const input: InstantiateProjectTemplateInput = {
    name: getRequiredString(formData, "name")
  };

  const startDate = toIsoString(getOptionalString(formData, "startDate"));
  const targetEndDate = toIsoString(getOptionalString(formData, "targetEndDate"));
  const parentProjectId = getOptionalString(formData, "parentProjectId");

  if (startDate) {
    input.startDate = startDate;
  }

  if (targetEndDate) {
    input.targetEndDate = targetEndDate;
  }

  if (parentProjectId) {
    input.parentProjectId = parentProjectId;
  }

  const project = await instantiateProjectTemplate(householdId, templateId, input);
  revalidateProjectPaths(householdId, project.id);
  redirect(await resolveProjectWorkspaceHref(householdId, project.id));
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
    notes: getNullableString(formData, "notes"),
    parentProjectId: getNullableString(formData, "parentProjectId")
  };

  await updateProject(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function saveProjectAsTemplateAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const sourceProjectId = getRequiredString(formData, "projectId");
  const input: CreateProjectTemplateInput = {
    sourceProjectId,
    name: getRequiredString(formData, "templateName")
  };

  const description = getOptionalString(formData, "templateDescription");
  const notes = getOptionalString(formData, "templateNotes");

  if (description) {
    input.description = description;
  }

  if (notes) {
    input.notes = notes;
  }

  await createProjectTemplate(householdId, input);
  revalidateProjectPaths(householdId, sourceProjectId);
}

export async function cloneProjectAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CloneProjectInput = {
    name: getRequiredString(formData, "name")
  };

  const startDate = toIsoString(getOptionalString(formData, "startDate"));
  const targetEndDate = toIsoString(getOptionalString(formData, "targetEndDate"));
  const parentProjectId = getOptionalString(formData, "parentProjectId");

  if (startDate) {
    input.startDate = startDate;
  }

  if (targetEndDate) {
    input.targetEndDate = targetEndDate;
  }

  if (parentProjectId) {
    input.parentProjectId = parentProjectId;
  }

  const project = await cloneProject(householdId, projectId, input);
  revalidateProjectPaths(householdId, project.id);
  redirect(await resolveProjectWorkspaceHref(householdId, project.id));
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
  const redirectTo = getOptionalString(formData, "redirectTo");

  await deleteProject(householdId, projectId);
  revalidateProjectPaths(householdId);
  if (redirectTo !== "none") {
    redirect(redirectTo ?? `/projects?householdId=${householdId}`);
  }
}

export async function addProjectAssetAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateProjectAssetInput = {
    assetId: getRequiredString(formData, "assetId")
  };

  const relationship = getOptionalString(formData, "relationship");
  const role = getOptionalString(formData, "role");
  const notes = getOptionalString(formData, "notes");

  if (relationship) {
    input.relationship = relationship as CreateProjectAssetInput["relationship"];
  }

  if (role) {
    input.role = role;
  }

  if (notes) {
    input.notes = notes;
  }

  await addProjectAsset(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectAssetAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const projectAssetId = getRequiredString(formData, "projectAssetId");
  const input: UpdateProjectAssetInput = {};

  const relationship = getOptionalString(formData, "relationship");
  const role = formData.has("role") ? (getString(formData, "role") || null) : undefined;
  const notes = formData.has("notes") ? (getString(formData, "notes") || null) : undefined;

  if (relationship) {
    input.relationship = relationship as UpdateProjectAssetInput["relationship"];
  }
  if (role !== undefined) {
    input.role = role;
  }
  if (notes !== undefined) {
    input.notes = notes;
  }

  await updateProjectAsset(householdId, projectId, projectAssetId, input);
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
  const phaseId = getOptionalString(formData, "phaseId");
  const assignedToId = getOptionalString(formData, "assignedToId");
  const dueDate = toIsoString(getOptionalString(formData, "dueDate"));
  const estimatedCost = getOptionalNumber(formData, "estimatedCost");
  const actualCost = getOptionalNumber(formData, "actualCost");
  const estimatedHours = getOptionalNumber(formData, "estimatedHours");
  const actualHours = getOptionalNumber(formData, "actualHours");
  const sortOrder = getOptionalNumber(formData, "sortOrder");
  const predecessorTaskIds = getRepeatedStrings(formData, "predecessorTaskIds");

  if (description) {
    input.description = description;
  }

  if (phaseId) {
    input.phaseId = phaseId;
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

  if (estimatedHours !== undefined) {
    input.estimatedHours = estimatedHours;
  }

  if (actualHours !== undefined) {
    input.actualHours = actualHours;
  }

  if (sortOrder !== undefined) {
    input.sortOrder = sortOrder;
  }

  if (predecessorTaskIds.length > 0) {
    input.predecessorTaskIds = predecessorTaskIds;
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
    phaseId: getNullableString(formData, "phaseId"),
    assignedToId: getNullableString(formData, "assignedToId"),
    dueDate: toNullableIsoString(getNullableString(formData, "dueDate")),
    estimatedCost: getNullableNumber(formData, "estimatedCost"),
    actualCost: getNullableNumber(formData, "actualCost"),
    estimatedHours: getNullableNumber(formData, "estimatedHours"),
    actualHours: getNullableNumber(formData, "actualHours"),
    sortOrder: getNullableNumber(formData, "sortOrder"),
    predecessorTaskIds: getRepeatedStrings(formData, "predecessorTaskIds"),
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

export async function createQuickTodoAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const input: CreateQuickTodoInput = {
    title: getRequiredString(formData, "title")
  };

  const phaseId = getOptionalString(formData, "phaseId");
  if (phaseId) { input.phaseId = phaseId; }

  await createQuickTodo(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
}

export async function toggleQuickTodoAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");
  const isCompleted = getRequiredString(formData, "isCompleted") === "true";

  await updateProjectTask(householdId, projectId, taskId, { isCompleted });
  revalidateProjectPaths(householdId, projectId);
}

export async function promoteTaskAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const taskId = getRequiredString(formData, "taskId");

  await promoteTask(householdId, projectId, taskId);
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

export async function createProjectNoteAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const title = getRequiredString(formData, "title");
  const body = getOptionalString(formData, "body") ?? "";
  const rawCategory = getOptionalString(formData, "category") ?? "general";
  const category = rawCategory as CreateProjectNoteInput["category"];
  const url = getOptionalString(formData, "url");
  const phaseId = getOptionalString(formData, "phaseId");
  const isPinnedRaw = getOptionalString(formData, "isPinned");
  const isPinned = isPinnedRaw === "true";

  const entryDetails = buildProjectEntryDetails({
    title,
    body,
    category,
    ...(url !== undefined ? { url } : {}),
    isPinned
  });

  await createEntry(householdId, {
    title,
    body: entryDetails.body,
    bodyFormat: "rich_text",
    entryDate: new Date().toISOString(),
    entityType: phaseId ? "project_phase" : "project",
    entityId: phaseId ?? projectId,
    entryType: entryDetails.entryType,
    measurements: [],
    tags: entryDetails.tags,
    flags: entryDetails.flags,
    attachmentUrl: entryDetails.attachmentUrl,
    attachmentName: entryDetails.attachmentName
  });

  revalidateProjectPaths(householdId, projectId);
}

export async function updateProjectNoteAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const noteId = getRequiredString(formData, "noteId");
  const sourceSystem = getOptionalString(formData, "sourceSystem") ?? "legacy";

  if (sourceSystem === "entry") {
    const title = getRequiredString(formData, "title");
    const body = getNullableString(formData, "body") ?? "";
    const rawCategory = getOptionalString(formData, "category") ?? "general";
    const category = rawCategory as CreateProjectNoteInput["category"];
    const url = getOptionalString(formData, "url");
    const isPinnedRaw = getOptionalString(formData, "isPinned");
    const isPinned = isPinnedRaw === "true";

    const entryDetails = buildProjectEntryDetails({
      title,
      body,
      category,
      ...(url !== undefined ? { url } : {}),
      isPinned
    });

    await updateEntry(householdId, noteId, {
      title,
      body: entryDetails.body,
      bodyFormat: "rich_text",
      tags: entryDetails.tags,
      flags: entryDetails.flags,
      attachmentUrl: entryDetails.attachmentUrl,
      attachmentName: entryDetails.attachmentName
    });
  } else {
    const input: UpdateProjectNoteInput = {
      title: getRequiredString(formData, "title"),
      body: getNullableString(formData, "body") ?? "",
      category: getRequiredString(formData, "category") as UpdateProjectNoteInput["category"],
      url: getNullableString(formData, "url"),
      phaseId: getNullableString(formData, "phaseId")
    };

    await updateProjectNote(householdId, projectId, noteId, input);
  }

  revalidateProjectPaths(householdId, projectId);
}

export async function deleteProjectNoteAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const noteId = getRequiredString(formData, "noteId");
  const sourceSystem = getOptionalString(formData, "sourceSystem") ?? "legacy";

  if (sourceSystem === "entry") {
    await deleteEntry(householdId, noteId);
  } else {
    await deleteProjectNote(householdId, projectId, noteId);
  }

  revalidateProjectPaths(householdId, projectId);
}

export async function toggleProjectNotePinAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const noteId = getRequiredString(formData, "noteId");
  const isPinned = getRequiredString(formData, "isPinned") === "true";
  const sourceSystem = getOptionalString(formData, "sourceSystem") ?? "legacy";

  if (sourceSystem === "entry") {
    await updateEntry(householdId, noteId, { flags: isPinned ? ["pinned"] : [] });
  } else {
    await updateProjectNote(householdId, projectId, noteId, { isPinned });
  }

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

  const category = getOptionalString(formData, "category");
  const description = getOptionalString(formData, "description");
  const quantityOnHand = getOptionalNumber(formData, "quantityOnHand");
  const unit = getOptionalString(formData, "unit");
  const estimatedUnitCost = getOptionalNumber(formData, "estimatedUnitCost");
  const actualUnitCost = getOptionalNumber(formData, "actualUnitCost");
  const supplier = getOptionalString(formData, "supplier");
  const supplierUrl = getOptionalNormalizedUrl(formData, "supplierUrl");
  const isProcured = getOptionalBoolean(formData, "isProcured");
  const isStaged = getOptionalBoolean(formData, "isStaged");
  const inventoryItemId = getOptionalString(formData, "inventoryItemId");
  const notes = getOptionalString(formData, "notes");
  const sortOrder = getOptionalNumber(formData, "sortOrder");

  if (category) input.category = category;
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
    category: getNullableString(formData, "category"),
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

export async function updateProjectPhaseSupplyCategoryAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyId = getRequiredString(formData, "supplyId");

  await updateProjectPhaseSupply(householdId, projectId, phaseId, supplyId, {
    category: getNullableString(formData, "category")
  });

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

export async function toggleProjectPhaseSupplyPurchasedAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyId = getRequiredString(formData, "supplyId");

  await updateProjectPhaseSupply(householdId, projectId, phaseId, supplyId, {
    isProcured: getOptionalBoolean(formData, "isProcured")
  });

  revalidateProjectPaths(householdId, projectId);
}

export async function reorderProjectPhaseSuppliesAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const phaseId = getRequiredString(formData, "phaseId");
  const supplyIdsJson = getRequiredString(formData, "supplyIds");
  const parsed = JSON.parse(supplyIdsJson) as unknown;

  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
    throw new Error("supplyIds must be a JSON array of supply ID strings.");
  }

  await reorderProjectPhaseSupplies(householdId, projectId, phaseId, parsed);
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

export async function createProjectPurchaseRequestsAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const projectId = getRequiredString(formData, "projectId");
  const supplyIdsPayload = getOptionalString(formData, "supplyIdsJson");
  const input: CreateProjectPurchaseRequestInput = {};

  if (supplyIdsPayload) {
    const parsed = JSON.parse(supplyIdsPayload) as unknown;

    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
      throw new Error("supplyIdsJson must be a JSON array of supply IDs.");
    }

    input.supplyIds = parsed;
  }

  await createProjectPurchaseRequests(householdId, projectId, input);
  revalidateProjectPaths(householdId, projectId);
  revalidateInventoryPaths(householdId);
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

export async function revalidateAttachmentsAction(formData: FormData): Promise<void> {
  const assetId = getOptionalString(formData, "assetId");
  if (assetId) {
    revalidateAssetPaths(assetId);
  }
  const projectId = getOptionalString(formData, "projectId");
  const householdId = getOptionalString(formData, "householdId");
  if (projectId && householdId) {
    revalidateProjectPaths(householdId, projectId);
  }
}

// ── Hobbies ──────────────────────────────────────────────────────────

export async function createHobbyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const statusPipeline = parseJsonField(formData, "statusPipelineJson", hobbyPresetPipelineStepSchema.array(), []);
  const input: CreateHobbyInput = {
    name: getRequiredString(formData, "name"),
    statusPipeline,
  };

  const description = getOptionalString(formData, "description");
  const status = getOptionalString(formData, "status") as HobbyStatus | undefined;
  const hobbyType = getOptionalString(formData, "hobbyType");
  const lifecycleMode = getOptionalString(formData, "lifecycleMode") as HobbySessionLifecycleMode | undefined;
  const presetKey = getOptionalString(formData, "presetKey");

  if (description) input.description = description;
  if (status) input.status = status;
  if (hobbyType) input.hobbyType = hobbyType;
  if (lifecycleMode) input.lifecycleMode = lifecycleMode;
  if (presetKey) input.presetKey = presetKey;

  const hobby = await createHobby(householdId, input);
  revalidateHobbyPaths(hobby.id);
  redirect(`/hobbies/${hobby.id}`);
}

export async function updateHobbyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const input: UpdateHobbyInput = {
    statusPipeline: parseJsonField(formData, "statusPipelineJson", hobbyPresetPipelineStepSchema.array(), []),
  };

  const name = getOptionalString(formData, "name");
  const status = getOptionalString(formData, "status") as HobbyStatus | undefined;
  const lifecycleMode = getOptionalString(formData, "lifecycleMode") as HobbySessionLifecycleMode | undefined;
  const hobbyType = getOptionalString(formData, "hobbyType");

  if (name) input.name = name;
  if (status) input.status = status;
  if (lifecycleMode) input.lifecycleMode = lifecycleMode;
  if (hobbyType) input.hobbyType = hobbyType;

  input.description = getNullableString(formData, "description");
  input.notes = getNullableString(formData, "notes");

  await updateHobby(householdId, hobbyId, input);
  revalidateHobbyPaths(hobbyId);
  redirect(`/hobbies/${hobbyId}`);
}

export async function archiveHobbyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const redirectTo = getOptionalString(formData, "redirectTo");

  await updateHobby(householdId, hobbyId, { status: "archived" });
  await emitRealtimeEvent(householdId, "hobby.session-progress", hobbyId);
  revalidateHobbyPaths(hobbyId);
  if (redirectTo !== "none") {
    redirect(redirectTo ?? `/hobbies/${hobbyId}?tab=settings`);
  }
}

export async function restoreHobbyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");

  await updateHobby(householdId, hobbyId, { status: "active" });
  await emitRealtimeEvent(householdId, "hobby.session-progress", hobbyId);
  revalidateHobbyPaths(hobbyId);
  redirect(`/hobbies/${hobbyId}?tab=settings`);
}

export async function deleteHobbyAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const redirectTo = getOptionalString(formData, "redirectTo");

  await deleteHobby(householdId, hobbyId);
  await emitRealtimeEvent(householdId, "hobby.session-progress", hobbyId);
  revalidateHobbyPaths();
  if (redirectTo !== "none") {
    redirect(redirectTo ?? "/hobbies");
  }
}

export async function createHobbyRecipeAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const description = getOptionalString(formData, "description");
  const styleCategory = getOptionalString(formData, "styleCategory");
  const estimatedDuration = getOptionalString(formData, "estimatedDuration");
  const estimatedCost = getOptionalNumber(formData, "estimatedCost");
  const yieldValue = getOptionalString(formData, "yield");
  const notes = getOptionalString(formData, "notes");
  const ingredients = parseJsonField(
    formData,
    "ingredientsJson",
    createHobbyRecipeIngredientInputSchema.array(),
    []
  );
  const steps = parseJsonField(
    formData,
    "stepsJson",
    createHobbyRecipeStepInputSchema.array(),
    []
  );

  const input: CreateHobbyRecipeInput = {
    name: getRequiredString(formData, "name"),
    ingredients,
    steps
  };

  if (description) input.description = description;
  if (styleCategory) input.styleCategory = styleCategory;
  if (estimatedDuration) input.estimatedDuration = estimatedDuration;
  if (estimatedCost !== undefined) input.estimatedCost = estimatedCost;
  if (yieldValue) input.yield = yieldValue;
  if (notes) input.notes = notes;

  const recipe = await createHobbyRecipe(householdId, hobbyId, input);
  revalidateHobbyRecipePaths(hobbyId, recipe.id);
  redirect(`/hobbies/${hobbyId}/recipes/${recipe.id}`);
}

export async function updateHobbyRecipeAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const recipeId = getRequiredString(formData, "recipeId");
  const input: UpdateHobbyRecipeInput = {};

  const name = getOptionalString(formData, "name");

  if (name) {
    input.name = name;
  }

  input.description = getNullableString(formData, "description");
  input.styleCategory = getNullableString(formData, "styleCategory");
  input.estimatedDuration = getNullableString(formData, "estimatedDuration");
  input.estimatedCost = getNullableNumber(formData, "estimatedCost");
  input.yield = getNullableString(formData, "yield");
  input.notes = getNullableString(formData, "notes");

  await updateHobbyRecipe(householdId, hobbyId, recipeId, input);
  revalidateHobbyRecipePaths(hobbyId, recipeId);
}

export async function deleteHobbyRecipeAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const recipeId = getRequiredString(formData, "recipeId");

  await deleteHobbyRecipe(householdId, hobbyId, recipeId);
  revalidateHobbyRecipePaths(hobbyId);
  redirect(`/hobbies/${hobbyId}?tab=recipes`);
}

export async function createSessionFromRecipeAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const recipeId = getRequiredString(formData, "recipeId");
  const recipeName = getRequiredString(formData, "recipeName");

  const input: CreateHobbySessionInput = {
    name: `Session from ${recipeName}`,
    recipeId
  };

  const session = await createHobbySession(householdId, hobbyId, input);
  revalidateHobbySessionPaths(hobbyId, session.id);
  redirect(`/hobbies/${hobbyId}/sessions/${session.id}`);
}

export async function createHobbySessionAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");

  const input: CreateHobbySessionInput = {
    name: getRequiredString(formData, "name"),
  };

  const recipeId = getOptionalString(formData, "recipeId");
  const startDate = getOptionalString(formData, "startDate");
  const notes = getOptionalString(formData, "notes");
  const routineId = getOptionalString(formData, "routineId");
  const collectionItemId = getOptionalString(formData, "collectionItemId");
  const existingSeriesId = getOptionalString(formData, "seriesId");
  const newSeriesName = getOptionalString(formData, "newSeriesName");
  const newSeriesDescription = getOptionalString(formData, "newSeriesDescription");
  const newSeriesTags = getOptionalString(formData, "newSeriesTags");

  if (recipeId) input.recipeId = recipeId;
  if (routineId) input.routineId = routineId;
  if (collectionItemId) input.collectionItemId = collectionItemId;
  if (startDate) input.startDate = new Date(`${startDate}T00:00:00.000Z`).toISOString();
  if (notes) input.notes = notes;

  let linkedSeriesId = existingSeriesId || "";

  if (!linkedSeriesId && newSeriesName) {
    const seriesInput: CreateHobbySeriesInput = {
      name: newSeriesName,
      ...(newSeriesDescription ? { description: newSeriesDescription } : {}),
      ...(newSeriesTags
        ? {
            tags: newSeriesTags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : {}),
    };

    const series = await createHobbySeries(householdId, hobbyId, seriesInput);
    linkedSeriesId = series.id;
    revalidateHobbySeriesPaths(hobbyId, series.id);
  }

  const session = await createHobbySession(householdId, hobbyId, input);

  if (linkedSeriesId) {
    await linkHobbySeriesSession(householdId, hobbyId, linkedSeriesId, session.id);
    revalidateHobbySeriesPaths(hobbyId, linkedSeriesId);
  }

  await emitRealtimeEvent(householdId, "hobby.session-progress", session.id);
  revalidateHobbySessionPaths(hobbyId, session.id);
  redirect(`/hobbies/${hobbyId}/sessions/${session.id}`);
}

export async function createHobbySeriesAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");

  const tags = getOptionalString(formData, "tags");
  const input: CreateHobbySeriesInput = {
    name: getRequiredString(formData, "name"),
  };

  const description = getOptionalString(formData, "description");
  const status = getOptionalString(formData, "status");
  const notes = getOptionalString(formData, "notes");
  const coverImageUrl = getOptionalString(formData, "coverImageUrl");

  if (description) input.description = description;
  if (status === "active" || status === "completed" || status === "archived") input.status = status;
  if (notes) input.notes = notes;
  if (coverImageUrl) input.coverImageUrl = coverImageUrl;
  if (tags) {
    input.tags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  const series = await createHobbySeries(householdId, hobbyId, input);
  revalidateHobbySeriesPaths(hobbyId, series.id);
  redirect(`/hobbies/${hobbyId}/series/${series.id}`);
}

export async function deleteHobbySeriesAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const seriesId = getRequiredString(formData, "seriesId");

  await deleteHobbySeries(householdId, hobbyId, seriesId);
  revalidateHobbySeriesPaths(hobbyId);
  redirect(`/hobbies/${hobbyId}?tab=series`);
}

export async function advanceHobbySessionAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const sessionId = getRequiredString(formData, "sessionId");

  await advanceHobbySession(householdId, hobbyId, sessionId);
  await emitRealtimeEvent(householdId, "hobby.session-progress", sessionId);
  revalidateHobbySessionPaths(hobbyId, sessionId);
}

export async function deleteHobbySessionAction(formData: FormData): Promise<void> {
  const householdId = getRequiredString(formData, "householdId");
  const hobbyId = getRequiredString(formData, "hobbyId");
  const sessionId = getRequiredString(formData, "sessionId");

  await deleteHobbySession(householdId, hobbyId, sessionId);
  revalidateHobbySessionPaths(hobbyId);
  redirect(`/hobbies/${hobbyId}?tab=sessions`);
}
