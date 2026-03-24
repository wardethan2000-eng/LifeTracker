import {
  bulkArchiveHobbySessionsSchema,
  bulkLogHobbySessionsSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { recalculatePracticeGoalsForHobby } from "../../lib/hobby-practice.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

type SessionFailedItem = {
  sessionId?: string;
  name: string | null;
  message: string;
};

export const hobbySessionBulkRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/sessions";

  // POST .../sessions/bulk/log
  app.post(`${BASE}/bulk/log`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkLogHobbySessionsSchema.parse({ ...body, householdId, hobbyId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });

    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found." });
    }

    const failed: SessionFailedItem[] = [];
    let succeeded = 0;

    for (const sessionInput of input.sessions) {
      try {
        await app.prisma.$transaction(async (tx) => {
          const created = await tx.hobbySession.create({
            data: {
              hobbyId,
              name: sessionInput.name,
              status: "completed",
              startDate: sessionInput.startDate ? new Date(sessionInput.startDate) : null,
              completedDate: sessionInput.completedDate
                ? new Date(sessionInput.completedDate)
                : new Date(),
              durationMinutes: sessionInput.durationMinutes ?? null,
              notes: sessionInput.notes ?? null,
              recipeId: null,
              routineId: null,
              collectionItemId: null,
              pipelineStepId: null,
              customFields: {},
              totalCost: null
            }
          });

          await recalculatePracticeGoalsForHobby(tx, hobbyId);

          return created;
        });

        succeeded++;
      } catch (err) {
        failed.push({
          name: sessionInput.name,
          message: err instanceof Error ? err.message : "Failed to create session."
        });
      }
    }

    if (succeeded > 0) {
      await logActivity(app.prisma, {
        householdId,
        userId: request.auth.userId,
        action: "hobby_session_bulk_logged",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { count: succeeded }
      });
    }

    return { succeeded, failed };
  });

  // POST .../sessions/bulk/archive
  app.post(`${BASE}/bulk/archive`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkArchiveHobbySessionsSchema.parse({ ...body, householdId, hobbyId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const sessions = await app.prisma.hobbySession.findMany({
      where: {
        id: { in: input.sessionIds },
        hobbyId,
        hobby: { householdId }
      },
      select: { id: true, name: true, status: true }
    });

    const found = new Set(sessions.map((s) => s.id));
    const failed: SessionFailedItem[] = input.sessionIds
      .filter((id) => !found.has(id))
      .map((id) => ({ sessionId: id, name: null, message: "Session not found." }));

    if (sessions.length > 0) {
      try {
        await app.prisma.hobbySession.updateMany({
          where: { id: { in: sessions.map((s) => s.id) } },
          data: { status: "archived" }
        });

        await logActivity(app.prisma, {
          householdId,
          userId: request.auth.userId,
          action: "hobby_session_bulk_archived",
          entityType: "hobby",
          entityId: hobbyId,
          metadata: { count: sessions.length }
        });

        return { succeeded: sessions.length, failed };
      } catch (err) {
        for (const session of sessions) {
          failed.push({
            sessionId: session.id,
            name: session.name,
            message: err instanceof Error ? err.message : "Failed to archive session."
          });
        }
        return { succeeded: 0, failed };
      }
    }

    return { succeeded: 0, failed };
  });
};
