import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
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

test("public share returns a serialized asset report and increments views", async (t) => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const { app, updatedViews } = await createPublicShareApp();
  t.after(async () => {
    await app.close();
    await resetRateLimitState();
  });

  const response = await app.inject({
    method: "GET",
    url: `/v1/public/share/${shareLinkRecord.token}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(updatedViews.length, 1);
  assert.deepEqual(response.json(), {
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
  assert.ok(typeof response.json().generatedAt === "string");
});

test("public share enforces the route rate limit", async (t) => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const { app } = await createPublicShareApp();
  t.after(async () => {
    await app.close();
    await resetRateLimitState();
  });

  for (let index = 0; index < 30; index += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/share/${shareLinkRecord.token}`
    });

    assert.equal(response.statusCode, 200);
  }

  const limitedResponse = await app.inject({
    method: "GET",
    url: `/v1/public/share/${shareLinkRecord.token}`
  });

  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.json().message, "Share link rate limit exceeded. Try again shortly.");
});
