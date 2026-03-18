import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

const searchMocks = vi.hoisted(() => ({
  removeSearchIndexEntry: vi.fn(async () => undefined),
  syncScheduleToSearchIndex: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: queueMocks.enqueueNotificationScan
}));

vi.mock("../src/lib/search-index.js", () => ({
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry,
  syncScheduleToSearchIndex: searchMocks.syncScheduleToSearchIndex,
  syncLogToSearchIndex: vi.fn(async () => undefined)
}));

import { scheduleRoutes } from "../src/routes/schedules/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";
const scheduleId = "clkeeperschedule000000000001";
const metricId = "clkeepermetric0000000000001";

const assetRecord = {
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

const createApp = async () => {
  let scheduleRecord = buildScheduleRecord();
  const updateScheduleMock = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    if (where.id === scheduleId) {
      scheduleRecord = buildScheduleRecord({
        ...scheduleRecord,
        ...data,
        updatedAt: new Date("2026-03-18T00:00:00.000Z")
      });
    }

    return scheduleRecord;
  });

  const app = Fastify();

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) => (where.id === assetId ? assetRecord : null)
    },
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    usageMetric: {
      findFirst: async ({ where }: { where: { id: string; assetId: string } }) => (
        where.id === metricId && where.assetId === assetId
          ? { id: metricId, currentValue: 9800 }
          : null
      )
    },
    maintenanceSchedule: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        scheduleRecord = buildScheduleRecord({
          id: "clkeeperschedule000000000002",
          name: data.name,
          description: data.description ?? null,
          triggerType: data.triggerType,
          triggerConfig: data.triggerConfig,
          notificationConfig: data.notificationConfig,
          metricId: data.metricId ?? null,
          nextDueAt: data.nextDueAt ?? null,
          nextDueMetricValue: data.nextDueMetricValue ?? null,
          estimatedCost: data.estimatedCost ?? null,
          estimatedMinutes: data.estimatedMinutes ?? null,
          assignedToId: data.assignedToId ?? null,
          createdAt: new Date("2026-03-18T00:00:00.000Z"),
          updatedAt: new Date("2026-03-18T00:00:00.000Z")
        });

        return scheduleRecord;
      },
      findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
        if (where.id === scheduleId && where.assetId === assetId) {
          if (where.deletedAt === null && scheduleRecord.deletedAt) {
            return null;
          }

          return include
            ? { ...scheduleRecord, inventoryItems: [], metric: scheduleRecord.metric, assignedTo: scheduleRecord.assignedTo }
            : scheduleRecord;
        }

        return null;
      },
      update: updateScheduleMock
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(scheduleRoutes);

  return { app, updateScheduleMock };
};

describe("schedule route integration", () => {
  it("creates an interval schedule and returns the serialized due state", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/schedules`,
        payload: {
          name: "Quarterly inspection",
          triggerConfig: {
            type: "interval",
            intervalDays: 90,
            leadTimeDays: 7
          },
          notificationConfig: {
            channels: ["push"],
            sendAtDue: true,
            digest: false
          }
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        name: "Quarterly inspection",
        triggerType: "interval",
        status: "upcoming"
      });
      expect(response.json().nextDueAt).toBeTruthy();
      expect(queueMocks.enqueueNotificationScan).toHaveBeenCalledWith({ householdId });
    } finally {
      await app.close();
    }
  });

  it("rejects schedule creation when the referenced usage metric does not belong to the asset", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/schedules`,
        payload: {
          name: "Odometer service",
          triggerConfig: {
            type: "usage",
            metricId: "clkeepermetricmissing000001",
            intervalValue: 5000,
            leadTimeValue: 250
          },
          notificationConfig: {
            channels: ["push"],
            sendAtDue: true,
            digest: false
          }
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe("Referenced metric does not belong to this asset.");
    } finally {
      await app.close();
    }
  });

  it("soft-deletes a schedule and removes it from the search index", async () => {
    const { app, updateScheduleMock } = await createApp();

    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}`
      });

      expect(response.statusCode).toBe(204);
      expect(updateScheduleMock).toHaveBeenCalledWith({
        where: { id: scheduleId },
        data: {
          deletedAt: expect.any(Date),
          isActive: false
        }
      });
      expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledWith(expect.anything(), "schedule", scheduleId);
    } finally {
      await app.close();
    }
  });
});