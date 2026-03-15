import type { Prisma, PrismaClient } from "@prisma/client";
import { updateScheduleDueState } from "./schedule-state.js";
export { toMaintenanceLogResponse } from "./serializers/index.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

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
