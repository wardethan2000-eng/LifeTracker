import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inventoryMocks = vi.hoisted(() => ({
  applyInventoryTransaction: vi.fn(async () => ({
    transaction: { id: "clkeepertxn0000000000001" },
    item: { id: "clkeeperitem0000000000001", quantityOnHand: 3 },
    stockClamped: false,
    lowStock: false,
  })),
}));

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const practiceMocks = vi.hoisted(() => ({
  recalculatePracticeGoalsForHobby: vi.fn(async () => []),
  recalculatePracticeRoutine: vi.fn(async () => undefined),
}));

const seriesMocks = vi.hoisted(() => ({
  syncHobbySeriesBatchCount: vi.fn(async () => undefined),
}));

const searchMocks = vi.hoisted(() => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
  syncHobbySeriesToSearchIndex: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/inventory.js")>();
  return { ...actual, applyInventoryTransaction: inventoryMocks.applyInventoryTransaction };
});
vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);
vi.mock("../src/lib/hobby-series.js", () => seriesMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbySessionRoutes } from "../src/routes/hobbies/sessions.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const sessionId = "clkeepersession0000000001";

const baseSessionRecord = {
  id: sessionId,
  hobbyId,
  recipeId: null,
  seriesId: null,
  batchNumber: null,
  routineId: null,
  collectionItemId: null,
  name: "Spring IPA",
  status: "active",
  startDate: new Date("2026-03-17T00:00:00.000Z"),
  completedDate: null,
  pipelineStepId: null,
  customFields: {},
  totalCost: null,
  rating: null,
  notes: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

// Full session record for GET /sessions (list) — needs recipe, _count, steps
const sessionListRecord = {
  ...baseSessionRecord,
  recipe: null,
  _count: { ingredients: 0, steps: 0, metricReadings: 0 },
  steps: [],
};

// Full session record for GET /sessions/:id — needs stages, ingredients, steps, metricReadings, recipe
const sessionDetailRecord = {
  ...baseSessionRecord,
  recipe: null,
  stages: [],
  ingredients: [],
  steps: [],
  metricReadings: [],
};

const basePrisma = () => ({
  householdMember: {
    findUnique: async () => ({ householdId, userId, role: "owner" }),
  },
  hobbySession: {
    findMany: vi.fn(async () => [sessionListRecord]),
    findFirst: vi.fn(async () => sessionDetailRecord),
    findUniqueOrThrow: vi.fn(async () => baseSessionRecord),
    create: vi.fn(async () => baseSessionRecord),
    update: vi.fn(async () => baseSessionRecord),
    delete: vi.fn(async () => baseSessionRecord),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  hobby: {
    findFirst: vi.fn(async () => ({
      id: hobbyId,
      householdId,
      lifecycleMode: "simple",
      statusPipeline: [],
    })),
  },
  entry: {
    findMany: vi.fn(async () => []),
    groupBy: vi.fn(async () => []),
  },
  hobbyPracticeRoutine: {
    findFirst: vi.fn(async () => null),
  },
  hobbyCollectionItem: {
    findFirst: vi.fn(async () => null),
  },
  hobbyRecipe: {
    findUnique: vi.fn(async () => null),
  },
  hobbySessionStatusStep: {
    findMany: vi.fn(async () => []),
  },
  $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
    callback({
      hobbySession: {
        create: vi.fn(async () => baseSessionRecord),
        update: vi.fn(async () => baseSessionRecord),
        findUniqueOrThrow: vi.fn(async () => baseSessionRecord),
      },
      hobbyRecipe: { findUnique: vi.fn(async () => null) },
      hobbySessionIngredient: { createMany: vi.fn(async () => ({ count: 0 })) },
      hobbySessionStep: { createMany: vi.fn(async () => ({ count: 0 })) },
      hobbySessionStage: { create: vi.fn(async () => ({ id: "clkeeperstage000000000001" })) },
      hobbySessionStageChecklistItem: { createMany: vi.fn(async () => ({ count: 0 })) },
    })
  ),
});

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbySessionRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby session CRUD routes", () => {
  describe("GET /sessions", () => {
    it("returns paginated list of sessions", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].id).toBe(sessionId);
      } finally {
        await app.close();
      }
    });

    it("filters by status query param", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}?status=completed` });
        expect(res.statusCode).toBe(200);
        expect(prisma.hobbySession.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: "completed" }) })
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /sessions/:sessionId", () => {
    it("returns full session detail", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${sessionId}` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.id).toBe(sessionId);
        expect(Array.isArray(body.stages)).toBe(true);
        expect(Array.isArray(body.steps)).toBe(true);
        expect(Array.isArray(body.ingredients)).toBe(true);
        expect(Array.isArray(body.logs)).toBe(true);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when session not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySession.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${sessionId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /sessions/:sessionId", () => {
    it("updates session notes and returns 200", async () => {
      const prisma = basePrisma();
      // PATCH uses $transaction when updating ingredients, but simple field update doesn't
      // It calls findFirst then $transaction containing update + recalculations
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${sessionId}`,
          payload: { notes: "Updated notes" },
        });
        expect(res.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when session not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySession.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${sessionId}`,
          payload: { notes: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /sessions/:sessionId", () => {
    it("deletes session and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${sessionId}` });
        expect(res.statusCode).toBe(204);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when session not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySession.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${sessionId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
