import type { Prisma } from "@prisma/client";
import { updateScheduleDueState } from "./schedule-state.js";
import type { PrismaExecutor } from "./prisma-types.js";
export { toMaintenanceLogResponse } from "./serializers/index.js";


export const syncScheduleCompletionFromLogs = async (
  prisma: PrismaExecutor,
  scheduleId: string
) => {
  const latestLog = await prisma.maintenanceLog.findFirst({
    where: { scheduleId, deletedAt: null },
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
