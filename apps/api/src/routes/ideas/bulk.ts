import {
  bulkArchiveIdeasSchema,
  bulkDeleteIdeasSchema,
  bulkMoveIdeasSchema,
  bulkSetIdeaPrioritySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { removeSearchIndexEntry, syncIdeaToSearchIndex } from "../../lib/search-index.js";
import { householdParamsSchema } from "../../lib/schemas.js";

type BulkFailedItem = {
  id?: string;
  label: string | null;
  error: string;
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
    const failed: BulkFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ id, label: null, error: "Idea not found or already archived." }));

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
          id: idea.id,
          label: idea.title,
          error: err instanceof Error ? err.message : "Failed to update stage."
        });
      }
    }

    if (succeeded > 0) {
            await createActivityLogger(app.prisma, request.auth.userId).log("idea", householdId, "idea.bulk_stage_moved", householdId, { count: succeeded, stage: input.stage });
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
    const failed: BulkFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ id, label: null, error: "Idea not found or already archived." }));

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
          id: idea.id,
          label: idea.title,
          error: err instanceof Error ? err.message : "Failed to archive idea."
        });
      }
    }

    if (succeeded > 0) {
            await createActivityLogger(app.prisma, request.auth.userId).log("idea", householdId, "idea.bulk_archived", householdId, { count: succeeded });
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
    const failed: BulkFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ id, label: null, error: "Idea not found or already archived." }));

    let succeeded = 0;

    if (ideas.length > 0) {
      try {
        await app.prisma.idea.updateMany({
          where: { id: { in: ideas.map((i) => i.id) } },
          data: { priority: input.priority }
        });
        succeeded = ideas.length;

                await createActivityLogger(app.prisma, request.auth.userId).log("idea", householdId, "idea.bulk_priority_changed", householdId, { count: succeeded, priority: input.priority });

        for (const idea of ideas) {
          void syncIdeaToSearchIndex(app.prisma, idea.id).catch(console.error);
        }
      } catch (err) {
        for (const idea of ideas) {
          failed.push({
            id: idea.id,
            label: idea.title,
            error: err instanceof Error ? err.message : "Failed to update priority."
          });
        }
      }
    }

    return { succeeded, failed };
  });

  // POST /v1/households/:householdId/ideas/bulk/delete
  app.post("/v1/households/:householdId/ideas/bulk/delete", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkDeleteIdeasSchema.parse({ ...body, householdId });

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const ideas = await app.prisma.idea.findMany({
      where: {
        id: { in: input.ideaIds },
        householdId
      },
      select: { id: true, title: true }
    });

    const found = new Set(ideas.map((i) => i.id));
    const failed: BulkFailedItem[] = input.ideaIds
      .filter((id) => !found.has(id))
      .map((id) => ({ id, label: null, error: "Idea not found." }));

    let succeeded = 0;

    for (const idea of ideas) {
      try {
        await app.prisma.idea.delete({ where: { id: idea.id } });
        succeeded++;
        void removeSearchIndexEntry(app.prisma, "idea", idea.id).catch(console.error);
      } catch (err) {
        failed.push({
          id: idea.id,
          label: idea.title,
          error: err instanceof Error ? err.message : "Failed to delete idea."
        });
      }
    }

    if (succeeded > 0) {
            await createActivityLogger(app.prisma, request.auth.userId).log("idea", householdId, "idea.bulk_deleted", householdId, { count: succeeded });
    }

    return { succeeded, failed };
  });
};
