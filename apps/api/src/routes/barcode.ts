import { barcodeLookupRequestSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { resolveBarcode } from "../lib/barcode-lookup.js";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

const rateLimitMap = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();

  for (const [userId, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recent.length === 0) {
      rateLimitMap.delete(userId);
    } else {
      rateLimitMap.set(userId, recent);
    }
  }
}, 10 * 60 * 1000).unref();

export const barcodeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/barcode/lookup", async (request, reply) => {
    const userId = request.auth.userId;

    if (isRateLimited(userId)) {
      return reply.code(429).send({
        message: "Barcode lookup rate limit exceeded. Try again shortly."
      });
    }

    const input = barcodeLookupRequestSchema.parse(request.body);
    const result = await resolveBarcode(app.prisma, input.barcode, input.barcodeFormat);

    return result;
  });
};
