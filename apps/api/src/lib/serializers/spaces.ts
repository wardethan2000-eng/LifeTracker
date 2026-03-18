import type { Prisma, Space, SpaceGeneralItem, SpaceInventoryItem, SpaceType } from "@prisma/client";
import {
  spaceGeneralItemSchema,
  spaceInventoryLinkDetailSchema,
  spaceResponseSchema,
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