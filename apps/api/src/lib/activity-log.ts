import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

/**
 * Insert an ActivityLog record for audit trail purposes.
 * Call from any handler that creates, updates, deletes, or completes
 * a meaningful entity within a household.
 */
export const logActivity = async (
  prisma: PrismaExecutor,
  params: {
    householdId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> => {
  await prisma.activityLog.create({
    data: {
      householdId: params.householdId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.metadata ? { metadata: params.metadata as Prisma.InputJsonValue } : {})
    }
  });
};
