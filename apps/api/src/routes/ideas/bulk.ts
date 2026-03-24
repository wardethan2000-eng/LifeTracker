import {
  bulkArchiveIdeasSchema,
  bulkMoveIdeasSchema,
  bulkSetIdeaPrioritySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { removeSearchIndexEntry, syncIdeaToSearchIndex } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

type IdeaFailedItem = {
  ideaId: string;
  title: string | null;
  message: string;
};

export const ideaBulkRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/households/:householdId/ideas/bulk/stage
  app.post("/v1/households/:householdId/ideas/bulk/stage", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkMoveIdeasSchema.parse({ ...body, householdId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const ideas = await app.prisma.idea.findMany({
      where: {
        id: { in: input.ideaIds },
        householdId,
        archivedAt: null
      },
      select: { id: true, title: true }
    });

    const found = new Set(ideas.map((i) => i.id));
    const failed: IdeaFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ ideaId: id, title: null, message: "Idea not found or already archived." }));

    let succeeded = 0;

    for (const idea of ideas) {
      try {
        await app.prisma.idea.update({
          where: { id: idea.id },
          data: { stage: input.stage }
        });
        succeeded++;
        void syncIdeaToSearchIndex(app.prisma, idea.id).catch(console.error);
      } catch (err) {
        failed.push({
          ideaId: idea.id,
          title: idea.title,
          message: err instanceof Error ? err.message : "Failed to update stage."
        });
      }
    }

    if (succeeded > 0) {
      await logActivity(app.prisma, {
        householdId,
        userId: request.auth.userId,
        action: "idea.bulk_stage_moved",
        entityType: "idea",
        entityId: householdId,
        metadata: { count: succeeded, stage: input.stage }
      });
    }

    return { succeeded, failed };
  });

  // POST /v1/households/:householdId/ideas/bulk/archive
  app.post("/v1/households/:householdId/ideas/bulk/archive", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkArchiveIdeasSchema.parse({ ...body, householdId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const ideas = await app.prisma.idea.findMany({
      where: {
        id: { in: input.ideaIds },
        householdId,
        archivedAt: null
      },
      select: { id: true, title: true }
    });

    const found = new Set(ideas.map((i) => i.id));
    const failed: IdeaFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ ideaId: id, title: null, message: "Idea not found or already archived." }));

    let succeeded = 0;
    const now = new Date();

    for (const idea of ideas) {
      try {
        await app.prisma.idea.update({
          where: { id: idea.id },
          data: { archivedAt: now }
        });
        succeeded++;
        void removeSearchIndexEntry(app.prisma, "idea", idea.id).catch(console.error);
      } catch (err) {
        failed.push({
          ideaId: idea.id,
          title: idea.title,
          message: err instanceof Error ? err.message : "Failed to archive idea."
        });
      }
    }

    if (succeeded > 0) {
      await logActivity(app.prisma, {
        householdId,
        userId: request.auth.userId,
        action: "idea.bulk_archived",
        entityType: "idea",
        entityId: householdId,
        metadata: { count: succeeded }
      });
    }

    return { succeeded, failed };
  });

  // POST /v1/households/:householdId/ideas/bulk/priority
  app.post("/v1/households/:householdId/ideas/bulk/priority", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkSetIdeaPrioritySchema.parse({ ...body, householdId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const ideas = await app.prisma.idea.findMany({
      where: {
        id: { in: input.ideaIds },
        householdId,
        archivedAt: null
      },
      select: { id: true, title: true }
    });

    const found = new Set(ideas.map((i) => i.id));
    const failed: IdeaFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ ideaId: id, title: null, message: "Idea not found or already archived." }));

    let succeeded = 0;

    if (ideas.length > 0) {
      try {
        await app.prisma.idea.updateMany({
          where: { id: { in: ideas.map((i) => i.id) } },
          data: { priority: input.priority }
        });
        succeeded = ideas.length;

        await logActivity(app.prisma, {
          householdId,
          userId: request.auth.userId,
          action: "idea.bulk_priority_changed",
          entityType: "idea",
          entityId: householdId,
          metadata: { count: succeeded, priority: input.priority }
        });

        for (const idea of ideas) {
          void syncIdeaToSearchIndex(app.prisma, idea.id).catch(console.error);
        }
      } catch (err) {
        for (const idea of ideas) {
          failed.push({
            ideaId: idea.id,
            title: idea.title,
            message: err instanceof Error ? err.message : "Failed to update priority."
          });
        }
      }
    }

    return { succeeded, failed };
  });
};
