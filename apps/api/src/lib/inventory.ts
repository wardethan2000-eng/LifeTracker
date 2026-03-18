import type {
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  type CreateInventoryTransactionCorrectionInput,
  type CreateMaintenanceLogPartInput,
  type CreateInventoryTransactionInput,
  type InventoryTransactionType,
  type SchedulePartReadinessItem,
  type SchedulePartsReadiness
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

type InventoryTransactionWriteInput = CreateInventoryTransactionInput & {
  correctionOfTransactionId?: string | null;
};

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
    householdId,
    deletedAt: null
  }
});

type ScheduleInventoryReadinessRecord = {
  scheduleId: string;
  quantityPerService: number;
  inventoryItem: {
    id: string;
    name: string;
    partNumber: string | null;
    quantityOnHand: number;
    unit: string;
    reorderThreshold: number | null;
  };
};

type ScheduleInventoryConsumptionRecord = {
  inventoryItemId: string;
  quantityPerService: number;
  notes: string | null;
  inventoryItem: {
    name: string;
    partNumber: string | null;
    unitCost: number | null;
    preferredSupplier: string | null;
  };
};

const buildSchedulePartsReadiness = (
  scheduleId: string,
  links: ScheduleInventoryReadinessRecord[]
): SchedulePartsReadiness => {
  const items: SchedulePartReadinessItem[] = links.map((link) => {
    const quantityNeeded = link.quantityPerService;
    const quantityOnHand = link.inventoryItem.quantityOnHand;
    const deficit = Math.max(0, quantityNeeded - quantityOnHand);

    return {
      inventoryItemId: link.inventoryItem.id,
      itemName: link.inventoryItem.name,
      itemPartNumber: link.inventoryItem.partNumber,
      unit: link.inventoryItem.unit,
      quantityNeeded,
      quantityOnHand,
      deficit,
      ready: deficit === 0
    };
  });

  const readyCount = items.filter((item) => item.ready).length;

  return {
    scheduleId,
    allReady: readyCount === items.length,
    totalLinkedItems: items.length,
    readyCount,
    items
  };
};

export const computeSchedulePartsReadiness = async (
  prisma: PrismaExecutor,
  scheduleId: string
): Promise<SchedulePartsReadiness> => {
  const links = await prisma.scheduleInventoryItem.findMany({
    where: { scheduleId },
    select: {
      scheduleId: true,
      quantityPerService: true,
      inventoryItem: {
        select: {
          id: true,
          name: true,
          partNumber: true,
          quantityOnHand: true,
          unit: true,
          reorderThreshold: true
        }
      }
    }
  });

  return buildSchedulePartsReadiness(scheduleId, links);
};

export const computeBulkSchedulePartsReadiness = async (
  prisma: PrismaExecutor,
  scheduleIds: string[]
): Promise<Map<string, SchedulePartsReadiness>> => {
  const readinessMap = new Map<string, SchedulePartsReadiness>();

  if (scheduleIds.length === 0) {
    return readinessMap;
  }

  const links = await prisma.scheduleInventoryItem.findMany({
    where: {
      scheduleId: {
        in: scheduleIds
      }
    },
    select: {
      scheduleId: true,
      quantityPerService: true,
      inventoryItem: {
        select: {
          id: true,
          name: true,
          partNumber: true,
          quantityOnHand: true,
          unit: true,
          reorderThreshold: true
        }
      }
    }
  });

  const grouped = links.reduce<Map<string, ScheduleInventoryReadinessRecord[]>>((map, link) => {
    const existing = map.get(link.scheduleId);

    if (existing) {
      existing.push(link);
    } else {
      map.set(link.scheduleId, [link]);
    }

    return map;
  }, new Map());

  for (const scheduleId of scheduleIds) {
    readinessMap.set(scheduleId, buildSchedulePartsReadiness(scheduleId, grouped.get(scheduleId) ?? []));
  }

  return readinessMap;
};

export const applyInventoryTransaction = async (
  prisma: Prisma.TransactionClient,
  options: {
    inventoryItemId: string;
    userId: string;
    input: InventoryTransactionWriteInput;
    preventNegative?: boolean;
    clampToZero?: boolean;
  }
) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: options.inventoryItemId }
  });

  if (!item || item.deletedAt) {
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
      correctionOfTransactionId: options.input.correctionOfTransactionId ?? null,
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

export const createInventoryTransactionCorrection = async (
  prisma: Prisma.TransactionClient,
  options: {
    householdId: string;
    transactionId: string;
    userId: string;
    input: CreateInventoryTransactionCorrectionInput;
  }
) => {
  const original = await prisma.inventoryTransaction.findFirst({
    where: {
      id: options.transactionId,
      inventoryItem: {
        householdId: options.householdId,
        deletedAt: null
      }
    }
  });

  if (!original) {
    throw new InventoryError("INVENTORY_TRANSACTION_NOT_FOUND", "Inventory transaction not found.");
  }

  const correctionQuantity = options.input.replacementQuantity - original.quantity;

  if (correctionQuantity === 0) {
    throw new InventoryError("NO_CORRECTION_REQUIRED", "The replacement quantity matches the original transaction.");
  }

  return applyInventoryTransaction(prisma, {
    inventoryItemId: original.inventoryItemId,
    userId: options.userId,
    input: {
      type: "correction" satisfies InventoryTransactionType,
      quantity: correctionQuantity,
      unitCost: original.unitCost ?? undefined,
      referenceType: "inventory_transaction",
      referenceId: original.id,
      correctionOfTransactionId: original.id,
      notes: options.input.notes
    },
    preventNegative: false,
    clampToZero: false
  });
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

export const createScheduleLinkedLogParts = async (
  prisma: Prisma.TransactionClient,
  options: {
    householdId: string;
    logId: string;
    userId: string;
    scheduleInventoryItems: ScheduleInventoryConsumptionRecord[];
  }
) => {
  const warnings: string[] = [];

  for (const schedulePart of options.scheduleInventoryItems) {
    try {
      const result = await createMaintenanceLogPartWithInventory(prisma, {
        householdId: options.householdId,
        logId: options.logId,
        userId: options.userId,
        input: {
          inventoryItemId: schedulePart.inventoryItemId,
          name: schedulePart.inventoryItem.name,
          partNumber: schedulePart.inventoryItem.partNumber ?? undefined,
          quantity: schedulePart.quantityPerService,
          unitCost: schedulePart.inventoryItem.unitCost ?? undefined,
          supplier: schedulePart.inventoryItem.preferredSupplier ?? undefined,
          notes: schedulePart.notes ?? undefined
        }
      });

      if (result.warning) {
        warnings.push(`${schedulePart.inventoryItem.name}: ${result.warning}`);
      }
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INVENTORY_ITEM_NOT_FOUND") {
        throw new Error(error.message);
      }

      throw error;
    }
  }

  return warnings;
};