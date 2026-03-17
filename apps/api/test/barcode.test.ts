import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { barcodeRoutes } from "../src/routes/barcode.js";
import { resetRateLimitState } from "../src/lib/rate-limit.js";

const createBarcodeApp = async (): Promise<FastifyInstance> => {
  const app = Fastify();

  app.decorate("prisma", {
    barcodeLookup: {
      findUnique: async () => null
    }
  } as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId: "clkeeperuser0000000000001",
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(barcodeRoutes);
  return app;
};

test("barcode lookup resolves non-UPC input without external fetches", async (t) => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const app = await createBarcodeApp();
  t.after(async () => {
    await app.close();
    await resetRateLimitState();
  });

  const response = await app.inject({
    method: "POST",
    url: "/v1/barcode/lookup",
    payload: {
      barcode: "LK-DEMO-CODE"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    barcode: "LK-DEMO-CODE",
    barcodeFormat: "unknown",
    found: false,
    productName: null,
    brand: null,
    description: null,
    category: null,
    imageUrl: null,
    cachedAt: null
  });
});

test("barcode lookup enforces the route rate limit", async (t) => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const app = await createBarcodeApp();
  t.after(async () => {
    await app.close();
    await resetRateLimitState();
  });

  for (let index = 0; index < 20; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/v1/barcode/lookup",
      payload: {
        barcode: `LK-${index}`
      }
    });

    assert.equal(response.statusCode, 200);
  }

  const limitedResponse = await app.inject({
    method: "POST",
    url: "/v1/barcode/lookup",
    payload: {
      barcode: "LK-LIMIT"
    }
  });

  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedResponse.json().message, "Barcode lookup rate limit exceeded. Try again shortly.");
});
