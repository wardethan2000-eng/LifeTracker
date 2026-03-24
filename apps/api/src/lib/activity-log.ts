import type { Prisma } from "@prisma/client";
import { emitDomainEvent } from "./domain-events.js";
import type { PrismaExecutor } from "./prisma-types.js";


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

/**
 * Factory that binds a Prisma executor and userId so individual log calls
 * become single-line instead of 6-line blocks.
 *
 * @example
 * const logger = createActivityLogger(app.prisma, request.auth.userId);
 * await logger.log("project", project.id, "project.created", params.householdId, { name: project.name });
 */
export function createActivityLogger(prisma: PrismaExecutor, userId: string) {
  return {
    log(
      entityType: string,
      entityId: string,
      action: string,
      householdId: string,
      metadata?: Record<string, unknown>
    ): Promise<void> {
      return logActivity(prisma, { householdId, userId, action, entityType, entityId, ...(metadata ? { metadata } : {}) });
    }
  };
}

/**
 * Convenience helper for routes that always call logActivity + emitDomainEvent
 * for the same mutation.  Both calls share `householdId`, `entityType`, and
 * `entityId`.  When `eventType` is omitted it falls back to `action`.
 * When `payload` is omitted it falls back to `metadata`.
 *
 * @example
 * await logAndEmit(app.prisma, request.auth.userId, {
 *   householdId, entityType: "comment", entityId: comment.id,
 *   action: "comment.created", metadata: { bodyPreview: "..." },
 * });
 */
export async function logAndEmit(
  prisma: PrismaExecutor,
  userId: string,
  params: {
    householdId: string;
    entityType: string;
    entityId: string;
    action: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await Promise.all([
    logActivity(prisma, {
      householdId: params.householdId,
      userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }),
    emitDomainEvent(prisma, {
      householdId: params.householdId,
      eventType: params.eventType ?? params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.payload ?? params.metadata ? { payload: params.payload ?? params.metadata } : {}),
    }),
  ]);
}
