import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const searchMocks = vi.hoisted(() => ({
  syncHobbyToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbyRoutes } from "../src/routes/hobbies/index.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const stageId1 = "clkeeperstage000000000001";
const stageId2 = "clkeeperstage000000000002";

const hobbyRecord = {
  id: hobbyId,
  householdId,
  name: "Coffee Roasting",
  description: null,
  status: "active",
  activityMode: "session",
  hobbyType: "Roasting",
  lifecycleMode: "pipeline",
  customFields: {},
  fieldDefinitions: [],
  notes: null,
  createdById: userId,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

// Full hobby record for GET /hobbies/:hobbyId (includes all related entities)
const hobbyDetailRecord = {
  ...hobbyRecord,
  assetLinks: [],
  inventoryLinks: [],
  projectLinks: [],
  metricDefinitions: [],
  statusPipeline: [],
  inventoryCategories: [],
  sessions: [],
  _count: { recipes: 0, sessions: 0 },
};

const basePrisma = () => ({
  householdMember: {
    findUnique: async () => ({ householdId, userId, role: "owner" }),
  },
  hobby: {
    findFirst: vi.fn(async () => hobbyDetailRecord),
    delete: vi.fn(async () => hobbyRecord),
  },
  hobbySession: {
    count: vi.fn(async () => 3),
  },
  hobbyRecipe: {
    count: vi.fn(async () => 1),
  },
  hobbySeries: {
    count: vi.fn(async () => 2),
  },
  hobbyPracticeGoal: {
    count: vi.fn(async () => 0),
  },
  hobbyPracticeRoutine: {
    count: vi.fn(async () => 1),
  },
  hobbyMetricDefinition: {
    count: vi.fn(async () => 2),
  },
  hobbyCollectionItem: {
    count: vi.fn(async () => 5),
  },
  hobbySessionStatusStep: {
    findMany: vi.fn(async () => [{ id: stageId1 }, { id: stageId2 }]),
    update: vi.fn(async (args: { where: { id: string }; data: { sortOrder: number } }) =>
      ({ id: args.where.id, sortOrder: args.data.sortOrder })
    ),
  },
  $transaction: vi.fn(async (ops: unknown) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops as Promise<unknown>[]);
    }
    return (ops as (tx: object) => Promise<unknown>)({});
  }),
});

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbyRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby index detail routes", () => {
  describe("GET /hobbies/:hobbyId", () => {
    it("returns full hobby detail with all related sections", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${hobbyId}` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.id).toBe(hobbyId);
        expect(body.name).toBe("Coffee Roasting");
        // All related arrays should be present
        expect(Array.isArray(body.assetLinks)).toBe(true);
        expect(Array.isArray(body.inventoryLinks)).toBe(true);
        expect(Array.isArray(body.projectLinks)).toBe(true);
        expect(Array.isArray(body.metricDefinitions)).toBe(true);
        expect(Array.isArray(body.statusPipeline)).toBe(true);
        expect(Array.isArray(body.inventoryCategories)).toBe(true);
        expect(Array.isArray(body.recentSessions)).toBe(true);
        expect(typeof body.sessionCount).toBe("number");
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${hobbyId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /hobbies/:hobbyId", () => {
    it("deletes the hobby and returns 204", async () => {
      const prisma = basePrisma();
      // findFirst for DELETE only needs the base fields
      prisma.hobby.findFirst = vi.fn(async () => hobbyRecord);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${hobbyId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobby.delete).toHaveBeenCalledWith({ where: { id: hobbyId } });
        expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledWith(
          expect.anything(),
          "hobby",
          hobbyId
        );
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${hobbyId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /hobbies/:hobbyId/delete-impact", () => {
    it("returns counts of all associated entities", async () => {
      const prisma = basePrisma();
      // findFirst for delete-impact only needs base fields
      prisma.hobby.findFirst = vi.fn(async () => hobbyRecord);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${hobbyId}/delete-impact` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(typeof body.sessions).toBe("number");
        expect(typeof body.recipes).toBe("number");
        expect(typeof body.series).toBe("number");
        expect(typeof body.practiceGoals).toBe("number");
        expect(typeof body.metricDefinitions).toBe("number");
        expect(typeof body.collectionItems).toBe("number");
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${hobbyId}/delete-impact` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /hobbies/:hobbyId/workflow-stages/reorder", () => {
    it("reorders stages and returns ordered IDs", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => hobbyRecord);
      const app = await createApp(prisma);
      try {
        const orderedIds = [stageId2, stageId1];
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${hobbyId}/workflow-stages/reorder`,
          payload: { orderedIds },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().orderedIds).toEqual(orderedIds);
      } finally {
        await app.close();
      }
    });

    it("returns 400 when orderedIds is missing stages", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => hobbyRecord);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${hobbyId}/workflow-stages/reorder`,
          payload: { orderedIds: [stageId1] }, // missing stageId2
        });
        expect(res.statusCode).toBe(400);
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
          method: "PATCH",
          url: `${BASE}/${hobbyId}/workflow-stages/reorder`,
          payload: { orderedIds: [stageId1, stageId2] },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
