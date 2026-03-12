import { cache } from "react";
import {
  assetDetailResponseSchema,
  assetSchema,
  customPresetProfileSchema,
  maintenanceScheduleSchema,
  householdDashboardSchema,
  householdSummarySchema,
  libraryPresetSchema,
  meResponseSchema,
  notificationSchema,
  type Asset,
  type AssetDetailResponse,
  type CompleteMaintenanceScheduleInput,
  type CreatePresetProfileInput,
  type CreateAssetInput,
  type CreateHouseholdInput,
  type CreateMaintenanceScheduleInput,
  type CreateMaintenanceLogInput,
  type CreateUsageMetricInput,
  type CustomPresetProfile,
  type HouseholdDashboard,
  type HouseholdSummary,
  type LibraryPreset,
  type MaintenanceSchedule,
  type MeResponse,
  type Notification,
  type UpdateAssetInput,
  type UpdateUsageMetricInput,
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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-dev-user-id": devUserId
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

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