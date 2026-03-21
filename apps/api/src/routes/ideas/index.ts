import type { Prisma } from "@prisma/client";
import {
  createIdeaSchema,
  updateIdeaSchema,
  addIdeaNoteSchema,
  addIdeaLinkSchema,
  promoteIdeaSchema,
  demoteToIdeaSchema,
  ideaStageSchema,
  ideaCategorySchema,
  ideaPrioritySchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { syncIdeaToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";
import { toIdeaResponse, toIdeaSummaryResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid(),
});

const ideaParamsSchema = householdParamsSchema.extend({
  ideaId: z.string().cuid(),
});

const noteParamsSchema = ideaParamsSchema.extend({
  noteId: z.string(),
});

const linkParamsSchema = ideaParamsSchema.extend({
  linkId: z.string(),
});

const listIdeasQuerySchema = z.object({
  stage: ideaStageSchema.optional(),
  category: ideaCategorySchema.optional(),
  priority: ideaPrioritySchema.optional(),
  search: z.string().optional(),
  includeArchived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

type IdeaNoteItem = { id: string; text: string; createdAt: string };
type IdeaLinkItem = { id: string; url: string; label: string; createdAt: string };
type IdeaMaterialItem = { id: string; name: string; quantity: string; notes: string };
type IdeaStepItem = { id: string; label: string; done: boolean };

const generateId = (): string => crypto.randomUUID();

export const ideaRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/ideas
  app.get("/v1/households/:householdId/ideas", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = listIdeasQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.IdeaWhereInput = {
      householdId,
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(!query.includeArchived ? { archivedAt: null } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };

    const limit = query.limit ?? 50;

    const ideas = await app.prisma.idea.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
    });

    const hasMore = ideas.length > limit;
    const items = hasMore ? ideas.slice(0, limit) : ideas;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return reply.send({
      items: items.map(toIdeaSummaryResponse),
      nextCursor,
    });
  });

  // POST /v1/households/:householdId/ideas
  app.post("/v1/households/:householdId/ideas", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = createIdeaSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const materials: IdeaMaterialItem[] = (input.materials ?? []).map((m) => ({
      id: generateId(),
      name: m.name,
      quantity: m.quantity,
      notes: m.notes,
    }));

    const steps: IdeaStepItem[] = (input.steps ?? []).map((s) => ({
      id: generateId(),
      label: s.label,
      done: false,
    }));

    const idea = await app.prisma.idea.create({
      data: {
        householdId,
        createdById: userId,
        title: input.title,
        description: input.description ?? null,
        stage: input.stage ?? "spark",
        priority: input.priority ?? "medium",
        category: input.category ?? null,
        promotionTarget: input.promotionTarget ?? null,
        materials: materials as unknown as Prisma.InputJsonValue,
        steps: steps as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.created",
      entityType: "idea",
      entityId: idea.id,
    });

    await syncIdeaToSearchIndex(app.prisma, idea.id);

    return reply.code(201).send(toIdeaResponse(idea));
  });

  // GET /v1/households/:householdId/ideas/:ideaId
  app.get("/v1/households/:householdId/ideas/:ideaId", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const idea = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!idea) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    return reply.send(toIdeaResponse(idea));
  });

  // PATCH /v1/households/:householdId/ideas/:ideaId
  app.patch("/v1/households/:householdId/ideas/:ideaId", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const input = updateIdeaSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.promotionTarget !== undefined ? { promotionTarget: input.promotionTarget } : {}),
        ...(input.materials !== undefined ? { materials: input.materials as unknown as Prisma.InputJsonValue } : {}),
        ...(input.steps !== undefined ? { steps: input.steps as unknown as Prisma.InputJsonValue } : {}),
        ...(input.links !== undefined ? { links: input.links as unknown as Prisma.InputJsonValue } : {}),
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.updated",
      entityType: "idea",
      entityId: idea.id,
    });

    await syncIdeaToSearchIndex(app.prisma, idea.id);

    return reply.send(toIdeaResponse(idea));
  });

  // DELETE /v1/households/:householdId/ideas/:ideaId
  app.delete("/v1/households/:householdId/ideas/:ideaId", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    await app.prisma.idea.update({
      where: { id: ideaId },
      data: { archivedAt: new Date() },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.archived",
      entityType: "idea",
      entityId: ideaId,
      metadata: { title: existing.title },
    });

    await removeSearchIndexEntry(app.prisma, "idea", ideaId);

    return reply.code(204).send();
  });

  // POST /v1/households/:householdId/ideas/:ideaId/notes
  app.post("/v1/households/:householdId/ideas/:ideaId/notes", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const input = addIdeaNoteSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const existingNotes = (existing.notes as unknown as IdeaNoteItem[]) ?? [];
    const newNote: IdeaNoteItem = {
      id: generateId(),
      text: input.text,
      createdAt: new Date().toISOString(),
    };

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        notes: [...existingNotes, newNote] as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.note_added",
      entityType: "idea",
      entityId: ideaId,
    });

    return reply.send(toIdeaResponse(idea));
  });

  // DELETE /v1/households/:householdId/ideas/:ideaId/notes/:noteId
  app.delete("/v1/households/:householdId/ideas/:ideaId/notes/:noteId", async (request, reply) => {
    const { householdId, ideaId, noteId } = noteParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const existingNotes = (existing.notes as unknown as IdeaNoteItem[]) ?? [];
    const filteredNotes = existingNotes.filter((n) => n.id !== noteId);

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        notes: filteredNotes as unknown as Prisma.InputJsonValue,
      },
    });

    return reply.send(toIdeaResponse(idea));
  });

  // POST /v1/households/:householdId/ideas/:ideaId/links
  app.post("/v1/households/:householdId/ideas/:ideaId/links", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const input = addIdeaLinkSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const existingLinks = (existing.links as unknown as IdeaLinkItem[]) ?? [];
    const newLink: IdeaLinkItem = {
      id: generateId(),
      url: input.url,
      label: input.label,
      createdAt: new Date().toISOString(),
    };

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        links: [...existingLinks, newLink] as unknown as Prisma.InputJsonValue,
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.link_added",
      entityType: "idea",
      entityId: ideaId,
    });

    return reply.send(toIdeaResponse(idea));
  });

  // DELETE /v1/households/:householdId/ideas/:ideaId/links/:linkId
  app.delete("/v1/households/:householdId/ideas/:ideaId/links/:linkId", async (request, reply) => {
    const { householdId, ideaId, linkId } = linkParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const existingLinks = (existing.links as unknown as IdeaLinkItem[]) ?? [];
    const filteredLinks = existingLinks.filter((l) => l.id !== linkId);

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        links: filteredLinks as unknown as Prisma.InputJsonValue,
      },
    });

    return reply.send(toIdeaResponse(idea));
  });

  // PATCH /v1/households/:householdId/ideas/:ideaId/stage
  app.patch("/v1/households/:householdId/ideas/:ideaId/stage", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const { stage } = z.object({ stage: ideaStageSchema }).parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: { stage },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.stage_changed",
      entityType: "idea",
      entityId: ideaId,
      metadata: { from: existing.stage, to: stage },
    });

    return reply.send(toIdeaResponse(idea));
  });

  // POST /v1/households/:householdId/ideas/:ideaId/promote
  app.post("/v1/households/:householdId/ideas/:ideaId/promote", async (request, reply) => {
    const { householdId, ideaId } = ideaParamsSchema.parse(request.params);
    const input = promoteIdeaSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.idea.findFirst({
      where: { id: ideaId, householdId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Idea not found" });
    }

    if (existing.promotedAt) {
      return reply.code(409).send({ message: "Idea has already been promoted" });
    }

    const entityName = input.name ?? existing.title;
    const entityDescription = input.description ?? existing.description;
    const now = new Date();

    let targetId: string;
    let targetType = input.target;

    if (input.target === "project") {
      const steps = (existing.steps as unknown as IdeaStepItem[]) ?? [];

      const project = await app.prisma.$transaction(async (prisma) => {
        const created = await prisma.project.create({
          data: {
            householdId,
            name: entityName,
            description: entityDescription,
            status: "planning",
          },
        });

        if (steps.length > 0) {
          await prisma.projectTask.createMany({
            data: steps.map((step, index) => ({
              projectId: created.id,
              title: step.label,
              status: step.done ? "completed" : "pending",
              isCompleted: step.done,
              sortOrder: index,
              ...(step.done ? { completedAt: now } : {}),
            })),
          });
        }

        return created;
      });

      targetId = project.id;
    } else if (input.target === "asset") {
      const asset = await app.prisma.asset.create({
        data: {
          householdId,
          createdById: userId,
          name: entityName,
          description: entityDescription,
          category: "other",
        },
      });
      targetId = asset.id;
    } else {
      // hobby
      const hobby = await app.prisma.hobby.create({
        data: {
          householdId,
          createdById: userId,
          name: entityName,
          description: entityDescription,
          status: "active",
        },
      });
      targetId = hobby.id;
    }

    const idea = await app.prisma.idea.update({
      where: { id: ideaId },
      data: {
        promotedAt: now,
        promotedToType: targetType,
        promotedToId: targetId,
        archivedAt: now,
        stage: "ready",
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.promoted",
      entityType: "idea",
      entityId: ideaId,
      metadata: { targetType, targetId },
    });

    await removeSearchIndexEntry(app.prisma, "idea", ideaId);

    return reply.send({
      ...toIdeaResponse(idea),
      promotedEntity: { type: targetType, id: targetId },
    });
  });

  // POST /v1/households/:householdId/ideas/demote
  app.post("/v1/households/:householdId/ideas/demote", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = demoteToIdeaSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!(await checkMembership(app.prisma, householdId, userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    let sourceName: string;
    let sourceDescription: string | null;

    if (input.sourceType === "project") {
      const project = await app.prisma.project.findFirst({
        where: { id: input.sourceId, householdId },
        select: { name: true, description: true },
      });
      if (!project) {
        return reply.code(404).send({ message: "Source project not found" });
      }
      sourceName = project.name;
      sourceDescription = project.description;
    } else if (input.sourceType === "asset") {
      const asset = await app.prisma.asset.findFirst({
        where: { id: input.sourceId, householdId },
        select: { name: true, description: true },
      });
      if (!asset) {
        return reply.code(404).send({ message: "Source asset not found" });
      }
      sourceName = asset.name;
      sourceDescription = asset.description;
    } else {
      const hobby = await app.prisma.hobby.findFirst({
        where: { id: input.sourceId, householdId },
        select: { name: true, description: true },
      });
      if (!hobby) {
        return reply.code(404).send({ message: "Source hobby not found" });
      }
      sourceName = hobby.name;
      sourceDescription = hobby.description;
    }

    const idea = await app.prisma.idea.create({
      data: {
        householdId,
        createdById: userId,
        title: input.title ?? sourceName,
        description: sourceDescription,
        stage: input.stage ?? "developing",
        demotedFromType: input.sourceType,
        demotedFromId: input.sourceId,
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "idea.demoted_from",
      entityType: "idea",
      entityId: idea.id,
      metadata: { sourceType: input.sourceType, sourceId: input.sourceId },
    });

    await syncIdeaToSearchIndex(app.prisma, idea.id);

    return reply.code(201).send(toIdeaResponse(idea));
  });
};
