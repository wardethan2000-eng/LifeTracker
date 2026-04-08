import type { Prisma } from "@prisma/client";
import {
  createHobbyRecipeInputSchema,
  updateHobbyRecipeInputSchema,
  createHobbyRecipeIngredientInputSchema,
  updateHobbyRecipeIngredientInputSchema,
  createHobbyRecipeStepInputSchema,
  updateHobbyRecipeStepInputSchema
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import {
  toIngredientResponse,
  toRecipeResponse,
  toRecipeSummaryResponse,
  toStepResponse
} from "../../lib/serializers/index.js";
import { notFound } from "../../lib/errors.js";
import { hobbyParamsSchema } from "../../lib/schemas.js";

const recipeParamsSchema = hobbyParamsSchema.extend({
  recipeId: z.string().cuid()
});

const ingredientParamsSchema = recipeParamsSchema.extend({
  ingredientId: z.string().cuid()
});

const stepParamsSchema = recipeParamsSchema.extend({
  stepId: z.string().cuid()
});

const listRecipesQuerySchema = z.object({
  isArchived: z.coerce.boolean().optional(),
  search: z.string().optional()
});

const reorderStepsBodySchema = z.object({
  stepIds: z.array(z.string().cuid())
});

export const hobbyRecipeRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/recipes";

  // GET .../recipes
  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = listRecipesQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const where: Prisma.HobbyRecipeWhereInput = {
      hobbyId,
      hobby: { householdId },
      ...(query.isArchived !== undefined ? { isArchived: query.isArchived } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {})
    };

    const recipes = await app.prisma.hobbyRecipe.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { ingredients: true, steps: true, sessions: true }
        }
      }
    });

    return reply.send(recipes.map(toRecipeSummaryResponse));
  });

  // POST .../recipes
  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyRecipeInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const recipe = await tx.hobbyRecipe.create({
        data: {
          hobbyId,
          name: input.name,
          description: input.description ?? null,
          sourceType: input.sourceType ?? "user",
          styleCategory: input.styleCategory ?? null,
          customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
          estimatedDuration: input.estimatedDuration ?? null,
          estimatedCost: input.estimatedCost ?? null,
          yield: input.yield ?? null,
          notes: input.notes ?? null,
        }
      });

      if (input.ingredients && input.ingredients.length > 0) {
        await tx.hobbyRecipeIngredient.createMany({
          data: input.ingredients.map((ing, idx) => ({
            recipeId: recipe.id,
            inventoryItemId: ing.inventoryItemId ?? null,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category ?? null,
            notes: ing.notes ?? null,
            sortOrder: ing.sortOrder ?? idx,
          }))
        });
      }

      if (input.steps && input.steps.length > 0) {
        await tx.hobbyRecipeStep.createMany({
          data: input.steps.map((step, idx) => ({
            recipeId: recipe.id,
            title: step.title,
            description: step.description ?? null,
            sortOrder: step.sortOrder ?? idx,
            durationMinutes: step.durationMinutes ?? null,
            stepType: step.stepType ?? "generic",
          }))
        });
      }

      return tx.hobbyRecipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: {
          ingredients: { orderBy: { sortOrder: "asc" } },
          steps: { orderBy: { sortOrder: "asc" } },
          _count: { select: { sessions: true } }
        }
      });
    });

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_recipe_created", householdId, { recipeId: result.id, recipeName: result.name });

    return reply.code(201).send({
      ...toRecipeResponse(result),
      ingredients: result.ingredients.map(toIngredientResponse),
      steps: result.steps.map(toStepResponse),
      sessionCount: result._count.sessions,
    });
  });

  // GET .../recipes/:recipeId
  app.get(`${BASE}/:recipeId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const recipe = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } },
      include: {
        ingredients: {
          orderBy: { sortOrder: "asc" },
          include: {
            inventoryItem: { select: { id: true, name: true, quantityOnHand: true, unit: true } }
          }
        },
        steps: { orderBy: { sortOrder: "asc" } },
        _count: { select: { sessions: true } }
      }
    });

    if (!recipe) {
      return notFound(reply, "Recipe");
    }

    return reply.send({
      ...toRecipeResponse(recipe),
      ingredients: recipe.ingredients.map((ing) => ({
        ...toIngredientResponse(ing),
        inventoryItem: ing.inventoryItem,
      })),
      steps: recipe.steps.map(toStepResponse),
      sessionCount: recipe._count.sessions,
    });
  });

  // PATCH .../recipes/:recipeId
  app.patch(`${BASE}/:recipeId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const input = updateHobbyRecipeInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return notFound(reply, "Recipe");
    }

    const recipe = await app.prisma.hobbyRecipe.update({
      where: { id: recipeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
        ...(input.styleCategory !== undefined ? { styleCategory: input.styleCategory } : {}),
        ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
        ...(input.estimatedDuration !== undefined ? { estimatedDuration: input.estimatedDuration } : {}),
        ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}),
        ...(input.yield !== undefined ? { yield: input.yield } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      }
    });

    return reply.send(toRecipeResponse(recipe));
  });

  // DELETE .../recipes/:recipeId
  app.delete(`${BASE}/:recipeId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return notFound(reply, "Recipe");
    }

    await app.prisma.hobbyRecipe.delete({ where: { id: recipeId } });

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_recipe_deleted", householdId, { recipeId, recipeName: existing.name });

    return reply.code(204).send();
  });

  // POST .../recipes/:recipeId/ingredients
  app.post(`${BASE}/:recipeId/ingredients`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const input = createHobbyRecipeIngredientInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const recipe = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } }
    });
    if (!recipe) {
      return notFound(reply, "Recipe");
    }

    const maxSort = await app.prisma.hobbyRecipeIngredient.aggregate({
      where: { recipeId },
      _max: { sortOrder: true }
    });

    const ingredient = await app.prisma.hobbyRecipeIngredient.create({
      data: {
        recipeId,
        inventoryItemId: input.inventoryItemId ?? null,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        category: input.category ?? null,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
      }
    });

    return reply.code(201).send(toIngredientResponse(ingredient));
  });

  // PATCH .../recipes/:recipeId/ingredients/:ingredientId
  app.patch(`${BASE}/:recipeId/ingredients/:ingredientId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId, ingredientId } = ingredientParamsSchema.parse(request.params);
    const input = updateHobbyRecipeIngredientInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipeIngredient.findFirst({
      where: { id: ingredientId, recipeId, recipe: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return notFound(reply, "Ingredient");
    }

    const ingredient = await app.prisma.hobbyRecipeIngredient.update({
      where: { id: ingredientId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.inventoryItemId !== undefined ? { inventoryItemId: input.inventoryItemId } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      }
    });

    return reply.send(toIngredientResponse(ingredient));
  });

  // DELETE .../recipes/:recipeId/ingredients/:ingredientId
  app.delete(`${BASE}/:recipeId/ingredients/:ingredientId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId, ingredientId } = ingredientParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipeIngredient.findFirst({
      where: { id: ingredientId, recipeId, recipe: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return notFound(reply, "Ingredient");
    }

    await app.prisma.hobbyRecipeIngredient.delete({ where: { id: ingredientId } });

    return reply.code(204).send();
  });

  // POST .../recipes/:recipeId/steps
  app.post(`${BASE}/:recipeId/steps`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const input = createHobbyRecipeStepInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const recipe = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } }
    });
    if (!recipe) {
      return notFound(reply, "Recipe");
    }

    const maxSort = await app.prisma.hobbyRecipeStep.aggregate({
      where: { recipeId },
      _max: { sortOrder: true }
    });

    const step = await app.prisma.hobbyRecipeStep.create({
      data: {
        recipeId,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
        durationMinutes: input.durationMinutes ?? null,
        stepType: input.stepType ?? "generic",
      }
    });

    return reply.code(201).send(toStepResponse(step));
  });

  // PATCH .../recipes/:recipeId/steps/:stepId
  app.patch(`${BASE}/:recipeId/steps/:stepId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId, stepId } = stepParamsSchema.parse(request.params);
    const input = updateHobbyRecipeStepInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipeStep.findFirst({
      where: { id: stepId, recipeId, recipe: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return notFound(reply, "Step");
    }

    const step = await app.prisma.hobbyRecipeStep.update({
      where: { id: stepId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.stepType !== undefined ? { stepType: input.stepType } : {}),
      }
    });

    return reply.send(toStepResponse(step));
  });

  // DELETE .../recipes/:recipeId/steps/:stepId
  app.delete(`${BASE}/:recipeId/steps/:stepId`, async (request, reply) => {
    const { householdId, hobbyId, recipeId, stepId } = stepParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyRecipeStep.findFirst({
      where: { id: stepId, recipeId, recipe: { hobbyId, hobby: { householdId } } }
    });
    if (!existing) {
      return notFound(reply, "Step");
    }

    await app.prisma.hobbyRecipeStep.delete({ where: { id: stepId } });

    return reply.code(204).send();
  });

  // POST .../recipes/:recipeId/reorder-steps
  app.post(`${BASE}/:recipeId/reorder-steps`, async (request, reply) => {
    const { householdId, hobbyId, recipeId } = recipeParamsSchema.parse(request.params);
    const { stepIds } = reorderStepsBodySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const recipe = await app.prisma.hobbyRecipe.findFirst({
      where: { id: recipeId, hobbyId, hobby: { householdId } }
    });
    if (!recipe) {
      return notFound(reply, "Recipe");
    }

    await app.prisma.$transaction(
      stepIds.map((id, index) =>
        app.prisma.hobbyRecipeStep.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return reply.send({ success: true });
  });
};

