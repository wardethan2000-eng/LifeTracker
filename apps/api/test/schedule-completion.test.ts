import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const maintenanceLogMocks = vi.hoisted(() => ({
  syncScheduleCompletionFromLogs: vi.fn(),
  toMaintenanceLogResponse: vi.fn((log: { id: string; title: string }) => ({
    id: log.id,
    title: log.title
  }))
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncLogToSearchIndex: vi.fn(async () => undefined),
  syncScheduleToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/maintenance-logs.js", () => ({
  syncScheduleCompletionFromLogs: maintenanceLogMocks.syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse: maintenanceLogMocks.toMaintenanceLogResponse
}));

import { scheduleRoutes } from "../src/routes/schedules/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";
const metricId = "clkeepermetric0000000000001";
const scheduleId = "clkeeperschedule000000000001";

const scheduleRecord = {
  id: scheduleId,
  assetId,
  metricId,
  name: "Oil change",
  description: "Replace oil and filter",
  triggerType: "usage",
  triggerConfig: {
    type: "usage",
    metricId,
    intervalValue: 5000,
    leadTimeValue: 250
  },
  notificationConfig: {
    channels: ["push"],
    sendAtDue: true,
    digest: false
  },
  presetKey: null,
  estimatedCost: 89,
  estimatedMinutes: 45,
  isActive: true,
  isRegulatory: false,
  lastCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  nextDueAt: null,
  nextDueMetricValue: 10000,
  assignedToId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  metric: {
    id: metricId,
    currentValue: 9500
  },
  assignedTo: null
};

const completedSchedule = {
  ...scheduleRecord,
  lastCompletedAt: new Date("2026-03-17T10:00:00.000Z"),
  nextDueMetricValue: 14500,
  updatedAt: new Date("2026-03-17T10:00:00.000Z")
};

const createApp = async () => {
  const app = Fastify();
  const logCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "clkeeperlog00000000000001",
    assetId,
    scheduleId,
    completedById: userId,
    serviceProviderId: null,
    title: data.title as string,
    notes: (data.notes as string | undefined) ?? null,
    completedAt: data.completedAt as Date,
    usageValue: (data.usageValue as number | undefined) ?? null,
    cost: (data.cost as number | undefined) ?? null,
    laborHours: null,
    laborRate: null,
    difficultyRating: null,
    performedBy: null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    deletedAt: null,
    createdAt: new Date("2026-03-17T10:00:00.000Z"),
    updatedAt: new Date("2026-03-17T10:00:00.000Z")
  }));

  const usageMetricUpdate = vi.fn(async () => undefined);

  const tx = {
    usageMetric: {
      update: usageMetricUpdate
    },
    maintenanceLog: {
      create: logCreate,
      findUniqueOrThrow: async () => ({
        id: "clkeeperlog00000000000001",
        title: "Oil change completed",
        parts: []
      })
    }
  };

  maintenanceLogMocks.syncScheduleCompletionFromLogs.mockResolvedValue(completedSchedule);

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) => (
        where.id === assetId
          ? {
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
              manufacturer: "Ford",
              model: "F-150",
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
            }
          : null
      )
    },
    maintenanceSchedule: {
      findFirst: async ({ where }: { where: { id: string; assetId: string } }) => (
        where.id === scheduleId && where.assetId === assetId
          ? {
              ...scheduleRecord,
              inventoryItems: []
            }
          : null
      )
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)
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

  return { app, logCreate, usageMetricUpdate };
};

describe("schedule completion integration", () => {
  it("creates a maintenance log, updates the metric, and returns refreshed schedule state", async () => {
    const { app, logCreate, usageMetricUpdate } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/schedules/${scheduleId}/complete`,
        payload: {
          title: "Oil change completed",
          completedAt: "2026-03-17T10:00:00.000Z",
          usageValue: 9500,
          cost: 99.99,
          applyLinkedParts: false,
          metadata: {
            source: "test"
          }
        }
      });

      expect(response.statusCode).toBe(201);
      expect(usageMetricUpdate).toHaveBeenCalledWith({
        where: { id: metricId },
        data: {
          currentValue: 9500,
          lastRecordedAt: new Date("2026-03-17T10:00:00.000Z")
        }
      });
      expect(logCreate).toHaveBeenCalled();
      expect(maintenanceLogMocks.syncScheduleCompletionFromLogs).toHaveBeenCalledWith(expect.anything(), scheduleId);
      expect(response.json()).toMatchObject({
        log: {
          id: "clkeeperlog00000000000001",
          title: "Oil change completed"
        },
        schedule: {
          id: scheduleId,
          nextDueMetricValue: 14500,
          status: "upcoming"
        },
        inventoryWarnings: []
      });
    } finally {
      await app.close();
    }
  });
});