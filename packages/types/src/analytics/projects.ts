import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const projectStatusSchema = z.enum(["planning", "active", "on_hold", "completed", "cancelled"]);
const projectPhaseStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);

export const projectAnalyticsTimelinePhaseSchema = z.object({
  phaseId: z.string().cuid(),
  phaseName: z.string(),
  projectId: z.string().cuid(),
  projectName: z.string(),
  status: projectPhaseStatusSchema,
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  actualEndDate: z.string().datetime().nullable(),
  taskCount: z.number().int().nonnegative(),
  completedTaskCount: z.number().int().nonnegative(),
  percentComplete: z.number().min(0).max(100)
});

export const projectAnalyticsMilestoneSchema = z.object({
  date: dayKeySchema,
  label: z.string(),
  type: z.enum(["phase_start", "phase_end", "target_end", "project_start", "project_target"])
});

export const projectTimelinePayloadSchema = z.object({
  phases: z.array(projectAnalyticsTimelinePhaseSchema),
  milestones: z.array(projectAnalyticsMilestoneSchema)
});

export const projectBudgetBurnMonthSchema = z.object({
  month: yearMonthSchema,
  spent: z.number(),
  cumulativeSpent: z.number(),
  budgetLine: z.number().nullable()
});

export const projectBudgetBurnPayloadSchema = z.object({
  totalBudget: z.number().nullable(),
  totalSpent: z.number(),
  burnRate: z.number(),
  projectedTotal: z.number().nullable(),
  months: z.array(projectBudgetBurnMonthSchema)
});

export const projectTaskVelocityMonthSchema = z.object({
  month: yearMonthSchema,
  tasksCompleted: z.number().int().nonnegative(),
  tasksCreated: z.number().int().nonnegative(),
  netBurn: z.number().int()
});

export const projectTaskVelocityPayloadSchema = z.object({
  months: z.array(projectTaskVelocityMonthSchema),
  averageCompletionRate: z.number(),
  averageLeadTimeDays: z.number().nullable()
});

export const projectPortfolioHealthStatusDistributionSchema = z.object({
  status: projectStatusSchema,
  count: z.number().int().nonnegative()
});

export const projectPortfolioHealthRiskBreakdownSchema = z.object({
  onTrack: z.number().int().nonnegative(),
  atRisk: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  overBudget: z.number().int().nonnegative()
});

export const projectPortfolioHealthBudgetSummarySchema = z.object({
  totalBudgeted: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number()
});

export const projectPortfolioHealthTopProjectSchema = z.object({
  projectId: z.string().cuid(),
  projectName: z.string(),
  status: projectStatusSchema,
  percentComplete: z.number().min(0).max(100),
  budgetRatio: z.number().nullable(),
  daysToTarget: z.number().int().nullable(),
  riskScore: z.number().int().nonnegative()
});

export const projectPortfolioHealthPayloadSchema = z.object({
  statusDistribution: z.array(projectPortfolioHealthStatusDistributionSchema),
  riskBreakdown: projectPortfolioHealthRiskBreakdownSchema,
  budgetSummary: projectPortfolioHealthBudgetSummarySchema,
  topProjects: z.array(projectPortfolioHealthTopProjectSchema)
});

export type ProjectAnalyticsTimelinePhase = z.infer<typeof projectAnalyticsTimelinePhaseSchema>;
export type ProjectAnalyticsMilestone = z.infer<typeof projectAnalyticsMilestoneSchema>;
export type ProjectTimelinePayload = z.infer<typeof projectTimelinePayloadSchema>;
export type ProjectBudgetBurnMonth = z.infer<typeof projectBudgetBurnMonthSchema>;
export type ProjectBudgetBurnPayload = z.infer<typeof projectBudgetBurnPayloadSchema>;
export type ProjectTaskVelocityMonth = z.infer<typeof projectTaskVelocityMonthSchema>;
export type ProjectTaskVelocityPayload = z.infer<typeof projectTaskVelocityPayloadSchema>;
export type ProjectPortfolioHealthStatusDistribution = z.infer<typeof projectPortfolioHealthStatusDistributionSchema>;
export type ProjectPortfolioHealthRiskBreakdown = z.infer<typeof projectPortfolioHealthRiskBreakdownSchema>;
export type ProjectPortfolioHealthBudgetSummary = z.infer<typeof projectPortfolioHealthBudgetSummarySchema>;
export type ProjectPortfolioHealthTopProject = z.infer<typeof projectPortfolioHealthTopProjectSchema>;
export type ProjectPortfolioHealthPayload = z.infer<typeof projectPortfolioHealthPayloadSchema>;