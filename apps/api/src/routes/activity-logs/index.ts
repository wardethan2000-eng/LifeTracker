import { activityLogQuerySchema } from "@aegis/types";
import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { householdParamsSchema } from "../../lib/schemas.js";
import { assertMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { forbidden } from "../../lib/errors.js";

export const activityLogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/activity", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = activityLogQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const where: Prisma.ActivityLogWhereInput = {
      householdId: params.householdId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.since ? { createdAt: { gte: new Date(query.since) } } : {}),
      ...cursorWhere(query.cursor)
    };

    const rawEntries = await app.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit + 1
    });

    const { items: entries, nextCursor } = buildCursorPage(rawEntries, query.limit);

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        householdId: entry.householdId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString()
      })),
      nextCursor
    };
  });
};
