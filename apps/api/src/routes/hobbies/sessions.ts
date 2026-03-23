import type { Prisma } from "@prisma/client";
import {
  createHobbySessionInputSchema,
  updateHobbySessionInputSchema,
  createHobbySessionIngredientInputSchema,
  updateHobbySessionIngredientInputSchema,
  createHobbySessionStepInputSchema,
  updateHobbySessionStepInputSchema,
  createHobbySessionStageChecklistItemInputSchema,
  updateHobbySessionStageChecklistItemInputSchema,
  updateHobbySessionStageInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { recalculatePracticeGoalsForHobby, recalculatePracticeRoutine } from "../../lib/hobby-practice.js";
import { syncHobbySeriesBatchCount } from "../../lib/hobby-series.js";
import { applyInventoryTransaction } from "../../lib/inventory.js";
import { syncEntryToSearchIndex, syncHobbySeriesToSearchIndex } from "../../lib/search-index.js";
import {
  toEntryAsHobbyLog,
  toSessionIngredientResponse,
  toSessionResponse,
  toSessionStepResponse,
  toSessionSummaryResponse
} from "../../lib/serializers/index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

const sessionParamsSchema = hobbyParamsSchema.extend({
  sessionId: z.string().cuid()
});

const sessionIngredientParamsSchema = sessionParamsSchema.extend({
  ingredientId: z.string().cuid()
});

const sessionStepParamsSchema = sessionParamsSchema.extend({
  stepId: z.string().cuid()
});

const sessionStageParamsSchema = sessionParamsSchema.extend({
  stageId: z.string().cuid()
});

const sessionStageChecklistParamsSchema = sessionStageParamsSchema.extend({
  checklistItemId: z.string().cuid()
});

const listSessionsQuerySchema = z.object({
  status: z.string().optional(),
  recipeId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const reorderStepsBodySchema = z.object({
  stepIds: z.array(z.string().cuid())
});

const validateRoutineForHobby = async (
  prisma: { hobbyPracticeRoutine: { findFirst: Function } },
  householdId: string,
  hobbyId: string,
  routineId: string | null | undefined,
) => {
  if (!routineId) {
    return null;
  }

  return prisma.hobbyPracticeRoutine.findFirst({
    where: { id: routineId, hobbyId, householdId },
    select: { id: true },
  });
};

const validateCollectionItemForHobby = async (
  prisma: { hobbyCollectionItem: { findFirst: Function } },
  householdId: string,
  hobbyId: string,
  collectionItemId: string | null | undefined,
) => {
  if (!collectionItemId) {
    return null;
  }

  return prisma.hobbyCollectionItem.findFirst({
    where: { id: collectionItemId, hobbyId, householdId },
    select: { id: true },
  });
};

const syncSessionIngredientInventory = async (
  tx: Prisma.TransactionClient,
  options: {
    existingInventoryItemId: string | null;
    nextInventoryItemId: string | null;
    existingQuantityUsed: number;
    nextQuantityUsed: number;
    userId: string;
    sessionId: string;
    sessionName: string;
  }
) => {
  const {
    existingInventoryItemId,
    nextInventoryItemId,
    existingQuantityUsed,
    nextQuantityUsed,
    userId,
    sessionId,
    sessionName
  } = options;

  if (existingInventoryItemId && nextInventoryItemId && existingInventoryItemId !== nextInventoryItemId) {
    await applyInventoryTransaction(tx, {
      inventoryItemId: existingInventoryItemId,
      userId,
      input: {
        type: "adjust",
        quantity: existingQuantityUsed,
        referenceType: "hobby_session",
        referenceId: sessionId,
        notes: `Ingredient reassigned for hobby session: ${sessionName}`,
      },
      clampToZero: false,
    });

    await applyInventoryTransaction(tx, {
      inventoryItemId: nextInventoryItemId,
      userId,
      input: {
        type: "consume",
        quantity: -nextQuantityUsed,
        referenceType: "hobby_session",
        referenceId: sessionId,
        notes: `Consumed for hobby session: ${sessionName}`,
      },
      clampToZero: true,
    });

    return;
  }

  if (existingInventoryItemId && nextInventoryItemId === null) {
    await applyInventoryTransaction(tx, {
      inventoryItemId: existingInventoryItemId,
      userId,
      input: {
        type: "adjust",
        quantity: existingQuantityUsed,
        referenceType: "hobby_session",
        referenceId: sessionId,
        notes: `Ingredient removed from hobby session: ${sessionName}`,
      },
      clampToZero: false,
    });

    return;
  }

  if (!existingInventoryItemId && nextInventoryItemId) {
    await applyInventoryTransaction(tx, {
      inventoryItemId: nextInventoryItemId,
      userId,
      input: {
        type: "consume",
        quantity: -nextQuantityUsed,
        referenceType: "hobby_session",
        referenceId: sessionId,
        notes: `Consumed for hobby session: ${sessionName}`,
      },
      clampToZero: true,
    });

    return;
  }

  if (!nextInventoryItemId) {
    return;
  }

  const delta = existingQuantityUsed - nextQuantityUsed;

  if (delta === 0) {
    return;
  }

  await applyInventoryTransaction(tx, {
    inventoryItemId: nextInventoryItemId,
    userId,
    input: {
      type: "adjust",
      quantity: delta,
      referenceType: "hobby_session",
      referenceId: sessionId,
      notes: `Ingredient quantity adjusted for hobby session: ${sessionName}`,
    },
    clampToZero: true,
  });
};

const cloneWorkflowStagesToSession = async (
  tx: Prisma.TransactionClient,
  options: {
    sessionId: string;
    stages: Array<{
      id: string;
      label: string;
      description: string | null;
      instructions: string | null;
      futureNotes: string | null;
      fieldDefinitions: Prisma.JsonValue;
      checklistTemplates: Prisma.JsonValue;
      supplyTemplates: Prisma.JsonValue;
      sortOrder: number;
    }>;
    startedAt: Date | null;
  }
): Promise<void> => {
  const { sessionId, stages, startedAt } = options;

  for (const [index, stage] of stages.entries()) {
    const createdStage = await tx.hobbySessionStage.create({
      data: {
        sessionId,
        stageTemplateId: stage.id,
        name: stage.label,
        description: stage.description,
        instructions: stage.instructions,
        futureNotes: stage.futureNotes,
        fieldDefinitions: (stage.fieldDefinitions ?? []) as Prisma.InputJsonValue,
        sortOrder: stage.sortOrder,
        startedAt: index === 0 ? startedAt : null,
      }
    });

    const checklistTemplates = Array.isArray(stage.checklistTemplates) ? stage.checklistTemplates as Array<{ title?: string; sortOrder?: number }> : [];
    if (checklistTemplates.length > 0) {
      await tx.hobbySessionStageChecklistItem.createMany({
        data: checklistTemplates
          .filter((item) => item.title?.trim())
          .map((item, checklistIndex) => ({
            sessionStageId: createdStage.id,
            title: item.title!.trim(),
            sortOrder: item.sortOrder ?? checklistIndex,
          }))
      });
    }

    const supplyTemplates = Array.isArray(stage.supplyTemplates) ? stage.supplyTemplates as Array<{
      inventoryItemId?: string | null;
      name?: string;
      quantityNeeded?: number;
      unit?: string;
      isRequired?: boolean;
      notes?: string | null;
      sortOrder?: number;
    }> : [];

    if (supplyTemplates.length > 0) {
      await tx.hobbySessionStageSupply.createMany({
        data: supplyTemplates
          .filter((item) => item.name?.trim() && item.quantityNeeded != null && item.unit?.trim())
          .map((item, supplyIndex) => ({
            sessionStageId: createdStage.id,
            inventoryItemId: item.inventoryItemId ?? null,
            name: item.name!.trim(),
            quantityNeeded: item.quantityNeeded!,
            unit: item.unit!.trim(),
            isRequired: item.isRequired ?? true,
            notes: item.notes?.trim() ? item.notes.trim() : null,
            sortOrder: item.sortOrder ?? supplyIndex,
          }))
      });
    }
  }
};

const serializeSessionStages = (stages: Array<{
  id: string;
  sessionId: string;
  stageTemplateId: string | null;
  name: string;
  description: string | null;
  instructions: string | null;
  futureNotes: string | null;
  fieldDefinitions: Prisma.JsonValue;
  sortOrder: number;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  customFieldValues: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  checklistItems: Array<{
    id: string;
    sessionStageId: string;
    title: string;
    sortOrder: number;
    isCompleted: boolean;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  supplies: Array<{
    id: string;
    sessionStageId: string;
    inventoryItemId: string | null;
    name: string;
    quantityNeeded: number;
    unit: string;
    isRequired: boolean;
    notes: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem: { id: string; name: string; unit: string; quantityOnHand: number } | null;
  }>;
}>) => stages.map((stage) => ({
  id: stage.id,
  sessionId: stage.sessionId,
  stageTemplateId: stage.stageTemplateId,
  name: stage.name,
  description: stage.description,
  instructions: stage.instructions,
  futureNotes: stage.futureNotes,
  fieldDefinitions: Array.isArray(stage.fieldDefinitions) ? stage.fieldDefinitions as unknown[] : [],
  sortOrder: stage.sortOrder,
  startedAt: stage.startedAt?.toISOString() ?? null,
  completedAt: stage.completedAt?.toISOString() ?? null,
  notes: stage.notes,
  customFieldValues: stage.customFieldValues as Record<string, unknown>,
  createdAt: stage.createdAt.toISOString(),
  updatedAt: stage.updatedAt.toISOString(),
  checklistItems: stage.checklistItems.map((item) => ({
    id: item.id,
    sessionStageId: item.sessionStageId,
    title: item.title,
    sortOrder: item.sortOrder,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt?.toISOString() ?? null,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  })),
  supplies: stage.supplies.map((supply) => ({
    id: supply.id,
    sessionStageId: supply.sessionStageId,
    inventoryItemId: supply.inventoryItemId,
    name: supply.name,
    quantityNeeded: supply.quantityNeeded,
    unit: supply.unit,
    isRequired: supply.isRequired,
    notes: supply.notes,
    sortOrder: supply.sortOrder,
    createdAt: supply.createdAt.toISOString(),
    updatedAt: supply.updatedAt.toISOString(),
    inventoryItem: supply.inventoryItem,
    hasSufficientInventory: supply.inventoryItem ? supply.inventoryItem.quantityOnHand >= supply.quantityNeeded : false,
  })),
}));

export const hobbySessionRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/sessions";

  // GET .../sessions
  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = listSessionsQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.HobbySessionWhereInput = {
      hobbyId,
      hobby: { householdId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.recipeId ? { recipeId: query.recipeId } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {})
    };

    const limit = query.limit ?? 50;

    const sessions = await app.prisma.hobbySession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        recipe: { select: { name: true } },
        _count: {
          select: {
            ingredients: true,
            steps: true,
            metricReadings: true
          }
        },
        steps: { select: { isCompleted: true } }
      }
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    // Batch-fetch log counts from Entry (previously from HobbyLog)
    const sessionIds = items.map((s) => s.id);
    const logCountRows = sessionIds.length > 0
      ? await app.prisma.entry.groupBy({
          by: ["entityId"],
          where: { entityType: "hobby_session", entityId: { in: sessionIds } },
          _count: { id: true }
        })
      : [];
    const logCountMap = new Map(logCountRows.map((r) => [r.entityId, r._count.id]));

    return reply.send({
      items: items.map((s) => toSessionSummaryResponse({
        ...s,
        _count: { ...s._count, logs: logCountMap.get(s.id) ?? 0 }
      })),
      nextCursor,
    });
  });

  // POST .../sessions
  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbySessionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId },
      include: {
        statusPipeline: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    if (input.routineId && !await validateRoutineForHobby(app.prisma, householdId, hobbyId, input.routineId)) {
      return reply.code(400).send({ message: "Routine must belong to this hobby." });
    }

    if (input.collectionItemId && !await validateCollectionItemForHobby(app.prisma, householdId, hobbyId, input.collectionItemId)) {
      return reply.code(400).send({ message: "Collection item must belong to this hobby." });
    }

    let createdEntryIds: string[] = [];
    const session = await app.prisma.$transaction(async (tx) => {
      let initialStatus = input.status ?? (input.completedDate ? "completed" : "active");
      let pipelineStepId: string | null = null;

      if (hobby.lifecycleMode === "pipeline" && hobby.statusPipeline.length > 0) {
        const firstStep = hobby.statusPipeline[0]!;
        initialStatus = firstStep.label;
        pipelineStepId = firstStep.id;
      }

      let customFields = (input.customFields ?? {}) as Prisma.InputJsonValue;

      const created = await tx.hobbySession.create({
        data: {
          hobbyId,
          recipeId: input.recipeId ?? null,
          routineId: input.routineId ?? null,
          collectionItemId: input.collectionItemId ?? null,
          name: input.name,
          status: initialStatus,
          startDate: input.startDate ? new Date(input.startDate) : null,
          completedDate: input.completedDate ? new Date(input.completedDate) : initialStatus === "completed" ? new Date() : null,
          durationMinutes: input.durationMinutes ?? null,
          pipelineStepId,
          customFields,
          totalCost: input.totalCost ?? null,
          notes: input.notes ?? null,
        }
      });

      if (hobby.lifecycleMode === "pipeline" && hobby.statusPipeline.length > 0) {
        await cloneWorkflowStagesToSession(tx, {
          sessionId: created.id,
          stages: hobby.statusPipeline,
          startedAt: created.startDate ?? created.createdAt,
        });
      }

      // Clone from recipe if provided
      if (input.recipeId) {
        const recipe = await tx.hobbyRecipe.findUnique({
          where: { id: input.recipeId },
          include: {
            ingredients: { orderBy: { sortOrder: "asc" } },
            steps: { orderBy: { sortOrder: "asc" } }
          }
        });

        if (recipe) {
          if (recipe.ingredients.length > 0) {
            await tx.hobbySessionIngredient.createMany({
              data: recipe.ingredients.map((ing) => ({
                sessionId: created.id,
                recipeIngredientId: ing.id,
                inventoryItemId: ing.inventoryItemId,
                name: ing.name,
                quantityUsed: ing.quantity,
                unit: ing.unit,
                notes: ing.notes,
              }))
            });

            for (const ingredient of recipe.ingredients) {
              await syncSessionIngredientInventory(tx, {
                existingInventoryItemId: null,
                nextInventoryItemId: ingredient.inventoryItemId,
                existingQuantityUsed: 0,
                nextQuantityUsed: ingredient.quantity,
                userId,
                sessionId: created.id,
                sessionName: created.name,
              });
            }
          }

          if (recipe.steps.length > 0) {
            await tx.hobbySessionStep.createMany({
              data: recipe.steps.map((step) => ({
                sessionId: created.id,
                recipeStepId: step.id,
                title: step.title,
                description: step.description,
                sortOrder: step.sortOrder,
                durationMinutes: step.durationMinutes,
              }))
            });
          }

          // Copy recipe custom fields as session starting values
          if (recipe.customFields && typeof recipe.customFields === "object") {
            await tx.hobbySession.update({
              where: { id: created.id },
              data: {
                customFields: {
                  ...(recipe.customFields as Record<string, unknown>),
                  ...(input.customFields ?? {})
                } as Prisma.InputJsonValue
              }
            });
          }
        }
      }

      createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
      if (created.routineId) {
        await recalculatePracticeRoutine(tx, created.routineId);
      }

      return tx.hobbySession.findUniqueOrThrow({
        where: { id: created.id }
      });
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_session_created",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { sessionId: session.id, sessionName: session.name },
    });

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));

    return reply.code(201).send(toSessionResponse(session));
  });

  // GET .../sessions/:sessionId
  app.get(`${BASE}/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } },
      include: {
        recipe: { select: { id: true, name: true } },
        stages: {
          orderBy: { sortOrder: "asc" },
          include: {
            checklistItems: { orderBy: { sortOrder: "asc" } },
            supplies: {
              orderBy: { sortOrder: "asc" },
              include: {
                inventoryItem: { select: { id: true, name: true, unit: true, quantityOnHand: true } }
              }
            }
          }
        },
        ingredients: {
          orderBy: { createdAt: "asc" },
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true, quantityOnHand: true } }
          }
        },
        steps: {
          orderBy: { sortOrder: "asc" },
          include: {
            recipeStep: { select: { stepType: true } }
          }
        },
        metricReadings: {
          orderBy: { readingDate: "desc" },
          include: {
            metricDefinition: { select: { name: true, unit: true } }
          }
        }
      }
    });

    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    // Fetch logs from Entry (previously from HobbyLog)
    const sessionLogEntries = await app.prisma.entry.findMany({
      where: { householdId, entityType: "hobby_session", entityId: sessionId },
      orderBy: { entryDate: "desc" }
    });

    return reply.send({
      ...toSessionResponse(session),
      recipeName: session.recipe?.name ?? null,
      stages: serializeSessionStages(session.stages),
      ingredients: session.ingredients.map((ing) => ({
        ...toSessionIngredientResponse(ing),
        inventoryItem: ing.inventoryItem,
      })),
      steps: session.steps.map((step) => toSessionStepResponse({
        ...step,
        stepType: step.recipeStep?.stepType ?? "generic",
      })),
      metricReadings: session.metricReadings.map((r) => ({
        id: r.id,
        metricDefinitionId: r.metricDefinitionId,
        sessionId: r.sessionId,
        value: r.value,
        readingDate: r.readingDate.toISOString(),
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        metricName: r.metricDefinition.name,
        metricUnit: r.metricDefinition.unit,
      })),
      logs: sessionLogEntries.map((entry) => toEntryAsHobbyLog(entry, hobbyId)),
    });
  });

  // PATCH .../sessions/:sessionId
  app.patch(`${BASE}/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const input = updateHobbySessionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const nextRoutineId = input.routineId === undefined ? existing.routineId : input.routineId;
    const nextCollectionItemId = input.collectionItemId === undefined ? existing.collectionItemId : input.collectionItemId;

    if (nextRoutineId && !await validateRoutineForHobby(app.prisma, householdId, hobbyId, nextRoutineId)) {
      return reply.code(400).send({ message: "Routine must belong to this hobby." });
    }

    if (nextCollectionItemId && !await validateCollectionItemForHobby(app.prisma, householdId, hobbyId, nextCollectionItemId)) {
      return reply.code(400).send({ message: "Collection item must belong to this hobby." });
    }

    const data: Prisma.HobbySessionUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.totalCost !== undefined) data.totalCost = input.totalCost;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.completedDate !== undefined) data.completedDate = input.completedDate ? new Date(input.completedDate) : null;
    if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
    if (input.customFields !== undefined) data.customFields = input.customFields as Prisma.InputJsonValue;
    if (input.routineId !== undefined) {
      data.routine = input.routineId === null
        ? { disconnect: true }
        : { connect: { id: input.routineId } };
    }

    if (input.collectionItemId !== undefined) {
      data.collectionItem = input.collectionItemId === null
        ? { disconnect: true }
        : { connect: { id: input.collectionItemId } };
    }

    if (input.status !== undefined) {
      // Validate pipeline status if in pipeline mode
      const hobby = await app.prisma.hobby.findUnique({
        where: { id: hobbyId },
        include: { statusPipeline: true }
      });

      if (hobby?.lifecycleMode === "pipeline") {
        const step = hobby.statusPipeline.find((s) => s.label === input.status);
        if (!step) {
          return reply.code(400).send({ message: "Invalid pipeline status" });
        }
        data.status = input.status;
        data.pipelineStepId = step.id;
        if (step.isFinal) {
          data.completedDate = new Date();
        }
      } else {
        data.status = input.status;
        if (input.status === "completed") {
          data.completedDate = new Date();
        } else if (input.completedDate === undefined) {
          data.completedDate = null;
        }
      }
    }

    let createdEntryIds: string[] = [];
    const session = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.hobbySession.update({
        where: { id: sessionId },
        data,
      });

      createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
      const affectedRoutineIds = Array.from(new Set([existing.routineId, updated.routineId].filter((routineId): routineId is string => Boolean(routineId))));
      for (const routineId of affectedRoutineIds) {
        await recalculatePracticeRoutine(tx, routineId);
      }

      return updated;
    });

    if (session.seriesId) {
      await syncHobbySeriesToSearchIndex(app.prisma, session.seriesId);
    }

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));

    if (input.status === "completed" || (existing.status !== "completed" && session.status === "completed")) {
      await logActivity(app.prisma, {
        householdId,
        userId,
        action: "hobby_session_completed",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { sessionId, sessionName: session.name },
      });
    }

    return reply.send(toSessionResponse(session));
  });

  // POST .../sessions/:sessionId/advance
  app.post(`${BASE}/:sessionId/advance`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId },
      include: { statusPipeline: { orderBy: { sortOrder: "asc" } } }
    });

    if (!hobby || hobby.lifecycleMode !== "pipeline") {
      return reply.code(400).send({ message: "Hobby is not in pipeline mode" });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId }
    });
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const currentIndex = hobby.statusPipeline.findIndex((s) => s.id === session.pipelineStepId);
    if (currentIndex === -1 || currentIndex >= hobby.statusPipeline.length - 1) {
      return reply.code(400).send({ message: "Session is already at the final step" });
    }

    const nextStep = hobby.statusPipeline[currentIndex + 1]!;

    const updated = await app.prisma.hobbySession.update({
      where: { id: sessionId },
      data: {
        status: nextStep.label,
        pipelineStepId: nextStep.id,
        ...(nextStep.isFinal ? { completedDate: new Date() } : {}),
      }
    });

    const stageInstances = await app.prisma.hobbySessionStage.findMany({
      where: { sessionId },
      select: { id: true, stageTemplateId: true, startedAt: true, completedAt: true },
    });

    const currentStage = stageInstances.find((stage) => stage.stageTemplateId === session.pipelineStepId);
    const nextStageInstance = stageInstances.find((stage) => stage.stageTemplateId === nextStep.id);

    if (currentStage && !currentStage.completedAt) {
      await app.prisma.hobbySessionStage.update({
        where: { id: currentStage.id },
        data: { completedAt: new Date() }
      });
    }

    if (nextStageInstance && !nextStageInstance.startedAt) {
      await app.prisma.hobbySessionStage.update({
        where: { id: nextStageInstance.id },
        data: { startedAt: new Date() }
      });
    }

    if (updated.seriesId) {
      await syncHobbySeriesToSearchIndex(app.prisma, updated.seriesId);
    }

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_session_advanced",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { sessionId, newStatus: nextStep.label },
    });

    return reply.send(toSessionResponse(updated));
  });

  // PATCH .../sessions/:sessionId/stages/:stageId
  app.patch(`${BASE}/:sessionId/stages/:stageId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, stageId } = sessionStageParamsSchema.parse(request.params);
    const input = updateHobbySessionStageInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionStage.findFirst({
      where: {
        id: stageId,
        sessionId,
        session: { hobbyId, hobby: { householdId } },
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Session stage not found" });
    }

    const updated = await app.prisma.hobbySessionStage.update({
      where: { id: stageId },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.startedAt !== undefined ? { startedAt: input.startedAt ? new Date(input.startedAt) : null } : {}),
        ...(input.completedAt !== undefined ? { completedAt: input.completedAt ? new Date(input.completedAt) : null } : {}),
        ...(input.customFieldValues !== undefined ? { customFieldValues: input.customFieldValues as Prisma.InputJsonValue } : {}),
      },
      include: {
        checklistItems: { orderBy: { sortOrder: "asc" } },
        supplies: {
          orderBy: { sortOrder: "asc" },
          include: { inventoryItem: { select: { id: true, name: true, unit: true, quantityOnHand: true } } }
        }
      }
    });

    return reply.send(serializeSessionStages([updated])[0]);
  });

  // POST .../sessions/:sessionId/stages/:stageId/checklists
  app.post(`${BASE}/:sessionId/stages/:stageId/checklists`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, stageId } = sessionStageParamsSchema.parse(request.params);
    const input = createHobbySessionStageChecklistItemInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const stage = await app.prisma.hobbySessionStage.findFirst({
      where: { id: stageId, sessionId, session: { hobbyId, hobby: { householdId } } }
    });

    if (!stage) {
      return reply.code(404).send({ message: "Session stage not found" });
    }

    const maxSort = await app.prisma.hobbySessionStageChecklistItem.aggregate({
      where: { sessionStageId: stageId },
      _max: { sortOrder: true }
    });

    const checklistItem = await app.prisma.hobbySessionStageChecklistItem.create({
      data: {
        sessionStageId: stageId,
        title: input.title,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
      }
    });

    return reply.code(201).send({
      id: checklistItem.id,
      sessionStageId: checklistItem.sessionStageId,
      title: checklistItem.title,
      sortOrder: checklistItem.sortOrder,
      isCompleted: checklistItem.isCompleted,
      completedAt: checklistItem.completedAt?.toISOString() ?? null,
      notes: checklistItem.notes,
      createdAt: checklistItem.createdAt.toISOString(),
      updatedAt: checklistItem.updatedAt.toISOString(),
    });
  });

  // PATCH .../sessions/:sessionId/stages/:stageId/checklists/:checklistItemId
  app.patch(`${BASE}/:sessionId/stages/:stageId/checklists/:checklistItemId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, stageId, checklistItemId } = sessionStageChecklistParamsSchema.parse(request.params);
    const input = updateHobbySessionStageChecklistItemInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionStageChecklistItem.findFirst({
      where: {
        id: checklistItemId,
        sessionStageId: stageId,
        sessionStage: { sessionId, session: { hobbyId, hobby: { householdId } } }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Stage checklist item not found" });
    }

    const updated = await app.prisma.hobbySessionStageChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isCompleted !== undefined ? {
          isCompleted: input.isCompleted,
          completedAt: input.isCompleted ? (input.completedAt ? new Date(input.completedAt) : new Date()) : null,
        } : {}),
        ...(input.completedAt !== undefined && input.isCompleted === undefined ? { completedAt: input.completedAt ? new Date(input.completedAt) : null } : {}),
      }
    });

    return reply.send({
      id: updated.id,
      sessionStageId: updated.sessionStageId,
      title: updated.title,
      sortOrder: updated.sortOrder,
      isCompleted: updated.isCompleted,
      completedAt: updated.completedAt?.toISOString() ?? null,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // DELETE .../sessions/:sessionId/stages/:stageId/checklists/:checklistItemId
  app.delete(`${BASE}/:sessionId/stages/:stageId/checklists/:checklistItemId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, stageId, checklistItemId } = sessionStageChecklistParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionStageChecklistItem.findFirst({
      where: {
        id: checklistItemId,
        sessionStageId: stageId,
        sessionStage: { sessionId, session: { hobbyId, hobby: { householdId } } }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Stage checklist item not found" });
    }

    await app.prisma.hobbySessionStageChecklistItem.delete({ where: { id: checklistItemId } });
    return reply.code(204).send();
  });

  // DELETE .../sessions/:sessionId
  app.delete(`${BASE}/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } },
      include: {
        ingredients: {
          select: {
            inventoryItemId: true,
            quantityUsed: true,
          }
        }
      }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Session not found" });
    }

    let createdEntryIds: string[] = [];
    await app.prisma.$transaction(async (tx) => {
      for (const ingredient of existing.ingredients) {
        await syncSessionIngredientInventory(tx, {
          existingInventoryItemId: ingredient.inventoryItemId,
          nextInventoryItemId: null,
          existingQuantityUsed: ingredient.quantityUsed,
          nextQuantityUsed: 0,
          userId,
          sessionId,
          sessionName: existing.name,
        });
      }

      await tx.hobbySession.delete({ where: { id: sessionId } });

      if (existing.seriesId) {
        await syncHobbySeriesBatchCount(tx, existing.seriesId);
      }

      createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
      if (existing.routineId) {
        await recalculatePracticeRoutine(tx, existing.routineId);
      }
    });

    if (existing.seriesId) {
      await syncHobbySeriesToSearchIndex(app.prisma, existing.seriesId);
    }

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_session_deleted",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { sessionId, sessionName: existing.name },
    });

    return reply.code(204).send();
  });

  // POST .../sessions/:sessionId/ingredients
  app.post(`${BASE}/:sessionId/ingredients`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const input = createHobbySessionIngredientInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } }
    });
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const ingredient = await app.prisma.$transaction(async (tx) => {
      const created = await tx.hobbySessionIngredient.create({
        data: {
          sessionId,
          recipeIngredientId: input.recipeIngredientId ?? null,
          inventoryItemId: input.inventoryItemId ?? null,
          name: input.name,
          quantityUsed: input.quantityUsed,
          unit: input.unit,
          unitCost: input.unitCost ?? null,
          notes: input.notes ?? null,
        }
      });

      // Consume from inventory if linked
      await syncSessionIngredientInventory(tx, {
        existingInventoryItemId: null,
        nextInventoryItemId: input.inventoryItemId ?? null,
        existingQuantityUsed: 0,
        nextQuantityUsed: input.quantityUsed,
        userId,
        sessionId,
        sessionName: session.name,
      });

      return created;
    });

    return reply.code(201).send(toSessionIngredientResponse(ingredient));
  });

  // PATCH .../sessions/:sessionId/ingredients/:ingredientId
  app.patch(`${BASE}/:sessionId/ingredients/:ingredientId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, ingredientId } = sessionIngredientParamsSchema.parse(request.params);
    const input = updateHobbySessionIngredientInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionIngredient.findFirst({
      where: { id: ingredientId, sessionId, session: { hobbyId, hobby: { householdId } } },
      include: {
        session: {
          select: {
            name: true,
          }
        }
      }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Ingredient not found" });
    }

    const ingredient = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.hobbySessionIngredient.update({
        where: { id: ingredientId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.quantityUsed !== undefined ? { quantityUsed: input.quantityUsed } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.inventoryItemId !== undefined ? { inventoryItemId: input.inventoryItemId } : {}),
          ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        }
      });

      await syncSessionIngredientInventory(tx, {
        existingInventoryItemId: existing.inventoryItemId,
        nextInventoryItemId: input.inventoryItemId !== undefined ? input.inventoryItemId : existing.inventoryItemId,
        existingQuantityUsed: existing.quantityUsed,
        nextQuantityUsed: input.quantityUsed ?? existing.quantityUsed,
        userId,
        sessionId,
        sessionName: existing.session.name,
      });

      return updated;
    });

    return reply.send(toSessionIngredientResponse(ingredient));
  });

  // DELETE .../sessions/:sessionId/ingredients/:ingredientId
  app.delete(`${BASE}/:sessionId/ingredients/:ingredientId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, ingredientId } = sessionIngredientParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionIngredient.findFirst({
      where: { id: ingredientId, sessionId, session: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Ingredient not found" });
    }

    await app.prisma.$transaction(async (tx) => {
      await syncSessionIngredientInventory(tx, {
        existingInventoryItemId: existing.inventoryItemId,
        nextInventoryItemId: null,
        existingQuantityUsed: existing.quantityUsed,
        nextQuantityUsed: 0,
        userId,
        sessionId,
        sessionName: existing.name,
      });

      await tx.hobbySessionIngredient.delete({ where: { id: ingredientId } });
    });

    return reply.code(204).send();
  });

  // POST .../sessions/:sessionId/steps
  app.post(`${BASE}/:sessionId/steps`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const input = createHobbySessionStepInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } }
    });
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const maxSort = await app.prisma.hobbySessionStep.aggregate({
      where: { sessionId },
      _max: { sortOrder: true }
    });

    const step = await app.prisma.hobbySessionStep.create({
      data: {
        sessionId,
        recipeStepId: input.recipeStepId ?? null,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
        durationMinutes: input.durationMinutes ?? null,
        notes: input.notes ?? null,
      }
    });

    return reply.code(201).send(toSessionStepResponse(step));
  });

  // PATCH .../sessions/:sessionId/steps/:stepId
  app.patch(`${BASE}/:sessionId/steps/:stepId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId, stepId } = sessionStepParamsSchema.parse(request.params);
    const input = updateHobbySessionStepInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySessionStep.findFirst({
      where: { id: stepId, sessionId, session: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Step not found" });
    }

    const data: Prisma.HobbySessionStepUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
    if (input.notes !== undefined) data.notes = input.notes;

    if (input.isCompleted !== undefined) {
      data.isCompleted = input.isCompleted;
      if (input.isCompleted && !existing.isCompleted) {
        data.completedAt = new Date();
      } else if (!input.isCompleted) {
        data.completedAt = null;
      }
    }

    const step = await app.prisma.hobbySessionStep.update({
      where: { id: stepId },
      data
    });

    return reply.send(toSessionStepResponse(step));
  });

  // POST .../sessions/:sessionId/steps/reorder
  app.post(`${BASE}/:sessionId/steps/reorder`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const { stepIds } = reorderStepsBodySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } }
    });
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    await app.prisma.$transaction(
      stepIds.map((id, index) =>
        app.prisma.hobbySessionStep.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return reply.send({ success: true });
  });

  // PATCH .../sessions/:sessionId/steps/reorder
  app.patch(`${BASE}/:sessionId/steps/reorder`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
    const { orderedIds } = z.object({ orderedIds: z.array(z.string().cuid()).min(1) }).parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: { id: sessionId, hobbyId, hobby: { householdId } }
    });
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const existing = await app.prisma.hobbySessionStep.findMany({
      where: { sessionId },
      select: { id: true }
    });

    if (existing.length !== orderedIds.length || existing.some((s) => !orderedIds.includes(s.id))) {
      return reply.code(400).send({ message: "orderedIds must include every step in the session exactly once." });
    }

    await app.prisma.$transaction(
      orderedIds.map((id, index) =>
        app.prisma.hobbySessionStep.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return reply.send({ orderedIds });
  });
};

