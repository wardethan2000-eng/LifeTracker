import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const practiceMocks = vi.hoisted(() => ({
  buildRoutineSummaryMetrics: vi.fn(() => ({
    adherenceRate: 0,
    nextExpectedSessionDate: null,
  })),
  recalculatePracticeRoutine: vi.fn(async () => undefined),
  buildRoutineComplianceSummary: vi.fn(() => ({
    routineId: "clkeeperroutine0000000001",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-03-17T00:00:00.000Z",
    periods: [],
    totalExpectedSessions: 4,
    totalCompletedSessions: 3,
    adherenceRate: 0.75,
  })),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);

import { hobbyRoutineRoutes } from "../src/routes/hobbies/routines.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const routineId = "clkeeperroutine0000000001";

const routineRecord = {
  id: routineId,
  hobbyId,
  householdId,
  createdById: userId,
  name: "Daily Scales",
  description: null,
  targetDurationMinutes: 30,
  targetFrequency: "weekly",
  targetSessionsPerPeriod: 3,
  isActive: true,
  currentStreak: 0,
  longestStreak: 0,
  notes: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
  sessions: [],
};

const basePrisma = () => ({
  householdMember: {
    findUnique: async () => ({ householdId, userId, role: "owner" }),
  },
  hobbyPracticeRoutine: {
    findMany: vi.fn(async () => [routineRecord]),
    findFirst: vi.fn(async () => routineRecord),
    create: vi.fn(async () => routineRecord),
    update: vi.fn(async () => routineRecord),
    findUniqueOrThrow: vi.fn(async () => routineRecord),
    delete: vi.fn(async () => routineRecord),
  },
  hobby: {
    findFirst: vi.fn(async () => ({ id: hobbyId })),
  },
});

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbyRoutineRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/routines`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby routine routes", () => {
  describe("GET /routines", () => {
    it("returns a paginated list of routines", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].id).toBe(routineId);
      } finally {
        await app.close();
      }
    });

    it("filters by isActive query param", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}?isActive=true` });
        expect(res.statusCode).toBe(200);
        expect(prisma.hobbyPracticeRoutine.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /routines", () => {
    it("creates a routine and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: {
            name: "Daily Scales",
            targetFrequency: "weekly",
            targetSessionsPerPeriod: 3,
            targetDurationMinutes: 30,
          },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json();
        expect(body.id).toBe(routineId);
        expect(body.name).toBe("Daily Scales");
        expect(prisma.hobbyPracticeRoutine.create).toHaveBeenCalledTimes(1);
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
          payload: { name: "Daily Scales", targetFrequency: "weekly" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /routines/:routineId", () => {
    it("returns the routine", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${routineId}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(routineId);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when routine not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeRoutine.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${routineId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /routines/:routineId", () => {
    it("updates and returns the routine", async () => {
      const prisma = basePrisma();
      // recalculatePracticeRoutine returns undefined so fallback findUniqueOrThrow is called
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${routineId}`,
          payload: { name: "Daily Scales v2" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(routineId);
        expect(prisma.hobbyPracticeRoutine.update).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when routine not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeRoutine.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${routineId}`,
          payload: { name: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /routines/:routineId", () => {
    it("deletes and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${routineId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobbyPracticeRoutine.delete).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when routine not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeRoutine.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${routineId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /routines/:routineId/compliance", () => {
    it("returns compliance summary", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const start = "2026-01-01T00:00:00.000Z";
        const end = "2026-03-17T00:00:00.000Z";
        const res = await app.inject({
          method: "GET",
          url: `${BASE}/${routineId}/compliance?startDate=${start}&endDate=${end}`,
        });
        expect(res.statusCode).toBe(200);
        expect(practiceMocks.buildRoutineComplianceSummary).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when routine not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyPracticeRoutine.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "GET",
          url: `${BASE}/${routineId}/compliance?startDate=2026-01-01T00:00:00.000Z&endDate=2026-03-17T00:00:00.000Z`,
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
