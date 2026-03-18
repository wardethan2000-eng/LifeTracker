import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { exportRoutes } from "../src/routes/exports/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";

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
};

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) => (where.id === assetId ? assetRecord : null)
    },
    maintenanceSchedule: {
      findMany: async () => [
        {
          id: "clkeeperschedule000000000001",
          assetId,
          name: "Quarterly inspection",
          description: "Inspect belts and fluids",
          triggerType: "interval",
          isActive: true,
          estimatedCost: 80,
          lastCompletedAt: new Date("2026-03-01T00:00:00.000Z"),
          nextDueAt: new Date("2026-06-01T00:00:00.000Z"),
          nextDueMetricValue: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z")
        }
      ]
    },
    activityLog: {
      findMany: async () => [
        {
          id: "clkeeperactivity000000001",
          householdId,
          userId,
          action: "schedule.created",
          entityType: "schedule",
          entityId: "clkeeperschedule000000000001",
          metadata: { name: "Quarterly inspection", assetId, details: "Initial setup" },
          createdAt: new Date("2026-03-18T00:00:00.000Z"),
          user: {
            displayName: "Dev User"
          }
        }
      ]
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

  await app.register(exportRoutes);

  return app;
};

describe("export routes", () => {
  it("exports schedule CSV rows for an accessible asset", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/export/csv?dataset=schedules`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.headers["content-disposition"]).toContain("schedules-lk-assettest01.csv");
      expect(response.body).toContain("Name,Description,Trigger Type,Is Active,Estimated Cost,Last Completed,Next Due Date,Next Due Metric Value");
      expect(response.body).toContain("Quarterly inspection");
      expect(response.body).toContain("Inspect belts and fluids");
    } finally {
      await app.close();
    }
  });

  it("exports household activity log CSV rows", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/export/csv?dataset=activity-log`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain(`activity-log-${householdId}.csv`);
      expect(response.body).toContain("schedule.created");
      expect(response.body).toContain("Quarterly inspection");
      expect(response.body).toContain("Dev User");
    } finally {
      await app.close();
    }
  });
});