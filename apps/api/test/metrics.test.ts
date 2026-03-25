import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

import { usageMetricRoutes } from "../src/routes/usage-metrics/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";
const metricId = "clkeepermetric0000000000001";
const entryId = "clkeeperentry0000000000001";

const baseAsset = {
  id: assetId,
  householdId,
  createdById: userId,
  ownerId: userId,
  parentAssetId: null,
  assetTag: "LK-ASSETTEST01",
  name: "Primary Vehicle",
  category: "vehicle",
  visibility: "shared",
  description: null,
  isArchived: false,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const buildMetricRecord = (overrides: Record<string, unknown> = {}) => ({
  id: metricId,
  assetId,
  name: "Odometer",
  unit: "miles",
  currentValue: 45000,
  lastRecordedAt: new Date("2026-03-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const buildEntryRecord = (overrides: Record<string, unknown> = {}) => ({
  id: entryId,
  metricId,
  value: 48000,
  recordedAt: new Date("2026-04-01T00:00:00.000Z"),
  source: "manual",
  notes: null,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-01T00:00:00.000Z"),
  ...overrides
});

type PrismaWhere = Record<string, unknown>;

const createApp = async (options: { metricMissing?: boolean; linkedSchedules?: number } = {}) => {
  const { metricMissing = false, linkedSchedules = 0 } = options;
  let metricRecord = buildMetricRecord();

  const metricCreate = vi.fn(async ({ data }: { data: PrismaWhere }) => {
    metricRecord = buildMetricRecord({
      id: "clkeepermetric0000000000002",
      name: data.name,
      unit: data.unit,
      currentValue: data.currentValue ?? 0,
      lastRecordedAt: data.lastRecordedAt ?? null
    });
    return metricRecord;
  });

  const metricUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: PrismaWhere }) => {
    if (where.id === metricRecord.id) {
      metricRecord = { ...metricRecord, ...data } as typeof metricRecord;
    }
    return metricRecord;
  });

  const metricDelete = vi.fn(async () => metricRecord);

  const entryCreate = vi.fn(async ({ data }: { data: PrismaWhere }) =>
    buildEntryRecord({ value: data.value, source: data.source ?? "manual", notes: data.notes ?? null })
  );

  const app = Fastify();

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === assetId ? baseAsset : null
    },
    usageMetric: {
      findFirst: async ({ where }: { where: PrismaWhere }) => {
        if (metricMissing) return null;
        if (typeof where.id === "string" && where.id !== metricRecord.id) return null;
        if (typeof where.assetId === "string" && where.assetId !== assetId) return null;
        return metricRecord;
      },
      findMany: async ({ where }: { where: PrismaWhere }) => {
        if (metricMissing) return [];
        if (typeof where.assetId === "string" && where.assetId !== assetId) return [];
        return [metricRecord];
      },
      create: metricCreate,
      update: metricUpdate,
      delete: metricDelete
    },
    usageMetricEntry: {
      create: entryCreate,
      findFirst: async () =>
        buildEntryRecord({
          value: 48000,
          recordedAt: new Date("2026-04-01T00:00:00.000Z")
        }),
      findMany: async () => [buildEntryRecord()]
    },
    maintenanceSchedule: {
      findMany: async () => [],
      count: async () => linkedSchedules
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(usageMetricRoutes);

  return { app, mocks: { metricCreate, metricUpdate, metricDelete, entryCreate } };
};

// ── POST /v1/assets/:assetId/metrics ─────────────────────────────────────────

describe("POST /v1/assets/:assetId/metrics", () => {
  it("creates a usage metric and returns 201", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/metrics`,
        payload: {
          name: "Odometer",
          unit: "miles",
          currentValue: 45000
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ name: "Odometer", unit: "miles", currentValue: 45000 });
      expect(mocks.metricCreate).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the asset does not exist", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/clkeeperassetmissing0000001/metrics",
        payload: { name: "Odometer", unit: "miles", currentValue: 0 }
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/metrics ──────────────────────────────────────────

describe("GET /v1/assets/:assetId/metrics", () => {
  it("returns all metrics for the asset", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics`
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toMatchObject({ id: metricId, name: "Odometer" });
    } finally {
      await app.close();
    }
  });

  it("returns an empty array when no metrics exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics`
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/metrics/:metricId ────────────────────────────────

describe("GET /v1/assets/:assetId/metrics/:metricId", () => {
  it("returns the metric by ID", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics/${metricId}`
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: metricId, name: "Odometer" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the metric does not exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics/${metricId}`
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── PATCH /v1/assets/:assetId/metrics/:metricId ──────────────────────────────

describe("PATCH /v1/assets/:assetId/metrics/:metricId", () => {
  it("updates the metric current value", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/metrics/${metricId}`,
        payload: { currentValue: 50000 }
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.metricUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: metricId },
          data: expect.objectContaining({ currentValue: 50000 })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the metric does not exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/metrics/${metricId}`,
        payload: { currentValue: 50000 }
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── DELETE /v1/assets/:assetId/metrics/:metricId ─────────────────────────────

describe("DELETE /v1/assets/:assetId/metrics/:metricId", () => {
  it("deletes the metric and returns 204", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/metrics/${metricId}`
      });
      expect(res.statusCode).toBe(204);
      expect(mocks.metricDelete).toHaveBeenCalledWith({ where: { id: metricId } });
    } finally {
      await app.close();
    }
  });

  it("returns 409 when the metric is still referenced by maintenance schedules", async () => {
    const { app } = await createApp({ linkedSchedules: 1 });
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/metrics/${metricId}`
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().message).toMatch(/schedules/i);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the metric does not exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/metrics/${metricId}`
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/:assetId/metrics/:metricId/entries ───────────────────────

describe("POST /v1/assets/:assetId/metrics/:metricId/entries", () => {
  it("creates a reading entry and returns 201", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/metrics/${metricId}/entries`,
        payload: { value: 48000 }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ value: 48000 });
      expect(mocks.entryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ value: 48000, metricId })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("accepts a notes field on the entry", async () => {
    const { app, mocks } = await createApp();
    try {
      await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/metrics/${metricId}/entries`,
        payload: { value: 49000, notes: "Post road trip" }
      });
      expect(mocks.entryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: "Post road trip" })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the metric does not exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/metrics/${metricId}/entries`,
        payload: { value: 48000 }
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/metrics/:metricId/entries ────────────────────────

describe("GET /v1/assets/:assetId/metrics/:metricId/entries", () => {
  it("returns entries for the metric in descending order", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics/${metricId}/entries`
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toMatchObject({ value: 48000 });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the metric does not exist", async () => {
    const { app } = await createApp({ metricMissing: true });
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/metrics/${metricId}/entries`
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
