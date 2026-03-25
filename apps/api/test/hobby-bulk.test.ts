import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const practiceMocks = vi.hoisted(() => ({
  recalculatePracticeGoalsForHobby: vi.fn(async () => []),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);

import { hobbySessionBulkRoutes } from "../src/routes/hobbies/sessions-bulk.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const sessionId1 = "clkeepersession0000000001";
const sessionId2 = "clkeepersession0000000002";

const sessionRecord = {
  id: sessionId1,
  hobbyId,
  name: "Batch 1",
  status: "active",
  startDate: null,
  completedDate: null,
  durationMinutes: null,
  notes: null,
  recipeId: null,
  routineId: null,
  collectionItemId: null,
  pipelineStepId: null,
  customFields: {},
  totalCost: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const basePrisma = () => {
  const txSession = { create: vi.fn(async () => sessionRecord) };
  return {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" }),
    },
    hobby: {
      findFirst: vi.fn(async () => ({ id: hobbyId, householdId, name: "Home Brewing" })),
    },
    hobbySession: {
      findMany: vi.fn(async () => [
        { id: sessionId1, name: "Batch 1", status: "active" },
        { id: sessionId2, name: "Batch 2", status: "active" },
      ]),
      updateMany: vi.fn(async () => ({ count: 2 })),
    },
    $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
      callback({ hobbySession: txSession })
    ),
  };
};

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbySessionBulkRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby session bulk routes", () => {
  describe("POST /sessions/bulk/log", () => {
    it("logs multiple sessions and returns success count", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/bulk/log`,
          payload: {
            householdId,
            hobbyId,
            sessions: [
              { name: "Batch 1", completedDate: "2026-03-10T00:00:00.000Z" },
              { name: "Batch 2", completedDate: "2026-03-15T00:00:00.000Z" },
            ],
          },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.succeeded).toBe(2);
        expect(body.failed).toHaveLength(0);
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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
          url: `${BASE}/bulk/log`,
          payload: {
            householdId,
            hobbyId,
            sessions: [{ name: "x", completedDate: "2026-03-10T00:00:00.000Z" }],
          },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("reports failures for individual sessions that throw", async () => {
      const prisma = basePrisma();
      prisma.$transaction = vi.fn(async () => {
        throw new Error("DB error");
      });
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/bulk/log`,
          payload: {
            householdId,
            hobbyId,
            sessions: [{ name: "Batch 1", completedDate: "2026-03-10T00:00:00.000Z" }],
          },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.succeeded).toBe(0);
        expect(body.failed).toHaveLength(1);
        expect(body.failed[0].label).toBe("Batch 1");
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /sessions/bulk/archive", () => {
    it("archives specified sessions and returns success count", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/bulk/archive`,
          payload: {
            householdId,
            hobbyId,
            sessionIds: [sessionId1, sessionId2],
          },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.succeeded).toBe(2);
        expect(body.failed).toHaveLength(0);
        expect(prisma.hobbySession.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ data: { status: "archived" } })
        );
      } finally {
        await app.close();
      }
    });

    it("returns not-found failures for session IDs that don't exist", async () => {
      const prisma = basePrisma();
      prisma.hobbySession.findMany = vi.fn(async () => []);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/bulk/archive`,
          payload: {
            householdId,
            hobbyId,
            sessionIds: ["clkeepersession0000000999"],
          },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.succeeded).toBe(0);
        expect(body.failed).toHaveLength(1);
        expect(body.failed[0].error).toMatch(/not found/i);
      } finally {
        await app.close();
      }
    });

    it("does not 404 when hobby sessions are not found", async () => {
      const prisma = basePrisma();
      // archive route does NOT validate hobby existence — it queries hobbySession directly
      // when no sessions are found for the given IDs, it returns succeeded=0
      prisma.hobbySession.findMany = vi.fn(async () => []);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/bulk/archive`,
          payload: { householdId, hobbyId, sessionIds: [sessionId1] },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().succeeded).toBe(0);
      } finally {
        await app.close();
      }
    });
  });
});
