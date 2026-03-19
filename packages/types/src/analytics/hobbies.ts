import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const hobbyStatusSchema = z.enum(["active", "paused", "archived"]);
const hobbyActivityModeSchema = z.enum(["session", "project", "practice", "collection"]);
const hobbyPracticeRoutineFrequencySchema = z.enum(["daily", "weekly", "biweekly", "monthly"]);
const hobbyPracticeGoalTypeSchema = z.enum(["metric_target", "session_count", "duration_total", "custom"]);

export const hobbySessionFrequencyMonthSchema = z.object({
  month: yearMonthSchema,
  sessionCount: z.number().int().nonnegative(),
  totalDurationMinutes: z.number().int().nonnegative(),
  avgRating: z.number().nullable()
});

export const hobbySessionFrequencySummarySchema = z.object({
  hobbyId: z.string().cuid(),
  hobbyName: z.string(),
  monthlyBreakdown: z.array(hobbySessionFrequencyMonthSchema)
});

export const hobbySessionFrequencyTotalSchema = z.object({
  month: yearMonthSchema,
  sessionCount: z.number().int().nonnegative(),
  totalDurationMinutes: z.number().int().nonnegative()
});

export const hobbySessionFrequencyPayloadSchema = z.object({
  hobbies: z.array(hobbySessionFrequencySummarySchema),
  totals: z.array(hobbySessionFrequencyTotalSchema)
});

export const hobbyPracticeStreakPeriodSchema = z.object({
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  sessionsCompleted: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  met: z.boolean()
});

export const hobbyPracticeStreakRoutineSchema = z.object({
  routineId: z.string().cuid(),
  routineName: z.string(),
  hobbyId: z.string().cuid(),
  hobbyName: z.string(),
  targetFrequency: hobbyPracticeRoutineFrequencySchema,
  targetSessionsPerPeriod: z.number().int().positive(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  adherenceRate: z.number().min(0).max(1),
  recentPeriods: z.array(hobbyPracticeStreakPeriodSchema).length(12)
});

export const hobbyPracticeStreaksPayloadSchema = z.object({
  routines: z.array(hobbyPracticeStreakRoutineSchema)
});

export const hobbyGoalProgressHistoryPointSchema = z.object({
  date: dateOnlySchema,
  value: z.number()
});

export const hobbyGoalProgressGoalSchema = z.object({
  goalId: z.string().cuid(),
  goalName: z.string(),
  hobbyId: z.string().cuid(),
  hobbyName: z.string(),
  goalType: hobbyPracticeGoalTypeSchema,
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.string(),
  percentComplete: z.number().min(0),
  startDate: z.string().datetime().nullable(),
  targetDate: z.string().datetime().nullable(),
  daysRemaining: z.number().int().nullable(),
  projectedCompletionDate: dateOnlySchema.nullable(),
  onTrack: z.boolean().nullable(),
  progressHistory: z.array(hobbyGoalProgressHistoryPointSchema)
});

export const hobbyGoalProgressPayloadSchema = z.object({
  goals: z.array(hobbyGoalProgressGoalSchema)
});

export const hobbyAnalyticsOverviewHobbySchema = z.object({
  hobbyId: z.string().cuid(),
  hobbyName: z.string(),
  status: hobbyStatusSchema,
  activityMode: hobbyActivityModeSchema.default("session"),
  totalSessions: z.number().int().nonnegative(),
  totalDurationMinutes: z.number().int().nonnegative(),
  totalCost: z.number(),
  activeGoals: z.number().int().nonnegative(),
  achievedGoals: z.number().int().nonnegative(),
  recipeCount: z.number().int().nonnegative(),
  seriesCount: z.number().int().nonnegative(),
  lastSessionDate: z.string().datetime().nullable()
});

export const hobbyAnalyticsOverviewSummarySchema = z.object({
  totalHobbies: z.number().int().nonnegative(),
  activeHobbies: z.number().int().nonnegative(),
  totalSessionsAllTime: z.number().int().nonnegative(),
  totalCostAllTime: z.number(),
  totalDurationAllTime: z.number().int().nonnegative()
});

export const hobbyAnalyticsOverviewPayloadSchema = z.object({
  hobbies: z.array(hobbyAnalyticsOverviewHobbySchema),
  summary: hobbyAnalyticsOverviewSummarySchema
});

export type HobbySessionFrequencyMonth = z.infer<typeof hobbySessionFrequencyMonthSchema>;
export type HobbySessionFrequencySummary = z.infer<typeof hobbySessionFrequencySummarySchema>;
export type HobbySessionFrequencyTotal = z.infer<typeof hobbySessionFrequencyTotalSchema>;
export type HobbySessionFrequencyPayload = z.infer<typeof hobbySessionFrequencyPayloadSchema>;
export type HobbyPracticeStreakPeriod = z.infer<typeof hobbyPracticeStreakPeriodSchema>;
export type HobbyPracticeStreakRoutine = z.infer<typeof hobbyPracticeStreakRoutineSchema>;
export type HobbyPracticeStreaksPayload = z.infer<typeof hobbyPracticeStreaksPayloadSchema>;
export type HobbyGoalProgressHistoryPoint = z.infer<typeof hobbyGoalProgressHistoryPointSchema>;
export type HobbyGoalProgressGoal = z.infer<typeof hobbyGoalProgressGoalSchema>;
export type HobbyGoalProgressPayload = z.infer<typeof hobbyGoalProgressPayloadSchema>;
export type HobbyAnalyticsOverviewHobby = z.infer<typeof hobbyAnalyticsOverviewHobbySchema>;
export type HobbyAnalyticsOverviewSummary = z.infer<typeof hobbyAnalyticsOverviewSummarySchema>;
export type HobbyAnalyticsOverviewPayload = z.infer<typeof hobbyAnalyticsOverviewPayloadSchema>;