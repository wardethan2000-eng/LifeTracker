import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { expect, test } from "vitest";
import { publicShareRoutes } from "../src/routes/share-links/public.js";
import { resetRateLimitState } from "../src/lib/rate-limit.js";

const shareLinkRecord = {
  id: "share-1",
  token: "token-123",
  assetId: "asset-1",
  householdId: "clkeeperhouse000000000001",
  createdById: "clkeeperuser0000000000001",
  label: "Public report",
  expiresAt: null,
  isRevoked: false,
  viewCount: 0,
  lastViewedAt: null,
  dateRangeStart: null,
  dateRangeEnd: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const createPublicShareApp = async () => {
  const updatedViews: unknown[] = [];
  const app = Fastify();

  app.decorate("prisma", {
    shareLink: {
      findUnique: async ({ where }: { where: { token: string } }) => (
        where.token === shareLinkRecord.token ? shareLinkRecord : null
      ),
      update: async (args: unknown) => {
        updatedViews.push(args);
        return shareLinkRecord;
      }
    },
    asset: {
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === shareLinkRecord.assetId
          ? {
              id: shareLinkRecord.assetId,
              householdId: shareLinkRecord.householdId,
              conditionHistory: [],
              name: "Primary Vehicle",
              category: "vehicle",
              manufacturer: "Ford",
              model: "F-150"
            }
          : null
      )
    },
    assetTimelineEntry: { findMany: async () => [] },
    entry: { findMany: async () => [] },
    projectTask: { findMany: async () => [] },
    projectPhase: { findMany: async () => [] },
    maintenanceLog: { findMany: async () => [] },
    activityLog: { findMany: async () => [] },
    comment: { findMany: async () => [] },
    usageMetricEntry: { findMany: async () => [] },
    inventoryTransaction: { findMany: async () => [] }
  } as never);

  await app.register(publicShareRoutes);
  return { app, updatedViews };
};

test("public share returns a serialized asset report and increments views", async () => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const { app, updatedViews } = await createPublicShareApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/share/${shareLinkRecord.token}`
    });

    expect(response.statusCode).toBe(200);
    expect(updatedViews).toHaveLength(1);
    expect(response.json()).toEqual({
      assetName: "Primary Vehicle",
      assetCategory: "vehicle",
      assetMake: "Ford",
      assetModel: "F-150",
      assetYear: null,
      timelineItems: [],
      costSummary: {
        lifetimeCost: 0,
        logCount: 0
      },
      generatedAt: response.json().generatedAt,
      dateRangeStart: null,
      dateRangeEnd: null
    });
    expect(typeof response.json().generatedAt).toBe("string");
  } finally {
    await app.close();
    await resetRateLimitState();
  }
});

test("public share enforces the route rate limit", async () => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const { app } = await createPublicShareApp();
  try {
    for (let index = 0; index < 30; index += 1) {
      const response = await app.inject({
        method: "GET",
        url: `/v1/public/share/${shareLinkRecord.token}`
      });

      expect(response.statusCode).toBe(200);
    }

    const limitedResponse = await app.inject({
      method: "GET",
      url: `/v1/public/share/${shareLinkRecord.token}`
    });

    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json().message).toBe("Share link rate limit exceeded. Try again shortly.");
  } finally {
    await app.close();
    await resetRateLimitState();
  }
});
