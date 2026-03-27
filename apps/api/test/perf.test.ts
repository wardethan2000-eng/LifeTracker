/**
 * Route handler latency tests.
 *
 * These tests verify that key Fastify route handlers respond within acceptable
 * time bounds when database operations are mocked (instant). They catch
 * regressions in input validation, serialization, or computational overhead
 * inside the handler layer — NOT real database performance.
 *
 * Thresholds are generous to remain stable across different CI environments
 * (slow VMs, shared runners, etc.):
 *
 *   GET list handlers: p95 < 50 ms (with instant mocked DB, should normally be < 5 ms)
 *
 * If a test fails here, something inside the handler is doing heavy synchronous
 * work — e.g. expensive Zod transforms, unnecessary iteration, or accidental
 * blocking calls. Fix the handler, not the threshold.
 */

import { describe, it, expect, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp, householdId, householdMemberMock } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
// These are required so the route plugins can be imported without side-effects.
// They are not called during GET requests but must exist to satisfy the module graph.
vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
  logAndEmit: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncAssetFamilyToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
  syncToSearchIndex: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/asset-tags.js", () => ({
  buildAssetScanUrl: vi.fn(() => "https://example.test/scan/LK-PERF"),
  ensureAssetTag: vi.fn(async () => "LK-PERF"),
}));

import { assetRoutes } from "../src/routes/assets/index.js";

// ─── Benchmark config ─────────────────────────────────────────────────────────
const WARMUP_RUNS = 20;
const SAMPLE_RUNS = 100;
// Generous ceiling: production-calibrated handlers should be orders of magnitude
// faster than this with instant DB mocks. Raise only if CI hardware is consistently
// this slow AND no real regression is present.
const P95_THRESHOLD_MS = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const p95 = (samples: number[]): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const warmAndMeasure = async (app: FastifyInstance, method: "GET" | "POST", url: string): Promise<number[]> => {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await app.inject({ method, url });
  }

  const samples: number[] = [];

  for (let i = 0; i < SAMPLE_RUNS; i++) {
    const start = performance.now();
    await app.inject({ method, url });
    samples.push(performance.now() - start);
  }

  return samples;
};

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Route handler latency — mocked DB", () => {
  describe("GET /v1/assets (paginated list)", () => {
    it(`p95 < ${P95_THRESHOLD_MS}ms`, async () => {
      const app = await buildApp(assetRoutes, {
        householdMember: householdMemberMock,
        asset: {
          findMany: async () => [],
          count: async () => 0,
        },
      });

      const samples = await warmAndMeasure(app, "GET", `/v1/assets?householdId=${householdId}&paginated=true`);
      const latencyP95 = p95(samples);

      expect(
        latencyP95,
        `p95 latency (${latencyP95.toFixed(2)}ms) exceeded the ${P95_THRESHOLD_MS}ms threshold. ` +
        `Check for expensive validation, serialization, or synchronous computation in the asset list handler.`
      ).toBeLessThan(P95_THRESHOLD_MS);
    }, 15_000);
  });

  describe("GET /v1/assets (unpaginated list)", () => {
    it(`p95 < ${P95_THRESHOLD_MS}ms`, async () => {
      const app = await buildApp(assetRoutes, {
        householdMember: householdMemberMock,
        asset: {
          findMany: async () => [],
          count: async () => 0,
        },
      });

      const samples = await warmAndMeasure(app, "GET", `/v1/assets?householdId=${householdId}`);
      const latencyP95 = p95(samples);

      expect(
        latencyP95,
        `p95 latency (${latencyP95.toFixed(2)}ms) exceeded the ${P95_THRESHOLD_MS}ms threshold. ` +
        `Check for expensive validation, serialization, or synchronous computation in the asset list handler.`
      ).toBeLessThan(P95_THRESHOLD_MS);
    }, 15_000);
  });
});
