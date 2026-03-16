import type { Prisma } from "@prisma/client";
import {
  createHobbySessionInputSchema,
  updateHobbySessionInputSchema,
  createHobbySessionIngredientInputSchema,
  updateHobbySessionIngredientInputSchema,
  createHobbySessionStepInputSchema,
  updateHobbySessionStepInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { applyInventoryTransaction } from "../../lib/inventory.js";
import {
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

const listSessionsQuerySchema = z.object({
  status: z.string().optional(),
  recipeId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const reorderStepsBodySchema = z.object({
  stepIds: z.array(z.string().cuid())
});

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
            metricReadings: true,
            logs: true
          }
        },
        steps: { select: { isCompleted: true } }
      }
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return reply.send({
      items: items.map(toSessionSummaryResponse),
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

    const session = await app.prisma.$transaction(async (tx) => {
      let initialStatus = input.status ?? "active";
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
          name: input.name,
          status: initialStatus,
          startDate: input.startDate ? new Date(input.startDate) : null,
          pipelineStepId,
          customFields,
          totalCost: input.totalCost ?? null,
          notes: input.notes ?? null,
        }
      });

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
        },
        logs: { orderBy: { logDate: "desc" } }
      }
    });

    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    return reply.send({
      ...toSessionResponse(session),
      recipeName: session.recipe?.name ?? null,
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
      logs: session.logs.map((l) => ({
        id: l.id,
        hobbyId: l.hobbyId,
        sessionId: l.sessionId,
        title: l.title,
        content: l.content,
        logDate: l.logDate.toISOString(),
        logType: l.logType,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
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

    const data: Prisma.HobbySessionUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.totalCost !== undefined) data.totalCost = input.totalCost;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.completedDate !== undefined) data.completedDate = input.completedDate ? new Date(input.completedDate) : null;
    if (input.customFields !== undefined) data.customFields = input.customFields as Prisma.InputJsonValue;

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

    const session = await app.prisma.hobbySession.update({
      where: { id: sessionId },
      data
    });

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

  // DELETE .../sessions/:sessionId
  app.delete(`${BASE}/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, sessionId } = sessionParamsSchema.parse(request.params);
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

    await app.prisma.hobbySession.delete({ where: { id: sessionId } });

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
      if (input.inventoryItemId) {
        await applyInventoryTransaction(tx, {
          inventoryItemId: input.inventoryItemId,
          userId,
          input: {
            type: "consume",
            quantity: -input.quantityUsed,
            referenceType: "hobby_session",
            referenceId: sessionId,
            notes: `Consumed for hobby session: ${session.name}`,
          },
          clampToZero: true,
        });
      }

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
      where: { id: ingredientId, sessionId, session: { hobbyId, hobby: { householdId } } }
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

      // Corrective inventory transaction if quantity changed and has inventory link
      if (input.quantityUsed !== undefined && existing.inventoryItemId) {
        const delta = existing.quantityUsed - input.quantityUsed;
        if (delta !== 0) {
          await applyInventoryTransaction(tx, {
            inventoryItemId: existing.inventoryItemId,
            userId,
            input: {
              type: "adjust",
              quantity: delta,
              referenceType: "hobby_session",
              referenceId: sessionId,
              notes: `Quantity adjustment for hobby session ingredient`,
            },
            clampToZero: true,
          });
        }
      }

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

    if (existing.inventoryItemId) {
      const inventoryItemId = existing.inventoryItemId;

      await app.prisma.$transaction(async (tx) => {
        await applyInventoryTransaction(tx, {
          inventoryItemId,
          userId,
          input: {
            type: "adjust",
            quantity: existing.quantityUsed,
            referenceType: "hobby_session",
            referenceId: sessionId,
            notes: "Session ingredient removed",
          },
          clampToZero: false,
        });

        await tx.hobbySessionIngredient.delete({ where: { id: ingredientId } });
      });
    } else {
      await app.prisma.hobbySessionIngredient.delete({ where: { id: ingredientId } });
    }

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
};

