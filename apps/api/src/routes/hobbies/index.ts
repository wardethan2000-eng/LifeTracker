import type { Prisma } from "@prisma/client";
import {
  createHobbyInputSchema,
  updateHobbyInputSchema,
  hobbyStatusSchema
} from "@lifekeeper/types";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { syncHobbyToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";
import { findHobbyPreset, hobbyPresetToDefinition, applyHobbyPreset } from "../../lib/hobby-presets.js";
import { toHobbyResponse, toHobbySummaryResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const hobbyParamsSchema = householdParamsSchema.extend({
  hobbyId: z.string().cuid()
});

const listHobbiesQuerySchema = z.object({
  status: hobbyStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const ensureMembership = async (app: FastifyInstance, householdId: string, userId: string) => {
  try {
    await assertMembership(app.prisma, householdId, userId);
    return true;
  } catch {
    return false;
  }
};

export const hobbyRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/hobbies
  app.get("/v1/households/:householdId/hobbies", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = listHobbiesQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await ensureMembership(app, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.HobbyWhereInput = {
      householdId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {})
    };

    const limit = query.limit ?? 50;

    const hobbies = await app.prisma.hobby.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        _count: {
          select: {
            recipes: true,
            sessions: true,
            assetLinks: true,
            inventoryLinks: true,
          }
        },
        sessions: {
          select: { status: true }
        }
      }
    });

    const hasMore = hobbies.length > limit;
    const items = hasMore ? hobbies.slice(0, limit) : hobbies;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return reply.send({
      items: items.map(toHobbySummaryResponse),
      nextCursor,
    });
  });

  // POST /v1/households/:householdId/hobbies
  app.post("/v1/households/:householdId/hobbies", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = createHobbyInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await ensureMembership(app, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.create({
      data: {
        householdId,
        createdById: userId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "active",
        hobbyType: input.hobbyType ?? null,
        lifecycleMode: input.lifecycleMode ?? "binary",
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        fieldDefinitions: (input.fieldDefinitions ?? []) as Prisma.InputJsonValue,
        notes: input.notes ?? null,
      }
    });

    if (input.presetKey) {
      const preset = findHobbyPreset(input.presetKey);
      if (preset) {
        const definition = hobbyPresetToDefinition(preset);
        await applyHobbyPreset(app.prisma, hobby.id, definition);
      }
    }

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_created",
      entityType: "hobby",
      entityId: hobby.id,
    });

    await syncHobbyToSearchIndex(app.prisma, hobby.id);

    return reply.code(201).send(toHobbyResponse(hobby));
  });

  // GET /v1/households/:householdId/hobbies/:hobbyId
  app.get("/v1/households/:householdId/hobbies/:hobbyId", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await ensureMembership(app, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId },
      include: {
        assetLinks: {
          include: {
            asset: { select: { id: true, name: true, category: true } }
          }
        },
        inventoryLinks: {
          include: {
            inventoryItem: { select: { id: true, name: true, quantityOnHand: true, unit: true } }
          }
        },
        projectLinks: {
          include: {
            project: { select: { id: true, name: true, status: true } }
          }
        },
        metricDefinitions: { orderBy: { name: "asc" } },
        statusPipeline: { orderBy: { sortOrder: "asc" } },
        inventoryCategories: { orderBy: { sortOrder: "asc" } },
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            completedDate: true,
            createdAt: true,
            recipe: { select: { id: true, name: true } },
          }
        },
        _count: {
          select: { recipes: true, sessions: true }
        }
      }
    });

    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    return reply.send({
      ...toHobbyResponse(hobby),
      assetLinks: hobby.assetLinks.map((link) => ({
        id: link.id,
        hobbyId: link.hobbyId,
        assetId: link.assetId,
        role: link.role,
        notes: link.notes,
        asset: link.asset,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      })),
      inventoryLinks: hobby.inventoryLinks.map((link) => ({
        id: link.id,
        hobbyId: link.hobbyId,
        inventoryItemId: link.inventoryItemId,
        notes: link.notes,
        inventoryItem: link.inventoryItem,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      })),
      projectLinks: hobby.projectLinks.map((link) => ({
        id: link.id,
        hobbyId: link.hobbyId,
        projectId: link.projectId,
        notes: link.notes,
        project: link.project,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      })),
      metricDefinitions: hobby.metricDefinitions.map((m) => ({
        id: m.id,
        hobbyId: m.hobbyId,
        name: m.name,
        unit: m.unit,
        description: m.description,
        metricType: m.metricType,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      statusPipeline: hobby.statusPipeline.map((s) => ({
        id: s.id,
        hobbyId: s.hobbyId,
        label: s.label,
        sortOrder: s.sortOrder,
        color: s.color,
        isFinal: s.isFinal,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      inventoryCategories: hobby.inventoryCategories.map((c) => ({
        id: c.id,
        hobbyId: c.hobbyId,
        categoryName: c.categoryName,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      recentSessions: hobby.sessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startDate: s.startDate?.toISOString() ?? null,
        completedDate: s.completedDate?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        recipeName: s.recipe?.name ?? null,
      })),
      recipeCount: hobby._count.recipes,
      sessionCount: hobby._count.sessions,
    });
  });

  // PATCH /v1/households/:householdId/hobbies/:hobbyId
  app.patch("/v1/households/:householdId/hobbies/:hobbyId", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = updateHobbyInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await ensureMembership(app, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const hobby = await app.prisma.hobby.update({
      where: { id: hobbyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.hobbyType !== undefined ? { hobbyType: input.hobbyType } : {}),
        ...(input.lifecycleMode !== undefined ? { lifecycleMode: input.lifecycleMode } : {}),
        ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
        ...(input.fieldDefinitions !== undefined ? { fieldDefinitions: input.fieldDefinitions as Prisma.InputJsonValue } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      }
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_updated",
      entityType: "hobby",
      entityId: hobby.id,
    });

    await syncHobbyToSearchIndex(app.prisma, hobby.id);

    return reply.send(toHobbyResponse(hobby));
  });

  // DELETE /v1/households/:householdId/hobbies/:hobbyId
  app.delete("/v1/households/:householdId/hobbies/:hobbyId", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await ensureMembership(app, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    await app.prisma.hobby.delete({ where: { id: hobbyId } });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_deleted",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { name: existing.name },
    });

    await removeSearchIndexEntry(app.prisma, "hobby", hobbyId);

    return reply.code(204).send();
  });
};
