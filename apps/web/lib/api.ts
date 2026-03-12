import { cache } from "react";
import {
  activityLogSchema,
  assetDetailResponseSchema,
  assetSchema,
  commentSchema,
  customPresetProfileSchema,
  householdInvitationSchema,
  householdMemberSchema,
  maintenanceLogSchema,
  maintenanceScheduleSchema,
  householdDashboardSchema,
  householdSummarySchema,
  libraryPresetSchema,
  meResponseSchema,
  notificationSchema,
  projectAssetSchema,
  projectDetailSchema,
  projectExpenseSchema,
  projectSchema,
  projectSummarySchema,
  projectTaskSchema,
  serviceProviderSchema,
  threadedCommentSchema,
  type Asset,
  type AssetDetailResponse,
  type ActivityLog,
  type AcceptInvitationInput,
  type CompleteMaintenanceScheduleInput,
  type CreateCommentInput,
  type CreateConditionAssessmentInput,
  type CreateInvitationInput,
  type CreateProjectAssetInput,
  type CreateProjectExpenseInput,
  type CreateProjectInput,
  type CreateProjectTaskInput,
  type CreatePresetProfileInput,
  type CreateServiceProviderInput,
  type CreateAssetInput,
  type CreateHouseholdInput,
  type CreateMaintenanceScheduleInput,
  type CreateMaintenanceLogInput,
  type CreateUsageMetricEntryInput,
  type CreateUsageMetricInput,
  type CustomPresetProfile,
  type HouseholdDashboard,
  type HouseholdInvitation,
  type HouseholdMember,
  type HouseholdSummary,
  type LibraryPreset,
  type MaintenanceLog,
  type MaintenanceSchedule,
  type MeResponse,
  type Notification,
  type ProjectAsset,
  type Project,
  type ProjectDetail,
  type ProjectExpense,
  type ProjectSummary,
  type ProjectTask,
  type ProjectStatus,
  type ServiceProvider,
  type ThreadedComment,
  type UpdateCommentInput,
  type UpdateAssetInput,
  type UpdateProjectExpenseInput,
  type UpdateProjectInput,
  type UpdateProjectTaskInput,
  type UpdateServiceProviderInput,
  type UpdateUsageMetricInput,
  type UsageMetricEntry,
  type UsageProjection,
  usageMetricEntrySchema,
  usageProjectionSchema,
  usageMetricResponseSchema
} from "@lifekeeper/types";

type Schema<T> = {
  parse: (value: unknown) => T;
};

type RequestOptions<T> = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: Schema<T>;
};

const libraryPresetListSchema = libraryPresetSchema.array();
const customPresetProfileListSchema = customPresetProfileSchema.array();
const activityLogListSchema = activityLogSchema.array();
const assetListSchema = assetSchema.array();
const commentWithRepliesSchema = commentSchema.extend({
  replies: commentSchema.array().default([])
});
const threadedCommentListSchema = threadedCommentSchema.array();
const householdInvitationListSchema = householdInvitationSchema.array();
const householdMemberListSchema = householdMemberSchema.array();
const maintenanceLogListSchema = maintenanceLogSchema.array();
const projectSummaryListSchema = projectSummarySchema.array();
const serviceProviderListSchema = serviceProviderSchema.array();
const usageMetricEntryListSchema = usageMetricEntrySchema.array();

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

export const apiRequest = async <T>({
  path,
  method = "GET",
  body,
  schema
}: RequestOptions<T>): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-dev-user-id": devUserId
      },
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
  schema: householdDashboardSchema
});

export const getAssetDetail = async (assetId: string): Promise<AssetDetailResponse> => apiRequest({
  path: `/v1/assets/${assetId}/detail`,
  schema: assetDetailResponseSchema
});

export const getLibraryPresets = cache(async (): Promise<LibraryPreset[]> => apiRequest({
  path: "/v1/presets/library",
  schema: libraryPresetListSchema
}));

export const getHouseholdProjects = async (householdId: string): Promise<ProjectSummary[]> => apiRequest({
  path: `/v1/households/${householdId}/projects`,
  schema: projectSummaryListSchema
});

export const getHouseholdActivity = async (householdId: string): Promise<ActivityLog[]> => apiRequest({
  path: `/v1/households/${householdId}/activity`,
  schema: activityLogListSchema
});

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
  schema: threadedCommentListSchema
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

export const getProjectDetail = async (householdId: string, projectId: string): Promise<ProjectDetail> => apiRequest({
  path: `/v1/households/${householdId}/projects/${projectId}`,
  schema: projectDetailSchema
});

export const getHouseholdAssets = async (householdId: string): Promise<Asset[]> => apiRequest({
  path: `/v1/assets?householdId=${householdId}`,
  schema: assetListSchema
});

export const getHouseholdMembers = async (householdId: string): Promise<HouseholdMember[]> => apiRequest({
  path: `/v1/households/${householdId}/members`,
  schema: householdMemberListSchema
});

export const getHouseholdServiceProviders = async (householdId: string): Promise<ServiceProvider[]> => apiRequest({
  path: `/v1/households/${householdId}/service-providers`,
  schema: serviceProviderListSchema
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

export const getAssetLogs = async (assetId: string): Promise<MaintenanceLog[]> => apiRequest({
  path: `/v1/assets/${assetId}/logs`,
  schema: maintenanceLogListSchema
});

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

export const getHouseholdPresets = async (householdId: string): Promise<CustomPresetProfile[]> => apiRequest({
  path: `/v1/households/${householdId}/presets`,
  schema: customPresetProfileListSchema
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
): Promise<void> => {
  await apiRequest({
    path: `/v1/assets/${assetId}/metrics`,
    method: "POST",
    body: input,
    schema: usageMetricResponseSchema
  });
};

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