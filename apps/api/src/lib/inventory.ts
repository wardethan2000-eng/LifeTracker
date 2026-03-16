import type {
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
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

export {
  calculateInventoryDeficit,
  calculateInventoryTotalValue,
  isInventoryLowStock
};

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export class InventoryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

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