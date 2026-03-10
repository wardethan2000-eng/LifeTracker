import type { MaintenanceLog, Prisma, PrismaClient } from "@prisma/client";
import { maintenanceLogSchema } from "@lifekeeper/types";
import { updateScheduleDueState } from "./schedule-state.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const toMaintenanceLogResponse = (log: Pick<MaintenanceLog, "id" | "assetId" | "scheduleId" | "completedById" | "title" | "notes" | "completedAt" | "usageValue" | "cost" | "metadata" | "createdAt" | "updatedAt">) => maintenanceLogSchema.parse({
  id: log.id,
  assetId: log.assetId,
  scheduleId: log.scheduleId,
  completedById: log.completedById,
  title: log.title,
  notes: log.notes,
  completedAt: log.completedAt.toISOString(),
  usageValue: log.usageValue,
  cost: log.cost,
  metadata: log.metadata,
  createdAt: log.createdAt.toISOString(),
  updatedAt: log.updatedAt.toISOString()
});

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
