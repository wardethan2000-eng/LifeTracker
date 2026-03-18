import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { expect, test } from "vitest";
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

test("barcode lookup resolves non-UPC input without external fetches", async () => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const app = await createBarcodeApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/v1/barcode/lookup",
      payload: {
        barcode: "LK-DEMO-CODE"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
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
  } finally {
    await app.close();
    await resetRateLimitState();
  }
});

test("barcode lookup enforces the route rate limit", async () => {
  process.env.RATE_LIMIT_STORE = "memory";
  await resetRateLimitState();
  const app = await createBarcodeApp();
  try {
    for (let index = 0; index < 20; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/barcode/lookup",
        payload: {
          barcode: `LK-${index}`
        }
      });

      expect(response.statusCode).toBe(200);
    }

    const limitedResponse = await app.inject({
      method: "POST",
      url: "/v1/barcode/lookup",
      payload: {
        barcode: "LK-LIMIT"
      }
    });

    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json().message).toBe("Barcode lookup rate limit exceeded. Try again shortly.");
  } finally {
    await app.close();
    await resetRateLimitState();
  }
});
