import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

const searchMocks = vi.hoisted(() => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => activityMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbyLogRoutes } from "../src/routes/hobbies/logs.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const logId = "clkeeperlog000000000000001";

const hobbyRecord = {
  id: hobbyId,
  householdId,
  name: "Home Brewing",
};

const entryRecord = {
  id: logId,
  householdId,
  createdById: userId,
  entityType: "hobby",
  entityId: hobbyId,
  entryType: "note",
  title: null,
  body: "Great brew day",
  entryDate: new Date("2026-03-17T00:00:00.000Z"),
  tags: [],
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const basePrisma = () => ({
  householdMember: {
    findUnique: async () => ({ householdId, userId, role: "owner" }),
  },
  hobby: {
    findFirst: vi.fn(async () => hobbyRecord),
  },
  hobbySession: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => ({ id: "clkeepersession0000000001" })),
  },
  entry: {
    findMany: vi.fn(async () => [entryRecord]),
    findFirst: vi.fn(async () => entryRecord),
    create: vi.fn(async () => entryRecord),
    update: vi.fn(async () => entryRecord),
    delete: vi.fn(async () => entryRecord),
  },
});

const createApp = async (prisma: object) => {
  const app = Fastify();
  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });
  await app.register(hobbyLogRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/logs`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby log routes", () => {
  describe("GET /logs", () => {
    it("returns array of log entries", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe(logId);
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

    it("filters by sessionId when provided", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const sessionId = "clkeepersession0000000001";
        const res = await app.inject({
          method: "GET",
          url: `${BASE}?sessionId=${sessionId}`,
        });
        expect(res.statusCode).toBe(200);
        // When sessionId provided, should NOT call hobbySession.findMany
        expect(prisma.hobbySession.findMany).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /logs/:logId", () => {
    it("returns a single log entry", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${logId}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(logId);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when log not found", async () => {
      const prisma = basePrisma();
      prisma.entry.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${logId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when hobby not found", async () => {
      const prisma = basePrisma();
      prisma.hobby.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${logId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /logs", () => {
    it("creates a log entry and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: {
            content: "Great brew day",
            logDate: "2026-03-17T00:00:00.000Z",
            logType: "note",
          },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(logId);
        expect(prisma.entry.create).toHaveBeenCalledTimes(1);
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
          payload: { content: "x", logDate: "2026-03-17T00:00:00.000Z" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /logs/:logId", () => {
    it("updates a log entry and returns it", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${logId}`,
          payload: { content: "Updated notes" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(logId);
        expect(prisma.entry.update).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when log not found", async () => {
      const prisma = basePrisma();
      prisma.entry.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${logId}`,
          payload: { content: "x" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /logs/:logId", () => {
    it("deletes and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${logId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.entry.delete).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when log not found", async () => {
      const prisma = basePrisma();
      prisma.entry.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${logId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
