import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const practiceMocks = vi.hoisted(() => ({
  recalculatePracticeGoalsForHobby: vi.fn(async () => []),
  buildPracticeGoalProgressHistory: vi.fn(async () => []),
  toProgressPercentage: vi.fn(() => 0),
}));

const searchMocks = vi.hoisted(() => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbyGoalRoutes } from "../src/routes/hobbies/goals.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const goalId = "clkeepergoal0000000000001";

const goalRecord = {
  id: goalId,
  hobbyId,
  householdId,
  createdById: userId,
  name: "Brew 12 batches",
  description: null,
  goalType: "session_count",
  targetValue: 12,
  currentValue: 3,
  unit: "batches",
  metricDefinitionId: null,
  startDate: null,
  targetDate: null,
  status: "active",
  tags: [],
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const makeTx = () => ({
  hobbyPracticeGoal: {
    create: vi.fn(async () => goalRecord),
    findUniqueOrThrow: vi.fn(async () => goalRecord),
    update: vi.fn(async () => goalRecord),
  },
});

const basePrisma = () => {
  const tx = makeTx();
  return {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" }),
    },
    hobbyPracticeGoal: {
      findMany: vi.fn(async () => [goalRecord]),
      findFirst: vi.fn(async () => goalRecord),
      create: vi.fn(async () => goalRecord),
      update: vi.fn(async () => goalRecord),
      delete: vi.fn(async () => goalRecord),
    },
    hobby: {
      findFirst: vi.fn(async () => ({ id: hobbyId })),
    },
    hobbyMetricDefinition: {
      findFirst: vi.fn(async () => ({ id: "clkeepermetric00000000001" })),
    },
    $transaction: vi.fn(async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx)),
    _tx: tx,
  };
};

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbyGoalRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/goals`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby goal routes", () => {
  describe("GET /goals", () => {
    it("returns paginated list of goals", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].id).toBe(goalId);
      } finally {
        await app.close();
      }
    });

    it("filters by status query param", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}?status=active` });
        expect(res.statusCode).toBe(200);
        expect(prisma.hobbyPracticeGoal.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: "active" }) })
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /goals", () => {
    it("creates a session_count goal and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: {
            name: "Brew 12 batches",
            goalType: "session_count",
            targetValue: 12,
            unit: "batches",
          },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(goalId);
      } finally {
        await app.close();
      }
    });

    it("returns 400 when metric_target goal has no metricDefinitionId", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: {
            name: "Hit OG target",
            goalType: "metric_target",
            targetValue: 1.065,
            unit: "SG",
          },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().message).toMatch(/metricDefinitionId/);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: { name: "x", goalType: "session_count", targetValue: 1, unit: "u" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /goals/:goalId", () => {
    it("updates and returns the goal", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${goalId}`,
          payload: { name: "Brew 20 batches" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(goalId);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when goal not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeGoal.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${goalId}`,
          payload: { name: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /goals/:goalId", () => {
    it("deletes and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${goalId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobbyPracticeGoal.delete).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when goal not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeGoal.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${goalId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
