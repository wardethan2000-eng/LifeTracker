import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => undefined),
}));

const searchMocks = vi.hoisted(() => ({
  syncHobbyCollectionItemToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbyCollectionRoutes } from "../src/routes/hobbies/collection.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const collectionItemId = "clkeepercollection0000001";

const collectionItemRecord = {
  id: collectionItemId,
  hobbyId,
  householdId,
  createdById: userId,
  name: "Cascade Hops",
  description: null,
  status: "active",
  acquiredDate: null,
  retiredDate: null,
  coverImageUrl: null,
  location: null,
  customFields: {},
  quantity: 1,
  tags: [],
  notes: null,
  parentItemId: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
  childItems: [],
};

const basePrisma = () => ({
  householdMember: {
    findUnique: async () => ({ householdId, userId, role: "owner" }),
  },
  hobbyCollectionItem: {
    findMany: vi.fn(async () => [collectionItemRecord]),
    findFirst: vi.fn(async () => ({ ...collectionItemRecord, childItems: [] })),
    create: vi.fn(async () => collectionItemRecord),
    update: vi.fn(async () => collectionItemRecord),
    delete: vi.fn(async () => collectionItemRecord),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  hobby: {
    findFirst: vi.fn(async () => ({ id: hobbyId })),
  },
  hobbySession: {
    findMany: vi.fn(async () => []),
  },
  entry: {
    findMany: vi.fn(async () => []),
  },
  hobbyMetricReading: {
    findMany: vi.fn(async () => []),
  },
});

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbyCollectionRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/collection`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby collection routes", () => {
  describe("GET /collection", () => {
    it("returns paginated list of collection items", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].id).toBe(collectionItemId);
      } finally {
        await app.close();
      }
    });

    it("filters by status", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}?status=active` });
        expect(res.statusCode).toBe(200);
        expect(prisma.hobbyCollectionItem.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ status: "active" }) })
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /collection", () => {
    it("creates an item and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: { name: "Cascade Hops", status: "active" },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(collectionItemId);
        expect(prisma.hobbyCollectionItem.create).toHaveBeenCalledTimes(1);
        expect(searchMocks.syncHobbyCollectionItemToSearchIndex).toHaveBeenCalledTimes(1);
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
  });

  describe("GET /collection/:collectionItemId", () => {
    it("returns the item detail", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${collectionItemId}` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.id).toBe(collectionItemId);
        // Detail response includes timeline + sessions + readings
        expect(Array.isArray(body.sessionHistory)).toBe(true);
        expect(Array.isArray(body.entryTimeline)).toBe(true);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when item not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyCollectionItem.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${collectionItemId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /collection/:collectionItemId", () => {
    it("updates and returns the item", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${collectionItemId}`,
          payload: { name: "Chinook Hops" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(collectionItemId);
        expect(prisma.hobbyCollectionItem.update).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when item not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyCollectionItem.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${collectionItemId}`,
          payload: { name: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /collection/:collectionItemId", () => {
    it("deletes and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${collectionItemId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobbyCollectionItem.delete).toHaveBeenCalledTimes(1);
        expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when item not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyCollectionItem.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${collectionItemId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
