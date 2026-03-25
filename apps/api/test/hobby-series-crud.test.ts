import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const seriesLibMocks = vi.hoisted(() => ({
  getNextHobbySeriesBatchNumber: vi.fn(async () => 2),
  syncHobbySeriesBatchCount: vi.fn(async () => undefined),
  updateHobbySessionSeriesLink: vi.fn(async () => ({
    id: "clkeepersession0000000001",
    hobbyId: "clkeeperhobby000000000001",
    recipeId: null,
    seriesId: "clkeeperseries00000000001",
    routineId: null,
    collectionItemId: null,
    batchNumber: 2,
    name: "Spring Batch Series - Batch 2",
    status: "active",
    startDate: null,
    completedDate: null,
    durationMinutes: null,
    pipelineStepId: null,
    customFields: {},
    totalCost: null,
    rating: null,
    notes: null,
    createdAt: new Date("2026-03-17T00:00:00.000Z"),
    updatedAt: new Date("2026-03-17T00:00:00.000Z"),
  })),
}));

const searchMocks = vi.hoisted(() => ({
  syncHobbySeriesToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/hobby-series.js", () => seriesLibMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbySeriesRoutes } from "../src/routes/hobbies/series.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const seriesId = "clkeeperseries00000000001";
const sessionId = "clkeepersession0000000001";

const seriesRecord = {
  id: seriesId,
  hobbyId,
  householdId,
  name: "Spring Batch Series",
  description: null,
  status: "active",
  batchCount: 0,
  tags: [],
  notes: null,
  coverImageUrl: null,
  bestBatchSessionId: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
  bestBatchSession: null,
  sessions: [],
};

const basePrisma = () => {
  const txSeries = {
    create: vi.fn(async () => seriesRecord),
    findUniqueOrThrow: vi.fn(async () => seriesRecord),
    update: vi.fn(async () => seriesRecord),
    delete: vi.fn(async () => seriesRecord),
  };
  const txSession = {
    updateMany: vi.fn(async () => ({ count: 0 })),
  };
  return {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" }),
    },
    hobby: {
      findFirst: vi.fn(async () => ({ id: hobbyId, householdId })),
    },
    hobbySeries: {
      findMany: vi.fn(async () => [seriesRecord]),
      findFirst: vi.fn(async () => seriesRecord),
      create: vi.fn(async () => seriesRecord),
      update: vi.fn(async () => seriesRecord),
      delete: vi.fn(async () => seriesRecord),
    },
    hobbySession: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    entry: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
      callback({ hobbySeries: txSeries, hobbySession: txSession })
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
  await app.register(hobbySeriesRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/series`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby series routes", () => {
  describe("GET /series", () => {
    it("returns array of series summaries", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe(seriesId);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /series/:seriesId", () => {
    it("returns series detail with sessions and entries", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${seriesId}` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.id).toBe(seriesId);
        expect(Array.isArray(body.sessions)).toBe(true);
        expect(Array.isArray(body.entries)).toBe(true);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when series not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySeries.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${seriesId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /series", () => {
    it("creates a series and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: { name: "Spring Batch Series" },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(seriesId);
        expect(searchMocks.syncHobbySeriesToSearchIndex).toHaveBeenCalledTimes(1);
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
          payload: { name: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when a session in sessionIds is not found", async () => {
      const prisma = basePrisma();
      // Only 0 sessions returned when 1 requested → triggers not found
      prisma.hobbySession.findMany = vi.fn(async () => []);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: { name: "x", sessionIds: [sessionId] },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().message).toMatch(/not found/i);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /series/:seriesId", () => {
    it("updates and returns the series", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${seriesId}`,
          payload: { name: "Autumn Batch Series" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(seriesId);
        expect(prisma.hobbySeries.update).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when series not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySeries.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${seriesId}`,
          payload: { name: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /series/:seriesId", () => {
    it("deletes series and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${seriesId}` });
        expect(res.statusCode).toBe(204);
        expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when series not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySeries.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${seriesId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /series/:seriesId/sessions/:sessionId", () => {
    it("links a session to a series", async () => {
      const prisma = basePrisma();
      // Session exists and is not yet in a series
      prisma.hobbySession.findFirst = vi.fn(async () => ({
        id: sessionId,
        hobbyId,
        seriesId: null,
        batchNumber: null,
        completedDate: null,
        startDate: null,
        createdAt: new Date("2026-03-17T00:00:00.000Z"),
      }));
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/${seriesId}/sessions`,
          payload: { sessionId },
        });
        expect(res.statusCode).toBe(201);
        expect(seriesLibMocks.updateHobbySessionSeriesLink).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when series not found", async () => {
      const prisma = basePrisma();
      prisma.hobbySeries.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/${seriesId}/sessions/${sessionId}`,
          payload: {},
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
