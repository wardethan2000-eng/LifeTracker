import type { Prisma } from "@prisma/client";
import {
  type CreateInventoryTransactionCorrectionInput,
  type CreateMaintenanceLogPartInput,
  type CreateInventoryTransactionInput,
  type InventoryItemMergeResult,
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
import type { PrismaExecutor } from "./prisma-types.js";

export {
  calculateInventoryDeficit,
  calculateInventoryTotalValue,
  isInventoryLowStock
};


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

const mergeText = (primary: string | null, secondary: string | null): string | null => {
  const values = [primary, secondary]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  if (values.length === 0) {
    return null;
  }

  return Array.from(new Set(values)).join("\n\n");
};

const mergeNumber = (primary: number | null, secondary: number | null): number | null => {
  if (primary !== null) {
    return primary;
  }

  return secondary;
};

const mergeAssetLinks = async (
  prisma: Prisma.TransactionClient,
  targetInventoryItemId: string,
  sourceInventoryItemId: string
): Promise<number> => {
  const [sourceLinks, targetLinks] = await Promise.all([
    prisma.assetInventoryItem.findMany({ where: { inventoryItemId: sourceInventoryItemId } }),
    prisma.assetInventoryItem.findMany({ where: { inventoryItemId: targetInventoryItemId } })
  ]);

  const targetByAssetId = new Map(targetLinks.map((link) => [link.assetId, link]));

  for (const sourceLink of sourceLinks) {
    const existingTarget = targetByAssetId.get(sourceLink.assetId);

    if (existingTarget) {
      await prisma.assetInventoryItem.update({
        where: { id: existingTarget.id },
        data: {
          notes: mergeText(existingTarget.notes, sourceLink.notes),
          recommendedQuantity: Math.max(existingTarget.recommendedQuantity ?? 0, sourceLink.recommendedQuantity ?? 0) || null
        }
      });
      await prisma.assetInventoryItem.delete({ where: { id: sourceLink.id } });
      continue;
    }

    await prisma.assetInventoryItem.update({
      where: { id: sourceLink.id },
      data: { inventoryItemId: targetInventoryItemId }
    });
  }

  return sourceLinks.length;
};

const mergeScheduleLinks = async (
  prisma: Prisma.TransactionClient,
  targetInventoryItemId: string,
  sourceInventoryItemId: string
): Promise<number> => {
  const [sourceLinks, targetLinks] = await Promise.all([
    prisma.scheduleInventoryItem.findMany({ where: { inventoryItemId: sourceInventoryItemId } }),
    prisma.scheduleInventoryItem.findMany({ where: { inventoryItemId: targetInventoryItemId } })
  ]);

  const targetByScheduleId = new Map(targetLinks.map((link) => [link.scheduleId, link]));

  for (const sourceLink of sourceLinks) {
    const existingTarget = targetByScheduleId.get(sourceLink.scheduleId);

    if (existingTarget) {
      await prisma.scheduleInventoryItem.update({
        where: { id: existingTarget.id },
        data: {
          quantityPerService: existingTarget.quantityPerService + sourceLink.quantityPerService,
          notes: mergeText(existingTarget.notes, sourceLink.notes)
        }
      });
      await prisma.scheduleInventoryItem.delete({ where: { id: sourceLink.id } });
      continue;
    }

    await prisma.scheduleInventoryItem.update({
      where: { id: sourceLink.id },
      data: { inventoryItemId: targetInventoryItemId }
    });
  }

  return sourceLinks.length;
};

const mergeProjectLinks = async (
  prisma: Prisma.TransactionClient,
  targetInventoryItemId: string,
  sourceInventoryItemId: string
): Promise<number> => {
  const [sourceLinks, targetLinks] = await Promise.all([
    prisma.projectInventoryItem.findMany({ where: { inventoryItemId: sourceInventoryItemId } }),
    prisma.projectInventoryItem.findMany({ where: { inventoryItemId: targetInventoryItemId } })
  ]);

  const targetByProjectId = new Map(targetLinks.map((link) => [link.projectId, link]));

  for (const sourceLink of sourceLinks) {
    const existingTarget = targetByProjectId.get(sourceLink.projectId);

    if (existingTarget) {
      await prisma.projectInventoryItem.update({
        where: { id: existingTarget.id },
        data: {
          quantityNeeded: existingTarget.quantityNeeded + sourceLink.quantityNeeded,
          quantityAllocated: existingTarget.quantityAllocated + sourceLink.quantityAllocated,
          budgetedUnitCost: mergeNumber(existingTarget.budgetedUnitCost, sourceLink.budgetedUnitCost),
          notes: mergeText(existingTarget.notes, sourceLink.notes)
        }
      });
      await prisma.projectInventoryItem.delete({ where: { id: sourceLink.id } });
      continue;
    }

    await prisma.projectInventoryItem.update({
      where: { id: sourceLink.id },
      data: { inventoryItemId: targetInventoryItemId }
    });
  }

  return sourceLinks.length;
};

const mergeHobbyLinks = async (
  prisma: Prisma.TransactionClient,
  targetInventoryItemId: string,
  sourceInventoryItemId: string
): Promise<number> => {
  const [sourceLinks, targetLinks] = await Promise.all([
    prisma.hobbyInventoryItem.findMany({ where: { inventoryItemId: sourceInventoryItemId } }),
    prisma.hobbyInventoryItem.findMany({ where: { inventoryItemId: targetInventoryItemId } })
  ]);

  const targetByHobbyId = new Map(targetLinks.map((link) => [link.hobbyId, link]));

  for (const sourceLink of sourceLinks) {
    const existingTarget = targetByHobbyId.get(sourceLink.hobbyId);

    if (existingTarget) {
      await prisma.hobbyInventoryItem.update({
        where: { id: existingTarget.id },
        data: {
          notes: mergeText(existingTarget.notes, sourceLink.notes)
        }
      });
      await prisma.hobbyInventoryItem.delete({ where: { id: sourceLink.id } });
      continue;
    }

    await prisma.hobbyInventoryItem.update({
      where: { id: sourceLink.id },
      data: { inventoryItemId: targetInventoryItemId }
    });
  }

  return sourceLinks.length;
};

const mergePurchaseLines = async (
  prisma: Prisma.TransactionClient,
  targetInventoryItemId: string,
  sourceInventoryItemId: string
): Promise<number> => {
  const [sourceLines, targetLines] = await Promise.all([
    prisma.inventoryPurchaseLine.findMany({ where: { inventoryItemId: sourceInventoryItemId } }),
    prisma.inventoryPurchaseLine.findMany({ where: { inventoryItemId: targetInventoryItemId } })
  ]);

  const targetByPurchaseId = new Map(targetLines.map((line) => [line.purchaseId, line]));

  for (const sourceLine of sourceLines) {
    const existingTarget = targetByPurchaseId.get(sourceLine.purchaseId);

    if (existingTarget) {
      const mergedOrderedAt = [existingTarget.orderedAt, sourceLine.orderedAt]
        .filter((value): value is Date => value !== null)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
      const mergedReceivedAt = [existingTarget.receivedAt, sourceLine.receivedAt]
        .filter((value): value is Date => value !== null)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
      const orderedQuantity = (existingTarget.orderedQuantity ?? 0) + (sourceLine.orderedQuantity ?? 0);
      const receivedQuantity = (existingTarget.receivedQuantity ?? 0) + (sourceLine.receivedQuantity ?? 0);

      await prisma.inventoryPurchaseLine.update({
        where: { id: existingTarget.id },
        data: {
          plannedQuantity: existingTarget.plannedQuantity + sourceLine.plannedQuantity,
          orderedQuantity: orderedQuantity > 0 ? orderedQuantity : null,
          receivedQuantity: receivedQuantity > 0 ? receivedQuantity : null,
          unitCost: mergeNumber(existingTarget.unitCost, sourceLine.unitCost),
          notes: mergeText(existingTarget.notes, sourceLine.notes),
          status: existingTarget.status === "received" || sourceLine.status === "received"
            ? "received"
            : (existingTarget.status === "ordered" || sourceLine.status === "ordered" ? "ordered" : "draft"),
          orderedAt: mergedOrderedAt,
          receivedAt: mergedReceivedAt
        }
      });
      await prisma.inventoryPurchaseLine.delete({ where: { id: sourceLine.id } });
      continue;
    }

    await prisma.inventoryPurchaseLine.update({
      where: { id: sourceLine.id },
      data: { inventoryItemId: targetInventoryItemId }
    });
  }

  return sourceLines.length;
};

export const mergeHouseholdInventoryItems = async (
  prisma: Prisma.TransactionClient,
  options: {
    householdId: string;
    sourceInventoryItemId: string;
    targetInventoryItemId: string;
  }
): Promise<InventoryItemMergeResult> => {
  if (options.sourceInventoryItemId === options.targetInventoryItemId) {
    throw new InventoryError("INVENTORY_ITEM_MERGE_SAME_ITEM", "Source and target inventory items must be different.");
  }

  const [sourceItem, targetItem] = await Promise.all([
    prisma.inventoryItem.findFirst({
      where: {
        id: options.sourceInventoryItemId,
        householdId: options.householdId,
        deletedAt: null
      }
    }),
    prisma.inventoryItem.findFirst({
      where: {
        id: options.targetInventoryItemId,
        householdId: options.householdId,
        deletedAt: null
      }
    })
  ]);

  if (!sourceItem || !targetItem) {
    throw new InventoryError("INVENTORY_ITEM_NOT_FOUND", "Inventory item not found.");
  }

  if (sourceItem.itemType !== targetItem.itemType) {
    throw new InventoryError("INVENTORY_ITEM_MERGE_TYPE_MISMATCH", "Inventory items with different item types cannot be merged.");
  }

  if (sourceItem.unit.trim().toLowerCase() !== targetItem.unit.trim().toLowerCase()) {
    throw new InventoryError("INVENTORY_ITEM_MERGE_UNIT_MISMATCH", "Inventory items with different units cannot be merged.");
  }

  const [assetLinks, scheduleLinks, projectLinks, hobbyLinks, purchaseLines] = await Promise.all([
    mergeAssetLinks(prisma, targetItem.id, sourceItem.id),
    mergeScheduleLinks(prisma, targetItem.id, sourceItem.id),
    mergeProjectLinks(prisma, targetItem.id, sourceItem.id),
    mergeHobbyLinks(prisma, targetItem.id, sourceItem.id),
    mergePurchaseLines(prisma, targetItem.id, sourceItem.id)
  ]);

  const [transactions, maintenanceLogParts, projectPhaseSupplies, hobbyRecipeIngredients, hobbySessionIngredients, comments] = await Promise.all([
    prisma.inventoryTransaction.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    }),
    prisma.maintenanceLogPart.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    }),
    prisma.projectPhaseSupply.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    }),
    prisma.hobbyRecipeIngredient.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    }),
    prisma.hobbySessionIngredient.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    }),
    prisma.comment.updateMany({
      where: { inventoryItemId: sourceItem.id },
      data: { inventoryItemId: targetItem.id }
    })
  ]);

  const mergedTargetItem = await prisma.inventoryItem.update({
    where: { id: targetItem.id },
    data: {
      quantityOnHand: targetItem.quantityOnHand + sourceItem.quantityOnHand,
      conditionStatus: targetItem.conditionStatus ?? sourceItem.conditionStatus,
      partNumber: targetItem.partNumber ?? sourceItem.partNumber,
      description: mergeText(targetItem.description, sourceItem.description),
      category: targetItem.category ?? sourceItem.category,
      manufacturer: targetItem.manufacturer ?? sourceItem.manufacturer,
      reorderThreshold: mergeNumber(targetItem.reorderThreshold, sourceItem.reorderThreshold),
      reorderQuantity: mergeNumber(targetItem.reorderQuantity, sourceItem.reorderQuantity),
      preferredSupplier: targetItem.preferredSupplier ?? sourceItem.preferredSupplier,
      supplierUrl: targetItem.supplierUrl ?? sourceItem.supplierUrl,
      unitCost: mergeNumber(targetItem.unitCost, sourceItem.unitCost),
      storageLocation: targetItem.storageLocation ?? sourceItem.storageLocation,
      notes: mergeText(targetItem.notes, sourceItem.notes)
    }
  });

  await prisma.inventoryItem.update({
    where: { id: sourceItem.id },
    data: {
      quantityOnHand: 0,
      deletedAt: new Date(),
      notes: mergeText(sourceItem.notes, `Merged into ${targetItem.name} (${targetItem.id}).`)
    }
  });

  return {
    sourceInventoryItemId: sourceItem.id,
    targetInventoryItem: {
      id: mergedTargetItem.id,
      householdId: mergedTargetItem.householdId,
      scanTag: mergedTargetItem.scanTag,
      itemType: mergedTargetItem.itemType,
      conditionStatus: mergedTargetItem.conditionStatus,
      name: mergedTargetItem.name,
      partNumber: mergedTargetItem.partNumber,
      description: mergedTargetItem.description,
      category: mergedTargetItem.category,
      manufacturer: mergedTargetItem.manufacturer,
      quantityOnHand: mergedTargetItem.quantityOnHand,
      unit: mergedTargetItem.unit,
      reorderThreshold: mergedTargetItem.reorderThreshold,
      reorderQuantity: mergedTargetItem.reorderQuantity,
      preferredSupplier: mergedTargetItem.preferredSupplier,
      supplierUrl: mergedTargetItem.supplierUrl,
      unitCost: mergedTargetItem.unitCost,
      storageLocation: mergedTargetItem.storageLocation,
      notes: mergedTargetItem.notes,
      deletedAt: null,
      totalValue: calculateInventoryTotalValue(mergedTargetItem.quantityOnHand, mergedTargetItem.unitCost),
      lowStock: isInventoryLowStock(mergedTargetItem.quantityOnHand, mergedTargetItem.reorderThreshold),
      createdAt: mergedTargetItem.createdAt.toISOString(),
      updatedAt: mergedTargetItem.updatedAt.toISOString()
    },
    reassignedCounts: {
      transactions: transactions.count,
      purchaseLines,
      assetLinks,
      scheduleLinks,
      projectLinks,
      hobbyLinks,
      maintenanceLogParts: maintenanceLogParts.count,
      projectPhaseSupplies: projectPhaseSupplies.count,
      hobbyRecipeIngredients: hobbyRecipeIngredients.count,
      hobbySessionIngredients: hobbySessionIngredients.count,
      comments: comments.count
    }
  };
};

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