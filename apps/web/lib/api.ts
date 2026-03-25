import { cache } from "react";
import { z } from "zod";
import {
  activityLogSchema,
  activityLogListResponseSchema,
  assetComparisonPayloadSchema,
  assetPartsConsumptionSchema,
  assetDetailResponseSchema,
  assetTransferListSchema,
  assetLabelDataSchema,
  scanResolutionResponseSchema,
  scanSpaceSummarySchema,
  assetTimelineEntrySchema,
  assetTimelineItemSchema,
  assetSchema,
  categoryAdherencePayloadSchema,
  commentSchema,
  complianceReportPayloadSchema,
  costForecastSchema,
  completionCycleRecordSchema,
  customPresetProfileSchema,
  devFixtureIds,
  dueWorkItemSchema,
  actionableEntryGroupListSchema,
  entryListResponseSchema,
  entrySchema,
  householdInventoryAnalyticsSchema,
  hobbyAnalyticsOverviewPayloadSchema,
  hobbyGoalProgressPayloadSchema,
  householdInvitationSchema,
  householdNotificationListSchema,
  householdCostDashboardSchema,
  householdCostOverviewSchema,
  householdUsageHighlightListSchema,
  hobbyPracticeStreaksPayloadSchema,
  hobbySessionFrequencyPayloadSchema,
  scheduleComplianceDashboardSchema,
  householdMemberSchema,
  maintenanceLogSchema,
  maintenanceScheduleSchema,
  householdDashboardSchema,
  householdSummarySchema,
  inventoryProjectLinkDetailSchema,
  bulkPartsReadinessSchema,
  scheduleInventoryLinkDetailSchema,
  schedulePartsReadinessSchema,
  createInventoryTransactionCorrectionSchema,
  inventoryTransactionListSchema,
  inventoryTransactionCorrectionResultSchema,
  inventoryTransactionSchema,
  inventoryItemDetailSchema,
  inventoryItemListResponseSchema,
  inventoryItemSummarySchema,
  inventoryItemConsumptionSchema,
  inventoryPurchaseSchema,
  inventoryShoppingListSummarySchema,
  inventoryReorderForecastSchema,
  inventoryTurnoverSchema,
  importSpacesResultSchema,
  spaceGeneralItemSchema,
  spaceItemHistoryListResponseSchema,
  spaceInventoryLinkDetailSchema,
  spaceOrphanCountSchema,
  spaceRecentScanListSchema,
  spaceContentsResponseSchema,
  spaceListResponseSchema,
  spaceResponseSchema,
  spaceUtilizationListSchema,
  memberContributionPayloadSchema,
  projectBudgetBurnPayloadSchema,
  projectPortfolioHealthPayloadSchema,
  projectTaskVelocityPayloadSchema,
  projectTimelinePayloadSchema,
  libraryPresetSchema,
  linkPreviewResponseSchema,
  lowStockInventoryItemSchema,
  meResponseSchema,
  notificationSchema,
  noteFolderSchema,
  noteTemplateSchema,
  onTimeRatePayloadSchema,
  overdueTrendPayloadSchema,
  partCommonalitySchema,
  projectAssetSchema,
  projectBudgetCategoryListSchema,
  projectBudgetAnalysisSchema,
  projectBudgetCategorySchema,
  projectDetailSchema,
  projectBreadcrumbSchema,
  projectChildSummarySchema,
  projectTreeStatsSchema,
  projectExpenseSchema,
  projectNoteSchema,
  projectNoteListSchema,
  projectPhaseChecklistItemSchema,
  projectPhaseDetailSchema,
  projectPhaseDetailListSchema,
  projectPhaseListSchema,
  projectPhaseSupplyListSchema,
  projectPhaseSupplySchema,
  projectInventoryRollupListSchema,
  projectPortfolioListSchema,
  projectPortfolioPageSchema,
  projectStatusCountListSchema,
  projectTemplateListSchema,
  projectTemplateSchema,
  projectShoppingListSchema,
  projectPurchaseRequestResultSchema,
  projectSchema,
  cloneProjectSchema,
  reorderProjectPhasesSchema,
  reorderProjectPhaseSuppliesSchema,
  reorderByOrderedIdsSchema,
  instantiateProjectTemplateSchema,
  projectSummarySchema,
  projectTaskSchema,
  projectTaskChecklistItemSchema,
  publicAssetReportSchema,
  searchResponseSchema,
  shareLinkListSchema,
  shareLinkSchema,
  serviceProviderSchema,
  serviceProviderSpendSchema,
  threadedCommentSchema,
  type Asset,
  type AssetComparisonPayload,
  type CategoryAdherencePayload,
  type AssetCostPerUnit,
  type AssetCostSummary,
  type AssetTransferList,
  type AssetDetailResponse,
  type AssetLabelData,
  type ScanResolutionResponse,
  type ScanSpaceSummary,
  type AssetTimelineEntry,
  type AssetTimelineItem,
  type AssetTimelineQuery,
  type ActivityLog,
  type ActivityLogListResponse,
  type AcceptInvitationInput,
  type ActionableEntryGroup,
  type CreateEntryInput,
  type CreateAssetTimelineEntryInput,
  type CompleteMaintenanceScheduleInput,
  type CreateCommentInput,
  type CreateConditionAssessmentInput,
  type CreateInvitationInput,
  type CreateProjectNoteInput,
  type UpdateProjectNoteInput,
  type ProjectNote,
  type CreateProjectAssetInput,
  type UpdateProjectAssetInput,
  type CreateProjectBudgetCategoryInput,
  type CreateProjectExpenseInput,
    type CostForecast,
    type HouseholdCostDashboard,
  type HouseholdCostOverview,
  type HouseholdUsageHighlight,
  type ScheduleComplianceDashboard,
  type CreateProjectPhaseChecklistItemInput,
  type CreateProjectPhaseInput,
  type CreateProjectPhaseSupplyInput,
  type CreateProjectInventoryItemInput,
  type CreateProjectInput,
  type CreateProjectTaskChecklistItemInput,
  type CreateProjectTaskInput,
  type CreateQuickTodoInput,
  type PromoteTaskInput,
  type CreatePresetProfileInput,
  type CreateServiceProviderInput,
  type CreateAssetInput,
  type CreateAssetTransferInput,
  type CreateHouseholdInput,
  type UpdateHouseholdInput,
  type CreateMaintenanceScheduleInput,
  type CreateMaintenanceLogInput,
  type CreateUsageMetricEntryInput,
  type CreateUsageMetricInput,
  type ComplianceReportPayload,
  type CompletionCycleRecord,
  type DueWorkItem,
  type Entry,
  type EntryFlag,
  type EntryListQuery,
  type EntrySurfaceQuery,
  type EntryType,
  type HouseholdInventoryAnalytics,
  type HobbyAnalyticsOverviewPayload,
  type HobbyGoalProgressPayload,
  type CustomPresetProfile,
  type HouseholdDashboard,
  type HouseholdInvitation,
  type HouseholdMember,
  type HouseholdSummary,
  type InventoryItemConsumption,
  type InventoryPurchase,
  type InventoryShoppingListSummary,
  type AddSpaceItemInput,
  type CreateInventoryItemInput,
  type CreateSpaceInput,
  type CreateQuickRestockInput,
  type InventoryReorderForecast,
  type InventoryTurnover,
  type BulkPartsReadiness,
  type CreateScheduleInventoryItemInput,
  type CreateInventoryTransactionCorrectionInput,
  type InventoryTransactionList,
  type InventoryTransactionCorrectionResult,
  type InventoryTransactionQuery,
  type InventoryItemDetail,
  type InventoryItemListResponse,
  type SpaceContentsResponse,
  type SpaceGeneralItem,
  type SpaceGeneralItemInput,
  type SpaceItemHistoryListResponse,
  type SpaceListResponse,
  type SpaceOrphanCount,
  type SpaceRecentScanEntry,
  type SpaceResponse,
  type SpaceUtilizationEntry,
  type UpdateInventoryItemInput,
  type UpdateSpaceGeneralItemInput,
  type UpdateSpaceInput,
  type UpdateInventoryPurchaseLineInput,
  type InventoryItemSummary,
  type AssetPartsConsumption,
  type InventoryProjectLinkDetail,
  type PartCommonality,
  type ScheduleInventoryLinkDetail,
  type SchedulePartsReadiness,
  type LibraryPreset,
  type LinkPreviewResponse,
  type LowStockInventoryItem,
  type MaintenanceLog,
  type MaintenanceSchedule,
  type MemberContributionPayload,
  type MeResponse,
  type Notification,
  type NoteFolder,
  type CreateNoteFolderInput,
  type UpdateNoteFolderInput,
  type NoteTemplate,
  type CreateNoteTemplateInput,
  type UpdateNoteTemplateInput,
  type HouseholdNotificationList,
  type OnTimeRatePayload,
  type OverdueTrendPayload,
  type ProjectBudgetBurnPayload,
  type ProjectAsset,
  type ProjectBudgetCategory,
  type ProjectBudgetAnalysis,
  type ProjectBudgetCategorySummary,
  type Project,
  type ProjectDetail,
  type ProjectExpense,
  type ProjectInventoryRollup,
  type ProjectPortfolioHealthPayload,
  type ProjectPhaseDetail,
  type ProjectPhaseSupply,
  type ProjectPhaseSummary,
  type ProjectTimelinePayload,
  type ProjectTemplate,
  type ProjectShoppingList,
  type CreateProjectPurchaseRequestInput,
  type ProjectPurchaseRequestResult,
  type ProjectChildSummary,
  type ProjectBreadcrumb,
  type ProjectTreeStats,
  type SearchEntityType,
  type SearchResponse,
  type ProjectPortfolioItem,
  type ProjectPortfolioPage,
  type ProjectStatusCount,
  type ProjectSummary,
  type ProjectTask,
  type ProjectTaskChecklistItem,
  type ProjectTaskVelocityPayload,
  type ProjectStatus,
  type CloneProjectInput,
  type CreateProjectTemplateInput,
  type InstantiateProjectTemplateInput,
  type PublicAssetReport,
  type ReorderProjectPhasesInput,
  type ReorderProjectPhaseSuppliesInput,
  type ReorderByOrderedIdsInput,
  type ShareLink,
  type ServiceProvider,
  type ServiceProviderSpend,
  type ThreadedComment,
  type UpdateEntryInput,
  type UpdateAssetTimelineEntryInput,
  type UpdateCommentInput,
  type UpdateProjectBudgetCategoryInput,
  type UpdateAssetInput,
  type CreateShareLinkInput,
  type CsvExportDataset,
  type UpdateProjectExpenseInput,
  type UpdateProjectInventoryItemInput,
  type UpdateProjectPhaseChecklistItemInput,
  type UpdateProjectPhaseInput,
  type UpdateProjectPhaseSupplyInput,
  type UpdateProjectInput,
  type UpdateProjectTaskChecklistItemInput,
  type UpdateProjectTaskInput,
  type UpdateScheduleInventoryItemInput,
  type UpdateServiceProviderInput,
  type UpdateUsageMetricInput,
  type AllocateProjectInventoryInput,
  type MoveSpaceInput,
  type ImportSpaceRow,
  type ImportSpacesResult,
  regulatoryAssetOptionSchema,
  type RegulatoryAssetOption,
  type UsageMetric,
  type UsageMetricEntry,
  type YearOverYearPayload,
  type UsageProjection,
  type UsageRateAnalytics,
  type UsageCostNormalization,
  type EnhancedUsageProjection,
  type AssetMetricCorrelationMatrix,
  usageMetricEntrySchema,
  assetCostPerUnitSchema,
  assetCostSummarySchema,
  yearOverYearPayloadSchema,
  usageProjectionSchema,
  usageRateAnalyticsSchema,
  usageCostNormalizationSchema,
  enhancedUsageProjectionSchema,
  assetMetricCorrelationMatrixSchema,
  usageMetricResponseSchema,
  barcodeLookupResultSchema,
  type BarcodeLookupResult,
  attachmentSchema,
  attachmentUploadResponseSchema,
  type Attachment,
  type AttachmentUploadResponse,
  type AttachmentEntityType,
  type CreateAttachmentUploadInput,
  type UpdateAttachmentInput,
  hobbySchema,
  hobbySummarySchema,
  hobbyAssetSchema,
  hobbyInventoryItemSchema,
  hobbyProjectLinkSchema,
  hobbyProjectSchema,
  hobbyProjectDetailSchema,
  hobbyProjectListResponseSchema,
  hobbyProjectMilestoneSchema,
  hobbyProjectInventoryLinkDetailSchema,
  hobbyProjectWorkLogSchema,
  hobbyProjectWorkLogListResponseSchema,
  hobbyPracticeGoalSchema,
  hobbyPracticeGoalDetailSchema,
  hobbyPracticeGoalListResponseSchema,
  hobbyPracticeRoutineSchema,
  hobbyPracticeRoutineSummarySchema,
  hobbyPracticeRoutineListResponseSchema,
  hobbyPracticeRoutineComplianceSummarySchema,
  hobbyCollectionItemSchema,
  hobbyCollectionItemDetailSchema,
  hobbyCollectionItemListResponseSchema,
  hobbyInventoryCategorySchema,
  hobbyRecipeSchema,
  hobbyRecipeDetailSchema,
  hobbyRecipeIngredientSchema,
  hobbyRecipeStepSchema,
  hobbySeriesComparisonSchema,
  hobbySeriesDetailSchema,
  hobbySeriesListSchema,
  hobbySeriesSchema,
  hobbySessionSchema,
  hobbySessionSummarySchema,
  hobbySessionIngredientSchema,
  hobbySessionStepSchema,
  hobbyMetricDefinitionSchema,
  hobbyMetricReadingSchema,
  hobbyRecipeShoppingListSchema,
  type Hobby,
  type HobbySessionFrequencyPayload,
  type HobbyPracticeStreaksPayload,
  type HobbySummary,
  type HobbyAsset,
  type HobbyInventoryItem,
  type HobbyProjectLink,
  type HobbyProject,
  type HobbyProjectDetail,
  type HobbyProjectListResponse,
  type HobbyProjectMilestone,
  type HobbyProjectInventoryLinkDetail,
  type HobbyProjectWorkLog,
  type HobbyProjectWorkLogListResponse,
  type HobbyPracticeGoal,
  type HobbyGoalProgressGoal,
  type HobbyPracticeGoalDetail,
  type HobbyPracticeGoalListResponse,
  type HobbyPracticeRoutine,
  type HobbyPracticeRoutineSummary,
  type HobbyPracticeRoutineListResponse,
  type HobbyPracticeRoutineComplianceSummary,
  type HobbyCollectionItem,
  type HobbyCollectionItemDetail,
  type HobbyCollectionItemListResponse,
  type HobbyInventoryCategory,
  type HobbyRecipe,
  type HobbyRecipeDetail,
  type HobbyRecipeIngredient,
  type HobbyRecipeStep,
  type HobbySeries,
  type HobbySeriesComparison,
  type HobbySeriesDetail,
  type HobbySeriesSummary,
  type HobbySession,
  type HobbySessionSummary,
  type HobbySessionIngredient,
  type HobbySessionStage,
  type HobbySessionStageChecklistItem,
  type HobbySessionStep,
  type HobbyMetricDefinition,
  type HobbyMetricReading,
  type HobbyRecipeShoppingList,
  type CreateHobbyInput,
  type UpdateHobbyInput,
  type CreateHobbyRecipeInput,
  type UpdateHobbyRecipeInput,
  type CreateHobbyRecipeIngredientInput,
  type UpdateHobbyRecipeIngredientInput,
  type CreateHobbyRecipeStepInput,
  type UpdateHobbyRecipeStepInput,
  type CreateHobbySeriesInput,
  type CreateHobbySessionInput,
  type UpdateHobbySessionInput,
  type UpdateHobbySessionStageInput,
  type CreateHobbySessionIngredientInput,
  type CreateHobbySessionStageChecklistItemInput,
  type UpdateHobbySessionStageChecklistItemInput,
  type UpdateHobbySessionIngredientInput,
  type CreateHobbySessionStepInput,
  type UpdateHobbySessionStepInput,
  type UpdateHobbySeriesInput,
  type UpdateHobbySeriesSessionInput,
  type CreateHobbyMetricDefinitionInput,
  type UpdateHobbyMetricDefinitionInput,
  type CreateHobbyMetricReadingInput,
  type CreateHobbyAssetInput,
  type CreateHobbyInventoryItemInput,
  type CreateHobbyProjectLinkInput,
  type CreateHobbyProjectInput,
  type UpdateHobbyProjectInput,
  type HobbyProjectListQuery,
  type CreateHobbyProjectMilestoneInput,
  type UpdateHobbyProjectMilestoneInput,
  type ReorderHobbyProjectMilestonesInput,
  type CreateHobbyProjectWorkLogInput,
  type UpdateHobbyProjectWorkLogInput,
  type HobbyProjectWorkLogListQuery,
  type CreateHobbyProjectInventoryItemInput,
  type UpdateHobbyProjectInventoryItemInput,
  type CreateHobbyPracticeGoalInput,
  type UpdateHobbyPracticeGoalInput,
  type HobbyPracticeGoalListQuery,
  type CreateHobbyPracticeRoutineInput,
  type UpdateHobbyPracticeRoutineInput,
  type HobbyPracticeRoutineListQuery,
  type HobbyPracticeRoutineComplianceQuery,
  type CreateHobbyCollectionItemInput,
  type UpdateHobbyCollectionItemInput,
  type HobbyCollectionItemListQuery,
  type CreateHobbyInventoryCategoryInput,
  type HobbyStatus,
  hobbyDetailSchema,
  hobbySessionDetailSchema,
  hobbySessionStageSchema,
  hobbySessionStageChecklistItemSchema,
  type HobbyDetail,
  type HobbySessionDetail,
  ideaSchema,
  ideaSummarySchema,
  addIdeaNoteSchema,
  addIdeaLinkSchema,
  type Idea,
  type IdeaSummary,
  type CreateIdeaInput,
  type UpdateIdeaInput,
  type PromoteIdeaInput,
  type DemoteToIdeaInput,
  ideaCanvasSchema,
  ideaCanvasSummarySchema,
  ideaCanvasNodeSchema,
  ideaCanvasEdgeSchema,
  type IdeaCanvas,
  type IdeaCanvasSummary,
  type IdeaCanvasNode,
  type IdeaCanvasEdge,
  type CreateIdeaCanvasInput,
  type UpdateIdeaCanvasInput,
  type UpdateCanvasSettingsInput,
  type CreateCanvasNodeInput,
  type UpdateCanvasNodeInput,
  type BatchUpdateCanvasNodesInput,
  type CreateCanvasEdgeInput,
  type UpdateCanvasEdgeInput,
  canvasObjectSchema,
  createCanvasObjectSchema,
  type CanvasObject,
  type CreateCanvasObjectInput,
  type UpdateCanvasObjectInput,
  layoutPreferenceSchema,
  type LayoutPreference,
  type SaveLayoutPreferenceInput,
  quickActionItemSchema,
  dashboardPinSchema,
  createDashboardPinSchema,
  type DashboardPin,
  type CreateDashboardPinInput,
  bulkAssetOperationResultSchema,
  type BulkAssetOperationResult,
  type AssetCategory,
  assetPageSchema,
  type AssetPage,
  bulkScheduleOperationResultSchema,
  type BulkScheduleOperationResult,
  bulkTaskOperationResultSchema,
  type BulkTaskOperationResult,
  bulkProjectOperationResultSchema,
  type BulkProjectOperationResult,
  bulkHobbySessionOperationResultSchema,
  type BulkHobbySessionOperationResult,
  bulkIdeaOperationResultSchema,
  type BulkIdeaOperationResult,
  notificationPreferencesSchema,
  updateNotificationPreferencesSchema,
  type NotificationPreferences,
  type UpdateNotificationPreferencesInput,
  displayPreferencesSchema,
  updateDisplayPreferencesSchema,
  type DisplayPreferences,
  type UpdateDisplayPreferencesInput,
  assetDeleteImpactSchema,
  type AssetDeleteImpact,
  projectDeleteImpactSchema,
  type ProjectDeleteImpact,
  inventoryDeleteImpactSchema,
  type InventoryDeleteImpact,
  hobbyDeleteImpactSchema,
  type HobbyDeleteImpact,
  trashListResponseSchema,
  type TrashListResponse,
} from "@lifekeeper/types";
import { normalizeExternalUrl } from "./url";

type Schema<T> = {
  parse: (value: unknown) => T;
};

export type ImportInventoryResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: InventoryItemSummary[];
};

type RequestOptions<T> = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: Schema<T>;
  cacheOptions?: RequestInit["cache"] | { revalidate: number };
  revalidate?: number | false;
  cachePolicy?: RequestCache | { next: { revalidate: number } } | { next: { tags: string[] } };
};

const libraryPresetListSchema = libraryPresetSchema.array();
const customPresetProfileListSchema = customPresetProfileSchema.array();
const activityLogListSchema = activityLogListResponseSchema;
const assetListSchema = assetSchema.array();
const dueWorkItemListSchema = dueWorkItemSchema.array();
const actionableEntryGroupResponseSchema = actionableEntryGroupListSchema;
const assetTimelineEntryListSchema = assetTimelineEntrySchema.array();
const entryListSchema = entryListResponseSchema;
const surfacedEntryListSchema = entrySchema.array();
const assetTimelineResponseSchema: Schema<{ items: AssetTimelineItem[]; nextCursor: string | null; totalSources: number }> = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid asset timeline response.");
    }

    const record = value as Record<string, unknown>;

    return {
      items: assetTimelineItemSchema.array().parse(record.items ?? []),
      nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null,
      totalSources: typeof record.totalSources === "number" ? record.totalSources : 0
    };
  }
};
const commentWithRepliesSchema = commentSchema.extend({
  replies: commentSchema.array().default([])
});
const threadedCommentListSchema = threadedCommentSchema.array();
const householdInvitationListSchema = householdInvitationSchema.array();
const householdMemberListSchema = householdMemberSchema.array();
const inventoryItemSummaryListSchema = inventoryItemSummarySchema.array();
const normalizeHobbyPayload = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  return {
    ...record,
    activityMode: record.activityMode ?? "session"
  };
};

const parseHobbyResponse = (value: unknown): Hobby => hobbySchema.parse(normalizeHobbyPayload(value));
const parseHobbySummaryResponse = (value: unknown): HobbySummary => hobbySummarySchema.parse(normalizeHobbyPayload(value));
const parseHobbyDetailResponse = (value: unknown): HobbyDetail => hobbyDetailSchema.parse(normalizeHobbyPayload(value));

const householdInventoryListSchema = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid inventory response.");
    }

    const record = value as Record<string, unknown>;

    return {
      items: inventoryItemSummaryListSchema.parse(record.items ?? []),
      nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null
    };
  }
};
const householdLowStockListSchema = lowStockInventoryItemSchema.array();
const assetPartsConsumptionListSchema = assetPartsConsumptionSchema.array();
const inventoryTurnoverListSchema = inventoryTurnoverSchema.array();
const inventoryReorderForecastListSchema = inventoryReorderForecastSchema.array();
const inventoryPurchaseSchemaResponse = inventoryPurchaseSchema;
const partCommonalityListSchema = partCommonalitySchema.array();
const regulatoryAssetOptionListSchema = regulatoryAssetOptionSchema.array();
const importInventoryResultSchema: Schema<ImportInventoryResult> = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid inventory import response.");
    }

    const record = value as Record<string, unknown>;

    return {
      created: typeof record.created === "number" ? record.created : 0,
      skipped: typeof record.skipped === "number" ? record.skipped : 0,
      errors: Array.isArray(record.errors)
        ? record.errors.map((entry) => {
            if (typeof entry !== "object" || entry === null) {
              throw new Error("Invalid inventory import error entry.");
            }

            const errorRecord = entry as Record<string, unknown>;

            return {
              index: typeof errorRecord.index === "number" ? errorRecord.index : 0,
              message: typeof errorRecord.message === "string" ? errorRecord.message : "Unknown import error."
            };
          })
        : [],
      createdItems: inventoryItemSummarySchema.array().parse(record.createdItems ?? [])
    };
  }
};
const maintenanceLogListSchema = maintenanceLogSchema.array();
const paginatedMaintenanceLogSchema: Schema<{ logs: MaintenanceLog[]; nextCursor: string | null }> = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid paginated logs response.");
    }

    const record = value as Record<string, unknown>;

    return {
      logs: maintenanceLogListSchema.parse(record.logs ?? []),
      nextCursor: typeof record.nextCursor === "string" ? record.nextCursor : null
    };
  }
};
const notificationListSchema = notificationSchema.array();
const projectBudgetCategorySummarySchema = projectBudgetCategoryListSchema.element;
const projectBudgetCategorySummaryListSchema = projectBudgetCategoryListSchema;
const projectInventoryListSchema = inventoryProjectLinkDetailSchema.array();
const scheduleInventoryListSchema = scheduleInventoryLinkDetailSchema.array();
const projectPhaseChecklistListSchema = projectPhaseChecklistItemSchema.array();
const projectPhaseSummarySchema = projectPhaseListSchema.element;
const projectPhaseSummaryListSchema = projectPhaseListSchema;
const projectPhaseSupplySummaryListSchema = projectPhaseSupplyListSchema;
const projectSummaryListSchema = projectSummarySchema.array();
const projectTaskChecklistListSchema = projectTaskChecklistItemSchema.array();
const serviceProviderListSchema = serviceProviderSchema.array();
const usageMetricEntryListSchema = usageMetricEntrySchema.array();
const projectInventoryAllocationSchema = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid project inventory allocation response.");
    }

    const record = value as Record<string, unknown>;

    return {
      projectInventoryItem: inventoryProjectLinkDetailSchema.parse(record.projectInventoryItem),
      inventoryItem: inventoryItemSummarySchema.parse(record.inventoryItem),
      transaction: inventoryTransactionSchema.parse(record.transaction)
    };
  }
};
const projectPhaseSupplyAllocationSchema = {
  parse: (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid phase supply allocation response.");
    }

    const record = value as Record<string, unknown>;

    return {
      supply: projectPhaseSupplySchema.parse(record.supply),
      inventoryItem: inventoryItemSummarySchema.parse(record.inventoryItem),
      transaction: inventoryTransactionSchema.parse(record.transaction)
    };
  }
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const apiBaseUrl = process.env.LIFEKEEPER_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL
  ?? "http://127.0.0.1:4000";

const devUserId = process.env.LIFEKEEPER_DEV_USER_ID
  ?? process.env.NEXT_PUBLIC_LIFEKEEPER_DEV_USER_ID
  ?? devFixtureIds.ownerUserId;

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const getApiBaseUrl = (): string => apiBaseUrl;

export const getDevUserId = (): string => devUserId;

const getProxyPath = (path: string): string => {
  if (path.startsWith("/v1/")) {
    return `/api/${path.slice(4)}`;
  }

  if (path === "/v1") {
    return "/api";
  }

  return `/api${path}`;
};

const getFetchTarget = (path: string): string => {
  if (typeof window !== "undefined") {
    return getProxyPath(path);
  }

  return `${apiBaseUrl}${path}`;
};

const getRequestHeaders = (contentType: string | null = "application/json"): HeadersInit => {
  const headers = new Headers();

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (typeof window === "undefined") {
    headers.set("x-dev-user-id", devUserId);
  }

  return headers;
};

const downloadFileFromProxy = async (path: string, filename: string): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("File downloads must be triggered in the browser.");
  }

  const response = await fetch(getProxyPath(path), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export const apiRequest = async <T>({
  path,
  method = "GET",
  body,
  schema,
  cacheOptions,
  revalidate,
  cachePolicy
}: RequestOptions<T>): Promise<T> => {
  let response: Response;

  const resolvedCacheOptions = (() => {
    if (method !== "GET") {
      return { cache: "no-store" as const };
    }

    if (cacheOptions !== undefined) {
      return typeof cacheOptions === "string"
        ? { cache: cacheOptions }
        : { next: { revalidate: cacheOptions.revalidate } };
    }

    if (typeof revalidate === "number") {
      return { next: { revalidate } };
    }

    if (cachePolicy !== undefined) {
      return typeof cachePolicy === "string"
        ? { cache: cachePolicy }
        : { next: cachePolicy.next };
    }

    return { cache: "no-store" as const };
  })();

  try {
    response = await fetch(getFetchTarget(path), {
      method,
      ...resolvedCacheOptions,
      headers: getRequestHeaders(body === undefined ? null : "application/json"),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the API at ${apiBaseUrl}.${detail}`,
      503
    );
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  if (!schema) {
    return payload as T;
  }

  return schema.parse(payload);
};

// cache() deduplicates getMe calls within a single RSC request/render pass.
export const getMe = cache(async (): Promise<MeResponse> => apiRequest({
  path: "/v1/me",
  schema: meResponseSchema,
  cacheOptions: { revalidate: 300 }
}));

export const getHouseholdDashboard = async (householdId: string): Promise<HouseholdDashboard> => apiRequest({
  path: `/v1/households/${householdId}/dashboard`,
  schema: householdDashboardSchema,
  cacheOptions: { revalidate: 60 }
});

const appendListValue = (params: URLSearchParams, key: string, value?: string | string[]): void => {
  if (value === undefined) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized = values.map((entry) => entry.trim()).filter(Boolean);

  if (normalized.length === 0) {
    return;
  }

  params.set(key, normalized.join(","));
};

export const getEntries = async (
  householdId: string,
  query?: Partial<EntryListQuery> & {
    entryType?: EntryType | EntryType[];
    flags?: EntryFlag[];
    excludeFlags?: EntryFlag[];
  }
): Promise<{ items: Entry[]; nextCursor: string | null }> => {
  const params = new URLSearchParams();

  if (query?.entityType) {
    params.set("entityType", query.entityType);
  }

  if (query?.entityId) {
    params.set("entityId", query.entityId);
  }

  appendListValue(params, "entryType", query?.entryType);
  appendListValue(params, "flags", query?.flags);
  appendListValue(params, "excludeFlags", query?.excludeFlags);
  appendListValue(params, "tags", query?.tags);

  if (query?.search) {
    params.set("search", query.search);
  }

  if (query?.createdById) {
    params.set("createdById", query.createdById);
  }

  if (query?.startDate) {
    params.set("startDate", query.startDate);
  }

  if (query?.endDate) {
    params.set("endDate", query.endDate);
  }

  if (query?.hasMeasurements !== undefined) {
    params.set("hasMeasurements", String(query.hasMeasurements));
  }

  if (query?.measurementName) {
    params.set("measurementName", query.measurementName);
  }

  if (query?.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  if (query?.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query?.cursor) {
    params.set("cursor", query.cursor);
  }

  if (query?.includeArchived !== undefined) {
    params.set("includeArchived", String(query.includeArchived));
  }

  if (query?.folderId) {
    params.set("folderId", query.folderId);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/entries${suffix}`,
    schema: entryListSchema,
    cacheOptions: "no-store"
  });
};

export const getEntry = async (householdId: string, entryId: string): Promise<Entry> => apiRequest({
  path: `/v1/households/${householdId}/entries/${entryId}`,
  schema: entrySchema,
  cacheOptions: "no-store"
});

export const createEntry = async (householdId: string, input: CreateEntryInput): Promise<Entry> => apiRequest({
  path: `/v1/households/${householdId}/entries`,
  method: "POST",
  body: input,
  schema: entrySchema
});

export const updateEntry = async (householdId: string, entryId: string, input: UpdateEntryInput): Promise<Entry> => apiRequest({
  path: `/v1/households/${householdId}/entries/${entryId}`,
  method: "PATCH",
  body: input,
  schema: entrySchema
});

export const deleteEntry = async (householdId: string, entryId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/entries/${entryId}`,
    method: "DELETE"
  });
};

export const getSurfacedEntries = async (householdId: string, query: EntrySurfaceQuery): Promise<Entry[]> => {
  const params = new URLSearchParams({ entityType: query.entityType, entityId: query.entityId });

  return apiRequest({
    path: `/v1/households/${householdId}/entries/surface?${params.toString()}`,
    schema: surfacedEntryListSchema,
    cacheOptions: "no-store"
  });
};

export const getActionableEntries = async (householdId: string): Promise<ActionableEntryGroup[]> => apiRequest({
  path: `/v1/households/${householdId}/entries/actionable`,
  schema: actionableEntryGroupResponseSchema,
  cacheOptions: "no-store"
});

export const getHouseholdDueWork = async (
  householdId: string,
  options: { limit?: number; status?: "all" | "due" | "overdue" } = {}
): Promise<DueWorkItem[]> => {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 100));
  params.set("status", options.status ?? "all");

  return apiRequest({
    path: `/v1/households/${householdId}/due-work?${params.toString()}`,
    schema: dueWorkItemListSchema,
    cachePolicy: { next: { revalidate: 15 } }
  });
};

export const getAssetDetail = async (assetId: string): Promise<AssetDetailResponse> => apiRequest({
  path: `/v1/assets/${assetId}/detail`,
  schema: assetDetailResponseSchema,
  cacheOptions: "no-store"
});

export const getAssetTransferHistory = async (assetId: string): Promise<AssetTransferList> => apiRequest({
  path: `/v1/assets/${assetId}/transfers`,
  schema: assetTransferListSchema,
  revalidate: 15
});

export const getHouseholdTransfers = async (
  householdId: string,
  options?: {
    since?: string;
    transferType?: "reassignment" | "household_transfer";
    limit?: number;
    cursor?: string;
  }
): Promise<AssetTransferList> => {
  const query = new URLSearchParams();

  if (options?.since) {
    query.set("since", options.since);
  }

  if (options?.transferType) {
    query.set("transferType", options.transferType);
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/transfers${suffix}`,
    schema: assetTransferListSchema
  });
};

export const getAssetLabelData = async (assetId: string): Promise<AssetLabelData> => apiRequest({
  path: `/v1/assets/${assetId}/label/data`,
  schema: assetLabelDataSchema
});

export const lookupAssetByTag = async (tag: string): Promise<Asset> => {
  const query = new URLSearchParams({ tag });

  return apiRequest({
    path: `/v1/assets/lookup?${query.toString()}`,
    schema: assetSchema
  });
};

export const resolveScanTag = async (tag: string): Promise<ScanResolutionResponse> => {
  const query = new URLSearchParams({ tag });

  return apiRequest({
    path: `/v1/scan/resolve?${query.toString()}`,
    schema: scanResolutionResponseSchema,
    cacheOptions: "no-store"
  });
};

export const getScanSpaceSummary = async (tag: string): Promise<ScanSpaceSummary> => apiRequest({
  path: `/v1/scan/spaces/${encodeURIComponent(tag)}/summary`,
  schema: scanSpaceSummarySchema,
  cacheOptions: "no-store"
});

export const getScanSpaceDetail = async (tag: string): Promise<SpaceResponse> => apiRequest({
  path: `/v1/scan/spaces/${encodeURIComponent(tag)}/detail`,
  schema: spaceResponseSchema,
  cacheOptions: "no-store"
});

export const getScanInventoryItemDetail = async (
  tag: string,
  options?: { transactionLimit?: number }
): Promise<InventoryItemDetail> => {
  const query = new URLSearchParams();

  if (options?.transactionLimit !== undefined) {
    query.set("transactionLimit", String(options.transactionLimit));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/scan/inventory-items/${encodeURIComponent(tag)}/detail${suffix}`,
    schema: inventoryItemDetailSchema,
    cacheOptions: "no-store"
  });
};

export const getLibraryPresets = cache(async (): Promise<LibraryPreset[]> => apiRequest({
  path: "/v1/presets/library",
  schema: libraryPresetListSchema,
  revalidate: 60
}));

const getProjectDetailCached = cache(async (householdId: string, projectId: string): Promise<ProjectDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}`,
  schema: projectDetailSchema,
  cacheOptions: { revalidate: 15 }
}));

const getProjectPhaseDetailsCached = cache(async (householdId: string, projectId: string): Promise<ProjectPhaseDetail[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/details`,
  schema: projectPhaseDetailListSchema,
  cachePolicy: { next: { revalidate: 15 } }
}));

const getHouseholdAssetsCached = cache(async (householdId: string): Promise<Asset[]> => apiRequest({
  path: `/v1/assets?householdId=${householdId}`,
  schema: assetListSchema,
  cacheOptions: { revalidate: 30 }
}));

const getHouseholdAssetsPaginatedCached = cache(async (
  householdId: string,
  limit: number,
  offset: number,
  includeArchived: boolean,
  search: string,
  category: string
): Promise<AssetPage> => {
  const params = new URLSearchParams({
    householdId,
    paginated: "true",
    limit: String(limit),
    offset: String(offset)
  });

  if (includeArchived) {
    params.set("includeArchived", "true");
  }

  if (search) {
    params.set("search", search);
  }

  if (category) {
    params.set("category", category);
  }

  return apiRequest({
    path: `/v1/assets?${params.toString()}`,
    schema: assetPageSchema,
    cacheOptions: { revalidate: 30 }
  });
});

const getHouseholdMembersCached = cache(async (householdId: string): Promise<HouseholdMember[]> => apiRequest({
  path: `/v1/households/${householdId}/members`,
  schema: householdMemberListSchema,
  revalidate: 15
}));

const getHouseholdServiceProvidersCached = cache(async (householdId: string): Promise<ServiceProvider[]> => apiRequest({
  path: `/v1/households/${householdId}/service-providers`,
  schema: serviceProviderListSchema,
  revalidate: 15
}));

const getHouseholdInventoryCached = cache(async (
  householdId: string,
  suffix: string
): Promise<{ items: InventoryItemSummary[]; nextCursor: string | null }> => apiRequest({
  path: `/v1/households/${householdId}/inventory${suffix}`,
  schema: householdInventoryListSchema,
  cacheOptions: { revalidate: 30 }
}));

export const getHouseholdProjects = async (
  householdId: string,
  options?: {
    status?: ProjectStatus;
    parentProjectId?: string | null;
  }
): Promise<ProjectSummary[]> => {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.parentProjectId !== undefined) {
    params.set("parentProjectId", options.parentProjectId === null ? "null" : options.parentProjectId);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/projects${suffix}`,
    schema: projectSummaryListSchema,
    cacheOptions: { revalidate: 30 }
  });
};

export const getHouseholdProjectStatusCounts = async (
  householdId: string,
  options?: { q?: string }
): Promise<ProjectStatusCount[]> => {
  const params = new URLSearchParams();

  if (options?.q && options.q.trim().length > 0) {
    params.set("q", options.q.trim());
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/projects/status-counts${suffix}`,
    schema: projectStatusCountListSchema,
    cachePolicy: { next: { revalidate: 30 } }
  });
};

export const getHouseholdProjectPortfolio = async (
  householdId: string,
  options?: { status?: ProjectStatus; q?: string }
): Promise<ProjectPortfolioItem[]> => {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.q && options.q.trim().length > 0) {
    params.set("q", options.q.trim());
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/projects/portfolio${suffix}`,
    schema: projectPortfolioListSchema,
    revalidate: 15
  });
};

export const getHouseholdProjectPortfolioPaginated = async (
  householdId: string,
  options: { status?: ProjectStatus; q?: string; depth?: number; limit: number; offset: number }
): Promise<ProjectPortfolioPage> => {
  const params = new URLSearchParams();
  params.set("paginated", "true");
  params.set("limit", String(options.limit));
  params.set("offset", String(options.offset));

  if (options.status) {
    params.set("status", options.status);
  }

  if (options.q && options.q.trim().length > 0) {
    params.set("q", options.q.trim());
  }

  if (options.depth !== undefined) {
    params.set("depth", String(options.depth));
  }

  return apiRequest({
    path: `/v1/households/${householdId}/projects/portfolio?${params.toString()}`,
    schema: projectPortfolioPageSchema,
    revalidate: 15
  });
};

export const searchHousehold = async (
  householdId: string,
  query: string,
  options?: {
    limit?: number;
    include?: SearchEntityType[];
    fuzzy?: boolean;
    includeHistory?: boolean;
  }
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query });

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.include && options.include.length > 0) {
    params.set("include", options.include.join(","));
  }

  if (options?.fuzzy !== undefined) {
    params.set("fuzzy", String(options.fuzzy));
  }

  if (options?.includeHistory !== undefined) {
    params.set("includeHistory", String(options.includeHistory));
  }

  return apiRequest({
    path: `/v1/households/${householdId}/search?${params.toString()}`,
    schema: searchResponseSchema
  });
};

export const getHouseholdActivity = async (
  householdId: string,
  options?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    since?: string;
    cursor?: string;
    limit?: number;
  }
): Promise<ActivityLogListResponse> => {
  const params = new URLSearchParams();

  if (options?.entityType) {
    params.set("entityType", options.entityType);
  }

  if (options?.entityId) {
    params.set("entityId", options.entityId);
  }

  if (options?.userId) {
    params.set("userId", options.userId);
  }

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/activity${suffix}`,
    schema: activityLogListSchema,
    revalidate: 15
  });
};

export const downloadAssetPdf = async (
  assetId: string,
  options?: { since?: string; until?: string }
): Promise<void> => {
  const params = new URLSearchParams();

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.until) {
    params.set("until", options.until);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  await downloadFileFromProxy(`/v1/assets/${assetId}/export/pdf${suffix}`, `asset-history-${assetId}.pdf`);
};

export const downloadComplianceAuditPdf = async (
  assetId: string,
  options?: { since?: string; until?: string }
): Promise<void> => {
  const params = new URLSearchParams();

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.until) {
    params.set("until", options.until);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  await downloadFileFromProxy(`/v1/assets/${assetId}/export/compliance-pdf${suffix}`, `compliance-audit-${assetId}.pdf`);
};

export const downloadAssetCsv = async (
  assetId: string,
  dataset: CsvExportDataset,
  options?: { since?: string; until?: string }
): Promise<void> => {
  const params = new URLSearchParams({ dataset });

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.until) {
    params.set("until", options.until);
  }

  await downloadFileFromProxy(`/v1/assets/${assetId}/export/csv?${params.toString()}`, `${dataset}-${assetId}.csv`);
};

export const downloadHouseholdCsv = async (
  householdId: string,
  dataset: string,
  options?: { since?: string; until?: string; assetIds?: string[] }
): Promise<void> => {
  const params = new URLSearchParams({ dataset });

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.until) {
    params.set("until", options.until);
  }

  if (options?.assetIds && options.assetIds.length > 0) {
    params.set("assetIds", options.assetIds.join(","));
  }

  await downloadFileFromProxy(`/v1/households/${householdId}/export/csv?${params.toString()}`, `${dataset}-${householdId}.csv`);
};

export const downloadAnnualCostPdf = async (householdId: string, year: number): Promise<void> => {
  const params = new URLSearchParams({ year: String(year) });
  await downloadFileFromProxy(`/v1/households/${householdId}/export/annual-cost-pdf?${params.toString()}`, `annual-cost-${year}-${householdId}.pdf`);
};

export const downloadInventoryValuationPdf = async (householdId: string): Promise<void> => {
  await downloadFileFromProxy(`/v1/households/${householdId}/export/inventory-valuation-pdf`, `inventory-valuation-${householdId}.pdf`);
};

export const downloadHouseholdJson = async (householdId: string): Promise<void> => {
  await downloadFileFromProxy(`/v1/households/${householdId}/export/json`, `lifekeeper-export-${householdId}.json`);
};

export const createShareLink = async (
  householdId: string,
  input: CreateShareLinkInput
): Promise<ShareLink> => apiRequest({
  path: `/v1/households/${householdId}/share-links`,
  method: "POST",
  body: input,
  schema: shareLinkSchema
});

export const getShareLinks = async (householdId: string, assetId?: string): Promise<ShareLink[]> => {
  const params = new URLSearchParams();

  if (assetId) {
    params.set("assetId", assetId);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/share-links${suffix}`,
    schema: shareLinkListSchema
  });
};

export const revokeShareLink = async (householdId: string, shareLinkId: string): Promise<ShareLink> => apiRequest({
  path: `/v1/households/${householdId}/share-links/${shareLinkId}`,
  method: "DELETE",
  schema: shareLinkSchema
});

export const getPublicAssetReport = async (token: string): Promise<PublicAssetReport> => {
  const response = await fetch(`${apiBaseUrl}/v1/public/share/${token}`, {
    cache: "no-store"
  });
  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return publicAssetReportSchema.parse(payload);
};

export const getHouseholdInvitations = async (
  householdId: string,
  status?: HouseholdInvitation["status"]
): Promise<HouseholdInvitation[]> => apiRequest({
  path: status
    ? `/v1/households/${householdId}/invitations?status=${status}`
    : `/v1/households/${householdId}/invitations`,
  schema: householdInvitationListSchema
});

export const createInvitation = async (
  householdId: string,
  input: CreateInvitationInput
): Promise<HouseholdInvitation> => apiRequest({
  path: `/v1/households/${householdId}/invitations`,
  method: "POST",
  body: input,
  schema: householdInvitationSchema
});

export const revokeInvitation = async (
  householdId: string,
  invitationId: string
): Promise<HouseholdInvitation> => apiRequest({
  path: `/v1/households/${householdId}/invitations/${invitationId}/revoke`,
  method: "POST",
  schema: householdInvitationSchema
});

export const acceptInvitation = async (input: AcceptInvitationInput): Promise<HouseholdSummary> => apiRequest({
  path: "/v1/invitations/accept",
  method: "POST",
  body: input,
  schema: householdSummarySchema
});

export const getAssetComments = async (assetId: string): Promise<ThreadedComment[]> => apiRequest({
  path: `/v1/assets/${assetId}/comments`,
  schema: threadedCommentListSchema,
  revalidate: 15
});

export const createComment = async (
  assetId: string,
  input: CreateCommentInput
): Promise<ThreadedComment> => apiRequest({
  path: `/v1/assets/${assetId}/comments`,
  method: "POST",
  body: input,
  schema: commentWithRepliesSchema
});

export const updateComment = async (
  assetId: string,
  commentId: string,
  input: UpdateCommentInput
): Promise<ThreadedComment> => apiRequest({
  path: `/v1/assets/${assetId}/comments/${commentId}`,
  method: "PATCH",
  body: input,
  schema: commentWithRepliesSchema
});

export const deleteComment = async (assetId: string, commentId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/comments/${commentId}`,
    method: "DELETE"
  });
};

export const getInventoryItemComments = async (
  householdId: string,
  inventoryItemId: string
): Promise<ThreadedComment[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/${inventoryItemId}/comments`,
  schema: threadedCommentListSchema,
  revalidate: 15
});

export const createInventoryComment = async (
  householdId: string,
  inventoryItemId: string,
  input: CreateCommentInput
): Promise<ThreadedComment> => apiRequest({
  path: `/v1/households/${householdId}/inventory/${inventoryItemId}/comments`,
  method: "POST",
  body: input,
  schema: commentWithRepliesSchema
});

export const updateInventoryComment = async (
  householdId: string,
  inventoryItemId: string,
  commentId: string,
  input: UpdateCommentInput
): Promise<ThreadedComment> => apiRequest({
  path: `/v1/households/${householdId}/inventory/${inventoryItemId}/comments/${commentId}`,
  method: "PATCH",
  body: input,
  schema: commentWithRepliesSchema
});

export const deleteInventoryComment = async (
  householdId: string,
  inventoryItemId: string,
  commentId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/inventory/${inventoryItemId}/comments/${commentId}`,
    method: "DELETE"
  });
};

export const getAssetTimeline = async (
  assetId: string,
  query?: Partial<AssetTimelineQuery>
): Promise<{ items: AssetTimelineItem[]; nextCursor: string | null; totalSources: number }> => {
  const params = new URLSearchParams();

  if (query?.sourceType) {
    params.set("sourceType", query.sourceType);
  }

  if (query?.category) {
    params.set("category", query.category);
  }

  if (query?.search) {
    params.set("search", query.search);
  }

  if (query?.since) {
    params.set("since", query.since);
  }

  if (query?.until) {
    params.set("until", query.until);
  }

  if (query?.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query?.cursor) {
    params.set("cursor", query.cursor);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/assets/${assetId}/timeline${suffix}`,
    schema: assetTimelineResponseSchema,
    revalidate: 15
  });
};

export const getAssetTimelineEntries = async (
  assetId: string,
  query?: {
    category?: string;
    since?: string;
    until?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<AssetTimelineEntry[]> => {
  const params = new URLSearchParams();

  if (query?.category) {
    params.set("category", query.category);
  }

  if (query?.since) {
    params.set("since", query.since);
  }

  if (query?.until) {
    params.set("until", query.until);
  }

  if (query?.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query?.cursor) {
    params.set("cursor", query.cursor);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/assets/${assetId}/timeline-entries${suffix}`,
    schema: assetTimelineEntryListSchema
  });
};

export const getAssetTimelineEntry = async (
  assetId: string,
  entryId: string
): Promise<AssetTimelineEntry> => apiRequest({
  path: `/v1/assets/${assetId}/timeline-entries/${entryId}`,
  schema: assetTimelineEntrySchema
});

export const createAssetTimelineEntry = async (
  assetId: string,
  input: CreateAssetTimelineEntryInput
): Promise<AssetTimelineEntry> => apiRequest({
  path: `/v1/assets/${assetId}/timeline-entries`,
  method: "POST",
  body: input,
  schema: assetTimelineEntrySchema
});

export const updateAssetTimelineEntry = async (
  assetId: string,
  entryId: string,
  input: UpdateAssetTimelineEntryInput
): Promise<AssetTimelineEntry> => apiRequest({
  path: `/v1/assets/${assetId}/timeline-entries/${entryId}`,
  method: "PATCH",
  body: input,
  schema: assetTimelineEntrySchema
});

export const deleteAssetTimelineEntry = async (assetId: string, entryId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/timeline-entries/${entryId}`,
    method: "DELETE"
  });
};

export const getProjectDetail = async (householdId: string, projectId: string): Promise<ProjectDetail> => getProjectDetailCached(householdId, projectId);

export const getProjectPhaseDetails = async (
  householdId: string,
  projectId: string
): Promise<ProjectPhaseDetail[]> => getProjectPhaseDetailsCached(householdId, projectId);

export const getHouseholdAssets = async (householdId: string): Promise<Asset[]> => getHouseholdAssetsCached(householdId);

export const getHouseholdAssetsPaginated = async (
  householdId: string,
  options: { limit: number; offset: number; includeArchived?: boolean; search?: string; category?: string }
): Promise<AssetPage> => getHouseholdAssetsPaginatedCached(householdId, options.limit, options.offset, options.includeArchived ?? false, options.search ?? "", options.category ?? "");

export const getHouseholdUsageHighlights = async (
  householdId: string,
  options?: { limit?: number; assetLimit?: number; lookback?: number; bucketSize?: "week" | "month" }
): Promise<HouseholdUsageHighlight[]> => {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.assetLimit !== undefined) {
    params.set("assetLimit", String(options.assetLimit));
  }

  if (options?.lookback !== undefined) {
    params.set("lookback", String(options.lookback));
  }

  if (options?.bucketSize) {
    params.set("bucketSize", options.bucketSize);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/metrics/analytics/highlights${suffix}`,
    schema: householdUsageHighlightListSchema,
    cachePolicy: { next: { revalidate: 30 } }
  });
};

export const getNotifications = async (options?: {
  householdId?: string;
  status?: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<Notification[]> => {
  const params = new URLSearchParams();

  if (options?.householdId) {
    params.set("householdId", options.householdId);
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.unreadOnly !== undefined) {
    params.set("unreadOnly", String(options.unreadOnly));
  }

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/notifications${suffix}`,
    schema: notificationListSchema
  });
};

export const getHouseholdNotifications = async (
  householdId: string,
  options?: {
    limit?: number;
    status?: "all" | "unread" | "read";
    cursor?: string;
    channel?: "push" | "email" | "digest";
    type?: "due_soon" | "due" | "overdue" | "digest" | "announcement" | "inventory_low_stock";
  }
): Promise<HouseholdNotificationList> => {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }

  if (options?.channel) {
    params.set("channel", options.channel);
  }

  if (options?.type) {
    params.set("type", options.type);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/notifications${suffix}`,
    schema: householdNotificationListSchema
  });
};

export const getAssetComparisonAnalytics = async (
  householdId: string,
  assetIds: string[],
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<AssetComparisonPayload> => {
  const query = new URLSearchParams({
    householdId,
    assetIds: assetIds.join(",")
  });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  return apiRequest({
    path: `/v1/analytics/comparative/assets?${query.toString()}`,
    schema: assetComparisonPayloadSchema
  });
};

export const getYearOverYearAnalytics = async (
  householdId: string,
  options?: {
    assetId?: string;
    years?: number[];
  }
): Promise<YearOverYearPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.assetId) {
    query.set("assetId", options.assetId);
  }

  if (options?.years && options.years.length > 0) {
    query.set("years", options.years.join(","));
  }

  return apiRequest({
    path: `/v1/analytics/comparative/year-over-year?${query.toString()}`,
    schema: yearOverYearPayloadSchema
  });
};

export const getMemberContributionAnalytics = async (
  householdId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<MemberContributionPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  return apiRequest({
    path: `/v1/analytics/comparative/member-contributions?${query.toString()}`,
    schema: memberContributionPayloadSchema
  });
};

export const getProjectTimeline = async (
  householdId: string,
  options?: {
    projectId?: string;
  }
): Promise<ProjectTimelinePayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.projectId) {
    query.set("projectId", options.projectId);
  }

  return apiRequest({
    path: `/v1/analytics/projects/timeline?${query.toString()}`,
    schema: projectTimelinePayloadSchema
  });
};

export const getProjectBudgetBurn = async (
  householdId: string,
  projectId: string
): Promise<ProjectBudgetBurnPayload> => apiRequest({
  path: `/v1/analytics/projects/budget-burn?${new URLSearchParams({ householdId, projectId }).toString()}`,
  schema: projectBudgetBurnPayloadSchema
});

export const getProjectTaskVelocity = async (
  householdId: string,
  options?: {
    projectId?: string;
    months?: number;
  }
): Promise<ProjectTaskVelocityPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.projectId) {
    query.set("projectId", options.projectId);
  }

  if (options?.months !== undefined) {
    query.set("months", String(options.months));
  }

  return apiRequest({
    path: `/v1/analytics/projects/task-velocity?${query.toString()}`,
    schema: projectTaskVelocityPayloadSchema
  });
};

export const getProjectPortfolioHealth = async (
  householdId: string
): Promise<ProjectPortfolioHealthPayload> => apiRequest({
  path: `/v1/analytics/projects/portfolio-health?${new URLSearchParams({ householdId }).toString()}`,
  schema: projectPortfolioHealthPayloadSchema
});

export const getHobbySessionFrequency = async (
  householdId: string,
  options?: {
    hobbyId?: string;
    months?: number;
  }
): Promise<HobbySessionFrequencyPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.hobbyId) {
    query.set("hobbyId", options.hobbyId);
  }

  if (options?.months !== undefined) {
    query.set("months", String(options.months));
  }

  return apiRequest({
    path: `/v1/analytics/hobbies/session-frequency?${query.toString()}`,
    schema: hobbySessionFrequencyPayloadSchema
  });
};

export const getHobbyPracticeStreaks = async (
  householdId: string,
  options?: {
    hobbyId?: string;
  }
): Promise<HobbyPracticeStreaksPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.hobbyId) {
    query.set("hobbyId", options.hobbyId);
  }

  return apiRequest({
    path: `/v1/analytics/hobbies/practice-streaks?${query.toString()}`,
    schema: hobbyPracticeStreaksPayloadSchema
  });
};

export const getHobbyGoalProgress = async (
  householdId: string,
  options?: {
    hobbyId?: string;
    status?: HobbyGoalProgressGoal["onTrack"] extends never ? never : "active" | "achieved" | "abandoned" | "paused";
  }
): Promise<HobbyGoalProgressPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.hobbyId) {
    query.set("hobbyId", options.hobbyId);
  }

  if (options?.status) {
    query.set("status", options.status);
  }

  return apiRequest({
    path: `/v1/analytics/hobbies/goal-progress?${query.toString()}`,
    schema: hobbyGoalProgressPayloadSchema
  });
};

export const getHobbyAnalyticsOverview = async (
  householdId: string
): Promise<HobbyAnalyticsOverviewPayload> => {
  const query = new URLSearchParams({ householdId });

  return apiRequest({
    path: `/v1/analytics/hobbies/overview?${query.toString()}`,
    schema: hobbyAnalyticsOverviewPayloadSchema
  });
};

export const getComplianceOnTimeRate = async (
  householdId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    assetId?: string;
  }
): Promise<OnTimeRatePayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  if (options?.assetId) {
    query.set("assetId", options.assetId);
  }

  return apiRequest({
    path: `/v1/analytics/compliance/on-time-rate?${query.toString()}`,
    schema: onTimeRatePayloadSchema
  });
};

export const getComplianceOverdueTrend = async (
  householdId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    assetId?: string;
  }
): Promise<OverdueTrendPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  if (options?.assetId) {
    query.set("assetId", options.assetId);
  }

  return apiRequest({
    path: `/v1/analytics/compliance/overdue-trend?${query.toString()}`,
    schema: overdueTrendPayloadSchema
  });
};

export const getComplianceCategoryAdherence = async (
  householdId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<CategoryAdherencePayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  return apiRequest({
    path: `/v1/analytics/compliance/category-adherence?${query.toString()}`,
    schema: categoryAdherencePayloadSchema
  });
};

export const getComplianceReport = async (
  assetId: string,
  householdId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    gracePeriodDays?: number;
  }
): Promise<ComplianceReportPayload> => {
  const query = new URLSearchParams({ householdId });

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  if (options?.gracePeriodDays !== undefined) {
    query.set("gracePeriodDays", String(options.gracePeriodDays));
  }

  return apiRequest({
    path: `/v1/analytics/compliance/report/${assetId}?${query.toString()}`,
    schema: complianceReportPayloadSchema
  });
};

export const getRegulatoryAssets = async (householdId: string): Promise<RegulatoryAssetOption[]> => apiRequest({
  path: `/v1/analytics/compliance/regulatory-assets?householdId=${householdId}`,
  schema: regulatoryAssetOptionListSchema
});

export const getHouseholdMembers = async (householdId: string): Promise<HouseholdMember[]> => getHouseholdMembersCached(householdId);

export const getHouseholdServiceProviders = async (householdId: string): Promise<ServiceProvider[]> => getHouseholdServiceProvidersCached(householdId);

export const getServiceProvider = async (householdId: string, providerId: string): Promise<ServiceProvider> => apiRequest({
  path: `/v1/households/${householdId}/service-providers/${providerId}`,
  schema: serviceProviderSchema,
  revalidate: 15
});

export const getHouseholdInventory = async (
  householdId: string,
  options?: {
    lowStock?: boolean;
    category?: string;
    search?: string;
    itemType?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<{ items: InventoryItemSummary[]; nextCursor: string | null }> => {
  const query = new URLSearchParams();

  if (options?.lowStock !== undefined) {
    query.set("lowStock", String(options.lowStock));
  }

  if (options?.category) {
    query.set("category", options.category);
  }

  if (options?.search) {
    query.set("search", options.search);
  }

  if (options?.itemType) {
    query.set("itemType", options.itemType);
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return getHouseholdInventoryCached(householdId, suffix);
};

export const getHouseholdLowStockInventory = async (householdId: string): Promise<LowStockInventoryItem[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/low-stock`,
  schema: householdLowStockListSchema
});

export const getInventoryShoppingList = async (householdId: string): Promise<InventoryShoppingListSummary> => apiRequest({
  path: `/v1/households/${householdId}/inventory/shopping-list`,
  schema: inventoryShoppingListSummarySchema
});

export const generateInventoryShoppingList = async (householdId: string): Promise<InventoryShoppingListSummary> => apiRequest({
  path: `/v1/households/${householdId}/inventory/shopping-list/generate`,
  method: "POST",
  schema: inventoryShoppingListSummarySchema
});

export const getInventoryAnalyticsSummary = async (householdId: string): Promise<HouseholdInventoryAnalytics> => apiRequest({
  path: `/v1/households/${householdId}/inventory/analytics/summary`,
  schema: householdInventoryAnalyticsSchema
});

export const getInventoryItemConsumption = async (
  householdId: string,
  inventoryItemId: string
): Promise<InventoryItemConsumption> => apiRequest({
  path: `/v1/households/${householdId}/inventory/${inventoryItemId}/analytics/consumption`,
  schema: inventoryItemConsumptionSchema
});

export const getInventoryItemDetail = async (
  householdId: string,
  inventoryItemId: string,
  options?: { transactionLimit?: number }
): Promise<InventoryItemDetail> => {
  const query = new URLSearchParams();

  if (options?.transactionLimit !== undefined) {
    query.set("transactionLimit", String(options.transactionLimit));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/inventory/${inventoryItemId}${suffix}`,
    schema: inventoryItemDetailSchema,
    cacheOptions: { revalidate: 30 }
  });
};

export const getInventoryTurnover = async (householdId: string): Promise<InventoryTurnover[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/analytics/turnover`,
  schema: inventoryTurnoverListSchema
});

export const getInventoryReorderForecast = async (householdId: string): Promise<InventoryReorderForecast[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/analytics/reorder-forecast`,
  schema: inventoryReorderForecastListSchema
});

export const getAssetPartsConsumption = async (householdId: string): Promise<AssetPartsConsumption[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/analytics/asset-consumption`,
  schema: assetPartsConsumptionListSchema
});

export const getPartCommonality = async (householdId: string): Promise<PartCommonality[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/analytics/part-commonality`,
  schema: partCommonalityListSchema
});

export const getHouseholdPartsReadiness = async (
  householdId: string,
  scheduleIds?: string[]
): Promise<BulkPartsReadiness> => {
  const query = new URLSearchParams();

  if (scheduleIds && scheduleIds.length > 0) {
    query.set("scheduleIds", scheduleIds.join(","));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/inventory/readiness${suffix}`,
    schema: bulkPartsReadinessSchema
  });
};

export const exportHouseholdInventory = async (householdId: string): Promise<string> => {
  const path = `/v1/households/${householdId}/inventory/export`;
  let response: Response;

  try {
    response = await fetch(getFetchTarget(path), {
      method: "GET",
      cache: "no-store",
      headers: getRequestHeaders(null)
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the API at ${apiBaseUrl}.${detail}`,
      503
    );
  }

  if (!response.ok) {
    const payload = await parseJson(response);
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return response.text();
};

export const importHouseholdInventory = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportInventoryResult> => {
  const path = `/v1/households/${householdId}/inventory/import`;
  let response: Response;

  try {
    response = await fetch(getFetchTarget(path), {
      method: "POST",
      cache: "no-store",
      headers: getRequestHeaders(),
      body: JSON.stringify({ items })
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the API at ${apiBaseUrl}.${detail}`,
      503
    );
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return importInventoryResultSchema.parse(payload);
};

export const exportHouseholdSpaces = async (householdId: string): Promise<string> => {
  const path = `/v1/households/${householdId}/spaces/export`;
  let response: Response;

  try {
    response = await fetch(getFetchTarget(path), {
      method: "GET",
      cache: "no-store",
      headers: getRequestHeaders(null)
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the API at ${apiBaseUrl}.${detail}`,
      503
    );
  }

  if (!response.ok) {
    const payload = await parseJson(response);
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return response.text();
};

export const importHouseholdSpaces = async (
  householdId: string,
  spaces: ImportSpaceRow[]
): Promise<ImportSpacesResult> => {
  const path = `/v1/households/${householdId}/spaces/import`;
  let response: Response;

  try {
    response = await fetch(getFetchTarget(path), {
      method: "POST",
      cache: "no-store",
      headers: getRequestHeaders(),
      body: JSON.stringify({ spaces })
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the API at ${apiBaseUrl}.${detail}`,
      503
    );
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return importSpacesResultSchema.parse(payload);
};

export const getHouseholdInventoryTransactions = async (
  householdId: string,
  options?: InventoryTransactionQuery
): Promise<InventoryTransactionList> => {
  const query = new URLSearchParams();

  if (options?.startDate) {
    query.set("startDate", options.startDate);
  }

  if (options?.endDate) {
    query.set("endDate", options.endDate);
  }

  if (options?.type) {
    query.set("type", options.type);
  }

  if (options?.referenceType) {
    query.set("referenceType", options.referenceType);
  }

  if (options?.inventoryItemId) {
    query.set("inventoryItemId", options.inventoryItemId);
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/inventory/transactions${suffix}`,
    schema: inventoryTransactionListSchema
  });
};

export const createInventoryTransactionCorrection = async (
  householdId: string,
  transactionId: string,
  input: CreateInventoryTransactionCorrectionInput
): Promise<InventoryTransactionCorrectionResult> => apiRequest({
  path: `/v1/households/${householdId}/inventory/transactions/${transactionId}/corrections`,
  method: "POST",
  body: createInventoryTransactionCorrectionSchema.parse(input),
  schema: inventoryTransactionCorrectionResultSchema
});

export const createInventoryItem = async (
  householdId: string,
  input: CreateInventoryItemInput
): Promise<InventoryItemSummary> => apiRequest({
  path: `/v1/households/${householdId}/inventory`,
  method: "POST",
  body: input,
  schema: inventoryItemSummarySchema
});

export const updateInventoryItem = async (
  householdId: string,
  inventoryItemId: string,
  input: UpdateInventoryItemInput
): Promise<InventoryItemSummary> => apiRequest({
  path: `/v1/households/${householdId}/inventory/${inventoryItemId}`,
  method: "PATCH",
  body: input,
  schema: inventoryItemSummarySchema
});

export const deleteInventoryItem = async (householdId: string, inventoryItemId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/inventory/${inventoryItemId}`,
    method: "DELETE"
  });
};

export const getHouseholdSpaces = async (
  householdId: string,
  options?: {
    parentSpaceId?: string | null;
    type?: string;
    search?: string;
    includeDeleted?: boolean;
    limit?: number;
    cursor?: string;
  }
): Promise<SpaceListResponse> => {
  const query = new URLSearchParams();

  if (options?.parentSpaceId !== undefined) {
    query.set("parentSpaceId", options.parentSpaceId ?? "null");
  }

  if (options?.type) {
    query.set("type", options.type);
  }

  if (options?.search) {
    query.set("search", options.search);
  }

  if (options?.includeDeleted !== undefined) {
    query.set("includeDeleted", String(options.includeDeleted));
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/spaces${suffix}`,
    schema: spaceListResponseSchema
  });
};

export const getHouseholdSpacesTree = async (householdId: string): Promise<SpaceResponse[]> => apiRequest({
  path: `/v1/households/${householdId}/spaces/tree`,
  schema: z.array(spaceResponseSchema)
});

export const getSpaceByShortCode = async (householdId: string, shortCode: string): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/lookup/${encodeURIComponent(shortCode)}`,
  schema: spaceResponseSchema
});

export const getSpaceOrphanCount = async (householdId: string): Promise<SpaceOrphanCount> => apiRequest({
  path: `/v1/households/${householdId}/spaces/analytics/orphans/count`,
  schema: spaceOrphanCountSchema
});

export const getSpaceOrphans = async (
  householdId: string,
  options?: {
    category?: string;
    search?: string;
    itemType?: "consumable" | "equipment";
    limit?: number;
    cursor?: string;
  }
): Promise<InventoryItemListResponse> => {
  const query = new URLSearchParams();

  if (options?.category) {
    query.set("category", options.category);
  }

  if (options?.search) {
    query.set("search", options.search);
  }

  if (options?.itemType) {
    query.set("itemType", options.itemType);
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/spaces/analytics/orphans${suffix}`,
    schema: inventoryItemListResponseSchema
  });
};

export const getSpaceUtilization = async (householdId: string): Promise<SpaceUtilizationEntry[]> => apiRequest({
  path: `/v1/households/${householdId}/spaces/analytics/utilization`,
  schema: spaceUtilizationListSchema
});

export const getRecentSpaceScans = async (
  householdId: string,
  limit = 10
): Promise<SpaceRecentScanEntry[]> => apiRequest({
  path: `/v1/households/${householdId}/spaces/recent-scans?limit=${encodeURIComponent(String(limit))}`,
  schema: spaceRecentScanListSchema,
  cacheOptions: { revalidate: 0 }
});

export const getSpace = async (householdId: string, spaceId: string): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}`,
  schema: spaceResponseSchema,
  cacheOptions: { revalidate: 30 }
});

export const createSpace = async (householdId: string, input: CreateSpaceInput): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces`,
  method: "POST",
  body: input,
  schema: spaceResponseSchema
});

export const updateSpace = async (
  householdId: string,
  spaceId: string,
  input: UpdateSpaceInput
): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}`,
  method: "PATCH",
  body: input,
  schema: spaceResponseSchema
});

export const deleteSpace = async (householdId: string, spaceId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/spaces/${spaceId}`,
    method: "DELETE"
  });
};

export const reorderSpaces = async (
  householdId: string,
  orderedIds: ReorderByOrderedIdsInput["orderedIds"]
): Promise<ReorderByOrderedIdsInput> => apiRequest({
  path: `/v1/households/${householdId}/spaces/reorder`,
  method: "PATCH",
  body: { orderedIds },
  schema: reorderByOrderedIdsSchema,
});

export const restoreSpace = async (householdId: string, spaceId: string): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/restore`,
  method: "POST",
  schema: spaceResponseSchema
});

export const moveSpace = async (
  householdId: string,
  spaceId: string,
  input: MoveSpaceInput
): Promise<SpaceResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/move`,
  method: "POST",
  body: input,
  schema: spaceResponseSchema
});

export const addItemToSpace = async (
  householdId: string,
  spaceId: string,
  input: AddSpaceItemInput
) => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/items`,
  method: "POST",
  body: input,
  schema: spaceInventoryLinkDetailSchema
});

export const removeItemFromSpace = async (
  householdId: string,
  spaceId: string,
  inventoryItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/spaces/${spaceId}/items/${inventoryItemId}`,
    method: "DELETE"
  });
};

export const addGeneralItemToSpace = async (
  householdId: string,
  spaceId: string,
  input: SpaceGeneralItemInput
): Promise<SpaceGeneralItem> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/general-items`,
  method: "POST",
  body: input,
  schema: spaceGeneralItemSchema
});

export const updateGeneralItem = async (
  householdId: string,
  spaceId: string,
  generalItemId: string,
  input: UpdateSpaceGeneralItemInput
): Promise<SpaceGeneralItem> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/general-items/${generalItemId}`,
  method: "PATCH",
  body: input,
  schema: spaceGeneralItemSchema
});

export const deleteGeneralItem = async (
  householdId: string,
  spaceId: string,
  generalItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/spaces/${spaceId}/general-items/${generalItemId}`,
    method: "DELETE"
  });
};

export const logSpaceDirectNavigation = async (householdId: string, spaceId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/spaces/${spaceId}/view`,
    method: "POST"
  });
};

export const getSpaceContents = async (householdId: string, spaceId: string): Promise<SpaceContentsResponse> => apiRequest({
  path: `/v1/households/${householdId}/spaces/${spaceId}/contents`,
  schema: spaceContentsResponseSchema,
  cacheOptions: { revalidate: 30 }
});

export const getSpaceHistory = async (
  householdId: string,
  spaceId: string,
  options?: {
    actions?: Array<"placed" | "removed" | "moved_in" | "moved_out" | "quantity_changed">;
    since?: string;
    until?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<SpaceItemHistoryListResponse> => {
  const query = new URLSearchParams();

  if (options?.actions && options.actions.length > 0) {
    query.set("actions", options.actions.join(","));
  }

  if (options?.since) {
    query.set("since", options.since);
  }

  if (options?.until) {
    query.set("until", options.until);
  }

  if (options?.limit !== undefined) {
    query.set("limit", String(options.limit));
  }

  if (options?.cursor) {
    query.set("cursor", options.cursor);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/spaces/${spaceId}/history${suffix}`,
    schema: spaceItemHistoryListResponseSchema,
    cacheOptions: { revalidate: 30 }
  });
};

export const updateInventoryPurchaseLine = async (
  householdId: string,
  purchaseId: string,
  lineId: string,
  input: UpdateInventoryPurchaseLineInput
): Promise<InventoryPurchase> => apiRequest({
  path: `/v1/households/${householdId}/inventory/purchases/${purchaseId}/lines/${lineId}`,
  method: "PATCH",
  body: input,
  schema: inventoryPurchaseSchemaResponse
});

export const createQuickRestockBatch = async (
  householdId: string,
  input: CreateQuickRestockInput
): Promise<InventoryPurchase> => apiRequest({
  path: `/v1/households/${householdId}/inventory/restock-batches`,
  method: "POST",
  body: input,
  schema: inventoryPurchaseSchemaResponse
});

export const createServiceProvider = async (
  householdId: string,
  input: CreateServiceProviderInput
): Promise<ServiceProvider> => apiRequest({
  path: `/v1/households/${householdId}/service-providers`,
  method: "POST",
  body: input,
  schema: serviceProviderSchema
});

export const updateServiceProvider = async (
  householdId: string,
  providerId: string,
  input: UpdateServiceProviderInput
): Promise<ServiceProvider> => apiRequest({
  path: `/v1/households/${householdId}/service-providers/${providerId}`,
  method: "PATCH",
  body: input,
  schema: serviceProviderSchema
});

export const deleteServiceProvider = async (householdId: string, providerId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/service-providers/${providerId}`,
    method: "DELETE"
  });
};

export const getAssetLogs = async (
  assetId: string,
  options?: { scheduleId?: string; limit?: number; cursor?: string }
): Promise<{ logs: MaintenanceLog[]; nextCursor: string | null }> => {
  const params = new URLSearchParams();
  if (options?.scheduleId) params.set("scheduleId", options.scheduleId);
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString();

  return apiRequest({
    path: `/v1/assets/${assetId}/logs${qs ? `?${qs}` : ""}`,
    schema: paginatedMaintenanceLogSchema
  });
};

export const deleteMetric = async (assetId: string, metricId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/metrics/${metricId}`,
    method: "DELETE"
  });
};

export const createMetricEntry = async (
  assetId: string,
  metricId: string,
  input: CreateUsageMetricEntryInput
): Promise<UsageMetricEntry> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/${metricId}/entries`,
  method: "POST",
  body: input,
  schema: usageMetricEntrySchema
});

export const getMetricEntries = async (assetId: string, metricId: string): Promise<UsageMetricEntry[]> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/${metricId}/entries`,
  schema: usageMetricEntryListSchema
});

export const getMetricProjection = async (assetId: string, metricId: string): Promise<UsageProjection> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/${metricId}/projection`,
  schema: usageProjectionSchema
});

export const getMetricRateAnalytics = async (
  assetId: string,
  metricId: string,
  options?: { bucketSize?: string; lookback?: number }
): Promise<UsageRateAnalytics> => {
  const params = new URLSearchParams();

  if (options?.bucketSize) {
    params.set("bucketSize", options.bucketSize);
  }

  if (options?.lookback !== undefined) {
    params.set("lookback", String(options.lookback));
  }

  const query = params.toString();

  return apiRequest({
    path: `/v1/assets/${assetId}/metrics/${metricId}/analytics/rates${query ? `?${query}` : ""}`,
    schema: usageRateAnalyticsSchema
  });
};

export const getMetricCostNormalization = async (
  assetId: string,
  metricId: string
): Promise<UsageCostNormalization> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/${metricId}/analytics/cost-normalization`,
  schema: usageCostNormalizationSchema
});

export const getEnhancedProjections = async (
  assetId: string,
  metricId: string
): Promise<EnhancedUsageProjection> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/${metricId}/analytics/projections`,
  schema: enhancedUsageProjectionSchema
});

export const getAssetMetricCorrelations = async (assetId: string): Promise<AssetMetricCorrelationMatrix> => apiRequest({
  path: `/v1/assets/${assetId}/metrics/analytics/correlations`,
  schema: assetMetricCorrelationMatrixSchema
});

export const recordConditionAssessment = async (
  assetId: string,
  input: CreateConditionAssessmentInput
): Promise<Asset> => apiRequest({
  path: `/v1/assets/${assetId}/condition`,
  method: "POST",
  body: input,
  schema: assetSchema
});

export const createProject = async (
  householdId: string,
  input: CreateProjectInput
): Promise<Project> => apiRequest({
  path: `/v1/households/${householdId}/projects`,
  method: "POST",
  body: input,
  schema: projectSchema
});

export const getProjectTemplates = async (householdId: string): Promise<ProjectTemplate[]> => apiRequest({
  path: `/v1/households/${householdId}/project-templates`,
  schema: projectTemplateListSchema
});

export const createProjectTemplate = async (
  householdId: string,
  input: CreateProjectTemplateInput
): Promise<ProjectTemplate> => apiRequest({
  path: `/v1/households/${householdId}/project-templates`,
  method: "POST",
  body: input,
  schema: projectTemplateSchema
});

export const instantiateProjectTemplate = async (
  householdId: string,
  templateId: string,
  input: InstantiateProjectTemplateInput
): Promise<Project> => apiRequest({
  path: `/v1/households/${householdId}/project-templates/${templateId}/instantiate`,
  method: "POST",
  body: instantiateProjectTemplateSchema.parse(input),
  schema: projectSchema
});

export const cloneProject = async (
  householdId: string,
  projectId: string,
  input: CloneProjectInput
): Promise<Project> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/clone`,
  method: "POST",
  body: cloneProjectSchema.parse(input),
  schema: projectSchema
});

export const updateProject = async (
  householdId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<Project> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}`,
  method: "PATCH",
  body: input,
  schema: projectSchema
});

export const deleteProject = async (householdId: string, projectId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}`,
    method: "DELETE"
  });
};

export const createProjectPhase = async (
  householdId: string,
  projectId: string,
  input: CreateProjectPhaseInput
): Promise<ProjectPhaseSummary> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases`,
  method: "POST",
  body: input,
  schema: projectPhaseSummarySchema
});

export const updateProjectPhase = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  input: UpdateProjectPhaseInput
): Promise<ProjectPhaseSummary> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}`,
  method: "PATCH",
  body: input,
  schema: projectPhaseSummarySchema
});

export const deleteProjectPhase = async (
  householdId: string,
  projectId: string,
  phaseId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}`,
    method: "DELETE"
  });
};

export const reorderProjectPhases = async (
  householdId: string,
  projectId: string,
  phaseIds: ReorderProjectPhasesInput["phaseIds"]
): Promise<ReorderProjectPhasesInput> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/reorder`,
  method: "PATCH",
  body: { phaseIds },
  schema: {
    parse: (value: unknown) => reorderProjectPhasesSchema.parse(value)
  }
});

export const createPhaseChecklistItem = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  input: CreateProjectPhaseChecklistItemInput
): Promise<ReturnType<typeof projectPhaseChecklistItemSchema.parse>> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist`,
  method: "POST",
  body: input,
  schema: projectPhaseChecklistItemSchema
});

export const updatePhaseChecklistItem = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  checklistItemId: string,
  input: UpdateProjectPhaseChecklistItemInput
): Promise<ReturnType<typeof projectPhaseChecklistItemSchema.parse>> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist/${checklistItemId}`,
  method: "PATCH",
  body: input,
  schema: projectPhaseChecklistItemSchema
});

export const deletePhaseChecklistItem = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  checklistItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist/${checklistItemId}`,
    method: "DELETE"
  });
};

export const reorderPhaseChecklistItems = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  orderedIds: ReorderByOrderedIdsInput["orderedIds"]
): Promise<ReorderByOrderedIdsInput> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist-items/reorder`,
  method: "PATCH",
  body: { orderedIds },
  schema: reorderByOrderedIdsSchema,
});

export const createTaskChecklistItem = async (
  householdId: string,
  projectId: string,
  taskId: string,
  input: CreateProjectTaskChecklistItemInput
): Promise<ProjectTaskChecklistItem> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}/checklist`,
  method: "POST",
  body: input,
  schema: projectTaskChecklistItemSchema
});

export const updateTaskChecklistItem = async (
  householdId: string,
  projectId: string,
  taskId: string,
  checklistItemId: string,
  input: UpdateProjectTaskChecklistItemInput
): Promise<ProjectTaskChecklistItem> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}/checklist/${checklistItemId}`,
  method: "PATCH",
  body: input,
  schema: projectTaskChecklistItemSchema
});

export const deleteTaskChecklistItem = async (
  householdId: string,
  projectId: string,
  taskId: string,
  checklistItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}/checklist/${checklistItemId}`,
    method: "DELETE"
  });
};

export const reorderTaskChecklistItems = async (
  householdId: string,
  projectId: string,
  taskId: string,
  orderedIds: ReorderByOrderedIdsInput["orderedIds"]
): Promise<ReorderByOrderedIdsInput> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}/checklist-items/reorder`,
  method: "PATCH",
  body: { orderedIds },
  schema: reorderByOrderedIdsSchema,
});

export const createProjectBudgetCategory = async (
  householdId: string,
  projectId: string,
  input: CreateProjectBudgetCategoryInput
): Promise<ProjectBudgetCategorySummary> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
  method: "POST",
  body: input,
  schema: projectBudgetCategorySummarySchema
});

export const updateProjectBudgetCategory = async (
  householdId: string,
  projectId: string,
  categoryId: string,
  input: UpdateProjectBudgetCategoryInput
): Promise<ProjectBudgetCategorySummary> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/budget-categories/${categoryId}`,
  method: "PATCH",
  body: input,
  schema: projectBudgetCategorySummarySchema
});

export const deleteProjectBudgetCategory = async (
  householdId: string,
  projectId: string,
  categoryId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/budget-categories/${categoryId}`,
    method: "DELETE"
  });
};

export const createProjectPhaseSupply = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  input: CreateProjectPhaseSupplyInput
): Promise<ProjectPhaseSupply> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
  method: "POST",
  body: input,
  schema: projectPhaseSupplySchema
});

export const updateProjectPhaseSupply = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  supplyId: string,
  input: UpdateProjectPhaseSupplyInput
): Promise<ProjectPhaseSupply> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/${supplyId}`,
  method: "PATCH",
  body: input,
  schema: projectPhaseSupplySchema
});

export const reorderProjectPhaseSupplies = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  supplyIds: ReorderProjectPhaseSuppliesInput["supplyIds"]
): Promise<ReorderProjectPhaseSuppliesInput> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/reorder`,
  method: "PATCH",
  body: { supplyIds },
  schema: {
    parse: (value: unknown) => reorderProjectPhaseSuppliesSchema.parse(value)
  }
});

export const deleteProjectPhaseSupply = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  supplyId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/${supplyId}`,
    method: "DELETE"
  });
};

export const allocateSupplyFromInventory = async (
  householdId: string,
  projectId: string,
  phaseId: string,
  supplyId: string,
  input: AllocateProjectInventoryInput
): Promise<{
  supply: ProjectPhaseSupply;
  inventoryItem: InventoryItemSummary;
  transaction: Awaited<ReturnType<typeof projectPhaseSupplyAllocationSchema.parse>>["transaction"];
}> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/${supplyId}/allocate-from-inventory`,
  method: "POST",
  body: input,
  schema: projectPhaseSupplyAllocationSchema
});

export const updateProjectStatus = async (
  householdId: string,
  projectId: string,
  status: ProjectStatus
): Promise<Project> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/status`,
  method: "PATCH",
  body: { status },
  schema: projectSchema
});

export const addProjectAsset = async (
  householdId: string,
  projectId: string,
  input: CreateProjectAssetInput
): Promise<ProjectAsset> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/assets`,
  method: "POST",
  body: input,
  schema: projectAssetSchema
});

export const updateProjectAsset = async (
  householdId: string,
  projectId: string,
  projectAssetId: string,
  input: UpdateProjectAssetInput
): Promise<ProjectAsset> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/assets/${projectAssetId}`,
  method: "PATCH",
  body: input,
  schema: projectAssetSchema
});

export const removeProjectAsset = async (
  householdId: string,
  projectId: string,
  projectAssetId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/assets/${projectAssetId}`,
    method: "DELETE"
  });
};

export const createProjectTask = async (
  householdId: string,
  projectId: string,
  input: CreateProjectTaskInput
): Promise<ProjectTask> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks`,
  method: "POST",
  body: input,
  schema: projectTaskSchema
});

export const updateProjectTask = async (
  householdId: string,
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput
): Promise<ProjectTask> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}`,
  method: "PATCH",
  body: input,
  schema: projectTaskSchema
});

export const deleteProjectTask = async (
  householdId: string,
  projectId: string,
  taskId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}`,
    method: "DELETE"
  });
};

export const createQuickTodo = async (
  householdId: string,
  projectId: string,
  input: CreateQuickTodoInput
): Promise<ProjectTask> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/quick-todos`,
  method: "POST",
  body: input,
  schema: projectTaskSchema
});

export const promoteTask = async (
  householdId: string,
  projectId: string,
  taskId: string,
  input?: PromoteTaskInput
): Promise<ProjectTask> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}/promote`,
  method: "POST",
  body: input ?? {},
  schema: projectTaskSchema
});

export const createProjectExpense = async (
  householdId: string,
  projectId: string,
  input: CreateProjectExpenseInput
): Promise<ProjectExpense> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/expenses`,
  method: "POST",
  body: input,
  schema: projectExpenseSchema
});

export const updateProjectExpense = async (
  householdId: string,
  projectId: string,
  expenseId: string,
  input: UpdateProjectExpenseInput
): Promise<ProjectExpense> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`,
  method: "PATCH",
  body: input,
  schema: projectExpenseSchema
});

export const deleteProjectExpense = async (
  householdId: string,
  projectId: string,
  expenseId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`,
    method: "DELETE"
  });
};

export const createProjectInventoryItem = async (
  householdId: string,
  projectId: string,
  input: CreateProjectInventoryItemInput
): Promise<InventoryProjectLinkDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/inventory`,
  method: "POST",
  body: input,
  schema: inventoryProjectLinkDetailSchema
});

export const updateProjectInventoryItem = async (
  householdId: string,
  projectId: string,
  inventoryItemId: string,
  input: UpdateProjectInventoryItemInput
): Promise<InventoryProjectLinkDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/inventory/${inventoryItemId}`,
  method: "PATCH",
  body: input,
  schema: inventoryProjectLinkDetailSchema
});

export const allocateProjectInventory = async (
  householdId: string,
  projectId: string,
  inventoryItemId: string,
  input: AllocateProjectInventoryInput
): Promise<{
  projectInventoryItem: InventoryProjectLinkDetail;
  inventoryItem: InventoryItemSummary;
  transaction: Awaited<ReturnType<typeof projectInventoryAllocationSchema.parse>>["transaction"];
}> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/inventory/${inventoryItemId}/allocate`,
  method: "POST",
  body: input,
  schema: projectInventoryAllocationSchema
});

export const deleteProjectInventoryItem = async (
  householdId: string,
  projectId: string,
  inventoryItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/inventory/${inventoryItemId}`,
    method: "DELETE"
  });
};

export const createHousehold = async (input: CreateHouseholdInput): Promise<HouseholdSummary> => apiRequest({
  path: "/v1/households",
  method: "POST",
  body: input,
  schema: householdSummarySchema
});

export const updateHousehold = async (householdId: string, input: UpdateHouseholdInput): Promise<HouseholdSummary> => apiRequest({
  path: `/v1/households/${householdId}`,
  method: "PATCH",
  body: input,
  schema: householdSummarySchema
});

export const createAsset = async (input: CreateAssetInput): Promise<Asset> => apiRequest({
  path: "/v1/assets",
  method: "POST",
  body: input,
  schema: assetSchema
});

export const updateAsset = async (assetId: string, input: UpdateAssetInput): Promise<Asset> => apiRequest({
  path: `/v1/assets/${assetId}`,
  method: "PATCH",
  body: input,
  schema: assetSchema
});

export const createAssetTransfer = async (
  assetId: string,
  input: CreateAssetTransferInput
) => apiRequest({
  path: `/v1/assets/${assetId}/transfers`,
  method: "POST",
  body: input,
  schema: assetTransferListSchema.shape.items.element
});

export const getHouseholdPresets = async (householdId: string): Promise<CustomPresetProfile[]> => apiRequest({
  path: `/v1/households/${householdId}/presets`,
  schema: customPresetProfileListSchema,
  revalidate: 60
});

export const createPresetProfile = async (
  householdId: string,
  input: CreatePresetProfileInput
): Promise<CustomPresetProfile> => apiRequest({
  path: `/v1/households/${householdId}/presets`,
  method: "POST",
  body: input,
  schema: customPresetProfileSchema
});

export const applyPreset = async (
  assetId: string,
  body: {
    source: "library" | "custom";
    presetKey?: string;
    presetProfileId?: string;
  }
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/apply-preset`,
    method: "POST",
    body: {
      ...body,
      mergeCustomFields: true,
      skipExistingMetrics: true,
      skipExistingSchedules: true
    }
  });
};

export const createProjectNote = async (
  householdId: string,
  projectId: string,
  input: CreateProjectNoteInput
): Promise<ProjectNote> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/notes`,
  method: "POST",
  body: input,
  schema: projectNoteSchema
});

export const updateProjectNote = async (
  householdId: string,
  projectId: string,
  noteId: string,
  input: UpdateProjectNoteInput
): Promise<ProjectNote> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/notes/${noteId}`,
  method: "PATCH",
  body: input,
  schema: projectNoteSchema
});

export const deleteProjectNote = async (
  householdId: string,
  projectId: string,
  noteId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/notes/${noteId}`,
    method: "DELETE"
  });
};

export const applyLibraryPreset = async (assetId: string, presetKey: string): Promise<void> => applyPreset(assetId, {
  source: "library",
  presetKey
});

export const completeSchedule = async (
  assetId: string,
  scheduleId: string,
  input: CompleteMaintenanceScheduleInput
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/schedules/${scheduleId}/complete`,
    method: "POST",
    body: input
  });
};

export const createMaintenanceLog = async (
  assetId: string,
  input: CreateMaintenanceLogInput
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/logs`,
    method: "POST",
    body: input
  });
};

export const createMetric = async (
  assetId: string,
  input: CreateUsageMetricInput
): Promise<UsageMetric> => apiRequest({
    path: `/v1/assets/${assetId}/metrics`,
    method: "POST",
    body: input,
    schema: usageMetricResponseSchema
  });

export const createSchedule = async (
  assetId: string,
  input: CreateMaintenanceScheduleInput
): Promise<MaintenanceSchedule> => apiRequest({
  path: `/v1/assets/${assetId}/schedules`,
  method: "POST",
  body: input,
  schema: maintenanceScheduleSchema
});

export const updateSchedule = async (
  assetId: string,
  scheduleId: string,
  input: Partial<Pick<MaintenanceSchedule, "isActive">>
): Promise<MaintenanceSchedule> => apiRequest({
  path: `/v1/assets/${assetId}/schedules/${scheduleId}`,
  method: "PATCH",
  body: input,
  schema: maintenanceScheduleSchema
});

export const getScheduleInventoryItems = async (
  assetId: string,
  scheduleId: string
): Promise<ScheduleInventoryLinkDetail[]> => apiRequest({
  path: `/v1/assets/${assetId}/schedules/${scheduleId}/inventory`,
  schema: scheduleInventoryListSchema
});

export const getSchedulePartsReadiness = async (
  assetId: string,
  scheduleId: string
): Promise<SchedulePartsReadiness> => apiRequest({
  path: `/v1/assets/${assetId}/schedules/${scheduleId}/inventory/readiness`,
  schema: schedulePartsReadinessSchema
});

export const getHouseholdCostDashboard = async (
  householdId: string,
  options?: { periodMonths?: number }
): Promise<HouseholdCostDashboard> => {
  const query = new URLSearchParams();

  if (options?.periodMonths !== undefined) {
    query.set("periodMonths", String(options.periodMonths));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/cost-analytics/dashboard${suffix}`,
    schema: householdCostDashboardSchema
  });
};

export const getServiceProviderSpend = async (householdId: string): Promise<ServiceProviderSpend> => apiRequest({
  path: `/v1/households/${householdId}/cost-analytics/service-providers`,
  schema: serviceProviderSpendSchema
});

export const getHouseholdCostForecast = async (householdId: string): Promise<CostForecast> => apiRequest({
  path: `/v1/households/${householdId}/cost-analytics/forecast`,
  schema: costForecastSchema
});

export const getHouseholdCostOverview = async (householdId: string): Promise<HouseholdCostOverview> => apiRequest({
  path: `/v1/households/${householdId}/cost-analytics/overview`,
  schema: householdCostOverviewSchema,
  revalidate: 30
});

export const getScheduleComplianceDashboard = async (
  householdId: string,
  periodMonths?: number
): Promise<ScheduleComplianceDashboard> => {
  const query = new URLSearchParams();

  if (periodMonths !== undefined) {
    query.set("periodMonths", String(periodMonths));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/schedule-compliance${suffix}`,
    schema: scheduleComplianceDashboardSchema
  });
};

export const getAssetCostSummary = async (assetId: string): Promise<AssetCostSummary> => apiRequest({
  path: `/v1/assets/${assetId}/cost-analytics/summary`,
  schema: assetCostSummarySchema
});

export const getAssetCostPerUnit = async (assetId: string): Promise<AssetCostPerUnit> => apiRequest({
  path: `/v1/assets/${assetId}/cost-analytics/cost-per-unit`,
  schema: assetCostPerUnitSchema
});

export const getAssetCostForecast = async (assetId: string): Promise<CostForecast> => apiRequest({
  path: `/v1/assets/${assetId}/cost-analytics/forecast`,
  schema: costForecastSchema
});

export const createScheduleInventoryItem = async (
  assetId: string,
  scheduleId: string,
  input: CreateScheduleInventoryItemInput
): Promise<ScheduleInventoryLinkDetail> => apiRequest({
  path: `/v1/assets/${assetId}/schedules/${scheduleId}/inventory`,
  method: "POST",
  body: input,
  schema: scheduleInventoryLinkDetailSchema
});

export const updateScheduleInventoryItem = async (
  assetId: string,
  scheduleId: string,
  inventoryItemId: string,
  input: UpdateScheduleInventoryItemInput
): Promise<ScheduleInventoryLinkDetail> => apiRequest({
  path: `/v1/assets/${assetId}/schedules/${scheduleId}/inventory/${inventoryItemId}`,
  method: "PATCH",
  body: input,
  schema: scheduleInventoryLinkDetailSchema
});

export const deleteScheduleInventoryItem = async (
  assetId: string,
  scheduleId: string,
  inventoryItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/schedules/${scheduleId}/inventory/${inventoryItemId}`,
    method: "DELETE"
  });
};

export const deleteSchedule = async (
  assetId: string,
  scheduleId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/schedules/${scheduleId}`,
    method: "DELETE"
  });
};

export const updateMetric = async (
  assetId: string,
  metricId: string,
  input: UpdateUsageMetricInput
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/metrics/${metricId}`,
    method: "PATCH",
    body: input,
    schema: usageMetricResponseSchema
  });
};

export const archiveAsset = async (assetId: string): Promise<Asset> => apiRequest({
  path: `/v1/assets/${assetId}/archive`,
  method: "POST",
  schema: assetSchema
});

export const unarchiveAsset = async (assetId: string): Promise<Asset> => apiRequest({
  path: `/v1/assets/${assetId}/unarchive`,
  method: "POST",
  schema: assetSchema
});

export const softDeleteAsset = async (assetId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}`,
    method: "DELETE"
  });
};

export const restoreAsset = async (assetId: string): Promise<Asset> => apiRequest({
  path: `/v1/assets/${assetId}/restore`,
  method: "POST",
  schema: assetSchema
});

export const bulkArchiveAssets = async (
  householdId: string,
  assetIds: string[],
  opts?: { applyToAll?: boolean }
): Promise<BulkAssetOperationResult> =>
  apiRequest({
    path: "/v1/assets/bulk/archive",
    method: "POST",
    body: opts?.applyToAll ? { householdId, applyToAll: true } : { householdId, assetIds },
    schema: bulkAssetOperationResultSchema
  });

export const bulkReassignAssetCategory = async (
  householdId: string,
  assetIds: string[],
  category: AssetCategory,
  opts?: { applyToAll?: boolean }
): Promise<BulkAssetOperationResult> =>
  apiRequest({
    path: "/v1/assets/bulk/category",
    method: "POST",
    body: opts?.applyToAll ? { householdId, applyToAll: true, category } : { householdId, assetIds, category },
    schema: bulkAssetOperationResultSchema
  });

export const exportHouseholdAssets = async (householdId: string): Promise<string> => {
  const path = `/v1/assets/export?householdId=${encodeURIComponent(householdId)}`;
  let response: Response;

  try {
    response = await fetch(getFetchTarget(path), {
      method: "GET",
      cache: "no-store",
      headers: getRequestHeaders(null)
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new ApiError(`Unable to reach the API at ${apiBaseUrl}.${detail}`, 503);
  }

  if (!response.ok) {
    const payload = await parseJson(response);
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }

  return response.text();
};

export const bulkCompleteSchedules = async (
  householdId: string,
  scheduleIds: string[],
  notes?: string
): Promise<BulkScheduleOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/schedules/bulk/complete`,
    method: "POST",
    body: { scheduleIds, ...(notes !== undefined ? { notes } : {}) },
    schema: bulkScheduleOperationResultSchema
  });

export const bulkSnoozeSchedules = async (
  householdId: string,
  scheduleIds: string[],
  snoozeDays: number
): Promise<BulkScheduleOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/schedules/bulk/snooze`,
    method: "POST",
    body: { scheduleIds, snoozeDays },
    schema: bulkScheduleOperationResultSchema
  });

export const bulkPauseSchedules = async (
  householdId: string,
  scheduleIds: string[]
): Promise<BulkScheduleOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/schedules/bulk/pause`,
    method: "POST",
    body: { scheduleIds },
    schema: bulkScheduleOperationResultSchema
  });

export const bulkCompleteTasks = async (
  householdId: string,
  projectId: string,
  taskIds: string[]
): Promise<BulkTaskOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/tasks/bulk/complete`,
    method: "POST",
    body: { taskIds },
    schema: bulkTaskOperationResultSchema
  });

export const bulkReassignTasks = async (
  householdId: string,
  projectId: string,
  taskIds: string[],
  options: { phaseId?: string | null; assignedToId?: string | null }
): Promise<BulkTaskOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/tasks/bulk/reassign`,
    method: "POST",
    body: { taskIds, ...options },
    schema: bulkTaskOperationResultSchema
  });

export const bulkChangeProjectsStatus = async (
  householdId: string,
  projectIds: string[],
  status: string
): Promise<BulkProjectOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/projects/bulk/status`,
    method: "POST",
    body: { projectIds, status },
    schema: bulkProjectOperationResultSchema
  });

export const markNotificationRead = async (notificationId: string): Promise<Notification> => apiRequest({
  path: `/v1/notifications/${notificationId}/read`,
  method: "PATCH",
  schema: notificationSchema
});

export const markNotificationUnread = async (notificationId: string): Promise<Notification> => apiRequest({
  path: `/v1/notifications/${notificationId}/unread`,
  method: "PATCH",
  schema: notificationSchema
});

export const getNotificationPreferences = cache(async (): Promise<NotificationPreferences> => apiRequest({
  path: "/v1/me/notification-preferences",
  schema: notificationPreferencesSchema,
  revalidate: 60
}));

export const updateNotificationPreferences = async (input: UpdateNotificationPreferencesInput): Promise<void> => {
  await apiRequest({
    path: "/v1/me/notification-preferences",
    method: "PATCH",
    body: input
  });
};

export const getDisplayPreferences = cache(async (): Promise<DisplayPreferences> => apiRequest({
  path: "/v1/me/display-preferences",
  schema: displayPreferencesSchema,
  revalidate: 60
}));

export const updateDisplayPreferences = async (input: UpdateDisplayPreferencesInput): Promise<DisplayPreferences> =>
  apiRequest({
    path: "/v1/me/display-preferences",
    method: "PATCH",
    body: input,
    schema: displayPreferencesSchema
  });

export const deleteAccount = async (): Promise<void> => {
  await apiRequest({ path: "/v1/me", method: "DELETE" });
};

export const enqueueNotificationScan = async (householdId: string): Promise<void> => {
  await apiRequest({
    path: "/v1/notifications/scan",
    method: "POST",
    body: { householdId }
  });
};

export const fetchLinkPreview = async (householdId: string, url: string): Promise<LinkPreviewResponse> => {
  const normalizedUrl = normalizeExternalUrl(url) ?? url.trim();

  if (typeof window === "undefined") {
    return apiRequest({
      path: `/v1/households/${householdId}/link-preview`,
      method: "POST",
      body: { url: normalizedUrl },
      schema: linkPreviewResponseSchema
    });
  }

  let response: Response;

  try {
    response = await fetch(`/api/households/${householdId}/link-preview`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ url: normalizedUrl })
    });
  } catch (error) {
    const detail = error instanceof Error && error.message
      ? ` ${error.message}`
      : "";

    throw new ApiError(
      `Unable to reach the web link preview route.${detail}`,
      503
    );
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new ApiError(message, response.status);
  }

  return linkPreviewResponseSchema.parse(payload);
};

export const lookupBarcode = async (barcode: string, barcodeFormat?: string): Promise<BarcodeLookupResult> => apiRequest({
  path: "/v1/barcode/lookup",
  method: "POST",
  body: { barcode, ...(barcodeFormat ? { barcodeFormat } : {}) },
  schema: barcodeLookupResultSchema
});

// ── Attachments ──────────────────────────────────────────────────────

export const requestAttachmentUpload = async (
  householdId: string,
  input: CreateAttachmentUploadInput
): Promise<AttachmentUploadResponse> => apiRequest({
  path: `/v1/households/${householdId}/attachments/upload`,
  method: "POST",
  body: input,
  schema: attachmentUploadResponseSchema,
});

export const confirmAttachmentUpload = async (
  householdId: string,
  attachmentId: string
): Promise<Attachment> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}/confirm`,
  method: "POST",
  body: {},
  schema: attachmentSchema,
});

export const fetchAttachments = async (
  householdId: string,
  entityType?: AttachmentEntityType,
  entityId?: string
): Promise<Attachment[]> => {
  const params = new URLSearchParams();
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  const query = params.toString();
  const path = `/v1/households/${householdId}/attachments${query ? `?${query}` : ""}`;
  return apiRequest({ path, schema: attachmentSchema.array() });
};

export const getAttachmentDownloadUrl = async (
  householdId: string,
  attachmentId: string
): Promise<{ url: string }> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}/download`,
});

export const updateAttachment = async (
  householdId: string,
  attachmentId: string,
  input: UpdateAttachmentInput
): Promise<Attachment> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}`,
  method: "PATCH",
  body: input,
  schema: attachmentSchema,
});

export const deleteAttachment = async (
  householdId: string,
  attachmentId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/attachments/${attachmentId}`,
    method: "DELETE",
  });
};

// ── Hobbies ──────────────────────────────────────────────────────────

export const getHouseholdHobbies = async (
  householdId: string,
  options?: { status?: HobbyStatus; search?: string; limit?: number; cursor?: string }
): Promise<{ items: HobbySummary[]; nextCursor: string | null }> => {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  const result = await apiRequest<{ items: HobbySummary[]; nextCursor: string | null }>({
    path: `/v1/households/${householdId}/hobbies${query ? `?${query}` : ""}`,
    cacheOptions: { revalidate: 30 }
  });
  return { items: result.items.map((item) => parseHobbySummaryResponse(item)), nextCursor: result.nextCursor };
};

export const createHobby = async (
  householdId: string,
  input: CreateHobbyInput
): Promise<Hobby> => apiRequest({
  path: `/v1/households/${householdId}/hobbies`,
  method: "POST",
  body: input,
  schema: hobbySchema,
});

export const getHobby = async (
  householdId: string,
  hobbyId: string
): Promise<Hobby> => {
  const result = await apiRequest<unknown>({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
  });

  return parseHobbyResponse(result);
};

export const getHobbyDetail = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyDetail> => {
  const result = await apiRequest<unknown>({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
  });

  return parseHobbyDetailResponse(result);
};

export const updateHobby = async (
  householdId: string,
  hobbyId: string,
  input: UpdateHobbyInput
): Promise<Hobby> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
  method: "PATCH",
  body: input,
  schema: hobbySchema,
});

export const deleteHobby = async (
  householdId: string,
  hobbyId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
    method: "DELETE",
  });
};

export const reorderHobbyWorkflowStages = async (
  householdId: string,
  hobbyId: string,
  orderedIds: ReorderByOrderedIdsInput["orderedIds"]
): Promise<ReorderByOrderedIdsInput> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/workflow-stages/reorder`,
  method: "PATCH",
  body: { orderedIds },
  schema: reorderByOrderedIdsSchema,
});

// ── Hobby Recipes ────────────────────────────────────────────────────

export const getHobbyRecipes = async (
  householdId: string,
  hobbyId: string,
  options?: { limit?: number; offset?: number }
): Promise<HobbyRecipe[]> => {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes${query ? `?${query}` : ""}`,
    schema: hobbyRecipeSchema.array(),
  });
};

export const createHobbyRecipe = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyRecipeInput
): Promise<HobbyRecipeDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes`,
  method: "POST",
  body: input,
  schema: hobbyRecipeDetailSchema,
});

export const getHobbyRecipe = async (
  householdId: string,
  hobbyId: string,
  recipeId: string
): Promise<HobbyRecipeDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}`,
  schema: hobbyRecipeDetailSchema,
});

export const updateHobbyRecipe = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  input: UpdateHobbyRecipeInput
): Promise<HobbyRecipe> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}`,
  method: "PATCH",
  body: input,
  schema: hobbyRecipeSchema,
});

export const deleteHobbyRecipe = async (
  householdId: string,
  hobbyId: string,
  recipeId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}`,
    method: "DELETE",
  });
};

// ── Hobby Recipe Ingredients ─────────────────────────────────────────

export const createHobbyRecipeIngredient = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  input: CreateHobbyRecipeIngredientInput
): Promise<HobbyRecipeIngredient> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/ingredients`,
  method: "POST",
  body: input,
  schema: hobbyRecipeIngredientSchema,
});

export const updateHobbyRecipeIngredient = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  ingredientId: string,
  input: UpdateHobbyRecipeIngredientInput
): Promise<HobbyRecipeIngredient> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/ingredients/${ingredientId}`,
  method: "PATCH",
  body: input,
  schema: hobbyRecipeIngredientSchema,
});

export const deleteHobbyRecipeIngredient = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  ingredientId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/ingredients/${ingredientId}`,
    method: "DELETE",
  });
};

// ── Hobby Recipe Steps ───────────────────────────────────────────────

export const createHobbyRecipeStep = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  input: CreateHobbyRecipeStepInput
): Promise<HobbyRecipeStep> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/steps`,
  method: "POST",
  body: input,
  schema: hobbyRecipeStepSchema,
});

export const updateHobbyRecipeStep = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  stepId: string,
  input: UpdateHobbyRecipeStepInput
): Promise<HobbyRecipeStep> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/steps/${stepId}`,
  method: "PATCH",
  body: input,
  schema: hobbyRecipeStepSchema,
});

export const deleteHobbyRecipeStep = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  stepId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/steps/${stepId}`,
    method: "DELETE",
  });
};

export const reorderHobbyRecipeSteps = async (
  householdId: string,
  hobbyId: string,
  recipeId: string,
  stepIds: string[]
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/reorder-steps`,
    method: "POST",
    body: { stepIds },
  });
};

// ── Hobby Sessions ───────────────────────────────────────────────────

export const getHobbySessions = async (
  householdId: string,
  hobbyId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<HobbySessionSummary[]> => {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  const result = await apiRequest<{ items: HobbySessionSummary[]; nextCursor: string | null }>({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions${query ? `?${query}` : ""}`,
  });
  return result.items.map((item) => hobbySessionSummarySchema.parse(item));
};

export const createHobbySession = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbySessionInput
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`,
  method: "POST",
  body: input,
  schema: hobbySessionSchema,
});

export const getHobbySession = async (
  householdId: string,
  hobbyId: string,
  sessionId: string
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
  schema: hobbySessionSchema,
});

export const getHobbySessionDetail = async (
  householdId: string,
  hobbyId: string,
  sessionId: string
): Promise<HobbySessionDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
  schema: hobbySessionDetailSchema,
});

export const updateHobbySession = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  input: UpdateHobbySessionInput
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionSchema,
});

export const advanceHobbySession = async (
  householdId: string,
  hobbyId: string,
  sessionId: string
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/advance`,
  method: "POST",
  body: {},
  schema: hobbySessionSchema,
});

export const updateHobbySessionStage = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stageId: string,
  input: UpdateHobbySessionStageInput
): Promise<HobbySessionStage> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/stages/${stageId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionStageSchema,
});

export const createHobbySessionStageChecklistItem = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stageId: string,
  input: CreateHobbySessionStageChecklistItemInput
): Promise<HobbySessionStageChecklistItem> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/stages/${stageId}/checklists`,
  method: "POST",
  body: input,
  schema: hobbySessionStageChecklistItemSchema,
});

export const updateHobbySessionStageChecklistItem = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stageId: string,
  checklistItemId: string,
  input: UpdateHobbySessionStageChecklistItemInput
): Promise<HobbySessionStageChecklistItem> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/stages/${stageId}/checklists/${checklistItemId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionStageChecklistItemSchema,
});

export const deleteHobbySessionStageChecklistItem = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stageId: string,
  checklistItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/stages/${stageId}/checklists/${checklistItemId}`,
    method: "DELETE",
  });
};

export const deleteHobbySession = async (
  householdId: string,
  hobbyId: string,
  sessionId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
    method: "DELETE",
  });
};

export const bulkLogHobbySessions = async (
  householdId: string,
  hobbyId: string,
  sessions: Array<{
    name: string;
    startDate?: string | null;
    completedDate?: string | null;
    durationMinutes?: number | null;
    notes?: string | null;
  }>
): Promise<BulkHobbySessionOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/bulk/log`,
    method: "POST",
    body: { sessions },
    schema: bulkHobbySessionOperationResultSchema
  });

export const bulkArchiveHobbySessions = async (
  householdId: string,
  hobbyId: string,
  sessionIds: string[]
): Promise<BulkHobbySessionOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/bulk/archive`,
    method: "POST",
    body: { sessionIds },
    schema: bulkHobbySessionOperationResultSchema
  });

// ── Hobby Series ─────────────────────────────────────────────────────

export const getHobbySeries = async (
  householdId: string,
  hobbyId: string,
  options?: { status?: "active" | "completed" | "archived"; search?: string; includeArchived?: boolean }
): Promise<HobbySeriesSummary[]> => {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.includeArchived !== undefined) params.set("includeArchived", String(options.includeArchived));
  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/series${suffix}`,
    schema: hobbySeriesListSchema,
  });
};

export const createHobbySeries = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbySeriesInput
): Promise<HobbySeriesSummary> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/series`,
  method: "POST",
  body: input,
  schema: hobbySeriesDetailSchema.pick({
    id: true,
    hobbyId: true,
    householdId: true,
    name: true,
    description: true,
    status: true,
    batchCount: true,
    bestBatchSessionId: true,
    tags: true,
    notes: true,
    coverImageUrl: true,
    createdAt: true,
    updatedAt: true,
    bestBatchSessionName: true,
    lastSessionDate: true,
  }),
});

export const getHobbySeriesDetail = async (
  householdId: string,
  hobbyId: string,
  seriesId: string
): Promise<HobbySeriesDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}`,
  schema: hobbySeriesDetailSchema,
});

export const updateHobbySeries = async (
  householdId: string,
  hobbyId: string,
  seriesId: string,
  input: UpdateHobbySeriesInput
): Promise<HobbySeriesSummary> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}`,
  method: "PATCH",
  body: input,
  schema: hobbySeriesDetailSchema.pick({
    id: true,
    hobbyId: true,
    householdId: true,
    name: true,
    description: true,
    status: true,
    batchCount: true,
    bestBatchSessionId: true,
    tags: true,
    notes: true,
    coverImageUrl: true,
    createdAt: true,
    updatedAt: true,
    bestBatchSessionName: true,
    lastSessionDate: true,
  }),
});

export const deleteHobbySeries = async (
  householdId: string,
  hobbyId: string,
  seriesId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}`,
    method: "DELETE",
  });
};

export const compareHobbySeries = async (
  householdId: string,
  hobbyId: string,
  seriesId: string,
  query?: { sessionIds?: string[] }
): Promise<HobbySeriesComparison> => {
  const params = new URLSearchParams();

  if (query?.sessionIds && query.sessionIds.length > 0) {
    params.set("sessionIds", query.sessionIds.join(","));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}/compare${suffix}`,
    schema: hobbySeriesComparisonSchema,
  });
};

export const linkHobbySeriesSession = async (
  householdId: string,
  hobbyId: string,
  seriesId: string,
  sessionId: string
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}/sessions`,
  method: "POST",
  body: { sessionId },
  schema: hobbySessionSchema,
});

export const unlinkHobbySeriesSession = async (
  householdId: string,
  hobbyId: string,
  seriesId: string,
  sessionId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}/sessions/${sessionId}`,
    method: "DELETE",
  });
};

export const updateHobbySeriesSession = async (
  householdId: string,
  hobbyId: string,
  seriesId: string,
  sessionId: string,
  input: UpdateHobbySeriesSessionInput
): Promise<HobbySession> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}/sessions/${sessionId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionSchema,
});

// ── Hobby Session Ingredients ────────────────────────────────────────

export const createHobbySessionIngredient = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  input: CreateHobbySessionIngredientInput
): Promise<HobbySessionIngredient> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/ingredients`,
  method: "POST",
  body: input,
  schema: hobbySessionIngredientSchema,
});

export const updateHobbySessionIngredient = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  ingredientId: string,
  input: UpdateHobbySessionIngredientInput
): Promise<HobbySessionIngredient> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/ingredients/${ingredientId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionIngredientSchema,
});

export const deleteHobbySessionIngredient = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  ingredientId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/ingredients/${ingredientId}`,
    method: "DELETE",
  });
};

// ── Hobby Session Steps ──────────────────────────────────────────────

export const createHobbySessionStep = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  input: CreateHobbySessionStepInput
): Promise<HobbySessionStep> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/steps`,
  method: "POST",
  body: input,
  schema: hobbySessionStepSchema,
});

export const updateHobbySessionStep = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stepId: string,
  input: UpdateHobbySessionStepInput
): Promise<HobbySessionStep> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/steps/${stepId}`,
  method: "PATCH",
  body: input,
  schema: hobbySessionStepSchema,
});

export const reorderHobbySessionSteps = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  stepIds: string[]
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/steps/reorder`,
    method: "POST",
    body: { stepIds },
  });
};

export const reorderHobbySessionStepsOrdered = async (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  orderedIds: ReorderByOrderedIdsInput["orderedIds"]
): Promise<ReorderByOrderedIdsInput> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}/steps/reorder`,
  method: "PATCH",
  body: { orderedIds },
  schema: reorderByOrderedIdsSchema,
});

// ── Hobby Metrics ────────────────────────────────────────────────────

export const getHobbyMetrics = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyMetricDefinition[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics`,
  schema: hobbyMetricDefinitionSchema.array(),
});

export const createHobbyMetric = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyMetricDefinitionInput
): Promise<HobbyMetricDefinition> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics`,
  method: "POST",
  body: input,
  schema: hobbyMetricDefinitionSchema,
});

export const updateHobbyMetric = async (
  householdId: string,
  hobbyId: string,
  metricId: string,
  input: UpdateHobbyMetricDefinitionInput
): Promise<HobbyMetricDefinition> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics/${metricId}`,
  method: "PATCH",
  body: input,
  schema: hobbyMetricDefinitionSchema,
});

export const deleteHobbyMetric = async (
  householdId: string,
  hobbyId: string,
  metricId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics/${metricId}`,
    method: "DELETE",
  });
};

// ── Hobby Metric Readings ────────────────────────────────────────────

export const getHobbyMetricReadings = async (
  householdId: string,
  hobbyId: string,
  metricId: string,
  options?: { sessionId?: string; from?: string; to?: string; limit?: number; offset?: number }
): Promise<HobbyMetricReading[]> => {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  const result = await apiRequest<{ items: HobbyMetricReading[]; nextCursor: string | null }>({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics/${metricId}/readings${query ? `?${query}` : ""}`,
  });
  return result.items.map((item) => hobbyMetricReadingSchema.parse(item));
};

export const createHobbyMetricReading = async (
  householdId: string,
  hobbyId: string,
  metricId: string,
  input: CreateHobbyMetricReadingInput
): Promise<HobbyMetricReading> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics/${metricId}/readings`,
  method: "POST",
  body: input,
  schema: hobbyMetricReadingSchema,
});

export const deleteHobbyMetricReading = async (
  householdId: string,
  hobbyId: string,
  metricId: string,
  readingId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/metrics/${metricId}/readings/${readingId}`,
    method: "DELETE",
  });
};

// ── Hobby Links ──────────────────────────────────────────────────────

export const getHobbyAssets = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyAsset[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/assets`,
  schema: hobbyAssetSchema.array(),
});

export const linkHobbyAsset = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyAssetInput
): Promise<HobbyAsset> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/assets`,
  method: "POST",
  body: input,
  schema: hobbyAssetSchema,
});

export const unlinkHobbyAsset = async (
  householdId: string,
  hobbyId: string,
  hobbyAssetId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/assets/${hobbyAssetId}`,
    method: "DELETE",
  });
};

export const getHobbyInventory = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyInventoryItem[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory`,
  schema: hobbyInventoryItemSchema.array(),
});

export const linkHobbyInventory = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyInventoryItemInput
): Promise<HobbyInventoryItem> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory`,
  method: "POST",
  body: input,
  schema: hobbyInventoryItemSchema,
});

export const unlinkHobbyInventory = async (
  householdId: string,
  hobbyId: string,
  hobbyInventoryItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory/${hobbyInventoryItemId}`,
    method: "DELETE",
  });
};

export const getHobbyProjectLinks = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyProjectLink[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects`,
  schema: hobbyProjectLinkSchema.array(),
});

export const linkHobbyProjectLink = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyProjectLinkInput
): Promise<HobbyProjectLink> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects`,
  method: "POST",
  body: input,
  schema: hobbyProjectLinkSchema,
});

export const unlinkHobbyProjectLink = async (
  householdId: string,
  hobbyId: string,
  hobbyProjectId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects/${hobbyProjectId}`,
    method: "DELETE",
  });
};

export const listHobbyProjects = async (
  householdId: string,
  hobbyId: string,
  query?: Partial<HobbyProjectListQuery>
): Promise<HobbyProjectListResponse> => {
  const params = new URLSearchParams();

  if (query?.status) params.set("status", query.status);
  if (query?.sortBy) params.set("sortBy", query.sortBy);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects${params.size ? `?${params.toString()}` : ""}`,
    schema: hobbyProjectListResponseSchema,
  });
};

export const createHobbyProject = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyProjectInput
): Promise<HobbyProject> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects`,
  method: "POST",
  body: input,
  schema: hobbyProjectSchema,
});

export const getHobbyProject = async (
  householdId: string,
  hobbyId: string,
  projectId: string
): Promise<HobbyProjectDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}`,
  schema: hobbyProjectDetailSchema,
});

export const updateHobbyProject = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  input: UpdateHobbyProjectInput
): Promise<HobbyProject> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}`,
  method: "PATCH",
  body: input,
  schema: hobbyProjectSchema,
});

export const deleteHobbyProject = async (
  householdId: string,
  hobbyId: string,
  projectId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}`,
    method: "DELETE",
  });
};

export const listHobbyProjectMilestones = async (
  householdId: string,
  hobbyId: string,
  projectId: string
): Promise<HobbyProjectMilestone[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/milestones`,
  schema: hobbyProjectMilestoneSchema.array(),
});

export const createHobbyProjectMilestone = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  input: CreateHobbyProjectMilestoneInput
): Promise<HobbyProjectMilestone> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/milestones`,
  method: "POST",
  body: input,
  schema: hobbyProjectMilestoneSchema,
});

export const updateHobbyProjectMilestone = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  milestoneId: string,
  input: UpdateHobbyProjectMilestoneInput
): Promise<HobbyProjectMilestone> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/milestones/${milestoneId}`,
  method: "PATCH",
  body: input,
  schema: hobbyProjectMilestoneSchema,
});

export const reorderHobbyProjectMilestones = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  input: ReorderHobbyProjectMilestonesInput
): Promise<HobbyProjectMilestone[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/milestones/reorder`,
  method: "POST",
  body: input,
  schema: hobbyProjectMilestoneSchema.array(),
});

export const deleteHobbyProjectMilestone = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  milestoneId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/milestones/${milestoneId}`,
    method: "DELETE",
  });
};

export const listHobbyProjectWorkLogs = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  query?: Partial<HobbyProjectWorkLogListQuery>
): Promise<HobbyProjectWorkLogListResponse> => {
  const params = new URLSearchParams();

  if (query?.milestoneId) params.set("milestoneId", query.milestoneId);
  if (query?.startDate) params.set("startDate", query.startDate);
  if (query?.endDate) params.set("endDate", query.endDate);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/work-logs${params.size ? `?${params.toString()}` : ""}`,
    schema: hobbyProjectWorkLogListResponseSchema,
  });
};

export const createHobbyProjectWorkLog = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  input: CreateHobbyProjectWorkLogInput
): Promise<HobbyProjectWorkLog> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/work-logs`,
  method: "POST",
  body: input,
  schema: hobbyProjectWorkLogSchema,
});

export const updateHobbyProjectWorkLog = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  workLogId: string,
  input: UpdateHobbyProjectWorkLogInput
): Promise<HobbyProjectWorkLog> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/work-logs/${workLogId}`,
  method: "PATCH",
  body: input,
  schema: hobbyProjectWorkLogSchema,
});

export const deleteHobbyProjectWorkLog = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  workLogId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/work-logs/${workLogId}`,
    method: "DELETE",
  });
};

export const listHobbyProjectInventoryItems = async (
  householdId: string,
  hobbyId: string,
  projectId: string
): Promise<HobbyProjectInventoryLinkDetail[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/inventory`,
  schema: hobbyProjectInventoryLinkDetailSchema.array(),
});

export const createHobbyProjectInventoryItem = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  input: CreateHobbyProjectInventoryItemInput
): Promise<unknown> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/inventory`,
  method: "POST",
  body: input,
});

export const updateHobbyProjectInventoryItem = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  inventoryItemId: string,
  input: UpdateHobbyProjectInventoryItemInput
): Promise<unknown> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/inventory/${inventoryItemId}`,
  method: "PATCH",
  body: input,
});

export const deleteHobbyProjectInventoryItem = async (
  householdId: string,
  hobbyId: string,
  projectId: string,
  inventoryItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/projects/${projectId}/inventory/${inventoryItemId}`,
    method: "DELETE",
  });
};

export const listHobbyPracticeGoals = async (
  householdId: string,
  hobbyId: string,
  query?: Partial<HobbyPracticeGoalListQuery>
): Promise<HobbyPracticeGoalListResponse> => {
  const params = new URLSearchParams();

  if (query?.status) params.set("status", query.status);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/goals${params.size ? `?${params.toString()}` : ""}`,
    schema: hobbyPracticeGoalListResponseSchema,
  });
};

export const createHobbyPracticeGoal = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyPracticeGoalInput
): Promise<HobbyPracticeGoal> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/goals`,
  method: "POST",
  body: input,
  schema: hobbyPracticeGoalSchema,
});

export const getHobbyPracticeGoal = async (
  householdId: string,
  hobbyId: string,
  goalId: string
): Promise<HobbyPracticeGoalDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/goals/${goalId}`,
  schema: hobbyPracticeGoalDetailSchema,
});

export const updateHobbyPracticeGoal = async (
  householdId: string,
  hobbyId: string,
  goalId: string,
  input: UpdateHobbyPracticeGoalInput
): Promise<HobbyPracticeGoal> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/goals/${goalId}`,
  method: "PATCH",
  body: input,
  schema: hobbyPracticeGoalSchema,
});

export const deleteHobbyPracticeGoal = async (
  householdId: string,
  hobbyId: string,
  goalId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/goals/${goalId}`,
    method: "DELETE",
  });
};

export const listHobbyPracticeRoutines = async (
  householdId: string,
  hobbyId: string,
  query?: Partial<HobbyPracticeRoutineListQuery>
): Promise<HobbyPracticeRoutineListResponse> => {
  const params = new URLSearchParams();

  if (query?.isActive !== undefined) params.set("isActive", String(query.isActive));
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines${params.size ? `?${params.toString()}` : ""}`,
    schema: hobbyPracticeRoutineListResponseSchema,
  });
};

export const createHobbyPracticeRoutine = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyPracticeRoutineInput
): Promise<HobbyPracticeRoutine> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines`,
  method: "POST",
  body: input,
  schema: hobbyPracticeRoutineSchema,
});

export const getHobbyPracticeRoutine = async (
  householdId: string,
  hobbyId: string,
  routineId: string
): Promise<HobbyPracticeRoutineSummary> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines/${routineId}`,
  schema: hobbyPracticeRoutineSummarySchema,
});

export const updateHobbyPracticeRoutine = async (
  householdId: string,
  hobbyId: string,
  routineId: string,
  input: UpdateHobbyPracticeRoutineInput
): Promise<HobbyPracticeRoutine> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines/${routineId}`,
  method: "PATCH",
  body: input,
  schema: hobbyPracticeRoutineSchema,
});

export const deleteHobbyPracticeRoutine = async (
  householdId: string,
  hobbyId: string,
  routineId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines/${routineId}`,
    method: "DELETE",
  });
};

export const getHobbyPracticeRoutineCompliance = async (
  householdId: string,
  hobbyId: string,
  routineId: string,
  query: HobbyPracticeRoutineComplianceQuery
): Promise<HobbyPracticeRoutineComplianceSummary> => {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
  });

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/routines/${routineId}/compliance?${params.toString()}`,
    schema: hobbyPracticeRoutineComplianceSummarySchema,
  });
};

export const listHobbyCollectionItems = async (
  householdId: string,
  hobbyId: string,
  query?: Partial<HobbyCollectionItemListQuery>
): Promise<HobbyCollectionItemListResponse> => {
  const params = new URLSearchParams();

  if (query?.status) params.set("status", query.status);
  if (query?.location) params.set("location", query.location);
  if (query?.tag) params.set("tag", query.tag);
  if (query?.search) params.set("search", query.search);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  return apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/collection${params.size ? `?${params.toString()}` : ""}`,
    schema: hobbyCollectionItemListResponseSchema,
  });
};

export const createHobbyCollectionItem = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyCollectionItemInput
): Promise<HobbyCollectionItem> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/collection`,
  method: "POST",
  body: input,
  schema: hobbyCollectionItemSchema,
});

export const getHobbyCollectionItem = async (
  householdId: string,
  hobbyId: string,
  collectionItemId: string
): Promise<HobbyCollectionItemDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/collection/${collectionItemId}`,
  schema: hobbyCollectionItemDetailSchema,
});

export const updateHobbyCollectionItem = async (
  householdId: string,
  hobbyId: string,
  collectionItemId: string,
  input: UpdateHobbyCollectionItemInput
): Promise<HobbyCollectionItem> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/collection/${collectionItemId}`,
  method: "PATCH",
  body: input,
  schema: hobbyCollectionItemSchema,
});

export const deleteHobbyCollectionItem = async (
  householdId: string,
  hobbyId: string,
  collectionItemId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/collection/${collectionItemId}`,
    method: "DELETE",
  });
};

// ── Hobby Inventory Categories ───────────────────────────────────────

export const getHobbyInventoryCategories = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyInventoryCategory[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory-categories`,
  schema: hobbyInventoryCategorySchema.array(),
});

export const createHobbyInventoryCategory = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyInventoryCategoryInput
): Promise<HobbyInventoryCategory> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory-categories`,
  method: "POST",
  body: input,
  schema: hobbyInventoryCategorySchema,
});

export const deleteHobbyInventoryCategory = async (
  householdId: string,
  hobbyId: string,
  categoryId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/inventory-categories/${categoryId}`,
    method: "DELETE",
  });
};

// ── Hobby Shopping List ──────────────────────────────────────────────

export const getHobbyRecipeShoppingList = async (
  householdId: string,
  hobbyId: string,
  recipeId: string
): Promise<HobbyRecipeShoppingList> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/recipes/${recipeId}/shopping-list`,
  schema: hobbyRecipeShoppingListSchema,
});

// ── Note Folders ─────────────────────────────────────────────────────

export const getNoteFolders = async (
  householdId: string
): Promise<(NoteFolder & { entryCount: number; childCount: number })[]> => apiRequest({
  path: `/v1/households/${householdId}/note-folders`,
  schema: z.array(noteFolderSchema.extend({
    entryCount: z.number(),
    childCount: z.number()
  })),
});

export const createNoteFolder = async (
  householdId: string,
  input: CreateNoteFolderInput
): Promise<NoteFolder> => apiRequest({
  path: `/v1/households/${householdId}/note-folders`,
  method: "POST",
  body: input,
  schema: noteFolderSchema,
});

export const updateNoteFolder = async (
  householdId: string,
  folderId: string,
  input: UpdateNoteFolderInput
): Promise<NoteFolder> => apiRequest({
  path: `/v1/households/${householdId}/note-folders/${folderId}`,
  method: "PATCH",
  body: input,
  schema: noteFolderSchema,
});

export const deleteNoteFolder = async (
  householdId: string,
  folderId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/note-folders/${folderId}`,
    method: "DELETE",
  });
};

// ── Note Templates ─────────────────────────────────────────────────────

export const getNoteTemplates = async (
  householdId: string
): Promise<NoteTemplate[]> => apiRequest({
  path: `/v1/households/${householdId}/note-templates`,
  schema: z.array(noteTemplateSchema),
});

export const createNoteTemplate = async (
  householdId: string,
  input: CreateNoteTemplateInput
): Promise<NoteTemplate> => apiRequest({
  path: `/v1/households/${householdId}/note-templates`,
  method: "POST",
  body: input,
  schema: noteTemplateSchema,
});

export const updateNoteTemplate = async (
  householdId: string,
  templateId: string,
  input: UpdateNoteTemplateInput
): Promise<NoteTemplate> => apiRequest({
  path: `/v1/households/${householdId}/note-templates/${templateId}`,
  method: "PATCH",
  body: input,
  schema: noteTemplateSchema,
});

export const deleteNoteTemplate = async (
  householdId: string,
  templateId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/note-templates/${templateId}`,
    method: "DELETE",
  });
};

// ─── Ideas ───────────────────────────────────────────────────────────────────

export const getHouseholdIdeas = async (
  householdId: string,
  options?: {
    stage?: string;
    category?: string;
    priority?: string;
    search?: string;
    includeArchived?: boolean;
    limit?: number;
    cursor?: string;
  }
): Promise<IdeaSummary[]> => {
  const params = new URLSearchParams();
  if (options?.stage) params.set("stage", options.stage);
  if (options?.category) params.set("category", options.category);
  if (options?.priority) params.set("priority", options.priority);
  if (options?.search) params.set("search", options.search);
  if (options?.includeArchived) params.set("includeArchived", "true");
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  const result = await apiRequest<{ items: unknown[] }>({
    path: `/v1/households/${householdId}/ideas${query ? `?${query}` : ""}`,
    cacheOptions: { revalidate: 30 },
  });
  return result.items.map((item) => ideaSummarySchema.parse(item));
};

export const getIdea = async (
  householdId: string,
  ideaId: string
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}`,
  schema: ideaSchema,
});

export const createIdea = async (
  householdId: string,
  input: CreateIdeaInput
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas`,
  method: "POST",
  body: input,
  schema: ideaSchema,
});

export const updateIdea = async (
  householdId: string,
  ideaId: string,
  input: UpdateIdeaInput
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}`,
  method: "PATCH",
  body: input,
  schema: ideaSchema,
});

export const deleteIdea = async (
  householdId: string,
  ideaId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/ideas/${ideaId}`,
    method: "DELETE",
  });
};

export const permanentlyDeleteIdea = async (
  householdId: string,
  ideaId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/ideas/${ideaId}/permanent`,
    method: "DELETE",
  });
};

export const bulkMoveIdeas = async (
  householdId: string,
  ideaIds: string[],
  stage: string
): Promise<BulkIdeaOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/ideas/bulk/stage`,
    method: "POST",
    body: { ideaIds, stage },
    schema: bulkIdeaOperationResultSchema
  });

export const bulkArchiveIdeas = async (
  householdId: string,
  ideaIds: string[]
): Promise<BulkIdeaOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/ideas/bulk/archive`,
    method: "POST",
    body: { ideaIds },
    schema: bulkIdeaOperationResultSchema
  });

export const bulkDeleteIdeas = async (
  householdId: string,
  ideaIds: string[]
): Promise<BulkIdeaOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/ideas/bulk/delete`,
    method: "POST",
    body: { ideaIds },
    schema: bulkIdeaOperationResultSchema
  });

export const bulkSetIdeaPriority = async (
  householdId: string,
  ideaIds: string[],
  priority: string
): Promise<BulkIdeaOperationResult> =>
  apiRequest({
    path: `/v1/households/${householdId}/ideas/bulk/priority`,
    method: "POST",
    body: { ideaIds, priority },
    schema: bulkIdeaOperationResultSchema
  });

// ── CSV Export / Import ──────────────────────────────────────────────────────

export type ImportAssetsResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: Array<{ id: string; name: string; category: string }>;
};

export type ImportProjectsResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: Array<{ id: string; name: string; status: string }>;
};

export type ImportSchedulesResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: Array<{ id: string; name: string; assetId: string }>;
};

export type ImportHobbiesResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: Array<{ id: string; name: string; status: string }>;
};

export type ImportIdeasResult = {
  created: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
  createdItems: Array<{ id: string; title: string; stage: string }>;
};

const parseImportResult = <T extends { id: string }>(
  value: unknown,
  parseCreatedItem: (entry: Record<string, unknown>) => T
): { created: number; skipped: number; errors: Array<{ index: number; message: string }>; createdItems: T[] } => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid import response.");
  }
  const record = value as Record<string, unknown>;
  return {
    created: typeof record.created === "number" ? record.created : 0,
    skipped: typeof record.skipped === "number" ? record.skipped : 0,
    errors: Array.isArray(record.errors)
      ? record.errors.map((e) => {
          const err = e as Record<string, unknown>;
          return {
            index: typeof err.index === "number" ? err.index : 0,
            message: typeof err.message === "string" ? err.message : "Unknown error."
          };
        })
      : [],
    createdItems: Array.isArray(record.createdItems)
      ? record.createdItems.map((item) => parseCreatedItem(item as Record<string, unknown>))
      : []
  };
};

const fetchCsvExport = async (path: string): Promise<string> => {
  let response: Response;
  try {
    response = await fetch(getFetchTarget(path), {
      method: "GET",
      cache: "no-store",
      headers: getRequestHeaders(null)
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new ApiError(`Unable to reach the API at ${apiBaseUrl}.${detail}`, 503);
  }
  if (!response.ok) {
    const payload = await parseJson(response);
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return response.text();
};

const postCsvImport = async (path: string, items: Array<Record<string, unknown>>): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(getFetchTarget(path), {
      method: "POST",
      cache: "no-store",
      headers: getRequestHeaders(),
      body: JSON.stringify({ items })
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new ApiError(`Unable to reach the API at ${apiBaseUrl}.${detail}`, 503);
  }
  const payload = await parseJson(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return payload;
};

export const exportHouseholdAssetsCSV = async (householdId: string): Promise<string> =>
  fetchCsvExport(`/v1/households/${householdId}/assets/export`);

export const importHouseholdAssets = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportAssetsResult> => {
  const payload = await postCsvImport(`/v1/households/${householdId}/assets/import`, items);
  return parseImportResult(payload, (e) => ({
    id: String(e.id ?? ""),
    name: String(e.name ?? ""),
    category: String(e.category ?? "")
  }));
};

export const exportHouseholdProjectsCSV = async (householdId: string): Promise<string> =>
  fetchCsvExport(`/v1/households/${householdId}/projects/export`);

export const importHouseholdProjects = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportProjectsResult> => {
  const payload = await postCsvImport(`/v1/households/${householdId}/projects/import`, items);
  return parseImportResult(payload, (e) => ({
    id: String(e.id ?? ""),
    name: String(e.name ?? ""),
    status: String(e.status ?? "")
  }));
};

export const exportHouseholdSchedulesCSV = async (householdId: string): Promise<string> =>
  fetchCsvExport(`/v1/households/${householdId}/schedules/export`);

export const importHouseholdSchedules = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportSchedulesResult> => {
  const payload = await postCsvImport(`/v1/households/${householdId}/schedules/import`, items);
  return parseImportResult(payload, (e) => ({
    id: String(e.id ?? ""),
    name: String(e.name ?? ""),
    assetId: String(e.assetId ?? "")
  }));
};

export const exportHouseholdHobbiesCSV = async (householdId: string): Promise<string> =>
  fetchCsvExport(`/v1/households/${householdId}/hobbies/export`);

export const importHouseholdHobbies = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportHobbiesResult> => {
  const payload = await postCsvImport(`/v1/households/${householdId}/hobbies/import`, items);
  return parseImportResult(payload, (e) => ({
    id: String(e.id ?? ""),
    name: String(e.name ?? ""),
    status: String(e.status ?? "")
  }));
};

export const exportHouseholdIdeasCSV = async (householdId: string): Promise<string> =>
  fetchCsvExport(`/v1/households/${householdId}/ideas/export`);

export const importHouseholdIdeas = async (
  householdId: string,
  items: Array<Record<string, unknown>>
): Promise<ImportIdeasResult> => {
  const payload = await postCsvImport(`/v1/households/${householdId}/ideas/import`, items);
  return parseImportResult(payload, (e) => ({
    id: String(e.id ?? ""),
    title: String(e.title ?? ""),
    stage: String(e.stage ?? "")
  }));
};

export const addIdeaNote = async (
  householdId: string,
  ideaId: string,
  data: { text: string }
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/notes`,
  method: "POST",
  body: data,
  schema: ideaSchema,
});

export const removeIdeaNote = async (
  householdId: string,
  ideaId: string,
  noteId: string
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/notes/${noteId}`,
  method: "DELETE",
  schema: ideaSchema,
});

export const addIdeaLink = async (
  householdId: string,
  ideaId: string,
  data: { url: string; label: string }
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/links`,
  method: "POST",
  body: data,
  schema: ideaSchema,
});

export const removeIdeaLink = async (
  householdId: string,
  ideaId: string,
  linkId: string
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/links/${linkId}`,
  method: "DELETE",
  schema: ideaSchema,
});

export const updateIdeaStage = async (
  householdId: string,
  ideaId: string,
  stage: string
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/stage`,
  method: "PATCH",
  body: { stage },
  schema: ideaSchema,
});

export const promoteIdea = async (
  householdId: string,
  ideaId: string,
  data: PromoteIdeaInput
): Promise<{ idea: Idea; createdEntity: { type: string; id: string } }> => apiRequest({
  path: `/v1/households/${householdId}/ideas/${ideaId}/promote`,
  method: "POST",
  body: data,
  schema: z.object({
    idea: ideaSchema,
    createdEntity: z.object({ type: z.string(), id: z.string() }),
  }),
});

export const demoteToIdea = async (
  householdId: string,
  data: DemoteToIdeaInput
): Promise<Idea> => apiRequest({
  path: `/v1/households/${householdId}/ideas/demote`,
  method: "POST",
  body: data,
  schema: ideaSchema,
});

export const getSourceIdea = async (
  householdId: string,
  entityType: string,
  entityId: string
): Promise<IdeaSummary | null> => {
  const params = new URLSearchParams({ entityType, entityId });
  const result = await apiRequest<unknown>({
    path: `/v1/households/${householdId}/ideas/source?${params.toString()}`,
    cacheOptions: { revalidate: 60 },
  });
  if (result === null) return null;
  return ideaSummarySchema.parse(result);
};

// ─── Idea Canvas ─────────────────────────────────────────────────────────────

export const getCanvases = async (
  householdId: string
): Promise<IdeaCanvasSummary[]> => apiRequest({
  path: `/v1/households/${householdId}/canvases`,
  schema: z.array(ideaCanvasSummarySchema),
});

export const getCanvasesByEntity = async (
  householdId: string,
  entityType: string,
  entityId: string
): Promise<IdeaCanvasSummary[]> => apiRequest({
  path: `/v1/households/${householdId}/canvases?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
  schema: z.array(ideaCanvasSummarySchema),
});

export const getCanvas = async (
  householdId: string,
  canvasId: string
): Promise<IdeaCanvas> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}`,
  schema: ideaCanvasSchema,
});

export const createCanvas = async (
  householdId: string,
  input: CreateIdeaCanvasInput
): Promise<IdeaCanvas> => apiRequest({
  path: `/v1/households/${householdId}/canvases`,
  method: "POST",
  body: input,
  schema: ideaCanvasSchema,
});

export const updateCanvas = async (
  householdId: string,
  canvasId: string,
  input: UpdateIdeaCanvasInput
): Promise<IdeaCanvas> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}`,
  method: "PATCH",
  body: input,
  schema: ideaCanvasSchema,
});

export const deleteCanvas = async (
  householdId: string,
  canvasId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/canvases/${canvasId}`,
    method: "DELETE",
  });
};

export const createCanvasNode = async (
  householdId: string,
  canvasId: string,
  input: CreateCanvasNodeInput
): Promise<IdeaCanvasNode> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
  method: "POST",
  body: input,
  schema: ideaCanvasNodeSchema,
});

export const updateCanvasNode = async (
  householdId: string,
  canvasId: string,
  nodeId: string,
  input: UpdateCanvasNodeInput
): Promise<IdeaCanvasNode> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
  method: "PATCH",
  body: input,
  schema: ideaCanvasNodeSchema,
});

export const deleteCanvasNode = async (
  householdId: string,
  canvasId: string,
  nodeId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
    method: "DELETE",
  });
};

export const batchUpdateCanvasNodes = async (
  householdId: string,
  canvasId: string,
  input: BatchUpdateCanvasNodesInput
): Promise<IdeaCanvas> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/nodes/batch`,
  method: "PATCH",
  body: input,
  schema: ideaCanvasSchema,
});

export const createCanvasEdge = async (
  householdId: string,
  canvasId: string,
  input: CreateCanvasEdgeInput
): Promise<IdeaCanvasEdge> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
  method: "POST",
  body: input,
  schema: ideaCanvasEdgeSchema,
});

export const updateCanvasEdge = async (
  householdId: string,
  canvasId: string,
  edgeId: string,
  input: UpdateCanvasEdgeInput
): Promise<IdeaCanvasEdge> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
  method: "PATCH",
  body: input,
  schema: ideaCanvasEdgeSchema,
});

export const deleteCanvasEdge = async (
  householdId: string,
  canvasId: string,
  edgeId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
    method: "DELETE",
  });
};

export const updateCanvasSettings = async (
  householdId: string,
  canvasId: string,
  input: UpdateCanvasSettingsInput
): Promise<IdeaCanvas> => apiRequest({
  path: `/v1/households/${householdId}/canvases/${canvasId}/settings`,
  method: "PATCH",
  body: input,
  schema: ideaCanvasSchema,
});

// ─── Canvas Object Library ──────────────────────────────────────────────────

export const fetchCanvasObjects = async (
  householdId: string,
  category?: string
): Promise<CanvasObject[]> => {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const query = params.toString();
  return apiRequest({
    path: `/v1/households/${householdId}/canvas-objects${query ? `?${query}` : ""}`,
    schema: canvasObjectSchema.array(),
  });
};

export const fetchCanvasObject = async (
  householdId: string,
  objectId: string
): Promise<CanvasObject> => apiRequest({
  path: `/v1/households/${householdId}/canvas-objects/${objectId}`,
  schema: canvasObjectSchema,
});

export const createCanvasObject = async (
  householdId: string,
  input: CreateCanvasObjectInput
): Promise<CanvasObject> => apiRequest({
  path: `/v1/households/${householdId}/canvas-objects`,
  method: "POST",
  body: input,
  schema: canvasObjectSchema,
});

export const updateCanvasObject = async (
  householdId: string,
  objectId: string,
  input: UpdateCanvasObjectInput
): Promise<CanvasObject> => apiRequest({
  path: `/v1/households/${householdId}/canvas-objects/${objectId}`,
  method: "PATCH",
  body: input,
  schema: canvasObjectSchema,
});

export const deleteCanvasObject = async (
  householdId: string,
  objectId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/canvas-objects/${objectId}`,
    method: "DELETE",
  });
};

// ─── Layout Preferences ───

export const getLayoutPreference = async (
  entityType: string,
  entityId?: string
): Promise<LayoutPreference | null> => {
  const params = new URLSearchParams({ entityType });
  if (entityId) params.set("entityId", entityId);
  return apiRequest({
    path: `/v1/layout-preferences?${params.toString()}`,
    method: "GET",
    schema: layoutPreferenceSchema.nullable(),
  });
};

export const saveLayoutPreference = async (
  input: SaveLayoutPreferenceInput
): Promise<LayoutPreference> => apiRequest({
  path: "/v1/layout-preferences",
  method: "PUT",
  body: input,
  schema: layoutPreferenceSchema,
});

export const getQuickActionsPreference = async (): Promise<string[] | null> => {
  const pref = await getLayoutPreference("quickactions");
  if (!pref) return null;
  return pref.layoutJson.flatMap((item) => {
    const parsed = quickActionItemSchema.safeParse(item);
    return parsed.success ? [parsed.data.i] : [];
  });
};

export const saveQuickActionsPreference = async (ids: string[]): Promise<void> => {
  await saveLayoutPreference({
    entityType: "quickactions",
    entityId: undefined,
    layoutJson: ids.map((i) => ({ i })),
  });
};

export const getDashboardPins = async (): Promise<DashboardPin[]> =>
  apiRequest({
    path: "/v1/dashboard-pins",
    method: "GET",
    schema: dashboardPinSchema.array(),
  });

export const addDashboardPin = async (
  input: CreateDashboardPinInput
): Promise<{ id: string }> =>
  apiRequest({
    path: "/v1/dashboard-pins",
    method: "POST",
    body: input,
    schema: z.object({ id: z.string() }),
  });

export const removeDashboardPin = async (pinId: string): Promise<void> => {
  await apiRequest({
    path: `/v1/dashboard-pins/${encodeURIComponent(pinId)}`,
    method: "DELETE",
  });
};

// ── Delete Impact ────────────────────────────────────────────────────

export const getAssetDeleteImpact = async (assetId: string): Promise<AssetDeleteImpact> =>
  apiRequest({ path: `/v1/assets/${assetId}/delete-impact`, schema: assetDeleteImpactSchema });

export const getProjectDeleteImpact = async (householdId: string, projectId: string): Promise<ProjectDeleteImpact> =>
  apiRequest({ path: `/v1/households/${householdId}/projects/${projectId}/delete-impact`, schema: projectDeleteImpactSchema });

export const getInventoryItemDeleteImpact = async (householdId: string, inventoryItemId: string): Promise<InventoryDeleteImpact> =>
  apiRequest({ path: `/v1/households/${householdId}/inventory/${inventoryItemId}/delete-impact`, schema: inventoryDeleteImpactSchema });

export const getHobbyDeleteImpact = async (householdId: string, hobbyId: string): Promise<HobbyDeleteImpact> =>
  apiRequest({ path: `/v1/households/${householdId}/hobbies/${hobbyId}/delete-impact`, schema: hobbyDeleteImpactSchema });

// ── Trash (Recently Deleted) ─────────────────────────────────────────

export const getHouseholdTrash = async (householdId: string): Promise<TrashListResponse> =>
  apiRequest({ path: `/v1/households/${householdId}/trash`, schema: trashListResponseSchema });

export const restoreProject = async (householdId: string, projectId: string): Promise<Project> =>
  apiRequest({ path: `/v1/households/${householdId}/projects/${projectId}/restore`, method: "POST", schema: projectSchema });

export const restoreInventoryItem = async (householdId: string, inventoryItemId: string): Promise<InventoryItemSummary> =>
  apiRequest({ path: `/v1/households/${householdId}/inventory/${inventoryItemId}/restore`, method: "POST", schema: inventoryItemSummarySchema });

export const purgeAsset = async (assetId: string): Promise<void> => {
  await apiRequest({ path: `/v1/assets/${assetId}/purge`, method: "DELETE" });
};

export const purgeProject = async (householdId: string, projectId: string): Promise<void> => {
  await apiRequest({ path: `/v1/households/${householdId}/projects/${projectId}/purge`, method: "DELETE" });
};

export const purgeInventoryItem = async (householdId: string, inventoryItemId: string): Promise<void> => {
  await apiRequest({ path: `/v1/households/${householdId}/inventory/${inventoryItemId}/purge`, method: "DELETE" });
};

export const purgeAllTrash = async (householdId: string, olderThanDays?: number): Promise<void> => {
  const params = olderThanDays !== undefined ? `?olderThanDays=${olderThanDays}` : "";
  await apiRequest({ path: `/v1/households/${householdId}/trash${params}`, method: "DELETE" });
};