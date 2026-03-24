import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { toHobbyRecipeShoppingListResponse } from "../../lib/serializers/index.js";
import { notFound } from "../../lib/errors.js";

const recipeParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
  recipeId: z.string().cuid()
});

export const hobbyShoppingListRoutes: FastifyPluginAsync = async (app) => {
  // GET .../recipes/:recipeId/shopping-list
  app.get(
    "/v1/households/:householdId/hobbies/:hobbyId/recipes/:recipeId/shopping-list",
    async (request, reply) => {
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
              inventoryItem: {
                select: { id: true, quantityOnHand: true, unitCost: true }
              }
            }
          }
        }
      });

      if (!recipe) {
        return notFound(reply, "Recipe");
      }

      const items = recipe.ingredients.map((ing) => {
        const quantityOnHand = ing.inventoryItem?.quantityOnHand ?? 0;
        const deficit = Math.max(0, ing.quantity - quantityOnHand);
        const unitCost = ing.inventoryItem?.unitCost ?? null;
        const estimatedCost = unitCost !== null ? deficit * unitCost : null;

        return {
          ingredientId: ing.id,
          ingredientName: ing.name,
          quantityNeeded: ing.quantity,
          quantityOnHand,
          deficit,
          unit: ing.unit,
          inventoryItemId: ing.inventoryItemId,
          estimatedCost,
        };
      });

      const costs = items.map((i) => i.estimatedCost).filter((c): c is number => c !== null);
      const totalEstimatedCost = costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) : null;

      return reply.send(toHobbyRecipeShoppingListResponse({
        recipeId: recipe.id,
        recipeName: recipe.name,
        items,
        totalEstimatedCost,
      }));
    }
  );
};

