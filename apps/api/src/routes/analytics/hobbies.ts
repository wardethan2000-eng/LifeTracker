import type { HobbyPracticeRoutineFrequency } from "@prisma/client";
import { hobbyPracticeGoalStatusSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { addDays, MS_PER_DAY, startOfUtcDay, startOfUtcMonth, startOfUtcWeek, toMonthKey, addUtcMonths } from "@lifekeeper/utils";
import { assertMembership } from "../../lib/asset-access.js";
import { buildPracticeGoalProgressHistory } from "../../lib/hobby-practice.js";
import {
  toHobbyAnalyticsOverviewPayloadResponse,
  toHobbyGoalProgressPayloadResponse,
  toHobbyPracticeStreaksPayloadResponse,
  toHobbySessionFrequencyPayloadResponse
} from "../../lib/serializers/index.js";

const completedSessionFilter = {
  OR: [
    { status: "completed" as const },
    { completedDate: { not: null } }
  ]
};

const householdScopedQuerySchema = z.object({
  householdId: z.string().cuid()
});

const sessionFrequencyQuerySchema = householdScopedQuerySchema.extend({
  hobbyId: z.string().cuid().optional(),
  months: z.coerce.number().int().min(1).max(24).default(6)
});

const practiceStreaksQuerySchema = householdScopedQuerySchema.extend({
  hobbyId: z.string().cuid().optional()
});

const goalProgressQuerySchema = householdScopedQuerySchema.extend({
  hobbyId: z.string().cuid().optional(),
  status: hobbyPracticeGoalStatusSchema.default("active")
});

const roundNumber = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

const getSessionEventDate = (session: {
  startDate: Date | null;
  completedDate: Date | null;
  createdAt: Date;
}): Date => session.completedDate ?? session.startDate ?? session.createdAt;

const getRoutinePeriodStart = (
  routine: { targetFrequency: HobbyPracticeRoutineFrequency; createdAt: Date },
  value: Date
): Date => {
  if (routine.targetFrequency === "daily") {
    return startOfUtcDay(value);
  }

  if (routine.targetFrequency === "weekly") {
    return startOfUtcWeek(value);
  }

  if (routine.targetFrequency === "monthly") {
    return startOfUtcMonth(value);
  }

  const anchor = startOfUtcWeek(routine.createdAt);
  const current = startOfUtcWeek(value);
  const weeksSinceAnchor = Math.floor((current.getTime() - anchor.getTime()) / (MS_PER_DAY * 7));
  const alignedWeeks = weeksSinceAnchor >= 0
    ? weeksSinceAnchor - (weeksSinceAnchor % 2)
    : weeksSinceAnchor - ((weeksSinceAnchor % 2 + 2) % 2);

  return addDays(anchor, alignedWeeks * 7);
};

const getNextRoutinePeriodStart = (
  routine: { targetFrequency: HobbyPracticeRoutineFrequency },
  periodStart: Date
): Date => {
  switch (routine.targetFrequency) {
    case "daily":
      return addDays(periodStart, 1);
    case "weekly":
      return addDays(periodStart, 7);
    case "biweekly":
      return addDays(periodStart, 14);
    case "monthly":
      return addUtcMonths(periodStart, 1);
  }
};

const getPreviousRoutinePeriodStart = (
  routine: { targetFrequency: HobbyPracticeRoutineFrequency },
  periodStart: Date
): Date => {
  switch (routine.targetFrequency) {
    case "daily":
      return addDays(periodStart, -1);
    case "weekly":
      return addDays(periodStart, -7);
    case "biweekly":
      return addDays(periodStart, -14);
    case "monthly":
      return addUtcMonths(periodStart, -1);
  }
};

const buildRecentRoutinePeriods = (
  routine: {
    createdAt: Date;
    targetFrequency: HobbyPracticeRoutineFrequency;
    targetSessionsPerPeriod: number;
  },
  completedDates: Date[],
  count = 12,
  referenceDate = new Date()
) => {
  const periods: Array<{ start: Date; endExclusive: Date }> = [];
  let cursor = getRoutinePeriodStart(routine, referenceDate);

  for (let index = 0; index < count; index += 1) {
    const endExclusive = getNextRoutinePeriodStart(routine, cursor);
    periods.unshift({ start: cursor, endExclusive });
    cursor = getPreviousRoutinePeriodStart(routine, cursor);
  }

  return periods.map((period) => {
    const sessionsCompleted = completedDates.filter((date) => date >= period.start && date < period.endExclusive).length;

    return {
      periodStart: toDateKey(period.start),
      periodEnd: toDateKey(addDays(period.endExclusive, -1)),
      sessionsCompleted,
      target: routine.targetSessionsPerPeriod,
      met: sessionsCompleted >= routine.targetSessionsPerPeriod
    };
  });
};

const toPercentComplete = (currentValue: number, targetValue: number): number => {
  if (targetValue <= 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return roundNumber(Math.max(0, (currentValue / targetValue) * 100));
};

const getProjectedCompletionDate = (
  progressHistory: Array<{ date: string; value: number }>,
  targetValue: number,
  referenceDate = new Date()
): string | null => {
  if (progressHistory.length < 2) {
    return null;
  }

  const now = startOfUtcDay(referenceDate);
  const windowStart = addDays(now, -30);
  const recentPoints = progressHistory.filter((point) => {
    const date = new Date(point.date);
    return date >= windowStart && date <= now;
  });

  if (recentPoints.length < 2) {
    return null;
  }

  const first = recentPoints[0];
  const last = recentPoints[recentPoints.length - 1];

  if (!first || !last) {
    return null;
  }

  const firstDate = new Date(first.date);
  const lastDate = new Date(last.date);
  const elapsedDays = (lastDate.getTime() - firstDate.getTime()) / MS_PER_DAY;

  if (elapsedDays <= 0) {
    return null;
  }

  const valueDelta = last.value - first.value;
  const dailyRate = valueDelta / elapsedDays;

  if (dailyRate <= 0) {
    return null;
  }

  if (last.value >= targetValue) {
    return toDateKey(lastDate);
  }

  const remaining = targetValue - last.value;
  const projectedDays = Math.ceil(remaining / dailyRate);
  return toDateKey(addDays(lastDate, projectedDays));
};

export const hobbyAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/analytics/hobbies/session-frequency", async (request, reply) => {
    const query = sessionFrequencyQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const now = new Date();
    const monthStart = addUtcMonths(startOfUtcMonth(now), -(query.months - 1));
    const nextMonthStart = addUtcMonths(startOfUtcMonth(now), 1);
    const monthKeys = Array.from({ length: query.months }, (_, index) => toMonthKey(addUtcMonths(monthStart, index)));

    const hobbies = await app.prisma.hobby.findMany({
      where: {
        householdId: query.householdId,
        ...(query.hobbyId ? { id: query.hobbyId } : {})
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: "asc" }
    });

    const sessions = hobbies.length > 0 ? await app.prisma.hobbySession.findMany({
      where: {
        hobby: { householdId: query.householdId },
        ...(query.hobbyId ? { hobbyId: query.hobbyId } : {}),
        AND: [
          completedSessionFilter,
          {
            OR: [
              { startDate: { gte: monthStart, lt: nextMonthStart } },
              { completedDate: { gte: monthStart, lt: nextMonthStart } },
              { createdAt: { gte: monthStart, lt: nextMonthStart } }
            ]
          }
        ]
      },
      select: {
        hobbyId: true,
        startDate: true,
        completedDate: true,
        createdAt: true,
        durationMinutes: true,
        rating: true
      }
    }) : [];

    const byHobbyMonth = new Map<string, { sessionCount: number; totalDurationMinutes: number; ratingTotal: number; ratingCount: number }>();

    for (const session of sessions) {
      const eventDate = getSessionEventDate(session);

      if (eventDate < monthStart || eventDate >= nextMonthStart) {
        continue;
      }

      const key = `${session.hobbyId}:${toMonthKey(eventDate)}`;
      const existing = byHobbyMonth.get(key) ?? {
        sessionCount: 0,
        totalDurationMinutes: 0,
        ratingTotal: 0,
        ratingCount: 0
      };

      existing.sessionCount += 1;
      existing.totalDurationMinutes += session.durationMinutes ?? 0;

      if (session.rating !== null) {
        existing.ratingTotal += session.rating;
        existing.ratingCount += 1;
      }

      byHobbyMonth.set(key, existing);
    }

    const hobbyRows = hobbies.map((hobby) => ({
      hobbyId: hobby.id,
      hobbyName: hobby.name,
      monthlyBreakdown: monthKeys.map((month) => {
        const entry = byHobbyMonth.get(`${hobby.id}:${month}`);

        return {
          month,
          sessionCount: entry?.sessionCount ?? 0,
          totalDurationMinutes: entry?.totalDurationMinutes ?? 0,
          avgRating: entry && entry.ratingCount > 0 ? roundNumber(entry.ratingTotal / entry.ratingCount) : null
        };
      })
    }));

    return toHobbySessionFrequencyPayloadResponse({
      hobbies: hobbyRows,
      totals: monthKeys.map((month) => ({
        month,
        sessionCount: hobbyRows.reduce((sum, hobby) => sum + (hobby.monthlyBreakdown.find((entry) => entry.month === month)?.sessionCount ?? 0), 0),
        totalDurationMinutes: hobbyRows.reduce((sum, hobby) => sum + (hobby.monthlyBreakdown.find((entry) => entry.month === month)?.totalDurationMinutes ?? 0), 0)
      }))
    });
  });

  app.get("/v1/analytics/hobbies/practice-streaks", async (request, reply) => {
    const query = practiceStreaksQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const routines = await app.prisma.hobbyPracticeRoutine.findMany({
      where: {
        householdId: query.householdId,
        ...(query.hobbyId ? { hobbyId: query.hobbyId } : {})
      },
      orderBy: [
        { hobby: { name: "asc" } },
        { name: "asc" }
      ],
      select: {
        id: true,
        name: true,
        hobbyId: true,
        targetFrequency: true,
        targetSessionsPerPeriod: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        hobby: {
          select: {
            name: true
          }
        },
        sessions: {
          where: completedSessionFilter,
          select: {
            completedDate: true,
            startDate: true,
            createdAt: true
          }
        }
      }
    });

    return toHobbyPracticeStreaksPayloadResponse({
      routines: routines.map((routine) => {
        const completedDates = routine.sessions.map(getSessionEventDate);
        const recentPeriods = buildRecentRoutinePeriods(routine, completedDates);
        const metPeriods = recentPeriods.filter((period) => period.met).length;

        return {
          routineId: routine.id,
          routineName: routine.name,
          hobbyId: routine.hobbyId,
          hobbyName: routine.hobby.name,
          targetFrequency: routine.targetFrequency,
          targetSessionsPerPeriod: routine.targetSessionsPerPeriod,
          currentStreak: routine.currentStreak,
          longestStreak: routine.longestStreak,
          adherenceRate: recentPeriods.length > 0 ? roundNumber(metPeriods / recentPeriods.length, 4) : 0,
          recentPeriods
        };
      })
    });
  });

  app.get("/v1/analytics/hobbies/goal-progress", async (request, reply) => {
    const query = goalProgressQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const goals = await app.prisma.hobbyPracticeGoal.findMany({
      where: {
        householdId: query.householdId,
        ...(query.hobbyId ? { hobbyId: query.hobbyId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        hobby: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { targetDate: "asc" },
        { createdAt: "asc" }
      ]
    });

    const today = startOfUtcDay(new Date());
    const goalRows = await Promise.all(goals.map(async (goal) => {
      const history = await buildPracticeGoalProgressHistory(app.prisma, goal);
      const progressHistory = history.map((point) => ({
        date: toDateKey(new Date(point.date)),
        value: roundNumber(point.value)
      }));
      const currentValue = progressHistory.at(-1)?.value ?? roundNumber(goal.currentValue);
      const projectedCompletionDate = getProjectedCompletionDate(progressHistory, goal.targetValue, today);
      const onTrack = goal.targetDate
        ? (projectedCompletionDate ? new Date(projectedCompletionDate) <= goal.targetDate : null)
        : null;

      return {
        goalId: goal.id,
        goalName: goal.name,
        hobbyId: goal.hobbyId,
        hobbyName: goal.hobby.name,
        goalType: goal.goalType,
        targetValue: roundNumber(goal.targetValue),
        currentValue,
        unit: goal.unit,
        percentComplete: toPercentComplete(currentValue, goal.targetValue),
        startDate: goal.startDate?.toISOString() ?? null,
        targetDate: goal.targetDate?.toISOString() ?? null,
        daysRemaining: goal.targetDate ? Math.ceil((startOfUtcDay(goal.targetDate).getTime() - today.getTime()) / MS_PER_DAY) : null,
        projectedCompletionDate,
        onTrack,
        progressHistory
      };
    }));

    return toHobbyGoalProgressPayloadResponse({ goals: goalRows });
  });

  app.get("/v1/analytics/hobbies/overview", async (request, reply) => {
    const query = householdScopedQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobbies = await app.prisma.hobby.findMany({
      where: { householdId: query.householdId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        activityMode: true,
        sessions: {
          where: completedSessionFilter,
          select: {
            startDate: true,
            completedDate: true,
            createdAt: true,
            durationMinutes: true,
            totalCost: true
          }
        },
        practiceGoals: {
          select: {
            status: true
          }
        },
        _count: {
          select: {
            recipes: true,
            series: true
          }
        }
      }
    });

    const hobbyRows = hobbies.map((hobby) => {
      const totalSessions = hobby.sessions.length;
      const totalDurationMinutes = hobby.sessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
      const totalCost = roundNumber(hobby.sessions.reduce((sum, session) => sum + (session.totalCost ?? 0), 0));
      const lastSession = hobby.sessions.reduce<Date | null>((latest, session) => {
        const eventDate = getSessionEventDate(session);

        if (!latest || eventDate > latest) {
          return eventDate;
        }

        return latest;
      }, null);

      return {
        hobbyId: hobby.id,
        hobbyName: hobby.name,
        status: hobby.status,
        activityMode: hobby.activityMode,
        totalSessions,
        totalDurationMinutes,
        totalCost,
        activeGoals: hobby.practiceGoals.filter((goal) => goal.status === "active").length,
        achievedGoals: hobby.practiceGoals.filter((goal) => goal.status === "achieved").length,
        recipeCount: hobby._count.recipes,
        seriesCount: hobby._count.series,
        lastSessionDate: lastSession?.toISOString() ?? null
      };
    });

    return toHobbyAnalyticsOverviewPayloadResponse({
      hobbies: hobbyRows,
      summary: {
        totalHobbies: hobbyRows.length,
        activeHobbies: hobbyRows.filter((hobby) => hobby.status === "active").length,
        totalSessionsAllTime: hobbyRows.reduce((sum, hobby) => sum + hobby.totalSessions, 0),
        totalCostAllTime: roundNumber(hobbyRows.reduce((sum, hobby) => sum + hobby.totalCost, 0)),
        totalDurationAllTime: hobbyRows.reduce((sum, hobby) => sum + hobby.totalDurationMinutes, 0)
      }
    });
  });
};