import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { calculateProjectBudgetBurnProjection } from "../../lib/project-budget-burn.js";
import { toProjectBudgetAnalysisResponse } from "../../lib/serializers/index.js";
import { forbidden, notFound } from "../../lib/errors.js";

const paramsSchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid()
});

export const projectBudgetAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/projects/:projectId/cost-analytics/budget-analysis", async (request, reply) => {
    const params = paramsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const project = await app.prisma.project.findFirst({
      where: {
        id: params.projectId,
        householdId: params.householdId
      },
      include: {
        expenses: true,
        phases: {
          include: {
            expenses: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        },
        budgetCategories: {
          include: {
            expenses: true
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const variance = (project.budgetAmount ?? 0) - totalSpent;
    const variancePercent = project.budgetAmount && project.budgetAmount > 0
      ? (variance / project.budgetAmount) * 100
      : null;
    const datedExpenses = project.expenses
      .map((expense) => expense.date ?? expense.createdAt)
      .sort((left, right) => left.getTime() - right.getTime());
    const firstExpenseDate = datedExpenses[0] ?? null;
    const lastExpenseDate = datedExpenses[datedExpenses.length - 1] ?? null;
    const burnProjection = calculateProjectBudgetBurnProjection({
      totalSpent,
      firstExpenseDate,
      lastExpenseDate,
      targetEndDate: project.targetEndDate
    });

    return toProjectBudgetAnalysisResponse({
      projectId: project.id,
      projectName: project.name,
      totalBudget: project.budgetAmount,
      totalSpent,
      variance,
      variancePercent,
      byPhase: project.phases.map((phase) => {
        const actualSpend = phase.expenses.reduce((sum, expense) => sum + expense.amount, 0);

        return {
          phaseId: phase.id,
          phaseName: phase.name,
          budgetAmount: phase.budgetAmount,
          actualSpend,
          variance: (phase.budgetAmount ?? 0) - actualSpend
        };
      }),
      byCategory: project.budgetCategories.map((category) => {
        const actualSpend = category.expenses.reduce((sum, expense) => sum + expense.amount, 0);

        return {
          categoryId: category.id,
          categoryName: category.name,
          budgetAmount: category.budgetAmount,
          actualSpend,
          variance: (category.budgetAmount ?? 0) - actualSpend
        };
      }),
      burnRate: burnProjection.burnRate,
      projectedTotalAtBurnRate: burnProjection.projectedTotal
    });
  });
};