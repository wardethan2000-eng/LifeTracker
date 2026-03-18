import type { Prisma, PrismaClient } from "@prisma/client";
import {
  cloneProjectSchema,
  createOffsetPaginationQuerySchema,
  createProjectPurchaseRequestSchema,
  createProjectSchema,
  createProjectTemplateSchema,
  noteCategoryValues,
  projectStatusCountListSchema,
  projectStatusValues,
  instantiateProjectTemplateSchema,
  updateProjectSchema,
  createProjectAssetSchema,
  updateProjectAssetSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  createQuickTodoSchema,
  promoteTaskSchema,
  createProjectExpenseSchema,
  updateProjectExpenseSchema,
  projectStatusSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, requireHouseholdMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import { buildOffsetPage } from "../../lib/pagination.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import {
  buildProjectCompletionGuardrailMessage,
  getProjectCompletionSummary,
  syncProjectDerivedStatuses
} from "../../lib/project-status.js";
import { buildProjectTemplateSnapshot, instantiateProjectFromTemplateSnapshot, summarizeProjectTemplateSnapshot, type ProjectTemplateSnapshot } from "../../lib/project-templates.js";
import { assertTaskDependenciesAcyclic, buildProjectTaskGraphSummary } from "../../lib/project-task-graph.js";
import {
  ProjectHierarchyValidationError,
  resolveProjectHierarchyInput,
  syncProjectTreeDepths
} from "../../lib/project-hierarchy.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";
import {
  toInventoryPurchaseResponse,
  toProjectAssetResponse,
  toProjectBudgetCategoryResponse,
  toProjectExpenseResponse,
  toProjectPortfolioItemResponse,
  toProjectPhaseSummaryResponse,
  toProjectResponse,
  toProjectTaskResponse,
  toProjectTemplateResponse
} from "../../lib/serializers/index.js";
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

const listProjectsQuerySchema = createOffsetPaginationQuerySchema({
  defaultLimit: 25,
  maxLimit: 100
}).extend({
  status: projectStatusSchema.optional(),
  parentProjectId: z.string().optional()
});

const projectPortfolioQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  q: z.string().trim().min(1).max(200).optional()
});

const projectTemplateParamsSchema = householdParamsSchema.extend({
  templateId: z.string().cuid()
});

const projectTaskSummarySelect = {
  id: true,
  status: true,
  taskType: true,
  isCompleted: true,
  phaseId: true,
  estimatedHours: true,
  actualHours: true,
  predecessorLinks: {
    select: { predecessorTaskId: true }
  }
} satisfies Prisma.ProjectTaskSelect;

const projectTaskDetailInclude = {
  assignedTo: { select: { id: true, displayName: true } },
  predecessorLinks: { select: { predecessorTaskId: true } },
  successorLinks: { select: { successorTaskId: true } },
  checklistItems: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  }
} satisfies Prisma.ProjectTaskInclude;

const parseTemplateSnapshot = (value: Prisma.JsonValue): ProjectTemplateSnapshot => value as ProjectTemplateSnapshot;

const activeProjectWhere = (
  householdId: string,
  projectId?: string
): Prisma.ProjectWhereInput => ({
  householdId,
  deletedAt: null,
  ...(projectId ? { id: projectId } : {})
});

const buildProjectPortfolioWhere = (
  householdId: string,
  filters: z.infer<typeof projectPortfolioQuerySchema>
): Prisma.ProjectWhereInput => {
  const baseWhere: Prisma.ProjectWhereInput = {
    householdId,
    deletedAt: null
  };

  if (filters.status !== undefined) {
    baseWhere.status = filters.status;
  }

  const searchText = filters.q?.trim();
  const normalizedSearchText = searchText?.toLowerCase() ?? "";
  const matchingProjectStatuses = projectStatusValues.filter((status) => (
    status.includes(normalizedSearchText) || status.replace(/_/g, " ").includes(normalizedSearchText)
  ));

  if (!searchText) {
    return baseWhere;
  }

  const normalizedStatusSearch = searchText.toLowerCase().replace(/\s+/g, "_");

  return {
    ...baseWhere,
    OR: [
      { name: { contains: searchText, mode: "insensitive" } },
      { description: { contains: searchText, mode: "insensitive" } },
      { notes: { contains: searchText, mode: "insensitive" } },
      ...(matchingProjectStatuses.length > 0 ? [{ status: { in: matchingProjectStatuses } }] : []),
      {
        phases: {
          some: {
            deletedAt: null,
            OR: [
              { name: { contains: searchText, mode: "insensitive" } },
              { description: { contains: searchText, mode: "insensitive" } },
              { notes: { contains: searchText, mode: "insensitive" } },
              { status: { contains: normalizedStatusSearch, mode: "insensitive" } }
            ]
          }
        }
      },
      {
        tasks: {
          some: {
            deletedAt: null,
            OR: [
              { title: { contains: searchText, mode: "insensitive" } },
              { description: { contains: searchText, mode: "insensitive" } },
              { status: { contains: normalizedStatusSearch, mode: "insensitive" } },
              { taskType: { contains: searchText, mode: "insensitive" } }
            ]
          }
        }
      },
      {
        noteEntries: {
          some: {
            deletedAt: null,
            OR: [
              { title: { contains: searchText, mode: "insensitive" } },
              { body: { contains: searchText, mode: "insensitive" } },
              { url: { contains: searchText, mode: "insensitive" } },
              { attachmentName: { contains: searchText, mode: "insensitive" } }
            ]
          }
        }
      },
      {
        expenses: {
          some: {
            deletedAt: null,
            OR: [
              { description: { contains: searchText, mode: "insensitive" } },
              { category: { contains: searchText, mode: "insensitive" } },
              { notes: { contains: searchText, mode: "insensitive" } }
            ]
          }
        }
      },
      {
        phases: {
          some: {
            deletedAt: null,
            supplies: {
              some: {
                deletedAt: null,
                OR: [
                  { name: { contains: searchText, mode: "insensitive" } },
                  { description: { contains: searchText, mode: "insensitive" } },
                  { supplier: { contains: searchText, mode: "insensitive" } },
                  { supplierUrl: { contains: searchText, mode: "insensitive" } },
                  { notes: { contains: searchText, mode: "insensitive" } }
                ]
              }
            }
          }
        }
      }
    ]
  };
};

const isProjectSummaryTaskCompleted = (task: {
  status: string;
  taskType: string;
  isCompleted: boolean;
}): boolean => task.status === "completed" || (task.taskType === "quick" && task.isCompleted);

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
    parentProjectId: string | null;
    depth: number;
    createdAt: Date;
    updatedAt: Date;
    expenses: { amount: number }[];
    _count: { tasks: number };
    tasks: {
      id: string;
      status: string;
      taskType: string;
      isCompleted: boolean;
      phaseId: string | null;
      estimatedHours: number | null;
      actualHours: number | null;
      predecessorLinks: { predecessorTaskId: string }[];
    }[];
    phases: {
      id: string;
      name: string;
      status: string;
    }[];
  }
) => {
  const taskGraph = buildProjectTaskGraphSummary(
    project.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      taskType: task.taskType,
      isCompleted: task.isCompleted,
      estimatedHours: task.estimatedHours,
      predecessorTaskIds: task.predecessorLinks.map((dependency) => dependency.predecessorTaskId)
    })),
    project.tasks.flatMap((task) => task.predecessorLinks.map((dependency) => ({
      predecessorTaskId: dependency.predecessorTaskId,
      successorTaskId: task.id
    }))),
    new Map(project.tasks.map((task) => [task.id, task.actualHours ?? 0]))
  );
  const totalSpent = project.expenses.reduce((sum, e) => sum + e.amount, 0);
  const taskCount = project._count.tasks;
  const completedTaskCount = project.tasks.filter(isProjectSummaryTaskCompleted).length;
  const phaseCount = project.phases.length;
  const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
  const percentComplete = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;
  const tasksByPhase = project.tasks.reduce<Map<string, typeof project.tasks>>((accumulator, task) => {
    if (!task.phaseId) {
      return accumulator;
    }

    const current = accumulator.get(task.phaseId) ?? [];
    current.push(task);
    accumulator.set(task.phaseId, current);
    return accumulator;
  }, new Map());
  const phaseProgress = project.phases.map((phase) => ({
    name: phase.name,
    status: phase.status,
    taskCount: (tasksByPhase.get(phase.id) ?? []).length,
    completedTaskCount: (tasksByPhase.get(phase.id) ?? []).filter(isProjectSummaryTaskCompleted).length
  }));
  const unphasedTasks = project.tasks.filter((task) => task.phaseId === null);

  if (unphasedTasks.length > 0) {
    phaseProgress.push({
      name: "Unphased",
      status: "active",
      taskCount: unphasedTasks.length,
      completedTaskCount: unphasedTasks.filter(isProjectSummaryTaskCompleted).length
    });
  }

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
    parentProjectId: project.parentProjectId,
    depth: project.depth,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    totalBudgeted: project.budgetAmount,
    totalSpent,
    taskCount,
    completedTaskCount,
    phaseCount,
    completedPhaseCount,
    percentComplete,
    phaseProgress,
    totalEstimatedHours: taskGraph.totalEstimatedHours,
    totalActualHours: taskGraph.totalActualHours,
    remainingEstimatedHours: taskGraph.remainingEstimatedHours,
    blockedTaskCount: taskGraph.blockedTaskCount,
    criticalTaskCount: taskGraph.criticalTaskCount
  };
};

const buildProjectInventoryRollups = (
  links: Array<{
    projectId: string;
    quantityNeeded: number;
    quantityAllocated: number;
    budgetedUnitCost: number | null;
    inventoryItem: { unitCost: number | null };
  }>
) => {
  const rollups = new Map<string, {
    inventoryLineCount: number;
    totalInventoryNeeded: number;
    totalInventoryAllocated: number;
    totalInventoryRemaining: number;
    plannedInventoryCost: number;
  }>();

  for (const link of links) {
    const current = rollups.get(link.projectId) ?? {
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

    rollups.set(link.projectId, current);
  }

  return rollups;
};

const activeProjectPurchaseStatuses = ["draft", "ordered"] as const;

const activeProjectSupplyPurchaseInclude = {
  where: {
    purchase: {
      status: {
        in: [...activeProjectPurchaseStatuses]
      }
    }
  },
  select: {
    id: true,
    status: true,
    plannedQuantity: true,
    orderedQuantity: true,
    receivedQuantity: true,
    purchaseId: true,
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

const getProjectSupplyPurchaseRequest = (supply: {
  purchaseLines?: Array<{
    id: string;
    status: string;
    plannedQuantity: number;
    orderedQuantity: number | null;
    receivedQuantity: number | null;
    purchaseId: string;
    purchase: {
      id: string;
      status: string;
      supplierName: string | null;
      supplierUrl: string | null;
    };
  }>;
}) => {
  const purchaseLine = supply.purchaseLines?.[0];

  if (!purchaseLine) {
    return null;
  }

  return {
    purchaseId: purchaseLine.purchase.id,
    purchaseLineId: purchaseLine.id,
    purchaseStatus: purchaseLine.purchase.status,
    lineStatus: purchaseLine.status,
    plannedQuantity: purchaseLine.plannedQuantity,
    orderedQuantity: purchaseLine.orderedQuantity,
    receivedQuantity: purchaseLine.receivedQuantity,
    supplierName: purchaseLine.purchase.supplierName,
    supplierUrl: purchaseLine.purchase.supplierUrl
  };
};

const getInventoryPurchaseSupplierKey = (supplierName: string | null, supplierUrl: string | null): string => (
  `${supplierName?.trim().toLowerCase() ?? ""}::${supplierUrl?.trim().toLowerCase() ?? ""}`
);

const getProjectTreeIds = async (prisma: PrismaClient, projectId: string): Promise<string[]> => {
  const treeRows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE project_tree AS (
      SELECT id FROM "Project" WHERE id = ${projectId} AND "deletedAt" IS NULL
      UNION ALL
      SELECT p.id FROM "Project" p
      JOIN project_tree pt ON p."parentProjectId" = pt.id
      WHERE p."deletedAt" IS NULL
    )
    SELECT id FROM project_tree
  `;

  return treeRows.map((row) => row.id);
};

const buildProjectBreadcrumbs = async (
  prisma: PrismaClient,
  projectId: string,
  householdId: string
): Promise<{ id: string; name: string }[]> => {
  const result = await prisma.$queryRaw<{ id: string; name: string }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, "parentProjectId"
      FROM "Project"
      WHERE id = ${projectId} AND "householdId" = ${householdId} AND "deletedAt" IS NULL
      UNION ALL
      SELECT p.id, p.name, p."parentProjectId"
      FROM "Project" p
      JOIN ancestors a ON p.id = a."parentProjectId"
      WHERE p."deletedAt" IS NULL
    )
    SELECT id, name FROM ancestors
  `;
  return result.reverse();
};

const getProjectTreeStats = async (
  prisma: PrismaClient,
  projectId: string
): Promise<{
  treeBudgetTotal: number | null;
  treeSpentTotal: number;
  treeTaskCount: number;
  treeCompletedTaskCount: number;
  treePercentComplete: number;
  descendantProjectCount: number;
}> => {
  const result = await prisma.$queryRaw<{
    tree_budget: number | null;
    tree_spent: number;
    tree_tasks: bigint;
    tree_completed: bigint;
    descendant_count: bigint;
  }[]>`
    WITH RECURSIVE project_tree AS (
      SELECT id FROM "Project" WHERE id = ${projectId} AND "deletedAt" IS NULL
      UNION ALL
      SELECT p.id FROM "Project" p
      JOIN project_tree pt ON p."parentProjectId" = pt.id
      WHERE p."deletedAt" IS NULL
    )
    SELECT
      SUM(proj."budgetAmount") as tree_budget,
      COALESCE(SUM(exp_agg.total), 0) as tree_spent,
      COALESCE(SUM(task_agg.total), 0) as tree_tasks,
      COALESCE(SUM(task_agg.completed), 0) as tree_completed,
      (COUNT(DISTINCT pt.id) - 1) as descendant_count
    FROM project_tree pt
    JOIN "Project" proj ON proj.id = pt.id
    LEFT JOIN LATERAL (
      SELECT SUM(amount) as total FROM "ProjectExpense" WHERE "projectId" = pt.id AND "deletedAt" IS NULL
    ) exp_agg ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM "ProjectTask" WHERE "projectId" = pt.id AND "deletedAt" IS NULL
    ) task_agg ON true
  `;

  const row = result[0];
  const taskCount = Number(row?.tree_tasks ?? 0);
  const completedCount = Number(row?.tree_completed ?? 0);

  return {
    treeBudgetTotal: row?.tree_budget ?? null,
    treeSpentTotal: Number(row?.tree_spent ?? 0),
    treeTaskCount: taskCount,
    treeCompletedTaskCount: completedCount,
    treePercentComplete: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
    descendantProjectCount: Number(row?.descendant_count ?? 0)
  };
};

export const projectRoutes: FastifyPluginAsync = async (app) => {
  const refreshProjectArtifacts = (householdId: string, projectId: string) => {
    void Promise.all([
      syncProjectToSearchIndex(app.prisma, projectId),
      enqueueNotificationScan({ householdId })
    ]).catch(console.error);
  };

  // ── Project CRUD ─────────────────────────────────────────────────

  app.get("/v1/households/:householdId/projects/status-counts", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = projectPortfolioQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const grouped = await app.prisma.project.groupBy({
      by: ["status"],
      where: buildProjectPortfolioWhere(params.householdId, query),
      _count: {
        _all: true
      }
    });

    const countByStatus = new Map(grouped.map((item) => [item.status, item._count._all]));

    return projectStatusCountListSchema.parse(projectStatusValues.map((status) => ({
      status,
      count: countByStatus.get(status) ?? 0
    })));
  });

  app.get("/v1/households/:householdId/projects", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listProjectsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const where: Prisma.ProjectWhereInput = {
      householdId: params.householdId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.parentProjectId !== undefined
        ? { parentProjectId: query.parentProjectId === "null" ? null : query.parentProjectId }
        : {})
    };

    const projectQuery = {
      where,
      include: {
        expenses: { where: { deletedAt: null }, select: { amount: true } },
        tasks: { where: { deletedAt: null }, select: projectTaskSummarySelect },
        phases: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        _count: { select: { tasks: true } }
      },
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }]
    } satisfies Prisma.ProjectFindManyArgs;

    if (query.paginated) {
      const [projects, total] = await Promise.all([
        app.prisma.project.findMany({
          ...projectQuery,
          skip: query.offset,
          take: query.limit
        }),
        app.prisma.project.count({ where })
      ]);

      return buildOffsetPage(
        projects.map(toProjectSummary),
        total,
        query
      );
    }

    const projects = await app.prisma.project.findMany(projectQuery);

    return projects.map(toProjectSummary);
  });

  app.get("/v1/households/:householdId/projects/portfolio", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = projectPortfolioQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const projects = await app.prisma.project.findMany({
      where: buildProjectPortfolioWhere(params.householdId, query),
      include: {
        expenses: { where: { deletedAt: null }, select: { amount: true } },
        tasks: { where: { deletedAt: null }, select: projectTaskSummarySelect },
        phases: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        _count: { select: { tasks: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const projectIds = projects.map((project) => project.id);
    const inventoryLinks = projectIds.length > 0
      ? await app.prisma.projectInventoryItem.findMany({
          where: {
            projectId: { in: projectIds }
          },
          select: {
            projectId: true,
            quantityNeeded: true,
            quantityAllocated: true,
            budgetedUnitCost: true,
            inventoryItem: {
              select: {
                unitCost: true
              }
            }
          },
          orderBy: [{ projectId: "asc" }, { createdAt: "asc" }]
        })
      : [];
    const rollups = buildProjectInventoryRollups(inventoryLinks);

    return projects.map((project) => {
      const summary = toProjectSummary(project);
      const rollup = rollups.get(project.id) ?? {
        inventoryLineCount: 0,
        totalInventoryNeeded: 0,
        totalInventoryAllocated: 0,
        totalInventoryRemaining: 0,
        plannedInventoryCost: 0
      };

      return toProjectPortfolioItemResponse({
        ...summary,
        ...rollup
      });
    });
  });

  app.post("/v1/households/:householdId/projects", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createProjectSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    let hierarchy: { parentProjectId: string | null; depth: number };

    try {
      hierarchy = await resolveProjectHierarchyInput(app.prisma, {
        householdId: params.householdId,
        parentProjectId: input.parentProjectId ?? null
      });
    } catch (error) {
      if (error instanceof ProjectHierarchyValidationError) {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
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
        notes: input.notes ?? null,
        parentProjectId: hierarchy.parentProjectId,
        depth: hierarchy.depth
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

    refreshProjectArtifacts(params.householdId, project.id);

    return reply.code(201).send(toProjectResponse(project));
  });

  app.get("/v1/households/:householdId/projects/:projectId", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, params.projectId),
      include: {
        assets: {
          include: {
            asset: { select: { id: true, name: true, category: true } }
          }
        },
        hobbyLinks: {
          include: {
            hobby: {
              select: { id: true, name: true, hobbyType: true, status: true }
            }
          }
        },
        tasks: {
          where: { deletedAt: null },
          include: projectTaskDetailInclude,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        expenses: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" }
        },
        phases: {
          where: { deletedAt: null },
          include: {
            tasks: { where: { deletedAt: null }, select: projectTaskSummarySelect },
            checklistItems: { select: { isCompleted: true } },
            supplies: { where: { deletedAt: null }, select: { isProcured: true } },
            expenses: { where: { deletedAt: null }, select: { amount: true } }
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

    const [breadcrumbs, childProjects] = await Promise.all([
      buildProjectBreadcrumbs(app.prisma as PrismaClient, project.id, params.householdId),
      app.prisma.project.findMany({
        where: { parentProjectId: project.id, householdId: params.householdId, deletedAt: null },
        include: {
          tasks: { where: { deletedAt: null }, select: projectTaskSummarySelect },
          expenses: { where: { deletedAt: null }, select: { amount: true } },
          _count: { select: { childProjects: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const childSummaries = childProjects.map((child) => {
      const taskCount = child.tasks.length;
      const completedTaskCount = child.tasks.filter(
        (t) => t.status === "completed" || (t.taskType === "quick" && t.isCompleted)
      ).length;
      return {
        id: child.id,
        name: child.name,
        status: child.status,
        depth: child.depth,
        budgetAmount: child.budgetAmount,
        startDate: child.startDate?.toISOString() ?? null,
        targetEndDate: child.targetEndDate?.toISOString() ?? null,
        taskCount,
        completedTaskCount,
        percentComplete: taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0,
        totalSpent: child.expenses.reduce((sum, e) => sum + e.amount, 0),
        childProjectCount: child._count.childProjects
      };
    });

    const treeStats = childSummaries.length > 0
      ? await getProjectTreeStats(app.prisma as PrismaClient, project.id)
      : null;
    const taskGraph = buildProjectTaskGraphSummary(
      project.tasks.map((task) => ({
        id: task.id,
        status: task.status,
        taskType: task.taskType ?? "full",
        isCompleted: task.isCompleted ?? false,
        estimatedHours: task.estimatedHours ?? null,
        predecessorTaskIds: (task.predecessorLinks ?? []).map((dependency) => dependency.predecessorTaskId)
      })),
      project.tasks.flatMap((task) => (task.predecessorLinks ?? []).map((dependency) => ({
        predecessorTaskId: dependency.predecessorTaskId,
        successorTaskId: task.id
      }))),
      new Map(project.tasks.map((task) => [task.id, task.actualHours ?? 0]))
    );

    return {
      ...toProjectResponse(project),
      assets: project.assets.map(toProjectAssetResponse),
      hobbyLinks: project.hobbyLinks.map((link) => ({
        id: link.id,
        hobbyId: link.hobbyId,
        hobbyName: link.hobby.name,
        hobbyType: link.hobby.hobbyType ?? null,
        hobbyStatus: link.hobby.status,
        role: null,
        notes: link.notes ?? null
      })),
      tasks: project.tasks.map((task) => toProjectTaskResponse(task, taskGraph.byTaskId.get(task.id))),
      expenses: project.expenses.map(toProjectExpenseResponse),
      phases: project.phases.map(toProjectPhaseSummaryResponse),
      budgetCategories: project.budgetCategories.map(toProjectBudgetCategoryResponse),
      breadcrumbs,
      childProjects: childSummaries,
      treeStats,
      criticalPath: {
        taskIds: taskGraph.criticalPathTaskIds,
        totalEstimatedHours: taskGraph.criticalPathHours
      }
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
      where: activeProjectWhere(params.householdId, params.projectId)
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.status === "completed") {
      const summary = await getProjectCompletionSummary(app.prisma, existing.id);

      if (summary && !summary.canComplete) {
        return reply.code(400).send({ message: buildProjectCompletionGuardrailMessage(summary) });
      }
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.targetEndDate !== undefined) data.targetEndDate = input.targetEndDate ? new Date(input.targetEndDate) : null;
    if (input.budgetAmount !== undefined) data.budgetAmount = input.budgetAmount ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    if (input.parentProjectId !== undefined) {
      try {
        const hierarchy = await resolveProjectHierarchyInput(app.prisma, {
          householdId: params.householdId,
          projectId: existing.id,
          parentProjectId: input.parentProjectId
        });

        data.parentProjectId = hierarchy.parentProjectId;
        data.depth = hierarchy.depth;
      } catch (error) {
        if (error instanceof ProjectHierarchyValidationError) {
          return reply.code(400).send({ message: error.message });
        }

        throw error;
      }
    }

    const project = await app.prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: existing.id },
        data
      });

      if (input.parentProjectId !== undefined) {
        await syncProjectTreeDepths(tx, updatedProject.id);
      }

      await syncProjectDerivedStatuses(tx, existing.id);

      return tx.project.findUniqueOrThrow({
        where: { id: updatedProject.id }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.updated",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name }
    });

    refreshProjectArtifacts(params.householdId, project.id);

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
      where: activeProjectWhere(params.householdId, params.projectId)
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    await app.prisma.project.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });

    await emitDomainEvent(app.prisma, {
      householdId: params.householdId,
      eventType: "project.deleted",
      entityType: "project",
      entityId: existing.id,
      payload: {
        name: existing.name,
        status: existing.status
      }
    });

    void removeSearchIndexEntry(app.prisma, "project", existing.id).catch(console.error);

    return reply.code(204).send();
  });

  // ── Project Templates & Cloning ────────────────────────────────

  app.get("/v1/households/:householdId/project-templates", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const templates = await app.prisma.projectTemplate.findMany({
      where: { householdId: params.householdId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });

    return templates.map((template) => {
      const summary = summarizeProjectTemplateSnapshot(parseTemplateSnapshot(template.snapshot));
      return toProjectTemplateResponse({
        id: template.id,
        householdId: template.householdId,
        sourceProjectId: template.sourceProjectId,
        name: template.name,
        description: template.description,
        notes: template.notes,
        phaseCount: summary.phaseCount,
        taskCount: summary.taskCount,
        assetCount: summary.assetCount,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      });
    });
  });

  app.post("/v1/households/:householdId/project-templates", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createProjectTemplateSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const sourceProject = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, input.sourceProjectId),
      include: {
        assets: {
          select: {
            assetId: true,
            relationship: true,
            role: true,
            notes: true
          }
        },
        budgetCategories: {
          select: {
            name: true,
            budgetAmount: true,
            sortOrder: true,
            notes: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        phases: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            sortOrder: true,
            startDate: true,
            targetEndDate: true,
            budgetAmount: true,
            notes: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        tasks: {
          select: {
            id: true,
            phaseId: true,
            title: true,
            description: true,
            taskType: true,
            assignedToId: true,
            dueDate: true,
            estimatedCost: true,
            estimatedHours: true,
            sortOrder: true,
            predecessorLinks: { select: { predecessorTaskId: true } }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!sourceProject) {
      return reply.code(404).send({ message: "Source project not found." });
    }

    const snapshot = buildProjectTemplateSnapshot(sourceProject);
    const summary = summarizeProjectTemplateSnapshot(snapshot);
    const template = await app.prisma.projectTemplate.create({
      data: {
        householdId: params.householdId,
        sourceProjectId: sourceProject.id,
        name: input.name,
        description: input.description ?? sourceProject.description,
        notes: input.notes ?? sourceProject.notes,
        snapshot
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.template.created",
      entityType: "project",
      entityId: sourceProject.id,
      metadata: { templateId: template.id, templateName: template.name }
    });

    return reply.code(201).send(toProjectTemplateResponse({
      id: template.id,
      householdId: template.householdId,
      sourceProjectId: template.sourceProjectId,
      name: template.name,
      description: template.description,
      notes: template.notes,
      phaseCount: summary.phaseCount,
      taskCount: summary.taskCount,
      assetCount: summary.assetCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));
  });

  app.post("/v1/households/:householdId/project-templates/:templateId/instantiate", async (request, reply) => {
    const params = projectTemplateParamsSchema.parse(request.params);
    const input = instantiateProjectTemplateSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const template = await app.prisma.projectTemplate.findFirst({
      where: { id: params.templateId, householdId: params.householdId }
    });

    if (!template) {
      return reply.code(404).send({ message: "Project template not found." });
    }

    let hierarchy: { parentProjectId: string | null; depth: number };

    try {
      hierarchy = await resolveProjectHierarchyInput(app.prisma, {
        householdId: params.householdId,
        parentProjectId: input.parentProjectId ?? null
      });
    } catch (error) {
      if (error instanceof ProjectHierarchyValidationError) {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }

    const project = await app.prisma.$transaction((tx) => instantiateProjectFromTemplateSnapshot(
      tx,
      params.householdId,
      parseTemplateSnapshot(template.snapshot),
      {
        name: input.name,
        parentProjectId: hierarchy.parentProjectId,
        depth: hierarchy.depth,
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.targetEndDate ? { targetEndDate: input.targetEndDate } : {})
      }
    ));

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.template.instantiated",
      entityType: "project",
      entityId: project.id,
      metadata: { templateId: template.id, templateName: template.name }
    });

    refreshProjectArtifacts(params.householdId, project.id);

    return reply.code(201).send(toProjectResponse(project));
  });

  app.post("/v1/households/:householdId/projects/:projectId/clone", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = cloneProjectSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const sourceProject = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, params.projectId),
      include: {
        assets: {
          select: {
            assetId: true,
            relationship: true,
            role: true,
            notes: true
          }
        },
        budgetCategories: {
          select: {
            name: true,
            budgetAmount: true,
            sortOrder: true,
            notes: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        phases: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            sortOrder: true,
            startDate: true,
            targetEndDate: true,
            budgetAmount: true,
            notes: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        tasks: {
          select: {
            id: true,
            phaseId: true,
            title: true,
            description: true,
            taskType: true,
            assignedToId: true,
            dueDate: true,
            estimatedCost: true,
            estimatedHours: true,
            sortOrder: true,
            predecessorLinks: { select: { predecessorTaskId: true } }
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!sourceProject) {
      return reply.code(404).send({ message: "Project not found." });
    }

    let hierarchy: { parentProjectId: string | null; depth: number };

    try {
      hierarchy = await resolveProjectHierarchyInput(app.prisma, {
        householdId: params.householdId,
        parentProjectId: input.parentProjectId ?? null
      });
    } catch (error) {
      if (error instanceof ProjectHierarchyValidationError) {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }

    const project = await app.prisma.$transaction((tx) => instantiateProjectFromTemplateSnapshot(
      tx,
      params.householdId,
      buildProjectTemplateSnapshot(sourceProject),
      {
        name: input.name,
        parentProjectId: hierarchy.parentProjectId,
        depth: hierarchy.depth,
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.targetEndDate ? { targetEndDate: input.targetEndDate } : {})
      }
    ));

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.cloned",
      entityType: "project",
      entityId: project.id,
      metadata: { sourceProjectId: sourceProject.id, sourceProjectName: sourceProject.name }
    });

    refreshProjectArtifacts(params.householdId, project.id);

    return reply.code(201).send(toProjectResponse(project));
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
      where: activeProjectWhere(params.householdId, params.projectId)
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (status === "completed") {
      const summary = await getProjectCompletionSummary(app.prisma, existing.id);

      if (summary && !summary.canComplete) {
        return reply.code(400).send({ message: buildProjectCompletionGuardrailMessage(summary) });
      }
    }

    const project = await app.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          status,
          actualEndDate: status === "completed" ? new Date() : null
        }
      });

      await syncProjectDerivedStatuses(tx, existing.id);

      return tx.project.findUniqueOrThrow({
        where: { id: existing.id }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.status_changed",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name, oldStatus: existing.status, newStatus: status }
    });

    refreshProjectArtifacts(params.householdId, project.id);

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
      where: activeProjectWhere(params.householdId, params.projectId)
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
        relationship: input.relationship ?? "target",
        role: input.role ?? null,
        notes: input.notes ?? null
      },
      include: {
        asset: { select: { id: true, name: true, category: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.asset.linked",
      entityType: "project",
      entityId: project.id,
      metadata: { assetId: asset.id, assetName: asset.name, relationship: projectAsset.relationship }
    });

    return reply.code(201).send(toProjectAssetResponse(projectAsset));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/assets/:projectAssetId", async (request, reply) => {
    const params = projectAssetParamsSchema.parse(request.params);
    const input = updateProjectAssetSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectAsset.findFirst({
      where: {
        id: params.projectAssetId,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
      },
      include: { asset: { select: { id: true, name: true, category: true } } }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project asset link not found." });
    }

    const data: Prisma.ProjectAssetUncheckedUpdateInput = {};
    if (input.relationship !== undefined) data.relationship = input.relationship;
    if (input.role !== undefined) data.role = input.role ?? null;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const projectAsset = await app.prisma.projectAsset.update({
      where: { id: existing.id },
      data,
      include: { asset: { select: { id: true, name: true, category: true } } }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.asset.updated",
      entityType: "project",
      entityId: params.projectId,
      metadata: { projectAssetId: existing.id, relationship: projectAsset.relationship }
    });

    return reply.send(toProjectAssetResponse(projectAsset));
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
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
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
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const tasks = await app.prisma.projectTask.findMany({
      where: { projectId: project.id, deletedAt: null },
      include: projectTaskDetailInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    const taskGraph = buildProjectTaskGraphSummary(
      tasks.map((task) => ({
        id: task.id,
        status: task.status,
        taskType: task.taskType ?? "full",
        isCompleted: task.isCompleted ?? false,
        estimatedHours: task.estimatedHours ?? null,
        predecessorTaskIds: (task.predecessorLinks ?? []).map((dependency) => dependency.predecessorTaskId)
      })),
      tasks.flatMap((task) => (task.predecessorLinks ?? []).map((dependency) => ({
        predecessorTaskId: dependency.predecessorTaskId,
        successorTaskId: task.id
      }))),
      new Map(tasks.map((task) => [task.id, task.actualHours ?? 0]))
    );

    return tasks.map((task) => toProjectTaskResponse(task, taskGraph.byTaskId.get(task.id)));
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
      where: activeProjectWhere(params.householdId, params.projectId),
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
        where: { id: input.phaseId, projectId: project.id, deletedAt: null },
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
          deletedAt: null,
          asset: { householdId: params.householdId }
        },
        select: { id: true }
      });

      if (!schedule) {
        return reply.code(400).send({ message: "Linked schedule not found or belongs to a different household." });
      }
    }

    if (input.predecessorTaskIds && input.predecessorTaskIds.length > 0) {
      const projectTasks = await app.prisma.projectTask.findMany({
        where: { projectId: project.id, deletedAt: null },
        select: {
          id: true,
          predecessorLinks: { select: { predecessorTaskId: true, successorTaskId: true } }
        }
      });

      for (const predecessorTaskId of input.predecessorTaskIds) {
        if (!projectTasks.some((task) => task.id === predecessorTaskId)) {
          return reply.code(400).send({ message: "Referenced dependency task not found in this project." });
        }
      }
    }

    const taskType = input.taskType ?? "full";
    const isQuick = taskType === "quick";

    const task = await app.prisma.$transaction(async (tx) => {
      const createdTask = await tx.projectTask.create({
        data: {
          projectId: project.id,
          phaseId: input.phaseId ?? null,
          title: input.title,
          description: isQuick ? null : (input.description ?? null),
          status: input.status ?? "pending",
          taskType,
          isCompleted: input.isCompleted ?? false,
          assignedToId: isQuick ? null : (input.assignedToId ?? null),
          dueDate: isQuick ? null : (input.dueDate ? new Date(input.dueDate) : null),
          estimatedCost: isQuick ? null : (input.estimatedCost ?? null),
          actualCost: isQuick ? null : (input.actualCost ?? null),
          estimatedHours: isQuick ? null : (input.estimatedHours ?? null),
          actualHours: isQuick ? null : (input.actualHours ?? null),
          sortOrder: input.sortOrder ?? null,
          scheduleId: isQuick ? null : (input.scheduleId ?? null)
        }
      });

      if (!isQuick) {
        for (const predecessorTaskId of input.predecessorTaskIds ?? []) {
          await tx.projectTaskDependency.create({
            data: {
              predecessorTaskId,
              successorTaskId: createdTask.id
            }
          });
        }
      }

      await syncProjectDerivedStatuses(tx, project.id);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: createdTask.id },
        include: projectTaskDetailInclude
      });
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

    refreshProjectArtifacts(params.householdId, project.id);

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
        deletedAt: null,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
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
        where: { id: input.phaseId, projectId: params.projectId, deletedAt: null },
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
          deletedAt: null,
          asset: { householdId: params.householdId }
        },
        select: { id: true }
      });

      if (!schedule) {
        return reply.code(400).send({ message: "Linked schedule not found or belongs to a different household." });
      }
    }

    if (input.predecessorTaskIds !== undefined) {
      const projectTasks = await app.prisma.projectTask.findMany({
        where: { projectId: params.projectId, deletedAt: null },
        select: {
          id: true,
          predecessorLinks: { select: { predecessorTaskId: true, successorTaskId: true } }
        }
      });

      try {
        assertTaskDependenciesAcyclic(
          projectTasks,
          projectTasks.flatMap((task) => task.predecessorLinks.map((dependency) => ({
            predecessorTaskId: dependency.predecessorTaskId,
            successorTaskId: dependency.successorTaskId
          }))),
          existing.id,
          input.predecessorTaskIds
        );
      } catch (error) {
        return reply.code(400).send({ message: error instanceof Error ? error.message : "Invalid task dependencies." });
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
    if (input.estimatedHours !== undefined) data.estimatedHours = input.estimatedHours ?? null;
    if (input.actualHours !== undefined) data.actualHours = input.actualHours ?? null;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder ?? null;
    if (input.scheduleId !== undefined) data.scheduleId = input.scheduleId ?? null;
    if (input.taskType !== undefined) data.taskType = input.taskType;

    // Handle isCompleted toggle (quick to-dos) — sync status and completedAt
    if (input.isCompleted !== undefined) {
      data.isCompleted = input.isCompleted;
      if (input.isCompleted) {
        data.status = "completed";
        data.completedAt = new Date();
      } else {
        data.status = "pending";
        data.completedAt = null;
      }
    }

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

    const task = await app.prisma.$transaction(async (tx) => {
      await tx.projectTask.update({
        where: { id: existing.id },
        data
      });

      if (input.predecessorTaskIds !== undefined) {
        await tx.projectTaskDependency.deleteMany({
          where: { successorTaskId: existing.id }
        });

        for (const predecessorTaskId of input.predecessorTaskIds) {
          await tx.projectTaskDependency.create({
            data: {
              predecessorTaskId,
              successorTaskId: existing.id
            }
          });
        }
      }

      await syncProjectDerivedStatuses(tx, params.projectId);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: existing.id },
        include: projectTaskDetailInclude
      });
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

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
        deletedAt: null,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.projectTask.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() }
      });
      await tx.projectTaskDependency.deleteMany({
        where: {
          OR: [
            { predecessorTaskId: existing.id },
            { successorTaskId: existing.id }
          ]
        }
      });
      await syncProjectDerivedStatuses(tx, params.projectId);
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(204).send();
  });

  // ── Quick To-dos ──────────────────────────────────────────────────

  app.post("/v1/households/:householdId/projects/:projectId/quick-todos", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createQuickTodoSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id, deletedAt: null },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    const task = await app.prisma.$transaction(async (tx) => {
      const createdTask = await tx.projectTask.create({
        data: {
          projectId: project.id,
          phaseId: input.phaseId ?? null,
          title: input.title,
          description: null,
          status: "pending",
          taskType: "quick",
          isCompleted: false,
          sortOrder: input.sortOrder ?? null
        }
      });

      await syncProjectDerivedStatuses(tx, project.id);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: createdTask.id },
        include: {
          assignedTo: { select: { id: true, displayName: true } },
          checklistItems: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.quicktodo.created",
      entityType: "project_task",
      entityId: task.id,
      metadata: { taskTitle: task.title }
    });

    refreshProjectArtifacts(params.householdId, project.id);

    return reply.code(201).send(toProjectTaskResponse(task));
  });

  app.post("/v1/households/:householdId/projects/:projectId/tasks/:taskId/promote", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const input = promoteTaskSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.projectTask.findFirst({
      where: {
        id: params.taskId,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project task not found." });
    }

    if (existing.taskType === "full") {
      return reply.code(400).send({ message: "Task is already a full task." });
    }

    const promotedStatus = input.status ?? (existing.isCompleted ? "completed" : "pending");
    const promotedCompletedAt = promotedStatus === "completed" && !existing.completedAt ? new Date() : existing.completedAt;

    const task = await app.prisma.$transaction(async (tx) => {
      await tx.projectTask.update({
        where: { id: existing.id },
        data: {
          taskType: "full",
          status: promotedStatus,
          completedAt: promotedCompletedAt,
          assignedToId: input.assignedToId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          estimatedCost: input.estimatedCost ?? null
        }
      });

      await syncProjectDerivedStatuses(tx, params.projectId);

      return tx.projectTask.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          assignedTo: { select: { id: true, displayName: true } },
          checklistItems: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
          }
        }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.task.promoted",
      entityType: "project_task",
      entityId: existing.id,
      metadata: { taskTitle: existing.title }
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

    return toProjectTaskResponse(task);
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
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const expenses = await app.prisma.projectExpense.findMany({
      where: { projectId: project.id, deletedAt: null },
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
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.taskId) {
      const task = await app.prisma.projectTask.findFirst({
        where: { id: input.taskId, projectId: project.id, deletedAt: null },
        select: { id: true }
      });

      if (!task) {
        return reply.code(400).send({ message: "Referenced task not found in this project." });
      }
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id, deletedAt: null },
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

    refreshProjectArtifacts(params.householdId, project.id);

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
        deletedAt: null,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project expense not found." });
    }

    if (input.taskId !== undefined && input.taskId !== null) {
      const task = await app.prisma.projectTask.findFirst({
        where: { id: input.taskId, projectId: params.projectId, deletedAt: null },
        select: { id: true }
      });

      if (!task) {
        return reply.code(400).send({ message: "Referenced task not found in this project." });
      }
    }

    if (input.phaseId !== undefined && input.phaseId !== null) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: params.projectId, deletedAt: null },
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

    refreshProjectArtifacts(params.householdId, params.projectId);

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
        deletedAt: null,
        project: { id: params.projectId, householdId: params.householdId, deletedAt: null }
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project expense not found." });
    }

    await app.prisma.projectExpense.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(204).send();
  });

  // ── Shopping List (aggregated unprocured supplies across project tree) ──

  app.get("/v1/households/:householdId/projects/:projectId/shopping-list", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const treeProjectIds = await getProjectTreeIds(app.prisma, params.projectId);

    const supplies = await app.prisma.projectPhaseSupply.findMany({
      where: {
        deletedAt: null,
        isProcured: false,
        phase: {
          deletedAt: null,
          projectId: { in: treeProjectIds }
        }
      },
      include: {
        phase: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { id: true, name: true } }
          }
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            quantityOnHand: true,
            unit: true,
            unitCost: true
          }
        },
        purchaseLines: activeProjectSupplyPurchaseInclude
      },
      orderBy: [
        { supplier: { sort: "asc", nulls: "last" } },
        { name: "asc" }
      ]
    });

    const items = supplies.map((supply) => {
      const quantityRemaining = Math.max(0, supply.quantityNeeded - supply.quantityOnHand);
      const estimatedLineCost = supply.estimatedUnitCost != null ? quantityRemaining * supply.estimatedUnitCost : null;

      return {
        id: supply.id,
        name: supply.name,
        description: supply.description,
        quantityNeeded: supply.quantityNeeded,
        quantityOnHand: supply.quantityOnHand,
        quantityRemaining,
        unit: supply.unit,
        estimatedUnitCost: supply.estimatedUnitCost,
        estimatedLineCost,
        supplier: supply.supplier,
        supplierUrl: supply.supplierUrl,
        inventoryItemId: supply.inventoryItemId,
        inventoryItem: supply.inventoryItem,
        activePurchaseRequest: getProjectSupplyPurchaseRequest(supply),
        phaseName: supply.phase.name,
        phaseId: supply.phase.id,
        projectName: supply.phase.project.name,
        projectId: supply.phase.project.id
      };
    });

    // Group by supplier (case-insensitive, trimmed)
    const groupMap = new Map<string, { supplierUrl: string | null; items: typeof items }>();
    for (const item of items) {
      const key = item.supplier ? item.supplier.trim().toLowerCase() : "";
      const existing = groupMap.get(key);
      if (existing) {
        if (!existing.supplierUrl && item.supplierUrl) {
          existing.supplierUrl = item.supplierUrl;
        }
        existing.items.push(item);
      } else {
        groupMap.set(key, { supplierUrl: item.supplierUrl, items: [item] });
      }
    }

    const groupedBySupplier = Array.from(groupMap.entries()).map(([key, group]) => {
      const firstSupplierName = group.items[0]?.supplier?.trim();

      return {
        supplierName: key === "" ? "No supplier specified" : (firstSupplierName ?? "Unknown supplier"),
        supplierUrl: group.supplierUrl,
        items: group.items,
        subtotal: group.items.reduce((sum, item) => sum + (item.estimatedLineCost ?? 0), 0)
      };
    });

    const totalEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedLineCost ?? 0), 0);
    const supplierCount = new Set(items.filter((item) => item.supplier != null).map((item) => item.supplier!.trim().toLowerCase())).size;

    return reply.send({
      items,
      totalEstimatedCost,
      supplierCount,
      lineCount: items.length,
      groupedBySupplier
    });
  });

  app.post("/v1/households/:householdId/projects/:projectId/shopping-list/purchase-requests", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectPurchaseRequestSchema.parse(request.body ?? {});

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await app.prisma.project.findFirst({
      where: activeProjectWhere(params.householdId, params.projectId),
      select: { id: true, name: true }
    });

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const treeProjectIds = await getProjectTreeIds(app.prisma, params.projectId);

    const supplies = await app.prisma.projectPhaseSupply.findMany({
      where: {
        deletedAt: null,
        phase: {
          deletedAt: null,
          projectId: { in: treeProjectIds }
        },
        ...(input.supplyIds ? { id: { in: input.supplyIds } } : {})
      },
      include: {
        phase: {
          select: {
            name: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            quantityOnHand: true,
            unit: true,
            unitCost: true,
            preferredSupplier: true,
            supplierUrl: true
          }
        },
        purchaseLines: activeProjectSupplyPurchaseInclude
      },
      orderBy: [
        { supplier: { sort: "asc", nulls: "last" } },
        { name: "asc" }
      ]
    });

    if (input.supplyIds && supplies.length !== input.supplyIds.length) {
      return reply.code(400).send({ message: "One or more requested supplies were not found in this project tree." });
    }

    const eligibleSupplies = supplies.filter((supply) => !supply.isProcured && Math.max(0, supply.quantityNeeded - supply.quantityOnHand) > 0);

    const summary = await app.prisma.$transaction(async (tx) => {
      const existingPurchases = await tx.inventoryPurchase.findMany({
        where: {
          householdId: params.householdId,
          status: {
            in: [...activeProjectPurchaseStatuses]
          }
        },
        include: {
          lines: {
            select: {
              id: true,
              inventoryItemId: true,
              projectPhaseSupplyId: true
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }]
          }
        },
        orderBy: [{ supplierName: "asc" }, { createdAt: "asc" }]
      });

      const openPurchaseBySupplier = new Map(existingPurchases.map((purchase) => [
        getInventoryPurchaseSupplierKey(purchase.supplierName, purchase.supplierUrl),
        purchase
      ]));
      const affectedPurchaseIds = new Set<string>();
      let createdLineCount = 0;
      let reusedLineCount = 0;
      let skippedSupplyCount = 0;

      for (const supply of eligibleSupplies) {
        const existingRequest = supply.purchaseLines[0];

        if (existingRequest) {
          affectedPurchaseIds.add(existingRequest.purchaseId);
          reusedLineCount += 1;
          continue;
        }

        let inventoryItemId = supply.inventoryItemId;

        if (!inventoryItemId) {
          const createdInventoryItem = await tx.inventoryItem.create({
            data: {
              householdId: params.householdId,
              itemType: "consumable",
              name: supply.name,
              description: supply.description ?? null,
              quantityOnHand: 0,
              unit: supply.unit,
              preferredSupplier: supply.supplier?.trim() || null,
              supplierUrl: supply.supplierUrl?.trim() || null,
              unitCost: supply.estimatedUnitCost ?? null,
              notes: `Auto-created from project supply ${supply.name} in ${supply.phase.project.name} / ${supply.phase.name}.`
            }
          });

          inventoryItemId = createdInventoryItem.id;

          await tx.projectPhaseSupply.update({
            where: { id: supply.id },
            data: { inventoryItemId }
          });
        }

        if (!inventoryItemId) {
          skippedSupplyCount += 1;
          continue;
        }

        const supplierName = supply.supplier?.trim() || null;
        const supplierUrl = supply.supplierUrl?.trim() || null;
        const supplierKey = getInventoryPurchaseSupplierKey(supplierName, supplierUrl);
        let purchase = openPurchaseBySupplier.get(supplierKey) ?? null;

        if (!purchase) {
          purchase = await tx.inventoryPurchase.create({
            data: {
              householdId: params.householdId,
              createdById: request.auth.userId,
              supplierName,
              supplierUrl,
              source: "manual",
              status: "draft",
              notes: `Generated from the ${project.name} project shopping list.`
            },
            include: {
              lines: {
                select: {
                  id: true,
                  inventoryItemId: true,
                  projectPhaseSupplyId: true
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }]
              }
            }
          });

          openPurchaseBySupplier.set(supplierKey, purchase);
        }

        const quantityRemaining = Math.max(0, supply.quantityNeeded - supply.quantityOnHand);

        const createdLine = await tx.inventoryPurchaseLine.create({
          data: {
            purchaseId: purchase.id,
            inventoryItemId,
            projectPhaseSupplyId: supply.id,
            status: "draft",
            plannedQuantity: quantityRemaining,
            unitCost: supply.estimatedUnitCost ?? supply.inventoryItem?.unitCost ?? null,
            notes: `${supply.phase.project.name} / ${supply.phase.name} / ${supply.name}`
          }
        });

        purchase.lines.push({
          id: createdLine.id,
          inventoryItemId,
          projectPhaseSupplyId: supply.id
        });
        affectedPurchaseIds.add(purchase.id);
        createdLineCount += 1;
      }

      const purchases = affectedPurchaseIds.size === 0
        ? []
        : await tx.inventoryPurchase.findMany({
            where: {
              id: { in: Array.from(affectedPurchaseIds) }
            },
            include: {
              lines: {
                where: {
                  inventoryItem: {
                    deletedAt: null
                  }
                },
                include: {
                  inventoryItem: true
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }]
              }
            },
            orderBy: [{ supplierName: "asc" }, { createdAt: "asc" }]
          });

      return {
        purchaseCount: purchases.length,
        createdLineCount,
        reusedLineCount,
        skippedSupplyCount,
        purchases: purchases.map(toInventoryPurchaseResponse)
      };
    });

    if (summary.createdLineCount > 0) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "project.supplies.purchase_requests_created",
        entityType: "project",
        entityId: project.id,
        metadata: {
          purchaseCount: summary.purchaseCount,
          createdLineCount: summary.createdLineCount,
          reusedLineCount: summary.reusedLineCount
        }
      });
    }

    refreshProjectArtifacts(params.householdId, params.projectId);

    return reply.code(201).send(summary);
  });
};
