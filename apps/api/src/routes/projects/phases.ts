import type { Prisma } from "@prisma/client";
import {
  allocateProjectInventorySchema,
  createProjectBudgetCategorySchema,
  createProjectPhaseChecklistItemSchema,
  createProjectPhaseSchema,
  createProjectPhaseSupplySchema,
  createProjectTaskChecklistItemSchema,
  reorderProjectPhasesSchema,
  updateProjectBudgetCategorySchema,
  updateProjectPhaseChecklistItemSchema,
  updateProjectPhaseSchema,
  updateProjectPhaseSupplySchema,
  updateProjectTaskChecklistItemSchema
} from "@lifekeeper/types";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, checkMembership, ForbiddenError } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import {
  applyInventoryTransaction,
  getHouseholdInventoryItem,
  InventoryError
} from "../../lib/inventory.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import {
  buildPhaseCompletionGuardrailMessage,
  getPhaseCompletionSummary,
  syncProjectDerivedStatuses
} from "../../lib/project-status.js";
import {
  toInventoryItemSummaryResponse,
  toInventoryTransactionResponse,
  toProjectBudgetCategoryResponse,
  toProjectExpenseResponse,
  toProjectPhaseDetailResponse,
  toProjectPhaseChecklistItemResponse,
  toProjectPhaseSummaryResponse,
  toProjectPhaseSupplyResponse,
  toProjectTaskChecklistItemResponse,
  toProjectTaskResponse
} from "../../lib/serializers/index.js";
import { syncProjectToSearchIndex } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const projectParamsSchema = householdParamsSchema.extend({
  projectId: z.string().cuid()
});

const phaseParamsSchema = projectParamsSchema.extend({
  phaseId: z.string().cuid()
});

const phaseChecklistParamsSchema = phaseParamsSchema.extend({
  checklistItemId: z.string().cuid()
});

const taskParamsSchema = projectParamsSchema.extend({
  taskId: z.string().cuid()
});

const taskChecklistParamsSchema = taskParamsSchema.extend({
  checklistItemId: z.string().cuid()
});

const budgetCategoryParamsSchema = projectParamsSchema.extend({
  categoryId: z.string().cuid()
});

const supplyParamsSchema = phaseParamsSchema.extend({
  supplyId: z.string().cuid()
});

const getProject = (app: FastifyInstance, householdId: string, projectId: string) => app.prisma.project.findFirst({
  where: { id: projectId, householdId, deletedAt: null },
  select: { id: true, householdId: true, name: true }
});

const getPhase = (app: FastifyInstance, projectId: string, phaseId: string) => app.prisma.projectPhase.findFirst({
  where: { id: phaseId, projectId, project: { deletedAt: null } }
});

const getNextSortOrder = async (
  getMax: () => Promise<{ _max: { sortOrder: number | null } }>
) => {
  const result = await getMax();
  return (result._max.sortOrder ?? -1) + 1;
};

const activePurchaseRequestInclude = {
  where: {
    purchase: {
      status: {
        in: ["draft", "ordered"]
      }
    }
  },
  select: {
    id: true,
    status: true,
    plannedQuantity: true,
    orderedQuantity: true,
    receivedQuantity: true,
    purchase: {
      select: {
        id: true,
        status: true,
        supplierName: true,
        supplierUrl: true
      }
    }
  },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: 1
} satisfies Prisma.InventoryPurchaseLineFindManyArgs;

const projectPhaseDetailInclude = {
  tasks: {
    include: {
      assignedTo: { select: { id: true, displayName: true } },
      predecessorLinks: { select: { predecessorTaskId: true } },
      successorLinks: { select: { successorTaskId: true } },
      checklistItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  checklistItems: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  supplies: {
    include: {
      inventoryItem: {
        select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
      },
      purchaseLines: activePurchaseRequestInclude
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  expenses: { orderBy: { createdAt: "desc" } }
} satisfies Prisma.ProjectPhaseInclude;

export const projectPhaseRoutes: FastifyPluginAsync = async (app) => {
  const refreshProjectArtifacts = (householdId: string, projectId: string) => {
    void Promise.all([
      syncProjectToSearchIndex(app.prisma, projectId),
      enqueueNotificationScan({ householdId })
    ]).catch(console.error);
  };

  app.get("/v1/households/:householdId/projects/:projectId/phases", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const phases = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            taskType: true,
            isCompleted: true,
            estimatedHours: true,
            actualHours: true,
            predecessorLinks: { select: { predecessorTaskId: true } }
          }
        },
        checklistItems: { select: { isCompleted: true } },
        supplies: { select: { isProcured: true } },
        expenses: { select: { amount: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return phases.map(toProjectPhaseSummaryResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/phases", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectPhaseSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const sortOrder = input.sortOrder ?? await getNextSortOrder(() => app.prisma.projectPhase.aggregate({
      where: { projectId: project.id },
      _max: { sortOrder: true }
    }));

    const phase = await app.prisma.$transaction(async (tx) => {
      const createdPhase = await tx.projectPhase.create({
        data: {
          projectId: project.id,
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          sortOrder,
          startDate: input.startDate ? new Date(input.startDate) : null,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
          budgetAmount: input.budgetAmount ?? null,
          notes: input.notes ?? null
        }
      });

      await syncProjectDerivedStatuses(tx, project.id);

      return tx.projectPhase.findUniqueOrThrow({
        where: { id: createdPhase.id },
        include: {
          tasks: {
            select: {
              id: true,
              status: true,
              taskType: true,
              isCompleted: true,
              estimatedHours: true,
              actualHours: true,
              predecessorLinks: { select: { predecessorTaskId: true } }
            }
          },
          checklistItems: { select: { isCompleted: true } },
          supplies: { select: { isProcured: true } },
          expenses: { select: { amount: true } }
        }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.phase.created",
      entityType: "project_phase",
      entityId: phase.id,
      metadata: { phaseName: phase.name, sortOrder: phase.sortOrder }
    });

    refreshProjectArtifacts(params.householdId, project.id);

    return reply.code(201).send(toProjectPhaseSummaryResponse(phase));
  });

  app.get("/v1/households/:householdId/projects/:projectId/phases/:phaseId", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const phase = await app.prisma.projectPhase.findFirst({
      where: { id: params.phaseId, projectId: project.id },
      include: projectPhaseDetailInclude
    });

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    return toProjectPhaseDetailResponse(phase);
  });

  app.get("/v1/households/:householdId/projects/:projectId/phases/details", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return reply.code(403).send({ message: "You do not have access to this household." });
      }

      throw error;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const phases = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      include: projectPhaseDetailInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return phases.map(toProjectPhaseDetailResponse);
  });

  app.patch("/v1/households/:householdId/projects/:projectId/phases/:phaseId", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);
    const input = updateProjectPhaseSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const data: Prisma.ProjectPhaseUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.targetEndDate !== undefined) data.targetEndDate = input.targetEndDate ? new Date(input.targetEndDate) : null;
    if (input.budgetAmount !== undefined) data.budgetAmount = input.budgetAmount ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.actualEndDate !== undefined) {
      data.actualEndDate = input.actualEndDate ? new Date(input.actualEndDate) : null;
    } else if (input.status === "completed" && phase.status !== "completed") {
      data.actualEndDate = new Date();
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.projectPhase.update({
        where: { id: phase.id },
        data
      });

      await syncProjectDerivedStatuses(tx, params.projectId);

      return tx.projectPhase.findUniqueOrThrow({
        where: { id: phase.id },
        include: {
          tasks: {
            select: {
              id: true,
              status: true,
              taskType: true,
              isCompleted: true,
              estimatedHours: true,
              actualHours: true,
              predecessorLinks: { select: { predecessorTaskId: true } }
            }
          },
          checklistItems: { select: { isCompleted: true } },
          supplies: { select: { isProcured: true } },
          expenses: { select: { amount: true } }
        }
      });
    });

    if (input.status !== undefined && input.status !== phase.status) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.phase.status_changed",
        entityType: "project_phase",
        entityId: phase.id,
        metadata: { phaseName: phase.name, oldStatus: phase.status, newStatus: input.status }
      });
    }

    refreshProjectArtifacts(params.householdId, params.projectId);

    return toProjectPhaseSummaryResponse(updated);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/phases/:phaseId", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.projectPhase.delete({ where: { id: phase.id } });
      await syncProjectDerivedStatuses(tx, params.projectId);
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.phase.deleted",
      entityType: "project_phase",
      entityId: phase.id,
      metadata: { phaseName: phase.name }
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(204).send();
  });

  app.patch("/v1/households/:householdId/projects/:projectId/phases/reorder", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = reorderProjectPhasesSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const existing = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      select: { id: true }
    });

    if (existing.length !== input.phaseIds.length || existing.some((phase) => !input.phaseIds.includes(phase.id))) {
      return reply.code(400).send({ message: "phaseIds must include every phase in the project exactly once." });
    }

    await app.prisma.$transaction(input.phaseIds.map((phaseId, index) => app.prisma.projectPhase.update({
      where: { id: phaseId },
      data: { sortOrder: index }
    })));

    return { phaseIds: input.phaseIds };
  });

  app.get("/v1/households/:householdId/projects/:projectId/phases/:phaseId/checklist", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const items = await app.prisma.projectPhaseChecklistItem.findMany({
      where: { phaseId: phase.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return items.map(toProjectPhaseChecklistItemResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/phases/:phaseId/checklist", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);
    const input = createProjectPhaseChecklistItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const sortOrder = input.sortOrder ?? await getNextSortOrder(() => app.prisma.projectPhaseChecklistItem.aggregate({
      where: { phaseId: phase.id },
      _max: { sortOrder: true }
    }));

    const item = await app.prisma.projectPhaseChecklistItem.create({
      data: {
        phaseId: phase.id,
        title: input.title,
        sortOrder
      }
    });

    return reply.code(201).send(toProjectPhaseChecklistItemResponse(item));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/phases/:phaseId/checklist/:checklistItemId", async (request, reply) => {
    const params = phaseChecklistParamsSchema.parse(request.params);
    const input = updateProjectPhaseChecklistItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.projectPhaseChecklistItem.findFirst({
      where: {
        id: params.checklistItemId,
        phase: { id: params.phaseId, projectId: params.projectId, project: { deletedAt: null } }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Phase checklist item not found." });
    }

    const data: Prisma.ProjectPhaseChecklistItemUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.isCompleted !== undefined) {
      data.isCompleted = input.isCompleted;
      data.completedAt = input.isCompleted
        ? new Date()
        : null;
    }

    const updated = await app.prisma.projectPhaseChecklistItem.update({
      where: { id: item.id },
      data
    });

    return toProjectPhaseChecklistItemResponse(updated);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/phases/:phaseId/checklist/:checklistItemId", async (request, reply) => {
    const params = phaseChecklistParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.projectPhaseChecklistItem.findFirst({
      where: {
        id: params.checklistItemId,
        phase: { id: params.phaseId, projectId: params.projectId, project: { deletedAt: null } }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Phase checklist item not found." });
    }

    await app.prisma.projectPhaseChecklistItem.delete({ where: { id: item.id } });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/projects/:projectId/tasks/:taskId/checklist", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const task = await app.prisma.projectTask.findFirst({
      where: { id: params.taskId, project: { id: params.projectId, householdId: params.householdId, deletedAt: null } }
    });

    if (!task) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    const items = await app.prisma.projectTaskChecklistItem.findMany({
      where: { taskId: task.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return items.map(toProjectTaskChecklistItemResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/tasks/:taskId/checklist", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const input = createProjectTaskChecklistItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const task = await app.prisma.projectTask.findFirst({
      where: { id: params.taskId, project: { id: params.projectId, householdId: params.householdId, deletedAt: null } }
    });

    if (!task) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    const sortOrder = input.sortOrder ?? await getNextSortOrder(() => app.prisma.projectTaskChecklistItem.aggregate({
      where: { taskId: task.id },
      _max: { sortOrder: true }
    }));

    const item = await app.prisma.projectTaskChecklistItem.create({
      data: {
        taskId: task.id,
        title: input.title,
        sortOrder
      }
    });

    return reply.code(201).send(toProjectTaskChecklistItemResponse(item));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/tasks/:taskId/checklist/:checklistItemId", async (request, reply) => {
    const params = taskChecklistParamsSchema.parse(request.params);
    const input = updateProjectTaskChecklistItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.projectTaskChecklistItem.findFirst({
      where: {
        id: params.checklistItemId,
        task: { id: params.taskId, projectId: params.projectId, project: { deletedAt: null } }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Task checklist item not found." });
    }

    const data: Prisma.ProjectTaskChecklistItemUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.isCompleted !== undefined) {
      data.isCompleted = input.isCompleted;
      data.completedAt = input.isCompleted ? new Date() : null;
    }

    const updated = await app.prisma.projectTaskChecklistItem.update({
      where: { id: item.id },
      data
    });

    return toProjectTaskChecklistItemResponse(updated);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/tasks/:taskId/checklist/:checklistItemId", async (request, reply) => {
    const params = taskChecklistParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.projectTaskChecklistItem.findFirst({
      where: {
        id: params.checklistItemId,
        task: { id: params.taskId, projectId: params.projectId, project: { deletedAt: null } }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Task checklist item not found." });
    }

    await app.prisma.projectTaskChecklistItem.delete({ where: { id: item.id } });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/projects/:projectId/budget-categories", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const categories = await app.prisma.projectBudgetCategory.findMany({
      where: { projectId: project.id },
      include: {
        expenses: { select: { amount: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return categories.map(toProjectBudgetCategoryResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/budget-categories", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectBudgetCategorySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const category = await app.prisma.projectBudgetCategory.create({
      data: {
        projectId: project.id,
        name: input.name,
        budgetAmount: input.budgetAmount ?? null,
        sortOrder: input.sortOrder ?? null,
        notes: input.notes ?? null
      },
      include: {
        expenses: { select: { amount: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.budget_category.created",
      entityType: "project_budget_category",
      entityId: category.id,
      metadata: { categoryName: category.name, budgetAmount: category.budgetAmount }
    });

    return reply.code(201).send(toProjectBudgetCategoryResponse(category));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/budget-categories/:categoryId", async (request, reply) => {
    const params = budgetCategoryParamsSchema.parse(request.params);
    const input = updateProjectBudgetCategorySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const category = await app.prisma.projectBudgetCategory.findFirst({
      where: { id: params.categoryId, projectId: params.projectId, project: { deletedAt: null } }
    });

    if (!category) {
      return reply.code(404).send({ message: "Budget category not found." });
    }

    const data: Prisma.ProjectBudgetCategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.budgetAmount !== undefined) data.budgetAmount = input.budgetAmount ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const updated = await app.prisma.projectBudgetCategory.update({
      where: { id: category.id },
      data,
      include: {
        expenses: { select: { amount: true } }
      }
    });

    return toProjectBudgetCategoryResponse(updated);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/budget-categories/:categoryId", async (request, reply) => {
    const params = budgetCategoryParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const category = await app.prisma.projectBudgetCategory.findFirst({
      where: { id: params.categoryId, projectId: params.projectId, project: { deletedAt: null } }
    });

    if (!category) {
      return reply.code(404).send({ message: "Budget category not found." });
    }

    await app.prisma.projectBudgetCategory.delete({ where: { id: category.id } });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.budget_category.deleted",
      entityType: "project_budget_category",
      entityId: category.id,
      metadata: { categoryName: category.name }
    });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/projects/:projectId/phases/:phaseId/supplies", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const supplies = await app.prisma.projectPhaseSupply.findMany({
      where: { phaseId: phase.id },
      include: {
        inventoryItem: {
          select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
        },
        purchaseLines: activePurchaseRequestInclude
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return supplies.map(toProjectPhaseSupplyResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/phases/:phaseId/supplies", async (request, reply) => {
    const params = phaseParamsSchema.parse(request.params);
    const input = createProjectPhaseSupplySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    if (input.inventoryItemId) {
      const inventoryItem = await getHouseholdInventoryItem(app.prisma, params.householdId, input.inventoryItemId);
      if (!inventoryItem) {
        return reply.code(400).send({ message: "Inventory item not found or belongs to a different household." });
      }
    }

    const sortOrder = input.sortOrder ?? await getNextSortOrder(() => app.prisma.projectPhaseSupply.aggregate({
      where: { phaseId: phase.id },
      _max: { sortOrder: true }
    }));

    const supply = await app.prisma.$transaction(async (tx) => {
      const createdSupply = await tx.projectPhaseSupply.create({
        data: {
          phaseId: phase.id,
          name: input.name,
          description: input.description ?? null,
          quantityNeeded: input.quantityNeeded,
          quantityOnHand: input.quantityOnHand ?? 0,
          unit: input.unit ?? "each",
          estimatedUnitCost: input.estimatedUnitCost ?? null,
          actualUnitCost: input.actualUnitCost ?? null,
          supplier: input.supplier ?? null,
          supplierUrl: input.supplierUrl ?? null,
          isProcured: input.isProcured ?? false,
          procuredAt: input.isProcured ? new Date() : null,
          isStaged: input.isStaged ?? false,
          stagedAt: input.isStaged ? new Date() : null,
          inventoryItemId: input.inventoryItemId ?? null,
          notes: input.notes ?? null,
          sortOrder
        }
      });

      await syncProjectDerivedStatuses(tx, params.projectId);

      return tx.projectPhaseSupply.findUniqueOrThrow({
        where: { id: createdSupply.id },
        include: {
          inventoryItem: {
            select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
          },
          purchaseLines: activePurchaseRequestInclude
        }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.supply.created",
      entityType: "project_phase_supply",
      entityId: supply.id,
      metadata: { supplyName: supply.name, phaseName: phase.name, quantityNeeded: supply.quantityNeeded }
    });

    if (supply.isProcured) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supply.procured",
        entityType: "project_phase_supply",
        entityId: supply.id,
        metadata: { supplyName: supply.name, phaseName: phase.name, actualUnitCost: supply.actualUnitCost }
      });
    }

    if (supply.isStaged) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supply.staged",
        entityType: "project_phase_supply",
        entityId: supply.id,
        metadata: { supplyName: supply.name, phaseName: phase.name }
      });
    }

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(201).send(toProjectPhaseSupplyResponse(supply));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/phases/:phaseId/supplies/:supplyId", async (request, reply) => {
    const params = supplyParamsSchema.parse(request.params);
    const input = updateProjectPhaseSupplySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const supply = await app.prisma.projectPhaseSupply.findFirst({
      where: { id: params.supplyId, phaseId: phase.id },
      include: {
        inventoryItem: {
          select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
        },
        purchaseLines: activePurchaseRequestInclude
      }
    });

    if (!supply) {
      return reply.code(404).send({ message: "Phase supply not found." });
    }

    if (input.inventoryItemId !== undefined && input.inventoryItemId !== null) {
      const inventoryItem = await getHouseholdInventoryItem(app.prisma, params.householdId, input.inventoryItemId);
      if (!inventoryItem) {
        return reply.code(400).send({ message: "Inventory item not found or belongs to a different household." });
      }
    }

    if (
      input.inventoryItemId !== undefined
      && input.inventoryItemId !== supply.inventoryItemId
      && supply.purchaseLines.length > 0
    ) {
      return reply.code(409).send({ message: "Cannot change the linked inventory item while this supply has an active purchase request." });
    }

    const data: Prisma.ProjectPhaseSupplyUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.quantityNeeded !== undefined) data.quantityNeeded = input.quantityNeeded;
    if (input.quantityOnHand !== undefined) data.quantityOnHand = input.quantityOnHand ?? 0;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.estimatedUnitCost !== undefined) data.estimatedUnitCost = input.estimatedUnitCost ?? null;
    if (input.actualUnitCost !== undefined) data.actualUnitCost = input.actualUnitCost ?? null;
    if (input.supplier !== undefined) data.supplier = input.supplier ?? null;
    if (input.supplierUrl !== undefined) data.supplierUrl = input.supplierUrl ?? null;
    if (input.inventoryItemId !== undefined) data.inventoryItemId = input.inventoryItemId ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;

    let procuredBecameTrue = false;
    let stagedBecameTrue = false;

    if (input.isProcured !== undefined) {
      data.isProcured = input.isProcured;
      if (input.isProcured) {
        procuredBecameTrue = !supply.isProcured;
        data.procuredAt = input.procuredAt ? new Date(input.procuredAt) : (supply.procuredAt ?? new Date());
      } else {
        data.procuredAt = null;
      }
    } else if (input.procuredAt !== undefined) {
      data.procuredAt = input.procuredAt ? new Date(input.procuredAt) : null;
    }

    if (input.isStaged !== undefined) {
      data.isStaged = input.isStaged;
      if (input.isStaged) {
        stagedBecameTrue = !supply.isStaged;
        data.stagedAt = input.stagedAt ? new Date(input.stagedAt) : (supply.stagedAt ?? new Date());
      } else {
        data.stagedAt = null;
      }
    } else if (input.stagedAt !== undefined) {
      data.stagedAt = input.stagedAt ? new Date(input.stagedAt) : null;
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.projectPhaseSupply.update({
        where: { id: supply.id },
        data
      });

      await syncProjectDerivedStatuses(tx, params.projectId);

      return tx.projectPhaseSupply.findUniqueOrThrow({
        where: { id: supply.id },
        include: {
          inventoryItem: {
            select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
          },
          purchaseLines: activePurchaseRequestInclude
        }
      });
    });

    if (procuredBecameTrue) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supply.procured",
        entityType: "project_phase_supply",
        entityId: updated.id,
        metadata: { supplyName: updated.name, phaseName: phase.name, actualUnitCost: updated.actualUnitCost }
      });
    }

    if (stagedBecameTrue) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supply.staged",
        entityType: "project_phase_supply",
        entityId: updated.id,
        metadata: { supplyName: updated.name, phaseName: phase.name }
      });
    }

    refreshProjectArtifacts(params.householdId, params.projectId);

    return toProjectPhaseSupplyResponse(updated);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/phases/:phaseId/supplies/:supplyId", async (request, reply) => {
    const params = supplyParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const supply = await app.prisma.projectPhaseSupply.findFirst({
      where: {
        id: params.supplyId,
        phase: { id: params.phaseId, projectId: params.projectId, project: { deletedAt: null } }
      },
      include: {
        purchaseLines: activePurchaseRequestInclude
      }
    });

    if (!supply) {
      return reply.code(404).send({ message: "Phase supply not found." });
    }

    if (supply.purchaseLines.length > 0) {
      return reply.code(409).send({ message: "Cannot delete a supply while it has an active purchase request." });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.projectPhaseSupply.delete({ where: { id: supply.id } });
      await syncProjectDerivedStatuses(tx, params.projectId);
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(204).send();
  });

  app.post("/v1/households/:householdId/projects/:projectId/phases/:phaseId/supplies/:supplyId/allocate-from-inventory", async (request, reply) => {
    const params = supplyParamsSchema.parse(request.params);
    const input = allocateProjectInventorySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const phase = await getPhase(app, params.projectId, params.phaseId);

    if (!phase) {
      return reply.code(404).send({ message: "Project phase not found." });
    }

    const supply = await app.prisma.projectPhaseSupply.findFirst({
      where: { id: params.supplyId, phaseId: phase.id },
      include: {
        inventoryItem: {
          select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true, householdId: true }
        }
      }
    });

    if (!supply) {
      return reply.code(404).send({ message: "Phase supply not found." });
    }

    if (!supply.inventoryItemId || !supply.inventoryItem) {
      return reply.code(400).send({ message: "This supply is not linked to a household inventory item." });
    }

    if (supply.inventoryItem.householdId !== params.householdId) {
      return reply.code(400).send({ message: "Linked inventory item belongs to a different household." });
    }

    if (input.quantity <= 0) {
      return reply.code(400).send({ message: "Allocation quantity must be greater than zero." });
    }

    if (supply.inventoryItem.quantityOnHand < input.quantity) {
      return reply.code(400).send({ message: "Insufficient stock for this allocation." });
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const updatedSupply = await tx.projectPhaseSupply.update({
          where: { id: supply.id },
          data: {
            quantityOnHand: { increment: input.quantity },
            isProcured: true,
            procuredAt: supply.procuredAt ?? new Date(),
            ...(input.unitCost !== undefined ? { actualUnitCost: input.unitCost } : {})
          },
          include: {
            inventoryItem: {
              select: { id: true, name: true, quantityOnHand: true, unit: true, unitCost: true }
            },
            purchaseLines: activePurchaseRequestInclude
          }
        });

        const inventoryResult = await applyInventoryTransaction(tx, {
          inventoryItemId: supply.inventoryItemId!,
          userId: request.auth.userId,
          input: {
            type: "project_supply_allocation",
            quantity: -input.quantity,
            unitCost: input.unitCost,
            referenceType: "project_phase_supply",
            referenceId: supply.id,
            notes: input.notes
          }
        });

        return {
          supply: updatedSupply,
          inventoryResult
        };
      });

      await syncProjectDerivedStatuses(app.prisma, params.projectId);

      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supply.inventory_allocated",
        entityType: "project_phase_supply",
        entityId: supply.id,
        metadata: {
          supplyName: supply.name,
          quantityAllocated: input.quantity,
          inventoryItemName: supply.inventoryItem.name
        }
      });

      if (!supply.isProcured) {
        await logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "project.supply.procured",
          entityType: "project_phase_supply",
          entityId: supply.id,
          metadata: { supplyName: supply.name, phaseName: phase.name, actualUnitCost: input.unitCost ?? supply.actualUnitCost }
        });
      }

      refreshProjectArtifacts(params.householdId, params.projectId);

      return reply.code(201).send({
        supply: toProjectPhaseSupplyResponse(result.supply),
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
};
