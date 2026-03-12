import type { MaintenanceLog, MaintenanceLogPart, Prisma, PrismaClient } from "@prisma/client";
import { maintenanceLogSchema } from "@lifekeeper/types";
import { updateScheduleDueState } from "./schedule-state.js";
import { toMaintenanceLogPartResponse } from "./presenters.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const toMaintenanceLogResponse = (
  log: Pick<MaintenanceLog, "id" | "assetId" | "scheduleId" | "completedById" | "serviceProviderId" | "title" | "notes" | "completedAt" | "usageValue" | "cost" | "metadata" | "createdAt" | "updatedAt">,
  parts: Pick<MaintenanceLogPart, "id" | "logId" | "name" | "partNumber" | "quantity" | "unitCost" | "supplier" | "notes" | "createdAt" | "updatedAt">[] = []
) => {
  const partResponses = parts.map(toMaintenanceLogPartResponse);
  const totalPartsCost = parts.reduce(
    (sum, p) => sum + (p.quantity ?? 1) * (p.unitCost ?? 0),
    0
  );

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
    metadata: log.metadata,
    parts: partResponses,
    totalPartsCost,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString()
  });
};

export const syncScheduleCompletionFromLogs = async (
  prisma: PrismaExecutor,
  scheduleId: string
) => {
  const latestLog = await prisma.maintenanceLog.findFirst({
    where: { scheduleId },
    orderBy: [
      { completedAt: "desc" },
      { createdAt: "desc" }
    ],
    select: {
      completedAt: true
    }
  });

  await prisma.maintenanceSchedule.update({
    where: { id: scheduleId },
    data: {
      lastCompletedAt: latestLog?.completedAt ?? null
    }
  });

  return updateScheduleDueState(prisma, scheduleId);
};
