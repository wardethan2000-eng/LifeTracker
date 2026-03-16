import { cache } from "react";
import {
  activityLogSchema,
  assetComparisonPayloadSchema,
  assetPartsConsumptionSchema,
  assetDetailResponseSchema,
  assetTransferListSchema,
  assetLabelDataSchema,
  assetTimelineEntrySchema,
  assetTimelineItemSchema,
  assetSchema,
  categoryAdherencePayloadSchema,
  commentSchema,
  complianceReportPayloadSchema,
  costForecastSchema,
  completionCycleRecordSchema,
  customPresetProfileSchema,
  dueWorkItemSchema,
  householdInventoryAnalyticsSchema,
  householdInvitationSchema,
  householdNotificationListSchema,
  householdCostDashboardSchema,
  householdCostOverviewSchema,
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
  inventoryTransactionListSchema,
  inventoryTransactionSchema,
  inventoryItemSummarySchema,
  inventoryItemConsumptionSchema,
  inventoryReorderForecastSchema,
  inventoryTurnoverSchema,
  memberContributionPayloadSchema,
  libraryPresetSchema,
  linkPreviewResponseSchema,
  lowStockInventoryItemSchema,
  meResponseSchema,
  notificationSchema,
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
  projectShoppingListSchema,
  projectSchema,
  reorderProjectPhasesSchema,
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
  type AssetTimelineEntry,
  type AssetTimelineItem,
  type AssetTimelineQuery,
  type ActivityLog,
  type AcceptInvitationInput,
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
  type CreateMaintenanceScheduleInput,
  type CreateMaintenanceLogInput,
  type CreateUsageMetricEntryInput,
  type CreateUsageMetricInput,
  type ComplianceReportPayload,
  type CompletionCycleRecord,
  type DueWorkItem,
  type HouseholdInventoryAnalytics,
  type CustomPresetProfile,
  type HouseholdDashboard,
  type HouseholdInvitation,
  type HouseholdMember,
  type HouseholdSummary,
  type InventoryItemConsumption,
  type CreateInventoryItemInput,
  type InventoryReorderForecast,
  type InventoryTurnover,
  type BulkPartsReadiness,
  type CreateScheduleInventoryItemInput,
  type InventoryTransactionList,
  type InventoryTransactionQuery,
  type UpdateInventoryItemInput,
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
  type HouseholdNotificationList,
  type OnTimeRatePayload,
  type OverdueTrendPayload,
  type ProjectAsset,
  type ProjectBudgetCategory,
  type ProjectBudgetAnalysis,
  type ProjectBudgetCategorySummary,
  type Project,
  type ProjectDetail,
  type ProjectExpense,
  type ProjectInventoryRollup,
  type ProjectPhaseDetail,
  type ProjectPhaseSupply,
  type ProjectPhaseSummary,
  type ProjectShoppingList,
  type ProjectChildSummary,
  type ProjectBreadcrumb,
  type ProjectTreeStats,
  type SearchEntityType,
  type SearchResponse,
  type ProjectPortfolioItem,
  type ProjectSummary,
  type ProjectTask,
  type ProjectTaskChecklistItem,
  type ProjectStatus,
  type PublicAssetReport,
  type ReorderProjectPhasesInput,
  type ShareLink,
  type ServiceProvider,
  type ServiceProviderSpend,
  type ThreadedComment,
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
  hobbyProjectSchema,
  hobbyInventoryCategorySchema,
  hobbyRecipeSchema,
  hobbyRecipeDetailSchema,
  hobbyRecipeIngredientSchema,
  hobbyRecipeStepSchema,
  hobbySessionSchema,
  hobbySessionSummarySchema,
  hobbySessionIngredientSchema,
  hobbySessionStepSchema,
  hobbyMetricDefinitionSchema,
  hobbyMetricReadingSchema,
  hobbyLogSchema,
  hobbyRecipeShoppingListSchema,
  type Hobby,
  type HobbySummary,
  type HobbyAsset,
  type HobbyInventoryItem,
  type HobbyProject,
  type HobbyInventoryCategory,
  type HobbyRecipe,
  type HobbyRecipeDetail,
  type HobbyRecipeIngredient,
  type HobbyRecipeStep,
  type HobbySession,
  type HobbySessionSummary,
  type HobbySessionIngredient,
  type HobbySessionStep,
  type HobbyMetricDefinition,
  type HobbyMetricReading,
  type HobbyLog,
  type HobbyRecipeShoppingList,
  type CreateHobbyInput,
  type UpdateHobbyInput,
  type CreateHobbyRecipeInput,
  type UpdateHobbyRecipeInput,
  type CreateHobbyRecipeIngredientInput,
  type UpdateHobbyRecipeIngredientInput,
  type CreateHobbyRecipeStepInput,
  type UpdateHobbyRecipeStepInput,
  type CreateHobbySessionInput,
  type UpdateHobbySessionInput,
  type CreateHobbySessionIngredientInput,
  type UpdateHobbySessionIngredientInput,
  type CreateHobbySessionStepInput,
  type UpdateHobbySessionStepInput,
  type CreateHobbyMetricDefinitionInput,
  type UpdateHobbyMetricDefinitionInput,
  type CreateHobbyMetricReadingInput,
  type CreateHobbyLogInput,
  type UpdateHobbyLogInput,
  type CreateHobbyAssetInput,
  type CreateHobbyInventoryItemInput,
  type CreateHobbyProjectInput,
  type CreateHobbyInventoryCategoryInput,
  type HobbyStatus,
  type HobbyLogType,
  hobbyDetailSchema,
  hobbySessionDetailSchema,
  type HobbyDetail,
  type HobbySessionDetail,
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
  revalidate?: number | false;
  cachePolicy?: RequestCache | { next: { revalidate: number } } | { next: { tags: string[] } };
};

const libraryPresetListSchema = libraryPresetSchema.array();
const customPresetProfileListSchema = customPresetProfileSchema.array();
const activityLogListSchema = activityLogSchema.array();
const assetListSchema = assetSchema.array();
const dueWorkItemListSchema = dueWorkItemSchema.array();
const assetTimelineEntryListSchema = assetTimelineEntrySchema.array();
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
  ?? "clkeeperuser0000000000001";

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
  revalidate,
  cachePolicy
}: RequestOptions<T>): Promise<T> => {
  let response: Response;

  const cacheOptions = method === "GET" && typeof revalidate === "number"
    ? { next: { revalidate } }
    : cachePolicy === undefined
      ? { cache: "no-store" as const }
      : typeof cachePolicy === "string"
        ? { cache: cachePolicy }
        : { next: cachePolicy.next };

  try {
    response = await fetch(getFetchTarget(path), {
      method,
      ...cacheOptions,
      headers: getRequestHeaders(),
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

export const getMe = cache(async (): Promise<MeResponse> => apiRequest({
  path: "/v1/me",
  schema: meResponseSchema
}));

export const getHouseholdDashboard = async (householdId: string): Promise<HouseholdDashboard> => apiRequest({
  path: `/v1/households/${householdId}/dashboard`,
  schema: householdDashboardSchema,
  revalidate: 15
});

export const getHouseholdDueWork = async (householdId: string): Promise<DueWorkItem[]> => apiRequest({
  path: `/v1/households/${householdId}/due-work?limit=100&status=all`,
  schema: dueWorkItemListSchema,
  cachePolicy: { next: { revalidate: 15 } }
});

export const getAssetDetail = async (assetId: string): Promise<AssetDetailResponse> => apiRequest({
  path: `/v1/assets/${assetId}/detail`,
  schema: assetDetailResponseSchema,
  revalidate: 15
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

export const getLibraryPresets = cache(async (): Promise<LibraryPreset[]> => apiRequest({
  path: "/v1/presets/library",
  schema: libraryPresetListSchema,
  revalidate: 60
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
    revalidate: 15
  });
};

export const getHouseholdProjectPortfolio = async (
  householdId: string,
  options?: { status?: ProjectStatus }
): Promise<ProjectPortfolioItem[]> => {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set("status", options.status);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/projects/portfolio${suffix}`,
    schema: projectPortfolioListSchema,
    revalidate: 15
  });
};

export const searchHousehold = async (
  householdId: string,
  query: string,
  options?: {
    limit?: number;
    types?: SearchEntityType[];
  }
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query });

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.types && options.types.length > 0) {
    params.set("types", options.types.join(","));
  }

  return apiRequest({
    path: `/v1/households/${householdId}/search?${params.toString()}`,
    schema: searchResponseSchema
  });
};

export const getHouseholdActivity = async (householdId: string): Promise<ActivityLog[]> => apiRequest({
  path: `/v1/households/${householdId}/activity`,
  schema: activityLogListSchema,
  revalidate: 15
});

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
  options?: { since?: string; until?: string }
): Promise<void> => {
  const params = new URLSearchParams({ dataset });

  if (options?.since) {
    params.set("since", options.since);
  }

  if (options?.until) {
    params.set("until", options.until);
  }

  await downloadFileFromProxy(`/v1/households/${householdId}/export/csv?${params.toString()}`, `${dataset}-${householdId}.csv`);
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

export const getProjectDetail = async (householdId: string, projectId: string): Promise<ProjectDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}`,
  schema: projectDetailSchema
});

export const getProjectPhases = async (
  householdId: string,
  projectId: string
): Promise<ProjectPhaseSummary[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases`,
  schema: projectPhaseSummaryListSchema
});

export const getProjectPhaseDetail = async (
  householdId: string,
  projectId: string,
  phaseId: string
): Promise<ProjectPhaseDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}`,
  schema: projectPhaseDetailSchema
});

export const getProjectPhaseDetails = async (
  householdId: string,
  projectId: string
): Promise<ProjectPhaseDetail[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/details`,
  schema: projectPhaseDetailListSchema,
  cachePolicy: { next: { revalidate: 15 } }
});

export const getProjectBudgetCategories = async (
  householdId: string,
  projectId: string
): Promise<ProjectBudgetCategorySummary[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
  schema: projectBudgetCategorySummaryListSchema
});

export const getProjectPhaseSupplies = async (
  householdId: string,
  projectId: string,
  phaseId: string
): Promise<ProjectPhaseSupply[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
  schema: projectPhaseSupplySummaryListSchema
});

export const getProjectInventory = async (
  householdId: string,
  projectId: string
): Promise<InventoryProjectLinkDetail[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/inventory`,
  schema: projectInventoryListSchema
});

export const getProjectInventoryRollups = async (
  householdId: string
): Promise<ProjectInventoryRollup[]> => apiRequest({
  path: `/v1/households/${householdId}/projects/inventory-rollups`,
  schema: projectInventoryRollupListSchema,
  cachePolicy: { next: { revalidate: 30 } }
});

export const getProjectShoppingList = async (
  householdId: string,
  projectId: string
): Promise<ProjectShoppingList> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/shopping-list`,
  schema: projectShoppingListSchema
});

export const getHouseholdAssets = async (householdId: string): Promise<Asset[]> => apiRequest({
  path: `/v1/assets?householdId=${householdId}`,
  schema: assetListSchema,
  cachePolicy: { next: { revalidate: 30 } }
});

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
  options?: { limit?: number; status?: "all" | "unread" | "read" }
): Promise<HouseholdNotificationList> => {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.status) {
    params.set("status", options.status);
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

export const getHouseholdMembers = async (householdId: string): Promise<HouseholdMember[]> => apiRequest({
  path: `/v1/households/${householdId}/members`,
  schema: householdMemberListSchema,
  revalidate: 15
});

export const getHouseholdServiceProviders = async (householdId: string): Promise<ServiceProvider[]> => apiRequest({
  path: `/v1/households/${householdId}/service-providers`,
  schema: serviceProviderListSchema,
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

  return apiRequest({
    path: `/v1/households/${householdId}/inventory${suffix}`,
    schema: householdInventoryListSchema,
    revalidate: 15
  });
};

export const getHouseholdLowStockInventory = async (householdId: string): Promise<LowStockInventoryItem[]> => apiRequest({
  path: `/v1/households/${householdId}/inventory/low-stock`,
  schema: householdLowStockListSchema
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

export const getProjectNotes = async (
  householdId: string,
  projectId: string,
  options?: {
    category?: string;
    phaseId?: string;
    pinned?: boolean;
  }
): Promise<ProjectNote[]> => {
  const query = new URLSearchParams();

  if (options?.category) {
    query.set("category", options.category);
  }

  if (options?.phaseId) {
    query.set("phaseId", options.phaseId);
  }

  if (options?.pinned !== undefined) {
    query.set("pinned", String(options.pinned));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  return apiRequest({
    path: `/v1/households/${householdId}/projects/${projectId}/notes${suffix}`,
    schema: projectNoteListSchema
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

export const getProjectBudgetAnalysis = async (
  householdId: string,
  projectId: string
): Promise<ProjectBudgetAnalysis> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}/cost-analytics/budget-analysis`,
  schema: projectBudgetAnalysisSchema
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

export const markNotificationRead = async (notificationId: string): Promise<Notification> => apiRequest({
  path: `/v1/notifications/${notificationId}/read`,
  method: "PATCH",
  schema: notificationSchema
});

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
  options?: { status?: HobbyStatus; search?: string; limit?: number; offset?: number }
): Promise<HobbySummary[]> => {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search) params.set("search", options.search);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  const result = await apiRequest<{ items: HobbySummary[]; nextCursor: string | null }>({
    path: `/v1/households/${householdId}/hobbies${query ? `?${query}` : ""}`,
  });
  return result.items.map((item) => hobbySummarySchema.parse(item));
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
): Promise<Hobby> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
  schema: hobbySchema,
});

export const getHobbyDetail = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyDetail> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}`,
  schema: hobbyDetailSchema,
});

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

// ── Hobby Logs ───────────────────────────────────────────────────────

export const getHobbyLogs = async (
  householdId: string,
  hobbyId: string,
  options?: { sessionId?: string; logType?: HobbyLogType; from?: string; to?: string; limit?: number; offset?: number }
): Promise<HobbyLog[]> => {
  const params = new URLSearchParams();
  if (options?.sessionId) params.set("sessionId", options.sessionId);
  if (options?.logType) params.set("logType", options.logType);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const query = params.toString();
  const result = await apiRequest<{ items: HobbyLog[]; nextCursor: string | null }>({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/logs${query ? `?${query}` : ""}`,
  });
  return result.items.map((item) => hobbyLogSchema.parse(item));
};

export const createHobbyLog = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyLogInput
): Promise<HobbyLog> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/logs`,
  method: "POST",
  body: input,
  schema: hobbyLogSchema,
});

export const updateHobbyLog = async (
  householdId: string,
  hobbyId: string,
  logId: string,
  input: UpdateHobbyLogInput
): Promise<HobbyLog> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/logs/${logId}`,
  method: "PATCH",
  body: input,
  schema: hobbyLogSchema,
});

export const deleteHobbyLog = async (
  householdId: string,
  hobbyId: string,
  logId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/logs/${logId}`,
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

export const getHobbyProjects = async (
  householdId: string,
  hobbyId: string
): Promise<HobbyProject[]> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects`,
  schema: hobbyProjectSchema.array(),
});

export const linkHobbyProject = async (
  householdId: string,
  hobbyId: string,
  input: CreateHobbyProjectInput
): Promise<HobbyProject> => apiRequest({
  path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects`,
  method: "POST",
  body: input,
  schema: hobbyProjectSchema,
});

export const unlinkHobbyProject = async (
  householdId: string,
  hobbyId: string,
  hobbyProjectId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/hobbies/${hobbyId}/links/projects/${hobbyProjectId}`,
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