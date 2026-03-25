import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const practiceMocks = vi.hoisted(() => ({
  recalculatePracticeGoalsForHobby: vi.fn(async () => []),
}));

const searchMocks = vi.hoisted(() => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/hobby-practice.js", () => practiceMocks);
vi.mock("../src/lib/search-index.js", () => searchMocks);

import { hobbyMetricRoutes } from "../src/routes/hobbies/metrics.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";
const metricId = "clkeepermetric00000000001";
const readingId = "clkeeperreading0000000001";

const metricRecord = {
  id: metricId,
  hobbyId,
  name: "Batch Size",
  unit: "lbs",
  description: null,
  metricType: "numeric",
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const readingRecord = {
  id: readingId,
  metricDefinitionId: metricId,
  sessionId: null,
  value: 5.2,
  readingDate: new Date("2026-03-17T00:00:00.000Z"),
  notes: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const basePrisma = () => {
  const txReading = { create: vi.fn(async () => readingRecord), delete: vi.fn(async () => readingRecord) };
  return {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" }),
    },
    hobbyMetricDefinition: {
      findMany: vi.fn(async () => [metricRecord]),
      findFirst: vi.fn(async () => metricRecord),
      create: vi.fn(async () => metricRecord),
      update: vi.fn(async () => metricRecord),
      delete: vi.fn(async () => metricRecord),
    },
    hobbyMetricReading: {
      findMany: vi.fn(async () => [readingRecord]),
      create: vi.fn(async () => readingRecord),
      findFirst: vi.fn(async () => readingRecord),
      delete: vi.fn(async () => readingRecord),
    },
    hobbySession: {
      findFirst: vi.fn(async () => ({ id: "clkeepersession0000000001" })),
    },
    hobby: {
      findFirst: vi.fn(async () => ({ id: hobbyId })),
    },
    $transaction: vi.fn(async (callback: (tx: object) => Promise<unknown>) =>
      callback({ hobbyMetricReading: txReading })
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
  await app.register(hobbyMetricRoutes);
  return app;
};

const BASE = `/v1/households/${householdId}/hobbies/${hobbyId}/metrics`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby metric routes", () => {
  describe("GET /metrics", () => {
    it("returns array of metric definitions", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: BASE });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe(metricId);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /metrics", () => {
    it("creates a metric definition and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: BASE,
          payload: { name: "Batch Size", unit: "lbs", metricType: "numeric" },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(metricId);
        expect(prisma.hobbyMetricDefinition.create).toHaveBeenCalledTimes(1);
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
          payload: { name: "Batch Size", unit: "lbs" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("PATCH /metrics/:metricId", () => {
    it("updates and returns the metric definition", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${metricId}`,
          payload: { name: "OG" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().id).toBe(metricId);
        expect(prisma.hobbyMetricDefinition.update).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when metric not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyMetricDefinition.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "PATCH",
          url: `${BASE}/${metricId}`,
          payload: { name: "OG" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /metrics/:metricId", () => {
    it("deletes the metric and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${metricId}` });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobbyMetricDefinition.delete).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when metric not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyMetricDefinition.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "DELETE", url: `${BASE}/${metricId}` });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /metrics/:metricId/readings", () => {
    it("returns paginated readings", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({ method: "GET", url: `${BASE}/${metricId}/readings` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0].id).toBe(readingId);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /metrics/:metricId/readings", () => {
    it("creates a reading and returns 201", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/${metricId}/readings`,
          payload: { value: 5.2, readingDate: "2026-03-17T00:00:00.000Z" },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json().id).toBe(readingId);
        expect(prisma.hobbyMetricReading.create).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when metric definition not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyMetricDefinition.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/${metricId}/readings`,
          payload: { value: 5.2, readingDate: "2026-03-17T00:00:00.000Z" },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("returns 400 when sessionId does not belong to this hobby", async () => {
      const prisma = basePrisma();
      prisma.hobbySession.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "POST",
          url: `${BASE}/${metricId}/readings`,
          payload: {
            value: 5.2,
            readingDate: "2026-03-17T00:00:00.000Z",
            sessionId: "clkeepersession0000000999",
          },
        });
        expect(res.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  describe("DELETE /metrics/:metricId/readings/:readingId", () => {
    it("deletes reading and returns 204", async () => {
      const prisma = basePrisma();
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "DELETE",
          url: `${BASE}/${metricId}/readings/${readingId}`,
        });
        expect(res.statusCode).toBe(204);
        expect(prisma.hobbyMetricReading.delete).toHaveBeenCalledTimes(1);
      } finally {
        await app.close();
      }
    });

    it("returns 404 when reading not found", async () => {
      const prisma = basePrisma();
      prisma.hobbyMetricReading.findFirst = vi.fn(async () => null);
      const app = await createApp(prisma);
      try {
        const res = await app.inject({
          method: "DELETE",
          url: `${BASE}/${metricId}/readings/${readingId}`,
        });
        expect(res.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
