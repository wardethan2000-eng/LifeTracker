import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => ({ id: "clkeeperactivity00000000002" }))
}));

const searchMocks = vi.hoisted(() => ({
  syncHobbyToSearchIndex: vi.fn(async () => undefined),
  syncHobbySeriesToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: activityMocks.logActivity,
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncHobbyToSearchIndex: searchMocks.syncHobbyToSearchIndex,
  syncHobbySeriesToSearchIndex: searchMocks.syncHobbySeriesToSearchIndex,
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry
}));

import { hobbyRoutes } from "../src/routes/hobbies/index.js";
import { hobbySeriesRoutes } from "../src/routes/hobbies/series.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const seriesId = "clkeeperseries00000000001";
const sessionId = "clkeepersession0000000001";
const userId = "clkeeperuser0000000000001";

const createApp = async (prisma: object, routes: Array<(typeof hobbyRoutes)>) => {
  const app = Fastify();

  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  for (const route of routes) {
    await app.register(route);
  }

  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby activity mode routes", () => {
  it("persists activityMode on create and supports list filtering", async () => {
    const hobbyCreate = vi.fn(async () => ({
      id: hobbyId,
      householdId,
      name: "Bread Baking",
      description: "Weekly sourdough experiments",
      status: "active",
      activityMode: "practice",
      hobbyType: "baking",
      lifecycleMode: "binary",
      customFields: {},
      fieldDefinitions: [],
      notes: null,
      createdById: userId,
      createdAt: new Date("2026-03-17T00:00:00.000Z"),
      updatedAt: new Date("2026-03-17T00:00:00.000Z")
    }));

    const hobbyFindMany = vi.fn(async () => ([{
      id: hobbyId,
      householdId,
      name: "Bread Baking",
      description: "Weekly sourdough experiments",
      status: "active",
      activityMode: "practice",
      hobbyType: "baking",
      lifecycleMode: "binary",
      customFields: {},
      fieldDefinitions: [],
      notes: null,
      createdById: userId,
      createdAt: new Date("2026-03-17T00:00:00.000Z"),
      updatedAt: new Date("2026-03-17T00:00:00.000Z"),
      _count: {
        recipes: 0,
        sessions: 0,
        assetLinks: 0,
        inventoryLinks: 0
      },
      sessions: []
    }]));

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      hobby: {
        create: hobbyCreate,
        findMany: hobbyFindMany
      },
      hobbySessionStatusStep: {
        createMany: vi.fn(async () => ({ count: 0 }))
      },
      $transaction: async <T>(callback: (tx: { hobby: { create: typeof hobbyCreate }; hobbySessionStatusStep: { createMany: Function } }) => Promise<T>) =>
        callback({ hobby: { create: hobbyCreate }, hobbySessionStatusStep: { createMany: vi.fn(async () => ({ count: 0 })) } })
    }, [hobbyRoutes]);

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/hobbies`,
        payload: {
          name: "Bread Baking",
          activityMode: "practice",
          hobbyType: "baking"
        }
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json()).toMatchObject({
        id: hobbyId,
        activityMode: "practice"
      });
      expect(hobbyCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          activityMode: "practice"
        })
      }));

      const listResponse = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/hobbies?activityMode=practice`
      });

      expect(listResponse.statusCode).toBe(200);
      expect(hobbyFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ activityMode: "practice" })
      }));
      expect(listResponse.json()).toMatchObject({
        items: [
          expect.objectContaining({ activityMode: "practice" })
        ]
      });
    } finally {
      await app.close();
    }
  });
});

describe("hobby series routes", () => {
  it("links a session with the next available batch number", async () => {
    const updatedSession = {
      id: sessionId,
      hobbyId,
      recipeId: null,
      seriesId,
      batchNumber: 5,
      name: "West Coast IPA Batch 5",
      status: "active",
      startDate: new Date("2026-03-17T00:00:00.000Z"),
      completedDate: null,
      pipelineStepId: null,
      customFields: {},
      totalCost: null,
      rating: null,
      notes: null,
      createdAt: new Date("2026-03-17T00:00:00.000Z"),
      updatedAt: new Date("2026-03-17T00:00:00.000Z")
    };

    const tx = {
      hobbySession: {
        aggregate: vi.fn(async () => ({ _max: { batchNumber: 4 } })),
        findUniqueOrThrow: vi.fn(async () => ({ seriesId: null })),
        update: vi.fn(async () => updatedSession),
        count: vi.fn(async () => 1)
      },
      hobbySeries: {
        findUnique: vi.fn(async () => ({ bestBatchSessionId: null })),
        update: vi.fn(async () => ({ id: seriesId }))
      }
    };

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      hobbySeries: {
        findFirst: async () => ({ id: seriesId, name: "West Coast IPA" })
      },
      hobbySession: {
        findFirst: async () => ({ id: sessionId, seriesId: null })
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx)
    }, [hobbySeriesRoutes]);

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/series/${seriesId}/sessions`,
        payload: {
          sessionId
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        id: sessionId,
        seriesId,
        batchNumber: 5
      });
      expect(tx.hobbySession.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: { seriesId }
      }));
      expect(searchMocks.syncHobbySeriesToSearchIndex).toHaveBeenCalledWith(expect.anything(), seriesId);
    } finally {
      await app.close();
    }
  });
});