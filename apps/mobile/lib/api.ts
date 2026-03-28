import {
  assetDetailResponseSchema,
  assetPageSchema,
  assetSchema,
  barcodeLookupResultSchema,
  entrySchema,
  entryListResponseSchema,
  searchResponseSchema,
  activityLogListResponseSchema,
  dueWorkItemSchema,
  attachmentSchema,
  attachmentUploadResponseSchema,
  meResponseSchema,
  completeMaintenanceScheduleSchema,
  projectSummarySchema,
  projectDetailSchema,
  projectTaskSchema,
  hobbySchema,
  hobbySummarySchema,
  hobbyDetailSchema,
  hobbySessionSchema,
  hobbySessionSummarySchema,
  ideaSchema,
  ideaSummarySchema,
  inventoryItemDetailSchema,
  inventoryItemListResponseSchema,
  inventoryTransactionSchema,
  createInventoryTransactionSchema,
  spaceResponseSchema,
  spaceListResponseSchema,
  spaceContentsResponseSchema,
  type Asset,
  type AssetPage,
  type AssetDetailResponse,
  type UpdateAssetInput,
  type BarcodeLookupResult,
  type Entry,
  type EntryListResponse,
  type EntryType,
  type EntryFlag,
  type EntryEntityType,
  type SearchResponse,
  type DueWorkItem,
  type CompleteMaintenanceScheduleInput,
  type ActivityLogListResponse,
  type ActivityLog,
  type Attachment,
  type AttachmentUploadResponse,
  type CreateAttachmentUploadInput,
  type MeResponse,
  type ProjectSummary,
  type ProjectDetail,
  type ProjectTask,
  type UpdateProjectInput,
  type UpdateProjectTaskInput,
  type Hobby,
  type HobbySummary,
  type HobbyDetail,
  type HobbySession,
  type HobbySessionSummary,
  type UpdateHobbyInput,
  type CreateHobbySessionInput,
  type UpdateHobbySessionInput,
  type Idea,
  type IdeaSummary,
  type CreateIdeaInput,
  type UpdateIdeaInput,
  type PromoteIdeaInput,
  type InventoryItemDetail,
  type InventoryItemListResponse,
  type InventoryTransaction,
  type CreateInventoryTransactionInput,
  type SpaceResponse,
  type SpaceListResponse,
  type SpaceContentsResponse,
} from "@lifekeeper/types";
import { z } from "zod";
import { API_BASE_URL, DEV_USER_ID } from "./constants";

// ---------------------------------------------------------------------------
// Types & Error class
// ---------------------------------------------------------------------------

type Schema<T> = { parse: (value: unknown) => T };

export class MobileApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MobileApiError";
  }
}

// ---------------------------------------------------------------------------
// Auth token injection
// ---------------------------------------------------------------------------

/**
 * Lazily imported so we don't break in envs where Clerk isn't initialized yet.
 * Falls back to the dev bypass header when __DEV__ is true.
 */
let _getClerkToken: (() => Promise<string | null>) | null = null;

export function registerClerkTokenGetter(fn: () => Promise<string | null>): void {
  _getClerkToken = fn;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  if (__DEV__) {
    return { "x-dev-user-id": DEV_USER_ID };
  }
  if (_getClerkToken) {
    const token = await _getClerkToken();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Query string params appended to the path */
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiRequest<T>(
  path: string,
  schema: Schema<T>,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const qsStr = qs.toString();
    if (qsStr) url = `${url}?${qsStr}`;
  }

  const authHeaders = await buildAuthHeaders();
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...authHeaders,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown network error.";
    throw new MobileApiError(`Unable to reach the API at ${API_BASE_URL}. ${msg}`, 503);
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as Record<string, unknown>).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}.`;
    throw new MobileApiError(message, response.status);
  }

  return schema.parse(payload);
}

// ---------------------------------------------------------------------------
// Auth / Me
// ---------------------------------------------------------------------------

export type { MeResponse };

export const getMe = (): Promise<MeResponse> =>
  apiRequest("/v1/auth/me", meResponseSchema);

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export interface EntryListQueryParams {
  entityType?: EntryEntityType;
  entityId?: string;
  entryType?: EntryType | undefined;
  flags?: EntryFlag[];
  excludeFlags?: EntryFlag[];
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  cursor?: string;
  includeArchived?: boolean;
}

export const getEntries = (
  householdId: string,
  query: EntryListQueryParams = {}
): Promise<EntryListResponse> => {
  const params: Record<string, string | number | boolean | undefined | null> = {
    limit: query.limit ?? 50,
  };
  if (query.entityType) params.entityType = query.entityType;
  if (query.entityId) params.entityId = query.entityId;
  if (query.entryType) params.entryType = query.entryType;
  if (query.flags?.length) params.flags = query.flags.join(",");
  if (query.excludeFlags?.length) params.excludeFlags = query.excludeFlags.join(",");
  if (query.search) params.search = query.search;
  if (query.startDate) params.startDate = query.startDate;
  if (query.endDate) params.endDate = query.endDate;
  if (query.cursor) params.cursor = query.cursor;
  if (query.includeArchived !== undefined) params.includeArchived = query.includeArchived;
  return apiRequest(`/v1/households/${householdId}/entries`, entryListResponseSchema, { params });
};

export const getEntry = (householdId: string, entryId: string): Promise<Entry> =>
  apiRequest(`/v1/households/${householdId}/entries/${entryId}`, entrySchema);

export interface CreateEntryInput {
  body: string;
  title?: string | null;
  entityType: EntryEntityType;
  entityId: string;
  entryType?: EntryType;
  flags?: EntryFlag[];
  entryDate?: string;
  tags?: string[];
}

export const createEntry = (
  householdId: string,
  input: CreateEntryInput
): Promise<Entry> =>
  apiRequest(`/v1/households/${householdId}/entries`, entrySchema, {
    method: "POST",
    body: {
      ...input,
      entryDate: input.entryDate ?? new Date().toISOString(),
      entryType: input.entryType ?? "note",
      flags: input.flags ?? [],
      tags: input.tags ?? [],
    },
  });

export const deleteEntry = (householdId: string, entryId: string): Promise<void> =>
  apiRequest(`/v1/households/${householdId}/entries/${entryId}`, z.unknown(), {
    method: "DELETE",
  }).then(() => undefined);

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const searchHousehold = (
  householdId: string,
  q: string,
  options: { limit?: number; fuzzy?: boolean } = {}
): Promise<SearchResponse> =>
  apiRequest(
    `/v1/households/${householdId}/search`,
    searchResponseSchema,
    {
      params: {
        q,
        limit: options.limit ?? 20,
        fuzzy: options.fuzzy ?? true,
      },
    }
  );

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const getHouseholdActivity = (
  householdId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<ActivityLogListResponse> =>
  apiRequest(
    `/v1/households/${householdId}/activity`,
    activityLogListResponseSchema,
    { params: { limit: options.limit ?? 20, cursor: options.cursor } }
  );

// ---------------------------------------------------------------------------
// Due Work / Maintenance
// ---------------------------------------------------------------------------

const dueWorkItemListSchema = z.array(dueWorkItemSchema);

export const getHouseholdDueWork = (
  householdId: string,
  options: { limit?: number; status?: "all" | "due" | "overdue" } = {}
): Promise<DueWorkItem[]> =>
  apiRequest(
    `/v1/households/${householdId}/due-work`,
    dueWorkItemListSchema,
    { params: { limit: options.limit ?? 50, status: options.status ?? "all" } }
  );

export const completeSchedule = (
  assetId: string,
  scheduleId: string,
  input: CompleteMaintenanceScheduleInput
): Promise<void> =>
  apiRequest(
    `/v1/assets/${assetId}/schedules/${scheduleId}/complete`,
    z.unknown(),
    { method: "POST", body: input }
  ).then(() => undefined);

export type { CompleteMaintenanceScheduleInput };

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export type { CreateAttachmentUploadInput };

export const requestAttachmentUpload = (
  householdId: string,
  input: CreateAttachmentUploadInput
): Promise<AttachmentUploadResponse> =>
  apiRequest(
    `/v1/households/${householdId}/attachments/upload`,
    attachmentUploadResponseSchema,
    { method: "POST", body: input }
  );

export const confirmAttachmentUpload = (
  householdId: string,
  attachmentId: string
): Promise<Attachment> =>
  apiRequest(
    `/v1/households/${householdId}/attachments/${attachmentId}/confirm`,
    attachmentSchema,
    { method: "POST", body: {} }
  );

export type { Entry, EntryType, EntryFlag, EntryEntityType, EntryListResponse };
export type { SearchResponse, DueWorkItem, ActivityLogListResponse, ActivityLog, Attachment, AttachmentUploadResponse };

// ---------------------------------------------------------------------------
// Assets (kept from original + enhanced parameter support)
// ---------------------------------------------------------------------------

export const lookupAssetByTagMobile = (tag: string): Promise<Asset> =>
  apiRequest(`/v1/assets/lookup`, assetSchema, { params: { tag } });

export const getAssetDetailMobile = (assetId: string): Promise<AssetDetailResponse> =>
  apiRequest(`/v1/assets/${assetId}`, assetDetailResponseSchema);

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

export const lookupBarcodeMobile = (barcode: string, barcodeFormat?: string): Promise<BarcodeLookupResult> =>
  apiRequest("/v1/barcode/lookup", barcodeLookupResultSchema, {
    method: "POST",
    body: { barcode, ...(barcodeFormat ? { barcodeFormat } : {}) },
  });

// ---------------------------------------------------------------------------
// Assets — Phase 2
// ---------------------------------------------------------------------------

export type { Asset, AssetPage, AssetDetailResponse, UpdateAssetInput };

export interface AssetListOptions {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  search?: string;
  category?: string;
}

export const getHouseholdAssets = (
  householdId: string,
  options: AssetListOptions = {}
): Promise<AssetPage> =>
  apiRequest(`/v1/assets`, assetPageSchema, {
    params: {
      householdId,
      paginated: true,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
      ...(options.includeArchived ? { includeArchived: true } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.category ? { category: options.category } : {}),
    },
  });

export const getAssetDetail = (assetId: string): Promise<AssetDetailResponse> =>
  apiRequest(`/v1/assets/${assetId}/detail`, assetDetailResponseSchema);

export const updateAsset = (
  assetId: string,
  input: UpdateAssetInput
): Promise<Asset> =>
  apiRequest(`/v1/assets/${assetId}`, assetSchema, { method: "PATCH", body: input });

export const archiveAsset = (assetId: string): Promise<Asset> =>
  apiRequest(`/v1/assets/${assetId}/archive`, assetSchema, { method: "POST", body: {} });

export const unarchiveAsset = (assetId: string): Promise<Asset> =>
  apiRequest(`/v1/assets/${assetId}/unarchive`, assetSchema, { method: "POST", body: {} });

// ---------------------------------------------------------------------------
// Projects — Phase 2
// ---------------------------------------------------------------------------

export type { ProjectSummary, ProjectDetail, ProjectTask, UpdateProjectInput, UpdateProjectTaskInput };

const projectSummaryListSchema = z.array(projectSummarySchema);

export interface ProjectListOptions {
  status?: string;
}

export const getHouseholdProjects = (
  householdId: string,
  options: ProjectListOptions = {}
): Promise<ProjectSummary[]> =>
  apiRequest(`/v1/households/${householdId}/projects`, projectSummaryListSchema, {
    params: { ...(options.status ? { status: options.status } : {}) },
  });

export const getProjectDetail = (
  householdId: string,
  projectId: string
): Promise<ProjectDetail> =>
  apiRequest(`/v1/households/${householdId}/projects/${projectId}`, projectDetailSchema);

export const updateProject = (
  householdId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectSummary> =>
  apiRequest(`/v1/households/${householdId}/projects/${projectId}`, projectSummarySchema, {
    method: "PATCH",
    body: input,
  });

export const updateProjectTask = (
  householdId: string,
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput
): Promise<ProjectTask> =>
  apiRequest(
    `/v1/households/${householdId}/projects/${projectId}/tasks/${taskId}`,
    projectTaskSchema,
    { method: "PATCH", body: input }
  );

// ---------------------------------------------------------------------------
// Hobbies — Phase 2
// ---------------------------------------------------------------------------

export type { Hobby, HobbySummary, HobbyDetail, HobbySession, HobbySessionSummary, UpdateHobbyInput, CreateHobbySessionInput, UpdateHobbySessionInput };

const hobbySummaryListSchema = z.object({
  items: z.array(hobbySummarySchema),
  nextCursor: z.string().nullable(),
});

const hobbySessionSummaryListSchema = z.array(hobbySessionSummarySchema);

export interface HobbyListOptions {
  status?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export const getHouseholdHobbies = (
  householdId: string,
  options: HobbyListOptions = {}
): Promise<{ items: HobbySummary[]; nextCursor: string | null }> =>
  apiRequest(`/v1/households/${householdId}/hobbies`, hobbySummaryListSchema, {
    params: {
      ...(options.status ? { status: options.status } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
  });

export const getHobbyDetail = (
  householdId: string,
  hobbyId: string
): Promise<HobbyDetail> =>
  apiRequest(`/v1/households/${householdId}/hobbies/${hobbyId}`, hobbyDetailSchema);

export const updateHobby = (
  householdId: string,
  hobbyId: string,
  input: UpdateHobbyInput
): Promise<Hobby> =>
  apiRequest(`/v1/households/${householdId}/hobbies/${hobbyId}`, hobbySchema, {
    method: "PATCH",
    body: input,
  });

export interface HobbySessionListOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export const getHobbySessions = (
  householdId: string,
  hobbyId: string,
  options: HobbySessionListOptions = {}
): Promise<HobbySessionSummary[]> =>
  apiRequest(
    `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`,
    hobbySessionSummaryListSchema,
    {
      params: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.limit ? { limit: options.limit } : {}),
        ...(options.offset ? { offset: options.offset } : {}),
      },
    }
  );

export const createHobbySession = (
  householdId: string,
  hobbyId: string,
  input: CreateHobbySessionInput
): Promise<HobbySession> =>
  apiRequest(
    `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`,
    hobbySessionSchema,
    { method: "POST", body: input }
  );

export const updateHobbySession = (
  householdId: string,
  hobbyId: string,
  sessionId: string,
  input: UpdateHobbySessionInput
): Promise<HobbySession> =>
  apiRequest(
    `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
    hobbySessionSchema,
    { method: "PATCH", body: input }
  );

export const deleteHobbySession = (
  householdId: string,
  hobbyId: string,
  sessionId: string
): Promise<void> =>
  apiRequest(
    `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
    z.unknown(),
    { method: "DELETE" }
  ).then(() => undefined);

// ---------------------------------------------------------------------------
// Ideas — Phase 2
// ---------------------------------------------------------------------------

export type { Idea, IdeaSummary, CreateIdeaInput, UpdateIdeaInput, PromoteIdeaInput };

const ideaSummaryListSchema = z.object({
  items: z.array(ideaSummarySchema),
  nextCursor: z.string().nullable().optional(),
});

export interface IdeaListOptions {
  stage?: string;
  category?: string;
  priority?: string;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export const getHouseholdIdeas = (
  householdId: string,
  options: IdeaListOptions = {}
): Promise<IdeaSummary[]> =>
  apiRequest(`/v1/households/${householdId}/ideas`, ideaSummaryListSchema, {
    params: {
      ...(options.stage ? { stage: options.stage } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.includeArchived ? { includeArchived: true } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
  }).then((r) => r.items);

export const getIdea = (
  householdId: string,
  ideaId: string
): Promise<Idea> =>
  apiRequest(`/v1/households/${householdId}/ideas/${ideaId}`, ideaSchema);

export const createIdea = (
  householdId: string,
  input: CreateIdeaInput
): Promise<Idea> =>
  apiRequest(`/v1/households/${householdId}/ideas`, ideaSchema, {
    method: "POST",
    body: input,
  });

export const updateIdea = (
  householdId: string,
  ideaId: string,
  input: UpdateIdeaInput
): Promise<Idea> =>
  apiRequest(`/v1/households/${householdId}/ideas/${ideaId}`, ideaSchema, {
    method: "PATCH",
    body: input,
  });

export const updateIdeaStage = (
  householdId: string,
  ideaId: string,
  stage: string
): Promise<Idea> =>
  apiRequest(`/v1/households/${householdId}/ideas/${ideaId}/stage`, ideaSchema, {
    method: "PATCH",
    body: { stage },
  });

export const promoteIdea = (
  householdId: string,
  ideaId: string,
  data: PromoteIdeaInput
): Promise<{ idea: Idea; createdEntity: { type: string; id: string } }> =>
  apiRequest(
    `/v1/households/${householdId}/ideas/${ideaId}/promote`,
    z.object({ idea: ideaSchema, createdEntity: z.object({ type: z.string(), id: z.string() }) }),
    { method: "POST", body: data }
  );

export const deleteIdea = (
  householdId: string,
  ideaId: string
): Promise<void> =>
  apiRequest(`/v1/households/${householdId}/ideas/${ideaId}`, z.unknown(), {
    method: "DELETE",
  }).then(() => undefined);

// ---------------------------------------------------------------------------
// Inventory — Phase 2
// ---------------------------------------------------------------------------

export type { InventoryItemDetail, InventoryItemListResponse, InventoryTransaction, CreateInventoryTransactionInput };

const inventoryTransactionListSchema = z.array(inventoryTransactionSchema);

export interface InventoryListOptions {
  lowStock?: boolean;
  category?: string;
  search?: string;
  itemType?: string;
  limit?: number;
  cursor?: string;
}

export const getHouseholdInventory = (
  householdId: string,
  options: InventoryListOptions = {}
): Promise<InventoryItemListResponse> =>
  apiRequest(`/v1/households/${householdId}/inventory`, inventoryItemListResponseSchema, {
    params: {
      ...(options.lowStock ? { lowStock: true } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.search ? { search: options.search } : {}),
      ...(options.itemType ? { itemType: options.itemType } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
  });

export const getInventoryItemDetail = (
  householdId: string,
  inventoryItemId: string
): Promise<InventoryItemDetail> =>
  apiRequest(
    `/v1/households/${householdId}/inventory/${inventoryItemId}`,
    inventoryItemDetailSchema
  );

export const createInventoryTransaction = (
  householdId: string,
  inventoryItemId: string,
  input: CreateInventoryTransactionInput
): Promise<InventoryTransaction> =>
  apiRequest(
    `/v1/households/${householdId}/inventory/${inventoryItemId}/transactions`,
    inventoryTransactionSchema,
    { method: "POST", body: createInventoryTransactionSchema.parse(input) }
  );

// ---------------------------------------------------------------------------
// Spaces — Phase 2
// ---------------------------------------------------------------------------

export type { SpaceResponse, SpaceListResponse, SpaceContentsResponse };

const spaceTreeSchema = z.array(spaceResponseSchema);

export const getHouseholdSpaces = (
  householdId: string,
  options: { search?: string; limit?: number; cursor?: string } = {}
): Promise<SpaceListResponse> =>
  apiRequest(`/v1/households/${householdId}/spaces`, spaceListResponseSchema, {
    params: {
      ...(options.search ? { search: options.search } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    },
  });

export const getHouseholdSpacesTree = (
  householdId: string
): Promise<SpaceResponse[]> =>
  apiRequest(`/v1/households/${householdId}/spaces/tree`, spaceTreeSchema);

export const getSpaceContents = (
  householdId: string,
  spaceId: string
): Promise<SpaceContentsResponse> =>
  apiRequest(
    `/v1/households/${householdId}/spaces/${spaceId}/contents`,
    spaceContentsResponseSchema
  );