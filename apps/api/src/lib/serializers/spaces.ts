import type { Prisma, Space, SpaceGeneralItem, SpaceInventoryItem, SpaceType } from "@prisma/client";
import {
  spaceGeneralItemSchema,
  spaceItemHistoryEntrySchema,
  spaceInventoryLinkDetailSchema,
  spaceRecentScanEntrySchema,
  spaceResponseSchema,
  spaceUtilizationEntrySchema,
  type SpaceResponse
} from "@lifekeeper/types";
import { toInventoryItemSummaryResponse } from "./inventory.js";

type SpaceParentRecord = Pick<
  Space,
  | "id"
  | "householdId"
  | "shortCode"
  | "scanTag"
  | "name"
  | "type"
  | "parentSpaceId"
  | "description"
  | "notes"
  | "sortOrder"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

type SpaceGeneralItemRecord = Pick<
  SpaceGeneralItem,
  | "id"
  | "spaceId"
  | "householdId"
  | "name"
  | "description"
  | "notes"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

type SpaceItemRecord = Pick<
  SpaceInventoryItem,
  | "id"
  | "spaceId"
  | "inventoryItemId"
  | "quantity"
  | "notes"
  | "placedAt"
  | "createdAt"
  | "updatedAt"
> & {
  inventoryItem?: Prisma.InventoryItemGetPayload<{}>;
};

type SpaceHistoryRecord = {
  id: string;
  spaceId: string;
  inventoryItemId: string | null;
  generalItemName: string | null;
  householdId: string;
  action: string;
  quantity: number | null;
  previousQuantity: number | null;
  performedBy: string | null;
  notes: string | null;
  createdAt: Date;
  inventoryItem: {
    id: string;
    name: string;
    deletedAt: Date | null;
  } | null;
  performer: {
    id: string;
    displayName: string | null;
  } | null;
  space: SpaceParentRecord;
};

type SpaceRecentScanRecord = {
  id: string;
  householdId: string;
  spaceId: string;
  userId: string;
  scannedAt: Date;
  method: "qr_scan" | "manual_lookup" | "direct_navigation";
  user: {
    id: string;
    displayName: string | null;
  };
  space: SpaceParentRecord;
};

type SpaceRecord = Pick<
  Space,
  | "id"
  | "householdId"
  | "shortCode"
  | "scanTag"
  | "name"
  | "type"
  | "parentSpaceId"
  | "description"
  | "notes"
  | "sortOrder"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
> & {
  parent?: SpaceParentRecord | null;
  children?: SpaceRecord[];
  spaceItems?: SpaceItemRecord[];
  generalItems?: SpaceGeneralItemRecord[];
  breadcrumb?: Array<{ id: string; name: string; type: SpaceType }>;
  itemCount?: number;
  generalItemCount?: number;
  totalItemCount?: number;
};

const toSpaceReference = (space: SpaceParentRecord) => ({
  id: space.id,
  householdId: space.householdId,
  shortCode: space.shortCode,
  scanTag: space.scanTag,
  name: space.name,
  type: space.type,
  parentSpaceId: space.parentSpaceId,
  description: space.description ?? null,
  notes: space.notes ?? null,
  sortOrder: space.sortOrder,
  createdAt: space.createdAt.toISOString(),
  updatedAt: space.updatedAt.toISOString(),
  deletedAt: space.deletedAt?.toISOString() ?? null
});

const toSpaceGeneralItem = (item: SpaceGeneralItemRecord) => spaceGeneralItemSchema.parse({
  id: item.id,
  spaceId: item.spaceId,
  householdId: item.householdId,
  name: item.name,
  description: item.description ?? null,
  notes: item.notes ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt?.toISOString() ?? null
});

const toSpaceItem = (item: SpaceItemRecord) => spaceInventoryLinkDetailSchema.parse({
  id: item.id,
  spaceId: item.spaceId,
  inventoryItemId: item.inventoryItemId,
  quantity: item.quantity ?? null,
  notes: item.notes ?? null,
  placedAt: item.placedAt.toISOString(),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  inventoryItem: item.inventoryItem ? toInventoryItemSummaryResponse(item.inventoryItem) : undefined
});

export const serializeSpaceItemHistory = (
  entry: SpaceHistoryRecord,
  options: {
    breadcrumb?: Array<{ id: string; name: string; type: SpaceType }>;
  } = {}
) => {
  const breadcrumb = options.breadcrumb ?? [{ id: entry.space.id, name: entry.space.name, type: entry.space.type }];
  const itemName = entry.inventoryItem?.name ?? entry.generalItemName ?? "Unknown item";
  const itemDeleted = entry.inventoryItem ? entry.inventoryItem.deletedAt !== null : true;

  return spaceItemHistoryEntrySchema.parse({
    id: entry.id,
    spaceId: entry.spaceId,
    inventoryItemId: entry.inventoryItemId,
    generalItemName: entry.generalItemName,
    householdId: entry.householdId,
    action: entry.action,
    quantity: entry.quantity,
    previousQuantity: entry.previousQuantity,
    performedBy: entry.performedBy,
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
    itemName,
    itemDeleted,
    entityUrl: entry.inventoryItemId && !itemDeleted ? `/inventory/${entry.inventoryItemId}?householdId=${entry.householdId}` : null,
    actor: entry.performer,
    space: {
      ...toSpaceReference(entry.space),
      breadcrumb
    }
  });
};

export const serializeSpace = (
  space: SpaceRecord,
  options: {
    breadcrumb?: Array<{ id: string; name: string; type: SpaceType }>;
  } = {}
): SpaceResponse => {
  const breadcrumb = options.breadcrumb ?? space.breadcrumb ?? [{ id: space.id, name: space.name, type: space.type }];
  const itemCount = space.itemCount ?? space.spaceItems?.length ?? 0;
  const generalItemCount = space.generalItemCount ?? space.generalItems?.filter((item) => item.deletedAt === null).length ?? 0;
  const totalItemCount = space.totalItemCount ?? itemCount + generalItemCount;

  const payload: Record<string, unknown> = {
    id: space.id,
    householdId: space.householdId,
    shortCode: space.shortCode,
    scanTag: space.scanTag,
    name: space.name,
    type: space.type,
    parentSpaceId: space.parentSpaceId,
    description: space.description ?? null,
    notes: space.notes ?? null,
    sortOrder: space.sortOrder,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    deletedAt: space.deletedAt?.toISOString() ?? null,
    breadcrumb,
    itemCount,
    generalItemCount,
    totalItemCount
  };

  if (space.parent) {
    payload.parent = toSpaceReference(space.parent);
  }

  if (space.children) {
    payload.children = space.children.map((child) => serializeSpace(child, {
      breadcrumb: [...breadcrumb, { id: child.id, name: child.name, type: child.type }]
    }));
  }

  if (space.spaceItems) {
    payload.spaceItems = space.spaceItems.map(toSpaceItem);
  }

  if (space.generalItems) {
    payload.generalItems = space.generalItems
      .filter((item) => item.deletedAt === null)
      .map(toSpaceGeneralItem);
  }

  return spaceResponseSchema.parse(payload);
};

export const serializeSpaceList = (
  spaces: SpaceRecord[],
  options: {
    breadcrumbsById?: Record<string, Array<{ id: string; name: string; type: SpaceType }> | undefined>;
  } = {}
): SpaceResponse[] => spaces.map((space) => {
  const breadcrumb = options.breadcrumbsById?.[space.id] ?? space.breadcrumb;

  return breadcrumb
    ? serializeSpace(space, { breadcrumb })
    : serializeSpace(space);
});

export const serializeSpaceUtilization = (
  space: SpaceParentRecord & {
    breadcrumb: Array<{ id: string; name: string; type: SpaceType }>;
    itemCount: number;
    generalItemCount: number;
    totalItemCount: number;
    lastActivityAt: Date | null;
  }
) => spaceUtilizationEntrySchema.parse({
  spaceId: space.id,
  shortCode: space.shortCode,
  name: space.name,
  type: space.type,
  breadcrumb: space.breadcrumb,
  itemCount: space.itemCount,
  generalItemCount: space.generalItemCount,
  totalItemCount: space.totalItemCount,
  lastActivityAt: space.lastActivityAt?.toISOString() ?? null,
  isEmpty: space.totalItemCount === 0
});

export const serializeSpaceRecentScan = (
  entry: SpaceRecentScanRecord,
  options: {
    breadcrumb?: Array<{ id: string; name: string; type: SpaceType }>;
  } = {}
) => spaceRecentScanEntrySchema.parse({
  id: entry.id,
  householdId: entry.householdId,
  spaceId: entry.spaceId,
  userId: entry.userId,
  scannedAt: entry.scannedAt.toISOString(),
  method: entry.method,
  actor: entry.user,
  space: {
    ...toSpaceReference(entry.space),
    breadcrumb: options.breadcrumb ?? [{ id: entry.space.id, name: entry.space.name, type: entry.space.type }]
  }
});