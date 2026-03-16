import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, ForbiddenError } from "../../lib/asset-access.js";
import { toProjectInventoryRollupResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

export const householdProjectInventoryRollupRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/projects/inventory-rollups", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return reply.code(403).send({ message: "You do not have access to this household." });
      }

      throw error;
    }

    const links = await app.prisma.projectInventoryItem.findMany({
      where: {
        project: {
          householdId: params.householdId
        }
      },
      include: {
        inventoryItem: {
          select: {
            unitCost: true
          }
        },
        project: {
          select: {
            id: true
          }
        }
      },
      orderBy: [{ projectId: "asc" }, { createdAt: "asc" }]
    });

    const rollups = new Map<string, {
      projectId: string;
      inventoryLineCount: number;
      totalInventoryNeeded: number;
      totalInventoryAllocated: number;
      totalInventoryRemaining: number;
      plannedInventoryCost: number;
    }>();

    for (const link of links) {
      const projectId = link.project.id;
      const current = rollups.get(projectId) ?? {
        projectId,
        inventoryLineCount: 0,
        totalInventoryNeeded: 0,
        totalInventoryAllocated: 0,
        totalInventoryRemaining: 0,
        plannedInventoryCost: 0
      };

      const quantityRemaining = Math.max(link.quantityNeeded - link.quantityAllocated, 0);
      const unitCost = link.budgetedUnitCost ?? link.inventoryItem.unitCost ?? 0;

      current.inventoryLineCount += 1;
      current.totalInventoryNeeded += link.quantityNeeded;
      current.totalInventoryAllocated += link.quantityAllocated;
      current.totalInventoryRemaining += quantityRemaining;
      current.plannedInventoryCost += unitCost * link.quantityNeeded;

      rollups.set(projectId, current);
    }

    return Array.from(rollups.values()).map(toProjectInventoryRollupResponse);
  });
};