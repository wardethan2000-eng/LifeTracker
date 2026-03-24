import type { Prisma } from "@prisma/client";
import {
  createHobbyInputSchema,
  hobbyActivityModeSchema,
  updateHobbyInputSchema,
  hobbyStatusSchema,
  reorderByOrderedIdsSchema,
  type HobbyStatusPipelineStepInput
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
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
  activityMode: hobbyActivityModeSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const normalizeStatusPipeline = (
  pipeline: HobbyStatusPipelineStepInput[]
): Array<{
  id?: string;
  label: string;
  description: string | null;
  instructions: string | null;
  futureNotes: string | null;
  fieldDefinitions: Prisma.InputJsonValue;
  checklistTemplates: Prisma.InputJsonValue;
  supplyTemplates: Prisma.InputJsonValue;
  sortOrder: number;
  color: string | null;
  isFinal: boolean;
}> => {
  const normalized = pipeline
    .map((step, index) => ({
      ...(step.id ? { id: step.id } : {}),
      label: step.label.trim(),
      description: step.description?.trim() ? step.description.trim() : null,
      instructions: step.instructions?.trim() ? step.instructions.trim() : null,
      futureNotes: step.futureNotes?.trim() ? step.futureNotes.trim() : null,
      fieldDefinitions: (step.fieldDefinitions ?? []).map((field, fieldIndex) => ({
        ...field,
        order: field.order ?? fieldIndex,
      })) as Prisma.InputJsonValue,
      checklistTemplates: (step.checklistTemplates ?? [])
        .map((item, itemIndex) => ({
          ...item,
          title: item.title.trim(),
          sortOrder: item.sortOrder ?? itemIndex,
        }))
        .filter((item) => item.title.length > 0) as Prisma.InputJsonValue,
      supplyTemplates: (step.supplyTemplates ?? [])
        .map((item, itemIndex) => ({
          ...item,
          inventoryItemId: item.inventoryItemId ?? null,
          name: item.name.trim(),
          notes: item.notes?.trim() ? item.notes.trim() : null,
          sortOrder: item.sortOrder ?? itemIndex,
          isRequired: item.isRequired ?? true,
        }))
        .filter((item) => item.name.length > 0) as Prisma.InputJsonValue,
      sortOrder: step.sortOrder ?? index,
      color: step.color?.trim() ? step.color.trim() : null,
      isFinal: step.isFinal ?? false,
    }))
    .filter((step) => step.label.length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((step, index) => ({
      ...step,
      sortOrder: index,
    }));

  if (normalized.length === 0) {
    return [];
  }

  let finalIndex = -1;
  normalized.forEach((step, index) => {
    if (step.isFinal) {
      finalIndex = index;
    }
  });

  if (finalIndex === -1) {
    finalIndex = normalized.length - 1;
  }

  return normalized.map((step, index) => ({
    ...step,
    isFinal: index === finalIndex,
  }));
};

const syncHobbyStatusPipeline = async (
  prisma: Prisma.TransactionClient,
  hobbyId: string,
  pipeline: HobbyStatusPipelineStepInput[]
): Promise<void> => {
  const normalized = normalizeStatusPipeline(pipeline);
  const existingSteps = await prisma.hobbySessionStatusStep.findMany({
    where: { hobbyId },
    select: { id: true },
  });
  const existingIds = new Set(existingSteps.map((step) => step.id));
  const retainedIds = new Set<string>();

  for (const step of normalized) {
    if (step.id && existingIds.has(step.id)) {
      retainedIds.add(step.id);
      await prisma.hobbySessionStatusStep.update({
        where: { id: step.id },
        data: {
          label: step.label,
          description: step.description,
          instructions: step.instructions,
          futureNotes: step.futureNotes,
          fieldDefinitions: step.fieldDefinitions,
          checklistTemplates: step.checklistTemplates,
          supplyTemplates: step.supplyTemplates,
          sortOrder: step.sortOrder,
          color: step.color,
          isFinal: step.isFinal,
        }
      });
    }
  }

  const removedIds = existingSteps
    .filter((step) => !retainedIds.has(step.id))
    .map((step) => step.id);

  if (removedIds.length > 0) {
    await prisma.hobbySession.updateMany({
      where: {
        hobbyId,
        pipelineStepId: { in: removedIds },
      },
      data: { pipelineStepId: null },
    });

    await prisma.hobbySessionStatusStep.deleteMany({
      where: {
        hobbyId,
        id: { in: removedIds },
      }
    });
  }

  const newSteps = normalized.filter((step) => !step.id || !existingIds.has(step.id));

  if (newSteps.length > 0) {
    await prisma.hobbySessionStatusStep.createMany({
      data: newSteps.map((step) => ({
        hobbyId,
        label: step.label,
        description: step.description,
        instructions: step.instructions,
        futureNotes: step.futureNotes,
        fieldDefinitions: step.fieldDefinitions,
        checklistTemplates: step.checklistTemplates,
        supplyTemplates: step.supplyTemplates,
        sortOrder: step.sortOrder,
        color: step.color,
        isFinal: step.isFinal,
      }))
    });
  }
};

export const hobbyRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/hobbies
  app.get("/v1/households/:householdId/hobbies", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = listHobbiesQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const where: Prisma.HobbyWhereInput = {
      householdId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.activityMode ? { activityMode: query.activityMode } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...cursorWhere(query.cursor)
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

    const { items, nextCursor } = buildCursorPage(hobbies, limit);

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

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await app.prisma.$transaction(async (prisma) => {
      const createdHobby = await prisma.hobby.create({
        data: {
          householdId,
          createdById: userId,
          name: input.name,
          description: input.description ?? null,
          status: input.status ?? "active",
          activityMode: input.activityMode ?? "session",
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
          if (input.statusPipeline !== undefined) {
            definition.pipeline = normalizeStatusPipeline(input.statusPipeline).map((step) => ({
              ...(step.id ? { id: step.id } : {}),
              label: step.label,
              ...(step.description ? { description: step.description } : {}),
              ...(step.instructions ? { instructions: step.instructions } : {}),
              ...(step.futureNotes ? { futureNotes: step.futureNotes } : {}),
              fieldDefinitions: step.fieldDefinitions as unknown[],
              checklistTemplates: (step.checklistTemplates as Array<{ title: string; sortOrder?: number }>).map((item) => ({
                title: item.title,
                ...(item.sortOrder != null ? { sortOrder: item.sortOrder } : {}),
              })),
              supplyTemplates: (step.supplyTemplates as Array<{ inventoryItemId?: string | null; name: string; quantityNeeded: number; unit: string; isRequired?: boolean; notes?: string | null; sortOrder?: number }>).map((item) => ({
                name: item.name,
                quantityNeeded: item.quantityNeeded,
                unit: item.unit,
                ...(item.inventoryItemId != null ? { inventoryItemId: item.inventoryItemId } : {}),
                ...(item.isRequired != null ? { isRequired: item.isRequired } : {}),
                ...(item.notes != null ? { notes: item.notes } : {}),
                ...(item.sortOrder != null ? { sortOrder: item.sortOrder } : {}),
              })),
              sortOrder: step.sortOrder,
              ...(step.color ? { color: step.color } : {}),
              isFinal: step.isFinal,
            }));
          }
          await applyHobbyPreset(prisma, createdHobby.id, definition);
        }
      } else if (input.statusPipeline !== undefined && input.statusPipeline.length > 0) {
        await syncHobbyStatusPipeline(prisma, createdHobby.id, input.statusPipeline);
      }

      return createdHobby;
    });

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

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
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
        description: s.description,
        instructions: s.instructions,
        futureNotes: s.futureNotes,
        fieldDefinitions: s.fieldDefinitions as unknown[],
        checklistTemplates: s.checklistTemplates as Array<{ id?: string; title: string; sortOrder?: number }>,
        supplyTemplates: s.supplyTemplates as Array<{ id?: string; inventoryItemId?: string | null; name: string; quantityNeeded: number; unit: string; isRequired?: boolean; notes?: string | null; sortOrder?: number }>,
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

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId },
      include: {
        statusPipeline: {
          select: { id: true },
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const hobby = await app.prisma.$transaction(async (prisma) => {
      const updatedHobby = await prisma.hobby.update({
        where: { id: hobbyId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.activityMode !== undefined ? { activityMode: input.activityMode } : {}),
          ...(input.hobbyType !== undefined ? { hobbyType: input.hobbyType } : {}),
          ...(input.lifecycleMode !== undefined ? { lifecycleMode: input.lifecycleMode } : {}),
          ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
          ...(input.fieldDefinitions !== undefined ? { fieldDefinitions: input.fieldDefinitions as Prisma.InputJsonValue } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        }
      });

      if (input.statusPipeline !== undefined) {
        await syncHobbyStatusPipeline(prisma, hobbyId, input.statusPipeline);
      }

      return updatedHobby;
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

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
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

  // PATCH /v1/households/:householdId/hobbies/:hobbyId/workflow-stages/reorder
  app.patch("/v1/households/:householdId/hobbies/:hobbyId/workflow-stages/reorder", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const { orderedIds } = reorderByOrderedIdsSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });

    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found." });
    }

    const existing = await app.prisma.hobbySessionStatusStep.findMany({
      where: { hobbyId },
      select: { id: true }
    });

    if (existing.length !== orderedIds.length || existing.some((s) => !orderedIds.includes(s.id))) {
      return reply.code(400).send({ message: "orderedIds must include every workflow stage exactly once." });
    }

    await app.prisma.$transaction(
      orderedIds.map((id, index) =>
        app.prisma.hobbySessionStatusStep.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return reply.send({ orderedIds });
  });
};

