import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const practiceMocks = vi.hoisted(() => ({
  buildPracticeGoalProgressHistory: vi.fn(),
  recalculatePracticeGoalsForHobby: vi.fn(async () => ["clkeeperentry000000000001"]),
  recalculatePracticeRoutine: vi.fn(async () => undefined),
  buildRoutineComplianceSummary: vi.fn(),
  buildRoutineSummaryMetrics: vi.fn(),
  toProgressPercentage: vi.fn((currentValue: number, targetValue: number) => (targetValue === 0 ? 0 : (currentValue / targetValue) * 100)),
}));

const searchMocks = vi.hoisted(() => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
  syncHobbySeriesToSearchIndex: vi.fn(async () => undefined),
  syncHobbyCollectionItemToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => ({ id: "clkeeperactivity00000000009" })),
}));

vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);
vi.mock("../src/lib/activity-log.js", () => ({ logActivity: activityMocks.logActivity }));

import { hobbyCollectionRoutes } from "../src/routes/hobbies/collection.js";
import { hobbyGoalRoutes } from "../src/routes/hobbies/goals.js";
import { hobbySessionRoutes } from "../src/routes/hobbies/sessions.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const routineId = "clkeeperroutine0000000001";
const collectionItemId = "clkeepercollection0000001";
const goalId = "clkeepergoal0000000000001";
const sessionId = "clkeepersession0000000001";
const userId = "clkeeperuser0000000000001";

const createApp = async (prisma: object, routes: Array<(typeof hobbyGoalRoutes) | (typeof hobbySessionRoutes) | (typeof hobbyCollectionRoutes)>) => {
  const app = Fastify();

  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass",
    };
  });

  for (const route of routes) {
    await app.register(route);
  }

  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  practiceMocks.buildPracticeGoalProgressHistory.mockResolvedValue([
    {
      value: 12,
      date: "2026-03-18T00:00:00.000Z",
      sourceType: "session",
      sourceId: sessionId,
      label: "Morning Run",
    },
  ]);
});

describe("hobby practice and collection routes", () => {
  it("returns practice goal detail with percentage and history", async () => {
    const goal = {
      id: goalId,
      hobbyId,
      householdId,
      createdById: userId,
      name: "Run 50 miles",
      description: null,
      goalType: "duration_total",
      targetValue: 24,
      currentValue: 12,
      unit: "hours",
      metricDefinitionId: null,
      startDate: null,
      targetDate: null,
      status: "active",
      tags: [],
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-18T00:00:00.000Z"),
    };

    const app = await createApp({
      householdMember: { findUnique: async () => ({ householdId, userId, role: "owner" }) },
      hobbyPracticeGoal: { findFirst: vi.fn(async () => goal) },
    }, [hobbyGoalRoutes]);

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/goals/${goalId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: goalId,
        progressPercentage: 50,
        progressHistory: [
          expect.objectContaining({ sourceId: sessionId, value: 12 }),
        ],
      });
      expect(practiceMocks.buildPracticeGoalProgressHistory).toHaveBeenCalledWith(expect.anything(), goal);
    } finally {
      await app.close();
    }
  });

  it("recalculates practice goals and routine streaks when completing a session", async () => {
    const existingSession = {
      id: sessionId,
      hobbyId,
      recipeId: null,
      seriesId: null,
      routineId,
      collectionItemId: null,
      batchNumber: null,
      name: "Morning Run",
      status: "active",
      startDate: new Date("2026-03-18T06:00:00.000Z"),
      completedDate: null,
      durationMinutes: 45,
      pipelineStepId: null,
      customFields: {},
      totalCost: null,
      rating: null,
      notes: null,
      createdAt: new Date("2026-03-18T06:00:00.000Z"),
      updatedAt: new Date("2026-03-18T06:00:00.000Z"),
    };

    const updatedSession = {
      ...existingSession,
      status: "completed",
      completedDate: new Date("2026-03-18T06:45:00.000Z"),
    };

    const tx = {
      hobbySession: {
        update: vi.fn(async () => updatedSession),
      },
    };

    const app = await createApp({
      householdMember: { findUnique: async () => ({ householdId, userId, role: "owner" }) },
      hobbyPracticeRoutine: {
        findFirst: vi.fn(async () => ({ id: routineId })),
      },
      hobbySession: {
        findFirst: vi.fn(async () => existingSession),
      },
      hobby: {
        findUnique: vi.fn(async () => ({ id: hobbyId, lifecycleMode: "binary", statusPipeline: [] })),
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx),
    }, [hobbySessionRoutes]);

    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`,
        payload: { status: "completed" },
      });

      expect(response.statusCode).toBe(200);
      expect(practiceMocks.recalculatePracticeGoalsForHobby).toHaveBeenCalledWith(tx, hobbyId);
      expect(practiceMocks.recalculatePracticeRoutine).toHaveBeenCalledWith(tx, routineId);
      expect(searchMocks.syncEntryToSearchIndex).toHaveBeenCalledWith(expect.anything(), "clkeeperentry000000000001");
    } finally {
      await app.close();
    }
  });

  it("bulk-updates collection item status by location and syncs search", async () => {
    const itemA = { id: "clkeepercollection0000001", name: "Monstera" };
    const itemB = { id: "clkeepercollection0000002", name: "Philodendron" };

    const app = await createApp({
      householdMember: { findUnique: async () => ({ householdId, userId, role: "owner" }) },
      hobbyCollectionItem: {
        findMany: vi.fn(async () => [itemA, itemB]),
        updateMany: vi.fn(async () => ({ count: 2 })),
      },
    }, [hobbyCollectionRoutes]);

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/collection/bulk-status`,
        payload: {
          status: "dormant",
          location: "Sunroom",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ updatedCount: 2 });
      expect(searchMocks.syncHobbyCollectionItemToSearchIndex).toHaveBeenCalledWith(expect.anything(), itemA.id);
      expect(searchMocks.syncHobbyCollectionItemToSearchIndex).toHaveBeenCalledWith(expect.anything(), itemB.id);
    } finally {
      await app.close();
    }
  });
});