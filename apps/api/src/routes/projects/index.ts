import type { Prisma } from "@prisma/client";
import {
  createProjectSchema,
  updateProjectSchema,
  createProjectAssetSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  createProjectExpenseSchema,
  updateProjectExpenseSchema,
  projectStatusSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";
import { syncLogToSearchIndex, syncProjectToSearchIndex, syncScheduleToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const projectParamsSchema = householdParamsSchema.extend({
  projectId: z.string().cuid()
});

const projectAssetParamsSchema = projectParamsSchema.extend({
  projectAssetId: z.string().cuid()
});

const taskParamsSchema = projectParamsSchema.extend({
  taskId: z.string().cuid()
});

const expenseParamsSchema = projectParamsSchema.extend({
  expenseId: z.string().cuid()
});

const listProjectsQuerySchema = z.object({
  status: projectStatusSchema.optional()
});

const toProjectSummary = (
  project: {
    id: string;
    householdId: string;
    name: string;
    description: string | null;
    status: string;
    startDate: Date | null;
    targetEndDate: Date | null;
    actualEndDate: Date | null;
    budgetAmount: number | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    expenses: { amount: number }[];
    _count: { tasks: number };
    tasks: { status: string }[];
    phases: { status: string }[];
  }
) => {
  const totalSpent = project.expenses.reduce((sum, e) => sum + e.amount, 0);
  const taskCount = project._count.tasks;
  const completedTaskCount = project.tasks.filter((t) => t.status === "completed").length;
  const phaseCount = project.phases.length;
  const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
  const percentComplete = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

  return {
    id: project.id,
    householdId: project.householdId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate?.toISOString() ?? null,
    targetEndDate: project.targetEndDate?.toISOString() ?? null,
    actualEndDate: project.actualEndDate?.toISOString() ?? null,
    budgetAmount: project.budgetAmount,
    notes: project.notes,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    totalBudgeted: project.budgetAmount,
    totalSpent,
    taskCount,
    completedTaskCount,
    phaseCount,
    completedPhaseCount,
    percentComplete
  };
};

const toProjectTaskChecklistItemResponse = (item: {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: item.id,
  taskId: item.taskId,
  title: item.title,
  isCompleted: item.isCompleted,
  completedAt: item.completedAt?.toISOString() ?? null,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

const toProjectBudgetCategoryResponse = (category: {
  id: string;
  projectId: string;
  name: string;
  budgetAmount: number | null;
  sortOrder: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  expenses?: { amount: number }[];
}) => ({
  id: category.id,
  projectId: category.projectId,
  name: category.name,
  budgetAmount: category.budgetAmount,
  sortOrder: category.sortOrder,
  notes: category.notes,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
  expenseCount: category.expenses?.length ?? 0,
  actualSpend: category.expenses?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0
});

const toProjectPhaseSummaryResponse = (phase: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: { status: string }[];
  checklistItems: { isCompleted: boolean }[];
  supplies: { isProcured: boolean }[];
  expenses: { amount: number }[];
}) => ({
  id: phase.id,
  projectId: phase.projectId,
  name: phase.name,
  description: phase.description,
  status: phase.status,
  sortOrder: phase.sortOrder,
  startDate: phase.startDate?.toISOString() ?? null,
  targetEndDate: phase.targetEndDate?.toISOString() ?? null,
  actualEndDate: phase.actualEndDate?.toISOString() ?? null,
  budgetAmount: phase.budgetAmount,
  notes: phase.notes,
  createdAt: phase.createdAt.toISOString(),
  updatedAt: phase.updatedAt.toISOString(),
  taskCount: phase.tasks.length,
  completedTaskCount: phase.tasks.filter((task) => task.status === "completed").length,
  checklistItemCount: phase.checklistItems.length,
  completedChecklistItemCount: phase.checklistItems.filter((item) => item.isCompleted).length,
  supplyCount: phase.supplies.length,
  procuredSupplyCount: phase.supplies.filter((supply) => supply.isProcured).length,
  expenseTotal: phase.expenses.reduce((sum, expense) => sum + expense.amount, 0)
});

const toProjectResponse = (project: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: project.id,
  householdId: project.householdId,
  name: project.name,
  description: project.description,
  status: project.status,
  startDate: project.startDate?.toISOString() ?? null,
  targetEndDate: project.targetEndDate?.toISOString() ?? null,
  actualEndDate: project.actualEndDate?.toISOString() ?? null,
  budgetAmount: project.budgetAmount,
  notes: project.notes,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString()
});

const toProjectAssetResponse = (pa: {
  id: string;
  projectId: string;
  assetId: string;
  role: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset?: { id: string; name: string; category: string } | null;
}) => ({
  id: pa.id,
  projectId: pa.projectId,
  assetId: pa.assetId,
  role: pa.role,
  notes: pa.notes,
  asset: pa.asset ?? undefined,
  createdAt: pa.createdAt.toISOString(),
  updatedAt: pa.updatedAt.toISOString()
});

const toProjectTaskResponse = (task: {
  id: string;
  projectId: string;
  phaseId: string | null;
  title: string;
  description: string | null;
  status: string;
  assignedToId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  estimatedCost: number | null;
  actualCost: number | null;
  sortOrder: number | null;
  scheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: { id: string; displayName: string | null } | null;
  checklistItems?: {
    id: string;
    taskId: string;
    title: string;
    isCompleted: boolean;
    completedAt: Date | null;
    sortOrder: number | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}) => ({
  id: task.id,
  projectId: task.projectId,
  phaseId: task.phaseId,
  title: task.title,
  description: task.description,
  status: task.status,
  assignedToId: task.assignedToId,
  assignee: task.assignedTo ? { id: task.assignedTo.id, displayName: task.assignedTo.displayName } : null,
  dueDate: task.dueDate?.toISOString() ?? null,
  completedAt: task.completedAt?.toISOString() ?? null,
  estimatedCost: task.estimatedCost,
  actualCost: task.actualCost,
  sortOrder: task.sortOrder,
  scheduleId: task.scheduleId,
  checklistItems: (task.checklistItems ?? []).map(toProjectTaskChecklistItemResponse),
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString()
});

const toProjectExpenseResponse = (expense: {
  id: string;
  projectId: string;
  phaseId: string | null;
  budgetCategoryId: string | null;
  description: string;
  amount: number;
  category: string | null;
  date: Date | null;
  taskId: string | null;
  serviceProviderId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: expense.id,
  projectId: expense.projectId,
  phaseId: expense.phaseId,
  budgetCategoryId: expense.budgetCategoryId,
  description: expense.description,
  amount: expense.amount,
  category: expense.category,
  date: expense.date?.toISOString() ?? null,
  taskId: expense.taskId,
  serviceProviderId: expense.serviceProviderId,
  notes: expense.notes,
  createdAt: expense.createdAt.toISOString(),
  updatedAt: expense.updatedAt.toISOString()
});

export const projectRoutes: FastifyPluginAsync = async (app) => {
  // ── Project CRUD ─────────────────────────────────────────────────

  app.get("/v1/households/:householdId/projects", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listProjectsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.ProjectWhereInput = {
      householdId: params.householdId,
      ...(query.status ? { status: query.status } : {})
    };

    const projects = await app.prisma.project.findMany({
      where,
      include: {
        expenses: { select: { amount: true } },
        tasks: { select: { status: true } },
        phases: { select: { status: true } },
        _count: { select: { tasks: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return projects.map(toProjectSummary);
  });

  app.post("/v1/households/:householdId/projects", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createProjectSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.create({
      data: {
        householdId: params.householdId,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        startDate: input.startDate ? new Date(input.startDate) : null,
        targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
        budgetAmount: input.budgetAmount ?? null,
        notes: input.notes ?? null
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name }
    });

    void syncProjectToSearchIndex(app.prisma, project.id).catch(console.error);

    return reply.code(201).send(toProjectResponse(project));
  });

  app.get("/v1/households/:householdId/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId },
      include: {
        assets: {
          include: {
            asset: { select: { id: true, name: true, category: true } }
          }
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, displayName: true } },
            checklistItems: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        expenses: {
          orderBy: { createdAt: "desc" }
        },
        phases: {
          include: {
            tasks: { select: { status: true } },
            checklistItems: { select: { isCompleted: true } },
            supplies: { select: { isProcured: true } },
            expenses: { select: { amount: true } }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        budgetCategories: {
          include: {
            expenses: { select: { amount: true } }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    return {
      ...toProjectResponse(project),
      assets: project.assets.map(toProjectAssetResponse),
      tasks: project.tasks.map(toProjectTaskResponse),
      expenses: project.expenses.map(toProjectExpenseResponse),
      phases: project.phases.map(toProjectPhaseSummaryResponse),
      budgetCategories: project.budgetCategories.map(toProjectBudgetCategoryResponse)
    };
  });

  app.patch("/v1/households/:householdId/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.targetEndDate !== undefined) data.targetEndDate = input.targetEndDate ? new Date(input.targetEndDate) : null;
    if (input.budgetAmount !== undefined) data.budgetAmount = input.budgetAmount ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const project = await app.prisma.project.update({
      where: { id: existing.id },
      data
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.updated",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name }
    });

    void syncProjectToSearchIndex(app.prisma, project.id).catch(console.error);

    return toProjectResponse(project);
  });

  app.delete("/v1/households/:householdId/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    await app.prisma.project.delete({ where: { id: existing.id } });

    void removeSearchIndexEntry(app.prisma, "project", existing.id).catch(console.error);

    return reply.code(204).send();
  });

  // ── Project Status Update ────────────────────────────────────────

  app.patch("/v1/households/:householdId/projects/:projectId/status", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const { status } = z.object({ status: projectStatusSchema }).parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const data: Prisma.ProjectUncheckedUpdateInput = { status };

    if (status === "completed") {
      data.actualEndDate = new Date();
    }

    const project = await app.prisma.project.update({
      where: { id: existing.id },
      data
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.status_changed",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name, oldStatus: existing.status, newStatus: status }
    });

    void syncProjectToSearchIndex(app.prisma, project.id).catch(console.error);

    return toProjectResponse(project);
  });

  // ── Project Assets ───────────────────────────────────────────────

  app.post("/v1/households/:householdId/projects/:projectId/assets", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectAssetSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const asset = await app.prisma.asset.findFirst({
      where: { id: input.assetId, householdId: params.householdId }
    });

    if (!asset) {
      return reply.code(400).send({ message: "Asset not found or belongs to a different household." });
    }

    const existingLink = await app.prisma.projectAsset.findUnique({
      where: { projectId_assetId: { projectId: project.id, assetId: asset.id } }
    });

    if (existingLink) {
      return reply.code(409).send({ message: "Asset is already linked to this project." });
    }

    const projectAsset = await app.prisma.projectAsset.create({
      data: {
        projectId: project.id,
        assetId: asset.id,
        role: input.role ?? null,
        notes: input.notes ?? null
      },
      include: {
        asset: { select: { id: true, name: true, category: true } }
      }
    });

    return reply.code(201).send(toProjectAssetResponse(projectAsset));
  });

  app.delete("/v1/households/:householdId/projects/:projectId/assets/:projectAssetId", async (request, reply) => {
    const params = projectAssetParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const projectAsset = await app.prisma.projectAsset.findFirst({
      where: {
        id: params.projectAssetId,
        project: { id: params.projectId, householdId: params.householdId }
      }
    });

    if (!projectAsset) {
      return reply.code(404).send({ message: "Project asset link not found." });
    }

    await app.prisma.projectAsset.delete({ where: { id: projectAsset.id } });

    return reply.code(204).send();
  });

  // ── Project Tasks ────────────────────────────────────────────────

  app.get("/v1/households/:householdId/projects/:projectId/tasks", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId },
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const tasks = await app.prisma.projectTask.findMany({
      where: { projectId: project.id },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        checklistItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return tasks.map(toProjectTaskResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/tasks", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectTaskSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId },
      select: { id: true, householdId: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.assignedToId) {
      const membership = await app.prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: params.householdId, userId: input.assignedToId } }
      });

      if (!membership) {
        return reply.code(400).send({ message: "Assigned user is not a member of this household." });
      }
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    if (input.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: input.scheduleId,
          asset: { householdId: params.householdId }
        },
        select: { id: true }
      });

      if (!schedule) {
        return reply.code(400).send({ message: "Linked schedule not found or belongs to a different household." });
      }
    }

    const task = await app.prisma.projectTask.create({
      data: {
        projectId: project.id,
        phaseId: input.phaseId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        assignedToId: input.assignedToId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        estimatedCost: input.estimatedCost ?? null,
        actualCost: input.actualCost ?? null,
        sortOrder: input.sortOrder ?? null,
        scheduleId: input.scheduleId ?? null
      },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        checklistItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (input.assignedToId) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.task.assigned",
        entityType: "project_task",
        entityId: task.id,
        metadata: { taskTitle: task.title, assignedToId: input.assignedToId }
      });
    }

    return reply.code(201).send(toProjectTaskResponse(task));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/tasks/:taskId", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const input = updateProjectTaskSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectTask.findFirst({
      where: {
        id: params.taskId,
        project: { id: params.projectId, householdId: params.householdId }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    if (input.assignedToId) {
      const membership = await app.prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: params.householdId, userId: input.assignedToId } }
      });

      if (!membership) {
        return reply.code(400).send({ message: "Assigned user is not a member of this household." });
      }
    }

    if (input.phaseId !== undefined && input.phaseId !== null) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: params.projectId },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    if (input.scheduleId !== undefined && input.scheduleId !== null) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: input.scheduleId,
          asset: { householdId: params.householdId }
        },
        select: { id: true }
      });

      if (!schedule) {
        return reply.code(400).send({ message: "Linked schedule not found or belongs to a different household." });
      }
    }

    const data: Prisma.ProjectTaskUncheckedUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.phaseId !== undefined) data.phaseId = input.phaseId ?? null;
    if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId ?? null;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.estimatedCost !== undefined) data.estimatedCost = input.estimatedCost ?? null;
    if (input.actualCost !== undefined) data.actualCost = input.actualCost ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.scheduleId !== undefined) data.scheduleId = input.scheduleId ?? null;

    const effectiveScheduleId = input.scheduleId !== undefined ? input.scheduleId : existing.scheduleId;

    // Handle status change to completed
    if (input.status !== undefined) {
      data.status = input.status;

      if (input.status === "completed" && existing.status !== "completed") {
        data.completedAt = input.completedAt ? new Date(input.completedAt) : new Date();

        // If linked to a maintenance schedule, optionally trigger schedule completion
        let createdScheduleLogId: string | null = null;

        if (effectiveScheduleId) {
          const schedule = await app.prisma.maintenanceSchedule.findUnique({
            where: { id: effectiveScheduleId },
            include: { asset: { select: { id: true, householdId: true } } }
          });

          if (schedule && schedule.asset.householdId === params.householdId) {
            await app.prisma.$transaction(async (tx) => {
              const logData: Prisma.MaintenanceLogUncheckedCreateInput = {
                assetId: schedule.assetId,
                scheduleId: schedule.id,
                completedById: request.auth.userId,
                title: input.title ?? existing.title,
                completedAt: new Date()
              };

              const createdLog = await tx.maintenanceLog.create({ data: logData });
              createdScheduleLogId = createdLog.id;
              await syncScheduleCompletionFromLogs(tx, schedule.id);
            });

            void Promise.all([
              syncScheduleToSearchIndex(app.prisma, schedule.id),
              ...(createdScheduleLogId ? [syncLogToSearchIndex(app.prisma, createdScheduleLogId)] : [])
            ]).catch(console.error);
          }
        }

        await logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "project.task.completed",
          entityType: "project_task",
          entityId: existing.id,
          metadata: { taskTitle: existing.title }
        });
      } else if (input.status !== "completed") {
        data.completedAt = null;
      }
    } else if (input.completedAt !== undefined) {
      data.completedAt = input.completedAt ? new Date(input.completedAt) : null;
    }

    // Track assignment changes
    if (input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.task.assigned",
        entityType: "project_task",
        entityId: existing.id,
        metadata: {
          taskTitle: existing.title,
          previousAssignedToId: existing.assignedToId,
          newAssignedToId: input.assignedToId
        }
      });
    }

    const task = await app.prisma.projectTask.update({
      where: { id: existing.id },
      data,
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        checklistItems: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    return toProjectTaskResponse(task);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/tasks/:taskId", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectTask.findFirst({
      where: {
        id: params.taskId,
        project: { id: params.projectId, householdId: params.householdId }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    await app.prisma.projectTask.delete({ where: { id: existing.id } });

    return reply.code(204).send();
  });

  // ── Project Expenses ─────────────────────────────────────────────

  app.get("/v1/households/:householdId/projects/:projectId/expenses", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId },
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const expenses = await app.prisma.projectExpense.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" }
    });

    return expenses.map(toProjectExpenseResponse);
  });

  app.post("/v1/households/:householdId/projects/:projectId/expenses", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectExpenseSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId },
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.taskId) {
      const task = await app.prisma.projectTask.findFirst({
        where: { id: input.taskId, projectId: project.id },
        select: { id: true }
      });

      if (!task) {
        return reply.code(400).send({ message: "Referenced task not found in this project." });
      }
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    if (input.budgetCategoryId) {
      const budgetCategory = await app.prisma.projectBudgetCategory.findFirst({
        where: { id: input.budgetCategoryId, projectId: project.id },
        select: { id: true }
      });

      if (!budgetCategory) {
        return reply.code(400).send({ message: "Referenced budget category not found in this project." });
      }
    }

    if (input.serviceProviderId) {
      const provider = await app.prisma.serviceProvider.findFirst({
        where: { id: input.serviceProviderId, householdId: params.householdId },
        select: { id: true }
      });

      if (!provider) {
        return reply.code(400).send({ message: "Service provider not found or belongs to a different household." });
      }
    }

    const expense = await app.prisma.projectExpense.create({
      data: {
        projectId: project.id,
        phaseId: input.phaseId ?? null,
        budgetCategoryId: input.budgetCategoryId ?? null,
        description: input.description,
        amount: input.amount,
        category: input.category ?? null,
        date: input.date ? new Date(input.date) : null,
        taskId: input.taskId ?? null,
        serviceProviderId: input.serviceProviderId ?? null,
        notes: input.notes ?? null
      }
    });

    return reply.code(201).send(toProjectExpenseResponse(expense));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/expenses/:expenseId", async (request, reply) => {
    const params = expenseParamsSchema.parse(request.params);
    const input = updateProjectExpenseSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectExpense.findFirst({
      where: {
        id: params.expenseId,
        project: { id: params.projectId, householdId: params.householdId }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project expense not found." });
    }

    if (input.taskId !== undefined && input.taskId !== null) {
      const task = await app.prisma.projectTask.findFirst({
        where: { id: input.taskId, projectId: params.projectId },
        select: { id: true }
      });

      if (!task) {
        return reply.code(400).send({ message: "Referenced task not found in this project." });
      }
    }

    if (input.phaseId !== undefined && input.phaseId !== null) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: params.projectId },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    if (input.budgetCategoryId !== undefined && input.budgetCategoryId !== null) {
      const budgetCategory = await app.prisma.projectBudgetCategory.findFirst({
        where: { id: input.budgetCategoryId, projectId: params.projectId },
        select: { id: true }
      });

      if (!budgetCategory) {
        return reply.code(400).send({ message: "Referenced budget category not found in this project." });
      }
    }

    if (input.serviceProviderId !== undefined && input.serviceProviderId !== null) {
      const provider = await app.prisma.serviceProvider.findFirst({
        where: { id: input.serviceProviderId, householdId: params.householdId },
        select: { id: true }
      });

      if (!provider) {
        return reply.code(400).send({ message: "Service provider not found or belongs to a different household." });
      }
    }

    const data: Prisma.ProjectExpenseUncheckedUpdateInput = {};

    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.category !== undefined) data.category = input.category ?? null;
    if (input.date !== undefined) data.date = input.date ? new Date(input.date) : null;
    if (input.phaseId !== undefined) data.phaseId = input.phaseId ?? null;
    if (input.budgetCategoryId !== undefined) data.budgetCategoryId = input.budgetCategoryId ?? null;
    if (input.taskId !== undefined) data.taskId = input.taskId ?? null;
    if (input.serviceProviderId !== undefined) data.serviceProviderId = input.serviceProviderId ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const expense = await app.prisma.projectExpense.update({
      where: { id: existing.id },
      data
    });

    return toProjectExpenseResponse(expense);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/expenses/:expenseId", async (request, reply) => {
    const params = expenseParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectExpense.findFirst({
      where: {
        id: params.expenseId,
        project: { id: params.projectId, householdId: params.householdId }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project expense not found." });
    }

    await app.prisma.projectExpense.delete({ where: { id: existing.id } });

    return reply.code(204).send();
  });
};
