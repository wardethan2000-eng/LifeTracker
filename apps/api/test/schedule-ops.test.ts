/**
 * Extended schedule route tests covering:
 *   GET  /v1/assets/:assetId/schedules
 *   GET  /v1/assets/:assetId/schedules/:scheduleId
 *   PATCH /v1/assets/:assetId/schedules/:scheduleId
 *
 * Completion and deletion are covered in schedule-completion.test.ts and
 * schedules.test.ts respectively.
 */
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/search-index.js", () => ({
  removeSearchIndexEntry: vi.fn(async () => undefined),
  syncScheduleToSearchIndex: vi.fn(async () => undefined),
  syncLogToSearchIndex: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/maintenance-logs.js", () => ({
  syncScheduleCompletionFromLogs: vi.fn(async () => undefined),
  toMaintenanceLogResponse: vi.fn((log: { id: string; title: string }) => ({
    id: log.id,
    title: log.title
  }))
}));

import { scheduleRoutes } from "../src/routes/schedules/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";
const scheduleId = "clkeeperschedule000000000001";

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
  manufacturer: null,
  model: null,
  serialNumber: null,
  purchaseDate: null,
  purchaseDetails: null,
  warrantyDetails: null,
  locationDetails: null,
  insuranceDetails: null,
  dispositionDetails: null,
  conditionScore: null,
  conditionHistory: [],
  assetTypeKey: null,
  assetTypeLabel: null,
  assetTypeDescription: null,
  assetTypeSource: "manual",
  assetTypeVersion: 1,
  fieldDefinitions: [],
  customFields: {},
  isArchived: false,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const buildScheduleRecord = (overrides: Record<string, unknown> = {}) => ({
  id: scheduleId,
  assetId,
  metricId: null,
  name: "Quarterly inspection",
  description: null,
  triggerType: "interval",
  triggerConfig: {
    type: "interval",
    intervalDays: 90,
    leadTimeDays: 7
  },
  notificationConfig: {
    channels: ["push"],
    sendAtDue: true,
    digest: false
  },
  presetKey: null,
  estimatedCost: null,
  estimatedMinutes: null,
  isActive: true,
  isRegulatory: false,
  deletedAt: null,
  lastCompletedAt: null,
  nextDueAt: new Date("2026-06-15T00:00:00.000Z"),
  nextDueMetricValue: null,
  assignedToId: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
  metric: null,
  assignedTo: null,
  ...overrides
});

const createApp = async (options: { scheduleMissing?: boolean } = {}) => {
  let scheduleRecord = buildScheduleRecord();
  const { scheduleMissing = false } = options;

  const scheduleUpdate = vi.fn(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      if (where.id === scheduleId) {
        scheduleRecord = buildScheduleRecord({ ...scheduleRecord, ...data });
      }
      return { ...scheduleRecord, metric: null, assignedTo: null };
    }
  );

  const app = Fastify();

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === assetId ? baseAsset : null
    },
    householdMember: {
      findUnique: async ({ where }: { where: { householdId_userId: { householdId: string; userId: string } } }) => {
        const targetUserId = where.householdId_userId?.userId;
        if (targetUserId === userId) {
          return { householdId, userId, role: "owner" };
        }
        return null;
      }
    },
    usageMetric: {
      findFirst: async () => null
    },
    maintenanceSchedule: {
      create: async ({ data, include }: { data: Record<string, unknown>; include?: unknown }) => {
        scheduleRecord = buildScheduleRecord({
          id: "clkeeperschedule000000000002",
          name: data.name,
          triggerType: data.triggerType,
          triggerConfig: data.triggerConfig,
          notificationConfig: data.notificationConfig,
          metricId: data.metricId ?? null,
          nextDueAt: data.nextDueAt ?? null,
          nextDueMetricValue: data.nextDueMetricValue ?? null
        });
        if (include) {
          return { ...scheduleRecord, metric: null, assignedTo: null };
        }
        return scheduleRecord;
      },
      findFirst: async ({
        where,
        include
      }: {
        where: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) => {
        if (scheduleMissing) return null;
        if (where.assetId !== assetId) return null;
        if (typeof where.id === "string" && where.id !== scheduleId) return null;
        if (where.deletedAt === null && scheduleRecord.deletedAt) return null;
        if (include) {
          return { ...scheduleRecord, inventoryItems: [], metric: null, assignedTo: null };
        }
        return scheduleRecord;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (scheduleMissing || where.id !== scheduleId) return null;
        return {
          ...scheduleRecord,
          metric: null,
          asset: { household: { timezone: "UTC" } }
        };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.assetId !== assetId) return [];
        return [scheduleRecord];
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.assetId !== assetId) return 0;
        return scheduleMissing ? 0 : 1;
      },
      update: scheduleUpdate
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(scheduleRoutes);

  return { app, scheduleUpdate };
};

// ── GET /v1/assets/:assetId/schedules ────────────────────────────────────────

describe("GET /v1/assets/:assetId/schedules", () => {
  it("returns all schedules for the asset", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/schedules`
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ name: "Quarterly inspection", triggerType: "interval" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the asset does not exist", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/assets/clkeeperassetmissing0000001/schedules"
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/schedules/:scheduleId ────────────────────────────

describe("GET /v1/assets/:assetId/schedules/:scheduleId", () => {
  it("returns the schedule by ID", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id: scheduleId,
        name: "Quarterly inspection",
        triggerType: "interval"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the schedule does not exist", async () => {
    const { app } = await createApp({ scheduleMissing: true });
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── PATCH /v1/assets/:assetId/schedules/:scheduleId ──────────────────────────

describe("PATCH /v1/assets/:assetId/schedules/:scheduleId", () => {
  it("updates the schedule name", async () => {
    const { app, scheduleUpdate } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`,
        payload: { name: "Annual service" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: scheduleId });
      expect(scheduleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: scheduleId },
          data: expect.objectContaining({ name: "Annual service" })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("deactivates a schedule when isActive is set to false", async () => {
    const { app, scheduleUpdate } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`,
        payload: { isActive: false }
      });
      expect(res.statusCode).toBe(200);
      expect(scheduleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the schedule does not exist", async () => {
    const { app } = await createApp({ scheduleMissing: true });
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`,
        payload: { name: "Updated name" }
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("returns 400 when the assigned user is not a household member", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`,
        payload: { assignedToId: "clkeeperuseroutsider000001" }
      });
      // householdMember.findUnique returns the test user but not the outsider
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/not a member/i);
    } finally {
      await app.close();
    }
  });
});
