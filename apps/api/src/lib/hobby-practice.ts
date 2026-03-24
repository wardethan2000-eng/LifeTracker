import { Prisma, type HobbyPracticeGoal, type HobbyPracticeRoutine, type PrismaClient } from "@prisma/client";
import { addDays, addUtcMonths, startOfUtcDay, startOfUtcMonth, startOfUtcWeek } from "@lifekeeper/utils";

type PracticePrisma = PrismaClient | Prisma.TransactionClient;

type GoalSessionRecord = {
  id: string;
  name: string;
  completedDate: Date | null;
  createdAt: Date;
  durationMinutes: number | null;
};

type GoalMetricReadingRecord = {
  id: string;
  metricDefinitionId: string;
  value: number;
  readingDate: Date;
  createdAt: Date;
};

export type PracticeGoalProgressPoint = {
  value: number;
  date: string;
  sourceType: "metric" | "session" | "manual";
  sourceId: string | null;
  label: string | null;
};

export type RoutineSummaryMetrics = {
  adherenceRate: number;
  nextExpectedSessionDate: string | null;
  currentStreak: number;
  longestStreak: number;
};

export type RoutineCompliancePeriod = {
  periodStart: string;
  periodEnd: string;
  expectedSessions: number;
  completedSessions: number;
  metTarget: boolean;
};

export type RoutineComplianceSummary = {
  routineId: string;
  startDate: string;
  endDate: string;
  periods: RoutineCompliancePeriod[];
  totalExpectedSessions: number;
  totalCompletedSessions: number;
  adherenceRate: number;
};

const autoTrackedGoalStatuses: Array<HobbyPracticeGoal["status"]> = ["active", "achieved"];

const toIso = (value: Date): string => value.toISOString();

const roundRatio = (value: number): number => Math.round(value * 100) / 100;

const toProgressPercentage = (currentValue: number, targetValue: number): number => {
  if (targetValue <= 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return roundRatio(Math.max(0, (currentValue / targetValue) * 100));
};

const getGoalEventDate = (record: { completedDate: Date | null; createdAt: Date }): Date => record.completedDate ?? record.createdAt;

const isWithinGoalWindow = (goal: Pick<HobbyPracticeGoal, "startDate" | "targetDate">, value: Date): boolean => {
  if (goal.startDate && value < goal.startDate) {
    return false;
  }

  if (goal.targetDate && value > goal.targetDate) {
    return false;
  }

  return true;
};

const getFrequencyAnchor = (routine: Pick<HobbyPracticeRoutine, "targetFrequency" | "createdAt">): Date => {
  if (routine.targetFrequency === "daily") {
    return startOfUtcDay(routine.createdAt);
  }

  if (routine.targetFrequency === "monthly") {
    return startOfUtcMonth(routine.createdAt);
  }

  return startOfUtcWeek(routine.createdAt);
};

const getPeriodStart = (
  routine: Pick<HobbyPracticeRoutine, "targetFrequency" | "createdAt">,
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

  const anchor = getFrequencyAnchor(routine);
  const weeksSinceAnchor = Math.floor((startOfUtcWeek(value).getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const alignedWeeks = weeksSinceAnchor >= 0 ? weeksSinceAnchor - (weeksSinceAnchor % 2) : weeksSinceAnchor - ((weeksSinceAnchor % 2 + 2) % 2);
  return addDays(anchor, alignedWeeks * 7);
};

const getNextPeriodStart = (
  routine: Pick<HobbyPracticeRoutine, "targetFrequency">,
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

const listRoutinePeriodBounds = (
  routine: Pick<HobbyPracticeRoutine, "targetFrequency" | "createdAt">,
  startDate: Date,
  endDate: Date
): Array<{ start: Date; end: Date }> => {
  if (endDate <= startDate) {
    return [];
  }

  const firstStart = getPeriodStart(routine, startDate);
  const periods: Array<{ start: Date; end: Date }> = [];
  let cursor = firstStart;

  while (cursor < endDate) {
    const next = getNextPeriodStart(routine, cursor);
    periods.push({ start: cursor, end: next });
    cursor = next;
  }

  return periods;
};

const computeRoutineStreaks = (
  routine: Pick<HobbyPracticeRoutine, "targetFrequency" | "targetSessionsPerPeriod" | "createdAt">,
  completedDates: Date[],
  referenceDate: Date
): { currentStreak: number; longestStreak: number } => {
  const periods = listRoutinePeriodBounds(routine, routine.createdAt, addDays(referenceDate, 1));
  if (periods.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const completionsByPeriod = periods.map((period) => completedDates.filter((date) => date >= period.start && date < period.end).length);
  let longestStreak = 0;
  let runningStreak = 0;

  for (const completedSessions of completionsByPeriod) {
    if (completedSessions >= routine.targetSessionsPerPeriod) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let index = completionsByPeriod.length - 1; index >= 0; index -= 1) {
    if (completionsByPeriod[index]! >= routine.targetSessionsPerPeriod) {
      currentStreak += 1;
      continue;
    }

    break;
  }

  return { currentStreak, longestStreak };
};

export const buildRoutineComplianceSummary = (
  routine: Pick<HobbyPracticeRoutine, "id" | "targetFrequency" | "targetSessionsPerPeriod" | "createdAt">,
  completedDates: Date[],
  startDate: Date,
  endDate: Date
): RoutineComplianceSummary => {
  const periods = listRoutinePeriodBounds(routine, startDate, endDate)
    .map((period) => {
      const completedSessions = completedDates.filter((date) => date >= period.start && date < period.end).length;
      return {
        periodStart: toIso(period.start),
        periodEnd: toIso(period.end),
        expectedSessions: routine.targetSessionsPerPeriod,
        completedSessions,
        metTarget: completedSessions >= routine.targetSessionsPerPeriod,
      };
    })
    .filter((period) => new Date(period.periodEnd) > startDate && new Date(period.periodStart) < endDate);

  const totalExpectedSessions = periods.reduce((sum, period) => sum + period.expectedSessions, 0);
  const totalCompletedSessions = periods.reduce((sum, period) => sum + period.completedSessions, 0);

  return {
    routineId: routine.id,
    startDate: toIso(startDate),
    endDate: toIso(endDate),
    periods,
    totalExpectedSessions,
    totalCompletedSessions,
    adherenceRate: totalExpectedSessions === 0 ? 0 : roundRatio(totalCompletedSessions / totalExpectedSessions),
  };
};

export const buildRoutineSummaryMetrics = (
  routine: Pick<HobbyPracticeRoutine, "id" | "targetFrequency" | "targetSessionsPerPeriod" | "createdAt" | "currentStreak" | "longestStreak">,
  completedDates: Date[],
  referenceDate: Date = new Date()
): RoutineSummaryMetrics => {
  const thirtyDaysAgo = addDays(referenceDate, -30);
  const compliance = buildRoutineComplianceSummary(routine, completedDates, thirtyDaysAgo, addDays(referenceDate, 1));
  const currentPeriodStart = getPeriodStart(routine, referenceDate);
  const currentPeriodEnd = getNextPeriodStart(routine, currentPeriodStart);
  const currentPeriodCompleted = completedDates.filter((date) => date >= currentPeriodStart && date < currentPeriodEnd).length;
  const nextExpectedSessionDate = currentPeriodCompleted >= routine.targetSessionsPerPeriod
    ? toIso(currentPeriodEnd)
    : toIso(currentPeriodEnd);

  return {
    adherenceRate: compliance.adherenceRate,
    nextExpectedSessionDate,
    currentStreak: routine.currentStreak,
    longestStreak: routine.longestStreak,
  };
};

export const recalculatePracticeRoutine = async (
  prisma: PracticePrisma,
  routineId: string,
  referenceDate: Date = new Date()
) => {
  const routine = await prisma.hobbyPracticeRoutine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      hobbyId: true,
      householdId: true,
      createdById: true,
      name: true,
      description: true,
      targetDurationMinutes: true,
      targetFrequency: true,
      targetSessionsPerPeriod: true,
      isActive: true,
      currentStreak: true,
      longestStreak: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        where: {
          OR: [
            { status: "completed" },
            { completedDate: { not: null } },
          ],
        },
        select: {
          completedDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!routine) {
    return null;
  }

  const completedDates = routine.sessions.map((session) => getGoalEventDate(session));
  const streaks = computeRoutineStreaks(routine, completedDates, referenceDate);

  if (streaks.currentStreak !== routine.currentStreak || streaks.longestStreak !== routine.longestStreak) {
    return prisma.hobbyPracticeRoutine.update({
      where: { id: routine.id },
      data: streaks,
    });
  }

  return routine;
};

const createAchievementEntry = async (
  prisma: PracticePrisma,
  goal: Pick<HobbyPracticeGoal, "id" | "hobbyId" | "householdId" | "createdById" | "name" | "targetValue" | "currentValue" | "unit">,
  achievedAt: Date
): Promise<string> => {
  const entry = await prisma.entry.create({
    data: {
      household: { connect: { id: goal.householdId } },
      createdBy: { connect: { id: goal.createdById } },
      title: `${goal.name} achieved`,
      body: `Practice goal achieved: ${goal.name} (${goal.currentValue} ${goal.unit} / ${goal.targetValue} ${goal.unit}).`,
      entryDate: achievedAt,
      entityType: "hobby",
      entityId: goal.hobbyId,
      entryType: "milestone",
      measurements: {
        currentValue: goal.currentValue,
        targetValue: goal.targetValue,
        unit: goal.unit,
        goalId: goal.id,
      } as Prisma.InputJsonValue,
      tags: ["practice-goal", goal.id] as Prisma.InputJsonValue,
      flags: {
        create: [{ flag: "important" }],
      },
    },
    select: { id: true },
  });

  return entry.id;
};

const computeGoalCurrentValue = (
  goal: Pick<HobbyPracticeGoal, "goalType" | "currentValue" | "metricDefinitionId" | "startDate" | "targetDate">,
  sessions: GoalSessionRecord[],
  readingsByMetricId: Map<string, GoalMetricReadingRecord[]>
): number => {
  if (goal.goalType === "custom") {
    return goal.currentValue;
  }

  if (goal.goalType === "session_count") {
    return sessions.filter((session) => isWithinGoalWindow(goal, getGoalEventDate(session))).length;
  }

  if (goal.goalType === "duration_total") {
    return sessions.reduce((sum, session) => (
      isWithinGoalWindow(goal, getGoalEventDate(session)) ? sum + (session.durationMinutes ?? 0) : sum
    ), 0);
  }

  if (!goal.metricDefinitionId) {
    return 0;
  }

  const readings = readingsByMetricId.get(goal.metricDefinitionId) ?? [];
  const latest = readings.filter((reading) => isWithinGoalWindow(goal, reading.readingDate)).at(-1);
  return latest?.value ?? 0;
};

export const recalculatePracticeGoalsForHobby = async (
  prisma: PracticePrisma,
  hobbyId: string,
  achievedAt: Date = new Date()
): Promise<string[]> => {
  const goals = await prisma.hobbyPracticeGoal.findMany({
    where: {
      hobbyId,
      status: { in: autoTrackedGoalStatuses },
    },
    orderBy: { createdAt: "asc" },
  });

  if (goals.length === 0) {
    return [];
  }

  const sessions = await prisma.hobbySession.findMany({
    where: {
      hobbyId,
      OR: [
        { status: "completed" },
        { completedDate: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      completedDate: true,
      createdAt: true,
      durationMinutes: true,
    },
  });

  const metricIds = Array.from(new Set(goals.map((goal) => goal.metricDefinitionId).filter((metricId): metricId is string => Boolean(metricId))));
  const metricReadings = metricIds.length > 0
    ? await prisma.hobbyMetricReading.findMany({
        where: { metricDefinitionId: { in: metricIds } },
        orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          metricDefinitionId: true,
          value: true,
          readingDate: true,
          createdAt: true,
        },
      })
    : [];

  const readingsByMetricId = new Map<string, GoalMetricReadingRecord[]>();
  for (const reading of metricReadings) {
    const existing = readingsByMetricId.get(reading.metricDefinitionId) ?? [];
    existing.push(reading);
    readingsByMetricId.set(reading.metricDefinitionId, existing);
  }

  const createdEntryIds: string[] = [];

  for (const goal of goals) {
    const currentValue = computeGoalCurrentValue(goal, sessions, readingsByMetricId);
    const status = currentValue >= goal.targetValue ? "achieved" : "active";

    if (currentValue !== goal.currentValue || status !== goal.status) {
      await prisma.hobbyPracticeGoal.update({
        where: { id: goal.id },
        data: {
          currentValue,
          status,
        },
      });
    }

    if (goal.status !== "achieved" && status === "achieved") {
      createdEntryIds.push(await createAchievementEntry(prisma, {
        id: goal.id,
        hobbyId: goal.hobbyId,
        householdId: goal.householdId,
        createdById: goal.createdById,
        name: goal.name,
        targetValue: goal.targetValue,
        currentValue,
        unit: goal.unit,
      }, achievedAt));
    }
  }

  return createdEntryIds;
};

export const buildPracticeGoalProgressHistory = async (
  prisma: PracticePrisma,
  goal: Pick<HobbyPracticeGoal, "id" | "hobbyId" | "goalType" | "metricDefinitionId" | "currentValue" | "updatedAt" | "startDate" | "targetDate"> & { name?: string | null }
): Promise<PracticeGoalProgressPoint[]> => {
  if (goal.goalType === "custom") {
    return [{
      value: goal.currentValue,
      date: toIso(goal.updatedAt),
      sourceType: "manual",
      sourceId: goal.id,
      label: goal.name ?? null,
    }];
  }

  if (goal.goalType === "metric_target") {
    if (!goal.metricDefinitionId) {
      return [];
    }

    const readings = await prisma.hobbyMetricReading.findMany({
      where: { metricDefinitionId: goal.metricDefinitionId },
      orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        value: true,
        readingDate: true,
      },
    });

    return readings
      .filter((reading) => isWithinGoalWindow(goal, reading.readingDate))
      .map((reading) => ({
        value: reading.value,
        date: toIso(reading.readingDate),
        sourceType: "metric" as const,
        sourceId: reading.id,
        label: null,
      }));
  }

  const sessions = await prisma.hobbySession.findMany({
    where: {
      hobbyId: goal.hobbyId,
      OR: [
        { status: "completed" },
        { completedDate: { not: null } },
      ],
    },
    orderBy: [{ completedDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      completedDate: true,
      createdAt: true,
      durationMinutes: true,
    },
  });

  let runningValue = 0;
  return sessions
    .filter((session) => isWithinGoalWindow(goal, getGoalEventDate(session)))
    .map((session) => {
      runningValue += goal.goalType === "duration_total" ? (session.durationMinutes ?? 0) : 1;
      return {
        value: runningValue,
        date: toIso(getGoalEventDate(session)),
        sourceType: "session" as const,
        sourceId: session.id,
        label: session.name,
      };
    });
};

export { toProgressPercentage };