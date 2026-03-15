import type { MaintenanceLog, MaintenanceLogPart } from "@prisma/client";
import {
  maintenanceLogPartSchema,
  maintenanceLogSchema
} from "@lifekeeper/types";

export const toMaintenanceLogPartResponse = (
  part: Pick<MaintenanceLogPart, "id" | "logId" | "inventoryItemId" | "name" | "partNumber" | "quantity" | "unitCost" | "supplier" | "notes" | "createdAt" | "updatedAt">
) => maintenanceLogPartSchema.parse({
  ...part,
  inventoryItemId: part.inventoryItemId ?? null,
  createdAt: part.createdAt.toISOString(),
  updatedAt: part.updatedAt.toISOString()
});

export const toMaintenanceLogResponse = (
  log: Pick<MaintenanceLog, "id" | "assetId" | "scheduleId" | "completedById" | "serviceProviderId" | "title" | "notes" | "completedAt" | "usageValue" | "cost" | "laborHours" | "laborRate" | "difficultyRating" | "performedBy" | "metadata" | "createdAt" | "updatedAt">,
  parts: Pick<MaintenanceLogPart, "id" | "logId" | "inventoryItemId" | "name" | "partNumber" | "quantity" | "unitCost" | "supplier" | "notes" | "createdAt" | "updatedAt">[] = []
) => {
  const partResponses = parts.map(toMaintenanceLogPartResponse);
  const totalPartsCost = parts.reduce(
    (sum, part) => sum + (part.quantity ?? 1) * (part.unitCost ?? 0),
    0
  );
  const totalLaborCost = typeof log.laborHours === "number" && typeof log.laborRate === "number"
    ? log.laborHours * log.laborRate
    : null;

  return maintenanceLogSchema.parse({
    id: log.id,
    assetId: log.assetId,
    scheduleId: log.scheduleId,
    completedById: log.completedById,
    serviceProviderId: log.serviceProviderId ?? null,
    title: log.title,
    notes: log.notes,
    completedAt: log.completedAt.toISOString(),
    usageValue: log.usageValue,
    cost: log.cost,
    laborHours: log.laborHours,
    laborRate: log.laborRate,
    difficultyRating: log.difficultyRating,
    performedBy: log.performedBy,
    metadata: log.metadata,
    parts: partResponses,
    totalPartsCost,
    totalLaborCost,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString()
  });
};