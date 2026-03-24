import { calculateProjectRiskScore, getProjectDaysToTarget, isProjectAtRisk, isProjectLate } from "@lifekeeper/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { addUtcMonths, getMonthRange, startOfUtcMonth, toMonthKey } from "../../lib/date-utils.js";
import { calculateProjectBudgetBurnProjection } from "../../lib/project-budget-burn.js";
import {
  toProjectBudgetBurnPayloadResponse,
  toProjectPortfolioHealthPayloadResponse,
  toProjectTaskVelocityPayloadResponse,
  toProjectTimelinePayloadResponse
} from "../../lib/serializers/index.js";
import { forbidden, notFound } from "../../lib/errors.js";

const activeProjectStatuses = ["planning", "active", "on_hold"] as const;
const allProjectStatuses = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
const projectTimelineQuerySchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid().optional()
});

const projectBudgetBurnQuerySchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid()
});

const projectTaskVelocityQuerySchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  months: z.coerce.number().int().min(1).max(12).default(6)
});

const projectPortfolioHealthQuerySchema = z.object({
  householdId: z.string().cuid()
});

const isProjectTaskCompleted = (task: {
  status: string;
  taskType: string;
  isCompleted: boolean;
}): boolean => task.status === "completed" || (task.taskType === "quick" && task.isCompleted);

const toPercentComplete = (completedTaskCount: number, taskCount: number): number => (
  taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0
);

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const getProjectTimelineWhere = (householdId: string, projectId?: string) => ({
  householdId,
  deletedAt: null,
  ...(projectId
    ? { id: projectId }
    : {
        status: {
          in: [...activeProjectStatuses]
        }
      })
});

const resolveBudgetWindowEnd = (
  project: {
    targetEndDate: Date | null;
    actualEndDate: Date | null;
  },
  lastExpenseDate: Date | null,
  startDate: Date
): Date => {
  const candidates = [project.actualEndDate, project.targetEndDate, lastExpenseDate, startDate]
    .filter((value): value is Date => value instanceof Date);

  return candidates.reduce((latest, value) => (value > latest ? value : latest), startDate);
};

export const projectAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/analytics/projects/timeline", async (request, reply) => {
    const query = projectTimelineQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const projects = await app.prisma.project.findMany({
      where: getProjectTimelineWhere(query.householdId, query.projectId),
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        targetEndDate: true
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    if (query.projectId && projects.length === 0) {
      return notFound(reply, "Project");
    }

    const projectIds = projects.map((project) => project.id);
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const phases = projectIds.length > 0
      ? await app.prisma.projectPhase.findMany({
          where: {
            projectId: { in: projectIds },
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            projectId: true,
            status: true,
            startDate: true,
            targetEndDate: true,
            actualEndDate: true,
            tasks: {
              where: { deletedAt: null },
              select: {
                status: true,
                taskType: true,
                isCompleted: true
              }
            }
          },
          orderBy: [{ projectId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
        })
      : [];

    const milestones = [
      ...projects.flatMap((project) => {
        const projectMilestones: Array<{ date: string; label: string; type: "project_start" | "project_target" }> = [];

        if (project.startDate) {
          projectMilestones.push({
            date: toDateOnly(project.startDate),
            label: `${project.name}: start`,
            type: "project_start"
          });
        }

        if (project.targetEndDate) {
          projectMilestones.push({
            date: toDateOnly(project.targetEndDate),
            label: `${project.name}: target`,
            type: "project_target"
          });
        }

        return projectMilestones;
      }),
      ...phases.flatMap((phase) => {
        const phaseMilestones: Array<{ date: string; label: string; type: "phase_start" | "phase_end" | "target_end" }> = [];

        if (phase.startDate) {
          phaseMilestones.push({
            date: toDateOnly(phase.startDate),
            label: `${phase.name}: started`,
            type: "phase_start"
          });
        }

        if (phase.actualEndDate) {
          phaseMilestones.push({
            date: toDateOnly(phase.actualEndDate),
            label: `${phase.name}: completed`,
            type: "phase_end"
          });
        }

        if (phase.targetEndDate) {
          phaseMilestones.push({
            date: toDateOnly(phase.targetEndDate),
            label: `${phase.name}: target`,
            type: "target_end"
          });
        }

        return phaseMilestones;
      })
    ].sort((left, right) => left.date.localeCompare(right.date) || left.label.localeCompare(right.label));

    return toProjectTimelinePayloadResponse({
      phases: phases.map((phase) => {
        const project = projectMap.get(phase.projectId);
        const taskCount = phase.tasks.length;
        const completedTaskCount = phase.tasks.filter(isProjectTaskCompleted).length;

        return {
          phaseId: phase.id,
          phaseName: phase.name,
          projectId: phase.projectId,
          projectName: project?.name ?? "Unknown project",
          status: phase.status,
          startDate: phase.startDate?.toISOString() ?? null,
          targetEndDate: phase.targetEndDate?.toISOString() ?? null,
          actualEndDate: phase.actualEndDate?.toISOString() ?? null,
          taskCount,
          completedTaskCount,
          percentComplete: toPercentComplete(completedTaskCount, taskCount)
        };
      }),
      milestones
    });
  });

  app.get("/v1/analytics/projects/budget-burn", async (request, reply) => {
    const query = projectBudgetBurnQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const project = await app.prisma.project.findFirst({
      where: {
        id: query.projectId,
        householdId: query.householdId,
        deletedAt: null
      },
      select: {
        id: true,
        budgetAmount: true,
        startDate: true,
        targetEndDate: true,
        actualEndDate: true,
        expenses: {
          where: { deletedAt: null },
          select: {
            amount: true,
            date: true,
            createdAt: true
          },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    const datedExpenses = project.expenses
      .map((expense) => ({
        amount: expense.amount,
        date: expense.date ?? expense.createdAt
      }))
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    const firstExpenseDate = datedExpenses[0]?.date ?? null;
    const lastExpenseDate = datedExpenses[datedExpenses.length - 1]?.date ?? null;
    const totalSpent = datedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const burnProjection = calculateProjectBudgetBurnProjection({
      totalSpent,
      firstExpenseDate,
      lastExpenseDate,
      targetEndDate: project.targetEndDate,
      cadence: "month"
    });
    const budgetWindowStart = project.startDate ?? firstExpenseDate ?? new Date();
    const budgetWindowEnd = resolveBudgetWindowEnd(project, lastExpenseDate, budgetWindowStart);
    const monthKeys = getMonthRange(startOfUtcMonth(budgetWindowStart), startOfUtcMonth(budgetWindowEnd));
    const spentByMonth = datedExpenses.reduce<Map<string, number>>((map, expense) => {
      const monthKey = toMonthKey(expense.date);
      map.set(monthKey, (map.get(monthKey) ?? 0) + expense.amount);
      return map;
    }, new Map());
    const durationMonthCount = monthKeys.length;
    const budgetLine = project.budgetAmount !== null && durationMonthCount > 0
      ? project.budgetAmount / durationMonthCount
      : null;
    let cumulativeSpent = 0;

    return toProjectBudgetBurnPayloadResponse({
      totalBudget: project.budgetAmount,
      totalSpent,
      burnRate: burnProjection.burnRate ?? 0,
      projectedTotal: burnProjection.projectedTotal,
      months: monthKeys.map((month) => {
        const spent = spentByMonth.get(month) ?? 0;
        cumulativeSpent += spent;

        return {
          month,
          spent,
          cumulativeSpent,
          budgetLine
        };
      })
    });
  });

  app.get("/v1/analytics/projects/task-velocity", async (request, reply) => {
    const query = projectTaskVelocityQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    if (query.projectId) {
      const project = await app.prisma.project.findFirst({
        where: {
          id: query.projectId,
          householdId: query.householdId,
          deletedAt: null
        },
        select: { id: true }
      });

      if (!project) {
        return notFound(reply, "Project");
      }
    }

    const currentMonth = startOfUtcMonth(new Date());
    const windowStart = addUtcMonths(currentMonth, -(query.months - 1));
    const monthKeys = getMonthRange(windowStart, currentMonth);
    const monthSet = new Set(monthKeys);
    const tasks = await app.prisma.projectTask.findMany({
      where: {
        deletedAt: null,
        project: {
          householdId: query.householdId,
          deletedAt: null,
          ...(query.projectId ? { id: query.projectId } : {})
        },
        OR: [
          { createdAt: { gte: windowStart } },
          { completedAt: { gte: windowStart } }
        ]
      },
      select: {
        createdAt: true,
        completedAt: true
      }
    });

    const createdCounts = new Map<string, number>();
    const completedCounts = new Map<string, number>();
    const leadTimes: number[] = [];

    for (const task of tasks) {
      const createdMonth = toMonthKey(task.createdAt);
      if (monthSet.has(createdMonth)) {
        createdCounts.set(createdMonth, (createdCounts.get(createdMonth) ?? 0) + 1);
      }

      if (task.completedAt) {
        const completedMonth = toMonthKey(task.completedAt);

        if (monthSet.has(completedMonth)) {
          completedCounts.set(completedMonth, (completedCounts.get(completedMonth) ?? 0) + 1);
          leadTimes.push((task.completedAt.getTime() - task.createdAt.getTime()) / 86_400_000);
        }
      }
    }

    const velocityMonths = monthKeys.map((month) => {
      const tasksCompleted = completedCounts.get(month) ?? 0;
      const tasksCreated = createdCounts.get(month) ?? 0;

      return {
        month,
        tasksCompleted,
        tasksCreated,
        netBurn: tasksCompleted - tasksCreated
      };
    });
    const totalCompleted = velocityMonths.reduce((sum, month) => sum + month.tasksCompleted, 0);

    return toProjectTaskVelocityPayloadResponse({
      months: velocityMonths,
      averageCompletionRate: velocityMonths.length > 0 ? totalCompleted / velocityMonths.length : 0,
      averageLeadTimeDays: leadTimes.length > 0
        ? leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length
        : null
    });
  });

  app.get("/v1/analytics/projects/portfolio-health", async (request, reply) => {
    const query = projectPortfolioHealthQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const projects = await app.prisma.project.findMany({
      where: {
        householdId: query.householdId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        status: true,
        budgetAmount: true,
        targetEndDate: true,
        updatedAt: true,
        tasks: {
          where: { deletedAt: null },
          select: {
            status: true,
            taskType: true,
            isCompleted: true
          }
        },
        expenses: {
          where: { deletedAt: null },
          select: {
            amount: true
          }
        },
        inventoryItems: {
          select: {
            quantityNeeded: true,
            quantityAllocated: true,
            budgetedUnitCost: true,
            inventoryItem: {
              select: {
                unitCost: true
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    const now = Date.now();
    const statusCounts = new Map(projects.map((project) => [project.status, 0]));
    let totalBudgeted = 0;
    let totalSpent = 0;
    let onTrack = 0;
    let atRisk = 0;
    let late = 0;
    let overBudget = 0;

    const topProjects = projects.map((project) => {
      statusCounts.set(project.status, (statusCounts.get(project.status) ?? 0) + 1);

      const taskCount = project.tasks.length;
      const completedTaskCount = project.tasks.filter(isProjectTaskCompleted).length;
      const percentComplete = toPercentComplete(completedTaskCount, taskCount);
      const projectSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const plannedInventoryCost = project.inventoryItems.reduce((sum, item) => (
        sum + ((item.budgetedUnitCost ?? item.inventoryItem.unitCost ?? 0) * item.quantityNeeded)
      ), 0);
      const committedCost = projectSpent + plannedInventoryCost;
      const totalInventoryNeeded = project.inventoryItems.reduce((sum, item) => sum + item.quantityNeeded, 0);
      const totalInventoryAllocated = project.inventoryItems.reduce((sum, item) => sum + item.quantityAllocated, 0);
      const materialCoverage = totalInventoryNeeded > 0 ? totalInventoryAllocated / totalInventoryNeeded : null;
      const budgetRatio = project.budgetAmount !== null && project.budgetAmount > 0
        ? committedCost / project.budgetAmount
        : null;
      const daysToTarget = getProjectDaysToTarget(project.targetEndDate, now);
      const riskScore = calculateProjectRiskScore({
        status: project.status,
        percentComplete,
        budgetRatio,
        materialCoverage,
        daysToTarget
      });
      const lateProject = isProjectLate({ status: project.status, daysToTarget });
      const overBudgetProject = budgetRatio !== null && budgetRatio >= 1;

      totalBudgeted += project.budgetAmount ?? 0;
      totalSpent += projectSpent;

      if (isProjectAtRisk(riskScore)) {
        atRisk += 1;
      }

      if (lateProject) {
        late += 1;
      }

      if (overBudgetProject) {
        overBudget += 1;
      }

      if (!isProjectAtRisk(riskScore) && !lateProject && !overBudgetProject) {
        onTrack += 1;
      }

      return {
        projectId: project.id,
        projectName: project.name,
        status: project.status,
        percentComplete,
        budgetRatio,
        daysToTarget,
        riskScore,
        updatedAt: project.updatedAt.toISOString()
      };
    }).sort((left, right) => (
      right.riskScore - left.riskScore
      || (right.budgetRatio ?? -1) - (left.budgetRatio ?? -1)
      || (left.daysToTarget ?? Number.POSITIVE_INFINITY) - (right.daysToTarget ?? Number.POSITIVE_INFINITY)
      || right.updatedAt.localeCompare(left.updatedAt)
    )).slice(0, 10);

    return toProjectPortfolioHealthPayloadResponse({
      statusDistribution: allProjectStatuses.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0
      })),
      riskBreakdown: {
        onTrack,
        atRisk,
        late,
        overBudget
      },
      budgetSummary: {
        totalBudgeted,
        totalSpent,
        totalRemaining: totalBudgeted - totalSpent
      },
      topProjects: topProjects.map(({ updatedAt: _updatedAt, ...project }) => project)
    });
  });
};