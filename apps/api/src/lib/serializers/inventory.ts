import type {
  Asset,
  AssetInventoryItem,
  InventoryItem,
  InventoryTransaction,
  MaintenanceLogPart,
  Project,
  ProjectInventoryItem,
  ScheduleInventoryItem
} from "@prisma/client";
import {
  assetInventoryItemSchema,
  assetPartsConsumptionSchema,
  householdInventoryAnalyticsSchema,
  inventoryItemConsumptionSchema,
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
  | "unitCost"
  | "notes"
  | "userId"
  | "createdAt"
>;

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

export const toInventoryTransactionResponse = (transaction: InventoryTransactionRecord) => inventoryTransactionSchema.parse({
  ...transaction,
  referenceType: transaction.referenceType ?? null,
  referenceId: transaction.referenceId ?? null,
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
  }
) => inventoryTransactionWithItemSchema.parse({
  ...toInventoryTransactionResponse(transaction),
  itemName: transaction.inventoryItem.name,
  itemPartNumber: transaction.inventoryItem.partNumber ?? null
});

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
  }
) => inventoryItemDetailSchema.parse({
  ...toInventoryItemSummaryResponse(item),
  transactions: item.transactions.map(toInventoryTransactionResponse),
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
  }))
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