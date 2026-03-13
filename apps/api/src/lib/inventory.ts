import type {
  Asset,
  AssetInventoryItem,
  InventoryItem,
  InventoryTransaction,
  MaintenanceLogPart,
  Prisma,
  PrismaClient,
  ProjectInventoryItem,
  Project
} from "@prisma/client";
import {
  assetInventoryItemSchema,
  inventoryAssetLinkDetailSchema,
  inventoryItemDetailSchema,
  inventoryItemSummarySchema,
  inventoryProjectLinkDetailSchema,
  inventoryTransactionSchema,
  lowStockInventoryItemSchema,
  maintenanceLogPartSchema,
  projectInventoryItemSchema,
  type CreateMaintenanceLogPartInput,
  type CreateInventoryTransactionInput,
  type InventoryTransactionType
} from "@lifekeeper/types";
import {
  applyInventoryDelta,
  calculateInventoryDeficit,
  calculateInventoryTotalValue,
  isInventoryLowStock
} from "@lifekeeper/utils";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

type InventorySummaryRecord = Pick<
  InventoryItem,
  | "id"
  | "householdId"
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

export class InventoryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export const toInventoryItemSummaryResponse = (item: InventorySummaryRecord) => inventoryItemSummarySchema.parse({
  id: item.id,
  householdId: item.householdId,
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

export const getHouseholdInventoryItem = async (
  prisma: PrismaExecutor,
  householdId: string,
  inventoryItemId: string
) => prisma.inventoryItem.findFirst({
  where: {
    id: inventoryItemId,
    householdId
  }
});

export const applyInventoryTransaction = async (
  prisma: Prisma.TransactionClient,
  options: {
    inventoryItemId: string;
    userId: string;
    input: CreateInventoryTransactionInput;
    preventNegative?: boolean;
    clampToZero?: boolean;
  }
) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: options.inventoryItemId }
  });

  if (!item) {
    throw new InventoryError("INVENTORY_ITEM_NOT_FOUND", "Inventory item not found.");
  }

  const rawQuantityAfter = item.quantityOnHand + options.input.quantity;

  if (options.preventNegative !== false && rawQuantityAfter < 0) {
    throw new InventoryError("INSUFFICIENT_STOCK", "Insufficient stock for this transaction.");
  }

  const quantityAfter = options.clampToZero ? applyInventoryDelta(item.quantityOnHand, options.input.quantity) : rawQuantityAfter;
  const stockClamped = options.clampToZero && rawQuantityAfter < 0;

  const updatedItem = await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      quantityOnHand: quantityAfter,
      ...(options.input.unitCost !== undefined ? { unitCost: options.input.unitCost } : {})
    }
  });

  const transaction = await prisma.inventoryTransaction.create({
    data: {
      inventoryItemId: item.id,
      type: options.input.type,
      quantity: options.input.quantity,
      quantityAfter,
      referenceType: options.input.referenceType ?? null,
      referenceId: options.input.referenceId ?? null,
      unitCost: options.input.unitCost ?? null,
      notes: options.input.notes ?? null,
      userId: options.userId
    }
  });

  return {
    item: updatedItem,
    transaction,
    stockClamped,
    lowStock: isInventoryLowStock(updatedItem.quantityOnHand, updatedItem.reorderThreshold)
  };
};

export const createMaintenanceLogPartWithInventory = async (
  prisma: Prisma.TransactionClient,
  options: {
    householdId: string;
    logId: string;
    userId: string;
    input: CreateMaintenanceLogPartInput;
  }
) => {
  let warning: string | undefined;

  if (options.input.inventoryItemId) {
    const inventoryItem = await getHouseholdInventoryItem(prisma, options.householdId, options.input.inventoryItemId);

    if (!inventoryItem) {
      throw new InventoryError("INVENTORY_ITEM_NOT_FOUND", "Inventory item not found or belongs to a different household.");
    }
  }

  const part = await prisma.maintenanceLogPart.create({
    data: {
      logId: options.logId,
      inventoryItemId: options.input.inventoryItemId ?? null,
      name: options.input.name,
      partNumber: options.input.partNumber ?? null,
      quantity: options.input.quantity ?? 1,
      unitCost: options.input.unitCost ?? null,
      supplier: options.input.supplier ?? null,
      notes: options.input.notes ?? null
    }
  });

  if (options.input.inventoryItemId) {
    const inventoryResult = await applyInventoryTransaction(prisma, {
      inventoryItemId: options.input.inventoryItemId,
      userId: options.userId,
      input: {
        type: "consume" satisfies InventoryTransactionType,
        quantity: -(options.input.quantity ?? 1),
        unitCost: options.input.unitCost,
        referenceType: "maintenance_log",
        referenceId: options.logId,
        notes: options.input.notes
      },
      preventNegative: false,
      clampToZero: true
    });

    if (inventoryResult.stockClamped) {
      warning = "Inventory stock was insufficient; quantity on hand was set to zero.";
    }
  }

  return {
    part,
    warning
  };
};