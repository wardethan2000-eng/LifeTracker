import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, test } from "vitest";
import { enforceRateLimit, resetRateLimitState } from "../src/lib/rate-limit.js";
import { applyTier, type RateLimitTier } from "../src/lib/rate-limit-tiers.js";
import type { AuthContext } from "../src/plugins/auth.js";

process.env.RATE_LIMIT_STORE = "memory";

const mockAuth = (userId: string): AuthContext => ({
  userId,
  clerkUserId: null,
  source: "dev-bypass"
});

// ---------------------------------------------------------------------------
// Test app factories
// ---------------------------------------------------------------------------

const createPerUserApp = async (
  userId: string,
  maxRequests: number
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  app.decorateRequest("auth", undefined as unknown as AuthContext);
  app.addHook("preHandler", async (request) => {
    request.auth = mockAuth(userId);
  });
  app.addHook("preHandler", async (request, reply) => {
    await enforceRateLimit(request, reply, {
      scope: "user",
      key: `user:${request.auth.userId}`,
      max: maxRequests,
      windowMs: 60_000,
      message: "Per-user rate limit exceeded."
    });
  });
  app.get("/test", async () => ({ ok: true }));
  return app;
};

const createTierApp = async (
  userId: string,
  tier: RateLimitTier
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  app.decorateRequest("auth", undefined as unknown as AuthContext);
  app.addHook("preHandler", async (request) => {
    request.auth = mockAuth(userId);
  });
  app.get("/test", async (request, reply) => {
    if (await applyTier(request, reply, tier)) return reply;
    return { ok: true };
  });
  return app;
};

// App with two routes: one tier-limited, one unrestricted. Used for independence tests.
const createMultiRouteApp = async (
  userId: string
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  app.decorateRequest("auth", undefined as unknown as AuthContext);
  app.addHook("preHandler", async (request) => {
    request.auth = mockAuth(userId);
  });
  app.get("/analytics", async (request, reply) => {
    if (await applyTier(request, reply, "heavy-analytics")) return reply;
    return { ok: true };
  });
  app.get("/normal", async () => ({ ok: true }));
  return app;
};

// App with two different user IDs on different routes to test isolation.
const createTwoUserApp = async (
  userA: string,
  userB: string,
  maxRequests: number
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  app.decorateRequest("auth", undefined as unknown as AuthContext);
  // Route A: sets auth to userA
  app.get("/a", async (request, reply) => {
    request.auth = mockAuth(userA);
    await enforceRateLimit(request, reply, {
      scope: "user",
      key: `user:${userA}`,
      max: maxRequests,
      windowMs: 60_000,
      message: "Per-user rate limit exceeded."
    });
    if (reply.sent) return reply;
    return { ok: true };
  });
  // Route B: sets auth to userB
  app.get("/b", async (request, reply) => {
    request.auth = mockAuth(userB);
    await enforceRateLimit(request, reply, {
      scope: "user",
      key: `user:${userB}`,
      max: maxRequests,
      windowMs: 60_000,
      message: "Per-user rate limit exceeded."
    });
    if (reply.sent) return reply;
    return { ok: true };
  });
  return app;
};

beforeEach(async () => {
  await resetRateLimitState();
});

// ---------------------------------------------------------------------------
// Per-user rate limit
// ---------------------------------------------------------------------------

describe("per-user rate limit", () => {
  test("allows requests up to the user limit", async () => {
    const app = await createPerUserApp("user-a", 3);
    for (let i = 0; i < 3; i++) {
      const response = await app.inject({ method: "GET", url: "/test" });
      expect(response.statusCode).toBe(200);
    }
  });

  test("blocks the request that exceeds the user limit", async () => {
    const app = await createPerUserApp("user-a", 3);
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: "GET", url: "/test" });
    }
    const response = await app.inject({ method: "GET", url: "/test" });
    expect(response.statusCode).toBe(429);
  });

  test("includes structured 429 body with retryAfter, scope, limit, windowSeconds", async () => {
    const app = await createPerUserApp("user-a", 2);
    await app.inject({ method: "GET", url: "/test" });
    await app.inject({ method: "GET", url: "/test" });
    const response = await app.inject({ method: "GET", url: "/test" });
    expect(response.statusCode).toBe(429);
    const body = response.json();
    expect(body.message).toBeDefined();
    expect(typeof body.retryAfter).toBe("number");
    expect(body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(body.scope).toBe("user");
    expect(body.limit).toBe(2);
    expect(body.windowSeconds).toBe(60);
  });

  test("throttling one user does not affect a different user", async () => {
    const app = await createTwoUserApp("user-a", "user-b", 2);
    // Exhaust user-a
    await app.inject({ method: "GET", url: "/a" });
    await app.inject({ method: "GET", url: "/a" });
    const blockedA = await app.inject({ method: "GET", url: "/a" });
    expect(blockedA.statusCode).toBe(429);
    // user-b is unaffected
    const okB = await app.inject({ method: "GET", url: "/b" });
    expect(okB.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Rate limit headers
// ---------------------------------------------------------------------------

describe("rate limit headers", () => {
  test("success response includes x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset", async () => {
    const app = await createPerUserApp("user-header", 5);
    const response = await app.inject({ method: "GET", url: "/test" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("5");
    expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(Number(response.headers["x-ratelimit-remaining"])).toBeGreaterThanOrEqual(0);
    expect(response.headers["x-ratelimit-reset"]).toBeDefined();
    expect(Number(response.headers["x-ratelimit-reset"])).toBeGreaterThan(0);
  });

  test("429 response includes retry-after header", async () => {
    const app = await createPerUserApp("user-header2", 1);
    await app.inject({ method: "GET", url: "/test" });
    const response = await app.inject({ method: "GET", url: "/test" });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
    expect(Number(response.headers["retry-after"])).toBeGreaterThanOrEqual(1);
  });

  test("x-ratelimit-remaining decrements with each request", async () => {
    const app = await createPerUserApp("user-decrement", 5);
    const first = await app.inject({ method: "GET", url: "/test" });
    const second = await app.inject({ method: "GET", url: "/test" });
    const remainingAfterFirst = Number(first.headers["x-ratelimit-remaining"]);
    const remainingAfterSecond = Number(second.headers["x-ratelimit-remaining"]);
    expect(remainingAfterSecond).toBe(remainingAfterFirst - 1);
  });
});

// ---------------------------------------------------------------------------
// Per-endpoint tier limits
// ---------------------------------------------------------------------------

describe("heavy-analytics tier (10 req/min)", () => {
  test("allows 10 analytics requests and blocks the 11th", async () => {
    const app = await createTierApp("user-analytics", "heavy-analytics");
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: "GET", url: "/test" });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.scope).toBe("heavy-analytics");
    expect(body.limit).toBe(10);
  });
});

describe("pdf-export tier (3 req/min)", () => {
  test("allows 3 PDF export requests and blocks the 4th", async () => {
    const app = await createTierApp("user-pdf", "pdf-export");
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: "GET", url: "/test" });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.scope).toBe("pdf-export");
    expect(body.limit).toBe(3);
  });
});

describe("bulk-export tier (5 req/min)", () => {
  test("allows 5 bulk export requests and blocks the 6th", async () => {
    const app = await createTierApp("user-bulk", "bulk-export");
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: "GET", url: "/test" });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.scope).toBe("bulk-export");
    expect(body.limit).toBe(5);
  });
});

describe("search tier (30 req/min)", () => {
  test("allows 30 search requests and blocks the 31st", async () => {
    const app = await createTierApp("user-search", "search");
    for (let i = 0; i < 30; i++) {
      const res = await app.inject({ method: "GET", url: "/test" });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.scope).toBe("search");
    expect(body.limit).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Independence of tiers
// ---------------------------------------------------------------------------

describe("tier independence", () => {
  test("exhausting the analytics tier does not block the normal route", async () => {
    const app = await createMultiRouteApp("user-independence");
    // Exhaust analytics tier (10 req)
    for (let i = 0; i < 10; i++) {
      await app.inject({ method: "GET", url: "/analytics" });
    }
    const analyticsBlocked = await app.inject({ method: "GET", url: "/analytics" });
    expect(analyticsBlocked.statusCode).toBe(429);

    // Normal route is still available
    const normalOk = await app.inject({ method: "GET", url: "/normal" });
    expect(normalOk.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Window reset
// ---------------------------------------------------------------------------

describe("window reset", () => {
  test("after the window elapses requests are allowed again", async () => {
    // Use a very short window (100ms) so we can wait it out in a test.
    const app = Fastify({ logger: false });
    app.decorateRequest("auth", undefined as unknown as AuthContext);
    app.addHook("preHandler", async (request) => {
      request.auth = mockAuth("user-window-reset");
    });
    app.get("/test", async (request, reply) => {
      const limited = await enforceRateLimit(request, reply, {
        scope: "window-reset",
        key: "user:user-window-reset",
        max: 2,
        windowMs: 100,
        message: "Rate limit exceeded."
      });
      if (limited) return reply;
      return { ok: true };
    });

    // Use up the limit
    await app.inject({ method: "GET", url: "/test" });
    await app.inject({ method: "GET", url: "/test" });
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);

    // Wait for the window to elapse
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again
    const allowed = await app.inject({ method: "GET", url: "/test" });
    expect(allowed.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// In-memory fallback (Redis unavailable)
// ---------------------------------------------------------------------------

describe("in-memory fallback via RATE_LIMIT_STORE=memory", () => {
  test("rate limiting still works when using the in-memory store", async () => {
    // RATE_LIMIT_STORE=memory is already set at the top of this file, so
    // all tests run against the in-memory store. This test verifies that
    // rate limiting enforces limits correctly under those conditions.
    const app = await createPerUserApp("user-inmemory", 2);
    await app.inject({ method: "GET", url: "/test" });
    await app.inject({ method: "GET", url: "/test" });
    const blocked = await app.inject({ method: "GET", url: "/test" });
    expect(blocked.statusCode).toBe(429);
  });
});
