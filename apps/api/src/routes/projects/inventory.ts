import {
  allocateProjectInventorySchema,
  createProjectInventoryItemSchema,
  updateProjectInventoryItemSchema
} from "@lifekeeper/types";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import {
  applyInventoryTransaction,
  getHouseholdInventoryItem,
  InventoryError
} from "../../lib/inventory.js";
import {
  toInventoryItemSummaryResponse,
  toInventoryTransactionResponse,
  toProjectInventoryItemResponse,
  toProjectInventoryLinkDetailResponse
} from "../../lib/serializers/index.js";

const projectParamsSchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid()
});

const projectInventoryItemParamsSchema = projectParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const getProject = (app: FastifyInstance, householdId: string, projectId: string) => app.prisma.project.findFirst({
  where: {
    id: projectId,
    householdId,
    deletedAt: null
  }
});

export const projectInventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/projects/:projectId/inventory", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const links = await app.prisma.projectInventoryItem.findMany({
      where: { projectId: project.id },
      include: {
        inventoryItem: true,
        project: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return links.map(toProjectInventoryLinkDetailResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/inventory", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectInventoryItemSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, params.householdId, input.inventoryItemId);

    if (!inventoryItem) {
      return reply.code(400).send({ message: "Inventory item not found or belongs to a different household." });
    }

    const existing = await app.prisma.projectInventoryItem.findUnique({
      where: {
        projectId_inventoryItemId: {
          projectId: project.id,
          inventoryItemId: inventoryItem.id
        }
      }
    });

    if (existing) {
      return reply.code(409).send({ message: "Inventory item is already linked to this project." });
    }

    const link = await app.prisma.projectInventoryItem.create({
      data: {
        projectId: project.id,
        inventoryItemId: inventoryItem.id,
        quantityNeeded: input.quantityNeeded,
        quantityAllocated: 0,
        budgetedUnitCost: input.budgetedUnitCost ?? null,
        notes: input.notes ?? null
      },
      include: {
        inventoryItem: true,
        project: {
          select: { id: true, name: true }
        }
      }
    });

    return reply.code(201).send(toProjectInventoryLinkDetailResponse(link));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/inventory/:inventoryItemId", async (request, reply) => {
    const params = projectInventoryItemParamsSchema.parse(request.params);
    const input = updateProjectInventoryItemSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const existing = await app.prisma.projectInventoryItem.findUnique({
      where: {
        projectId_inventoryItemId: {
          projectId: project.id,
          inventoryItemId: params.inventoryItemId
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project inventory link not found." });
    }

    const nextQuantityNeeded = input.quantityNeeded ?? existing.quantityNeeded;
    const nextQuantityAllocated = input.quantityAllocated ?? existing.quantityAllocated;

    if (nextQuantityAllocated > nextQuantityNeeded) {
      return reply.code(400).send({ message: "Allocated quantity cannot exceed quantity needed." });
    }

    const link = await app.prisma.projectInventoryItem.update({
      where: { id: existing.id },
      data: {
        ...(input.quantityNeeded !== undefined ? { quantityNeeded: input.quantityNeeded } : {}),
        ...(input.quantityAllocated !== undefined ? { quantityAllocated: input.quantityAllocated } : {}),
        ...(input.budgetedUnitCost !== undefined ? { budgetedUnitCost: input.budgetedUnitCost ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
      }
    });

    return {
      ...toProjectInventoryItemResponse(link),
      quantityRemaining: link.quantityNeeded - link.quantityAllocated
    };
  });

  app.post("/v1/households/:householdId/projects/:projectId/inventory/:inventoryItemId/allocate", async (request, reply) => {
    const params = projectInventoryItemParamsSchema.parse(request.params);
    const input = allocateProjectInventorySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!inventoryItem) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const existing = await app.prisma.projectInventoryItem.findUnique({
      where: {
        projectId_inventoryItemId: {
          projectId: project.id,
          inventoryItemId: inventoryItem.id
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project inventory link not found." });
    }

    if (inventoryItem.quantityOnHand < input.quantity) {
      return reply.code(400).send({ message: "Insufficient stock for this allocation." });
    }

    if (existing.quantityAllocated + input.quantity > existing.quantityNeeded) {
      return reply.code(400).send({ message: "Allocation would exceed the quantity needed for this project." });
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const link = await tx.projectInventoryItem.update({
          where: { id: existing.id },
          data: {
            quantityAllocated: {
              increment: input.quantity
            }
          }
        });

        const inventoryResult = await applyInventoryTransaction(tx, {
          inventoryItemId: inventoryItem.id,
          userId: request.auth.userId,
          input: {
            type: "consume",
            quantity: -input.quantity,
            unitCost: input.unitCost,
            referenceType: "project",
            referenceId: project.id,
            notes: input.notes
          }
        });

        return {
          link,
          inventoryResult
        };
      });

      return reply.code(201).send({
        projectInventoryItem: {
          ...toProjectInventoryItemResponse(result.link),
          quantityRemaining: result.link.quantityNeeded - result.link.quantityAllocated
        },
        inventoryItem: toInventoryItemSummaryResponse(result.inventoryResult.item),
        transaction: toInventoryTransactionResponse(result.inventoryResult.transaction)
      });
    } catch (error) {
      if (error instanceof InventoryError && error.code === "INSUFFICIENT_STOCK") {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });

  app.delete("/v1/households/:householdId/projects/:projectId/inventory/:inventoryItemId", async (request, reply) => {
    const params = projectInventoryItemParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const existing = await app.prisma.projectInventoryItem.findUnique({
      where: {
        projectId_inventoryItemId: {
          projectId: project.id,
          inventoryItemId: params.inventoryItemId
        }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project inventory link not found." });
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!inventoryItem) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    await app.prisma.$transaction(async (tx) => {
      if (existing.quantityAllocated > 0) {
        await applyInventoryTransaction(tx, {
          inventoryItemId: inventoryItem.id,
          userId: request.auth.userId,
          input: {
            type: "return",
            quantity: existing.quantityAllocated,
            unitCost: existing.budgetedUnitCost ?? inventoryItem.unitCost ?? undefined,
            referenceType: "project",
            referenceId: project.id,
            notes: `Returned allocated inventory after removing ${project.name} inventory link.`
          }
        });
      }

      await tx.projectInventoryItem.delete({ where: { id: existing.id } });
    });

    return reply.code(204).send();
  });
};
