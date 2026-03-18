import type {
  Asset,
  AssetInventoryItem,
  InventoryItem,
  InventoryItemRevision,
  InventoryPurchase,
  InventoryPurchaseLine,
  InventoryTransaction,
  MaintenanceLogPart,
  Project,
  ProjectInventoryItem,
  Space,
  SpaceInventoryItem,
  ScheduleInventoryItem
} from "@prisma/client";
import {
  assetInventoryItemSchema,
  assetPartsConsumptionSchema,
  householdInventoryAnalyticsSchema,
  inventoryItemConsumptionSchema,
  inventoryItemRevisionSchema,
  inventoryItemSpaceLinkSchema,
  inventoryPurchaseLineSchema,
  inventoryPurchaseSchema,
  inventoryShoppingListSummarySchema,
  scheduleInventoryItemSchema,
  scheduleInventoryLinkDetailSchema,
  inventoryAssetLinkDetailSchema,
  inventoryItemDetailSchema,
  inventoryReorderForecastSchema,
  inventoryItemSummarySchema,
  inventoryProjectLinkDetailSchema,
  inventoryTransactionWithItemSchema,
  inventoryTransactionSchema,
  inventoryTurnoverSchema,
  lowStockInventoryItemSchema,
  maintenanceLogPartSchema,
  partCommonalitySchema,
  projectInventoryItemSchema
} from "@lifekeeper/types";
import type { InventoryTransactionReferenceLink } from "@lifekeeper/types";
import {
  calculateInventoryDeficit,
  calculateInventoryTotalValue,
  isInventoryLowStock
} from "../inventory.js";

type InventorySummaryRecord = Pick<
  InventoryItem,
  | "id"
  | "householdId"
  | "itemType"
  | "conditionStatus"
  | "name"
  | "partNumber"
  | "description"
  | "category"
  | "manufacturer"
  | "quantityOnHand"
  | "unit"
  | "reorderThreshold"
  | "reorderQuantity"
  | "preferredSupplier"
  | "supplierUrl"
  | "unitCost"
  | "storageLocation"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

type InventoryTransactionRecord = Pick<
  InventoryTransaction,
  | "id"
  | "inventoryItemId"
  | "type"
  | "quantity"
  | "quantityAfter"
  | "referenceType"
  | "referenceId"
  | "correctionOfTransactionId"
  | "unitCost"
  | "notes"
  | "userId"
  | "createdAt"
> & {
  correctionOfTransaction?: Pick<InventoryTransaction, "id" | "type" | "quantity" | "createdAt"> | null;
  correctedByTransactions?: Array<Pick<InventoryTransaction, "id" | "type" | "quantity" | "createdAt">>;
};

type InventoryPurchaseLineRecord = Pick<
  InventoryPurchaseLine,
  | "id"
  | "purchaseId"
  | "inventoryItemId"
  | "projectPhaseSupplyId"
  | "status"
  | "plannedQuantity"
  | "orderedQuantity"
  | "receivedQuantity"
  | "unitCost"
  | "notes"
  | "orderedAt"
  | "receivedAt"
  | "createdAt"
  | "updatedAt"
> & {
  inventoryItem: InventorySummaryRecord;
};

type InventoryPurchaseRecord = Pick<
  InventoryPurchase,
  | "id"
  | "householdId"
  | "createdById"
  | "supplierName"
  | "supplierUrl"
  | "source"
  | "status"
  | "notes"
  | "orderedAt"
  | "receivedAt"
  | "createdAt"
  | "updatedAt"
> & {
  lines: InventoryPurchaseLineRecord[];
};

type MaintenanceLogPartRecord = Pick<
  MaintenanceLogPart,
  | "id"
  | "logId"
  | "inventoryItemId"
  | "name"
  | "partNumber"
  | "quantity"
  | "unitCost"
  | "supplier"
  | "notes"
  | "createdAt"
  | "updatedAt"
>;

type InventoryItemRevisionRecord = Pick<
  InventoryItemRevision,
  | "id"
  | "inventoryItemId"
  | "householdId"
  | "userId"
  | "action"
  | "changes"
  | "createdAt"
> & {
  user: {
    id: string;
    displayName: string | null;
  };
};

export const toInventoryItemSummaryResponse = (item: InventorySummaryRecord) => inventoryItemSummarySchema.parse({
  id: item.id,
  householdId: item.householdId,
  itemType: item.itemType,
  conditionStatus: item.conditionStatus ?? null,
  name: item.name,
  partNumber: item.partNumber ?? null,
  description: item.description ?? null,
  category: item.category ?? null,
  manufacturer: item.manufacturer ?? null,
  quantityOnHand: item.quantityOnHand,
  unit: item.unit,
  reorderThreshold: item.reorderThreshold ?? null,
  reorderQuantity: item.reorderQuantity ?? null,
  preferredSupplier: item.preferredSupplier ?? null,
  supplierUrl: item.supplierUrl ?? null,
  unitCost: item.unitCost ?? null,
  storageLocation: item.storageLocation ?? null,
  notes: item.notes ?? null,
  totalValue: calculateInventoryTotalValue(item.quantityOnHand, item.unitCost),
  lowStock: isInventoryLowStock(item.quantityOnHand, item.reorderThreshold),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

const toInventoryTransactionLinkResponse = (
  transaction: Pick<InventoryTransaction, "id" | "type" | "quantity" | "createdAt">
) => ({
  id: transaction.id,
  type: transaction.type,
  quantity: transaction.quantity,
  createdAt: transaction.createdAt.toISOString()
});

export const toInventoryTransactionResponse = (
  transaction: InventoryTransactionRecord,
  referenceLink: InventoryTransactionReferenceLink | null = null
) => inventoryTransactionSchema.parse({
  ...transaction,
  referenceType: transaction.referenceType ?? null,
  referenceId: transaction.referenceId ?? null,
  referenceLink,
  correctionOfTransactionId: transaction.correctionOfTransactionId ?? null,
  correctionOfTransaction: transaction.correctionOfTransaction
    ? toInventoryTransactionLinkResponse(transaction.correctionOfTransaction)
    : null,
  correctedByTransactions: (transaction.correctedByTransactions ?? []).map(toInventoryTransactionLinkResponse),
  unitCost: transaction.unitCost ?? null,
  notes: transaction.notes ?? null,
  createdAt: transaction.createdAt.toISOString()
});

export const toInventoryTransactionWithItemResponse = (
  transaction: InventoryTransactionRecord & {
    inventoryItem: {
      name: string;
      partNumber: string | null;
    };
  },
  referenceLink: InventoryTransactionReferenceLink | null = null
) => inventoryTransactionWithItemSchema.parse({
  ...toInventoryTransactionResponse(transaction, referenceLink),
  itemName: transaction.inventoryItem.name,
  itemPartNumber: transaction.inventoryItem.partNumber ?? null
});

export const toInventoryPurchaseLineResponse = (line: InventoryPurchaseLineRecord) => inventoryPurchaseLineSchema.parse({
  id: line.id,
  purchaseId: line.purchaseId,
  inventoryItemId: line.inventoryItemId,
  projectPhaseSupplyId: line.projectPhaseSupplyId ?? null,
  status: line.status,
  plannedQuantity: line.plannedQuantity,
  orderedQuantity: line.orderedQuantity ?? null,
  receivedQuantity: line.receivedQuantity ?? null,
  unitCost: line.unitCost ?? null,
  notes: line.notes ?? null,
  orderedAt: line.orderedAt?.toISOString() ?? null,
  receivedAt: line.receivedAt?.toISOString() ?? null,
  createdAt: line.createdAt.toISOString(),
  updatedAt: line.updatedAt.toISOString(),
  inventoryItem: toInventoryItemSummaryResponse(line.inventoryItem)
});

export const toInventoryPurchaseResponse = (purchase: InventoryPurchaseRecord) => {
  const lines = purchase.lines.map(toInventoryPurchaseLineResponse);
  const totalEstimatedCost = lines.reduce<number | null>((sum, line) => {
    if (line.unitCost === null) {
      return sum;
    }

    const quantity = line.receivedQuantity ?? line.orderedQuantity ?? line.plannedQuantity;
    return (sum ?? 0) + (quantity * line.unitCost);
  }, 0);

  return inventoryPurchaseSchema.parse({
    id: purchase.id,
    householdId: purchase.householdId,
    createdById: purchase.createdById,
    supplierName: purchase.supplierName ?? null,
    supplierUrl: purchase.supplierUrl ?? null,
    source: purchase.source,
    status: purchase.status,
    notes: purchase.notes ?? null,
    orderedAt: purchase.orderedAt?.toISOString() ?? null,
    receivedAt: purchase.receivedAt?.toISOString() ?? null,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    lineCount: lines.length,
    totalEstimatedCost,
    lines
  });
};

export const toInventoryShoppingListResponse = (purchases: InventoryPurchaseRecord[]) => {
  const serialized = purchases.map(toInventoryPurchaseResponse);
  const supplierCount = new Set(serialized.map((purchase) => `${purchase.supplierName ?? ""}::${purchase.supplierUrl ?? ""}`)).size;
  const lineCount = serialized.reduce((sum, purchase) => sum + purchase.lineCount, 0);
  const totalEstimatedCost = serialized.reduce<number | null>((sum, purchase) => {
    if (purchase.totalEstimatedCost === null) {
      return sum;
    }

    return (sum ?? 0) + purchase.totalEstimatedCost;
  }, 0);

  return inventoryShoppingListSummarySchema.parse({
    purchaseCount: serialized.length,
    supplierCount,
    lineCount,
    totalEstimatedCost,
    purchases: serialized
  });
};

export const toMaintenanceLogPartWithInventoryResponse = (part: MaintenanceLogPartRecord) => maintenanceLogPartSchema.parse({
  ...part,
  inventoryItemId: part.inventoryItemId ?? null,
  createdAt: part.createdAt.toISOString(),
  updatedAt: part.updatedAt.toISOString()
});

export const toAssetInventoryItemResponse = (
  link: Pick<AssetInventoryItem, "id" | "assetId" | "inventoryItemId" | "notes" | "recommendedQuantity" | "createdAt" | "updatedAt">
) => assetInventoryItemSchema.parse({
  ...link,
  notes: link.notes ?? null,
  recommendedQuantity: link.recommendedQuantity ?? null,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toAssetInventoryLinkDetailResponse = (
  link: Pick<AssetInventoryItem, "id" | "assetId" | "inventoryItemId" | "notes" | "recommendedQuantity" | "createdAt" | "updatedAt"> & {
    inventoryItem: InventorySummaryRecord;
    asset?: Pick<Asset, "id" | "name" | "category"> | null;
  }
) => inventoryAssetLinkDetailSchema.parse({
  ...toAssetInventoryItemResponse(link),
  inventoryItem: toInventoryItemSummaryResponse(link.inventoryItem),
  asset: link.asset ?? undefined
});

export const toScheduleInventoryItemResponse = (
  link: Pick<ScheduleInventoryItem, "id" | "scheduleId" | "inventoryItemId" | "quantityPerService" | "notes" | "createdAt" | "updatedAt">
) => scheduleInventoryItemSchema.parse({
  ...link,
  notes: link.notes ?? null,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toScheduleInventoryLinkDetailResponse = (
  link: Pick<ScheduleInventoryItem, "id" | "scheduleId" | "inventoryItemId" | "quantityPerService" | "notes" | "createdAt" | "updatedAt"> & {
    inventoryItem: InventorySummaryRecord;
  }
) => scheduleInventoryLinkDetailSchema.parse({
  ...toScheduleInventoryItemResponse(link),
  inventoryItem: toInventoryItemSummaryResponse(link.inventoryItem)
});

export const toProjectInventoryItemResponse = (
  link: Pick<ProjectInventoryItem, "id" | "projectId" | "inventoryItemId" | "quantityNeeded" | "quantityAllocated" | "budgetedUnitCost" | "notes" | "createdAt" | "updatedAt">
) => projectInventoryItemSchema.parse({
  ...link,
  budgetedUnitCost: link.budgetedUnitCost ?? null,
  notes: link.notes ?? null,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toProjectInventoryLinkDetailResponse = (
  link: Pick<ProjectInventoryItem, "id" | "projectId" | "inventoryItemId" | "quantityNeeded" | "quantityAllocated" | "budgetedUnitCost" | "notes" | "createdAt" | "updatedAt"> & {
    inventoryItem: InventorySummaryRecord;
    project?: Pick<Project, "id" | "name"> | null;
  }
) => inventoryProjectLinkDetailSchema.parse({
  ...toProjectInventoryItemResponse(link),
  inventoryItem: toInventoryItemSummaryResponse(link.inventoryItem),
  project: link.project ?? undefined,
  quantityRemaining: link.quantityNeeded - link.quantityAllocated
});

export const toInventoryItemRevisionResponse = (revision: InventoryItemRevisionRecord) => inventoryItemRevisionSchema.parse({
  id: revision.id,
  inventoryItemId: revision.inventoryItemId,
  householdId: revision.householdId,
  userId: revision.userId,
  action: revision.action,
  changes: revision.changes,
  user: revision.user,
  createdAt: revision.createdAt.toISOString()
});

export const toInventoryItemDetailResponse = (
  item: InventorySummaryRecord & {
    transactions: InventoryTransactionRecord[];
    assetLinks: (Pick<AssetInventoryItem, "id" | "assetId" | "inventoryItemId" | "notes" | "recommendedQuantity" | "createdAt" | "updatedAt"> & {
      asset: Pick<Asset, "id" | "name" | "category">;
    })[];
    projectLinks: (Pick<ProjectInventoryItem, "id" | "projectId" | "inventoryItemId" | "quantityNeeded" | "quantityAllocated" | "budgetedUnitCost" | "notes" | "createdAt" | "updatedAt"> & {
      project: Pick<Project, "id" | "name">;
    })[];
    hobbyLinks: Array<{
      id: string;
      hobbyId: string;
      inventoryItemId: string;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      hobby: {
        id: string;
        name: string;
        hobbyType: string | null;
        status: string;
      };
    }>;
    spaceLinks: (Pick<SpaceInventoryItem, "id" | "spaceId" | "inventoryItemId" | "quantity" | "notes" | "placedAt" | "createdAt" | "updatedAt"> & {
      space: Pick<Space, "id" | "householdId" | "shortCode" | "scanTag" | "name" | "type" | "parentSpaceId" | "description" | "notes" | "sortOrder" | "createdAt" | "updatedAt" | "deletedAt"> & {
        breadcrumb: Array<{ id: string; name: string; type: Space["type"] }>;
      };
    })[];
    revisions: InventoryItemRevisionRecord[];
  }
) => inventoryItemDetailSchema.parse({
  ...toInventoryItemSummaryResponse(item),
  transactions: item.transactions.map((transaction) => toInventoryTransactionResponse(transaction)),
  assets: item.assetLinks.map((link) => ({
    ...toAssetInventoryItemResponse(link),
    asset: link.asset
  })),
  projects: item.projectLinks.map((link) => ({
    ...toProjectInventoryItemResponse(link),
    quantityRemaining: link.quantityNeeded - link.quantityAllocated,
    project: link.project
  })),
  hobbyLinks: item.hobbyLinks.map((link) => ({
    id: link.id,
    hobbyId: link.hobbyId,
    hobbyName: link.hobby.name,
    hobbyType: link.hobby.hobbyType ?? null,
    hobbyStatus: link.hobby.status,
    role: null,
    notes: link.notes ?? null
  })),
  spaceLinks: item.spaceLinks.map((link) => inventoryItemSpaceLinkSchema.parse({
    id: link.id,
    spaceId: link.spaceId,
    inventoryItemId: link.inventoryItemId,
    quantity: link.quantity ?? null,
    notes: link.notes ?? null,
    placedAt: link.placedAt.toISOString(),
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    space: {
      id: link.space.id,
      householdId: link.space.householdId,
      shortCode: link.space.shortCode,
      scanTag: link.space.scanTag,
      name: link.space.name,
      type: link.space.type,
      parentSpaceId: link.space.parentSpaceId,
      description: link.space.description ?? null,
      notes: link.space.notes ?? null,
      sortOrder: link.space.sortOrder,
      createdAt: link.space.createdAt.toISOString(),
      updatedAt: link.space.updatedAt.toISOString(),
      deletedAt: link.space.deletedAt?.toISOString() ?? null,
      breadcrumb: link.space.breadcrumb
    }
  })),
  revisions: item.revisions.map(toInventoryItemRevisionResponse)
});

export const toLowStockInventoryItemResponse = (item: InventorySummaryRecord) => lowStockInventoryItemSchema.parse({
  id: item.id,
  householdId: item.householdId,
  name: item.name,
  partNumber: item.partNumber ?? null,
  quantityOnHand: item.quantityOnHand,
  reorderThreshold: item.reorderThreshold ?? null,
  reorderQuantity: item.reorderQuantity ?? null,
  preferredSupplier: item.preferredSupplier ?? null,
  supplierUrl: item.supplierUrl ?? null,
  unitCost: item.unitCost ?? null,
  unit: item.unit,
  deficit: calculateInventoryDeficit(item.quantityOnHand, item.reorderThreshold)
});

export const toHouseholdInventoryAnalyticsResponse = (payload: unknown) => householdInventoryAnalyticsSchema.parse(payload);

export const toInventoryItemConsumptionResponse = (payload: unknown) => inventoryItemConsumptionSchema.parse(payload);

export const toInventoryTurnoverResponse = (payload: unknown) => inventoryTurnoverSchema.parse(payload);

export const toInventoryReorderForecastResponse = (payload: unknown) => inventoryReorderForecastSchema.parse(payload);

export const toAssetPartsConsumptionResponse = (payload: unknown) => assetPartsConsumptionSchema.parse(payload);

export const toPartCommonalityResponse = (payload: unknown) => partCommonalitySchema.parse(payload);