import { barcodeLookupRequestSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { buildRateLimitKey, enforceRateLimit } from "../lib/rate-limit.js";
import { resolveBarcode } from "../lib/barcode-lookup.js";

export const barcodeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/barcode/lookup", async (request, reply) => {
    if (await enforceRateLimit(request, reply, {
      scope: "barcode",
      key: buildRateLimitKey(request, request.auth.userId),
      max: 20,
      windowMs: 5 * 60 * 1000,
      message: "Barcode lookup rate limit exceeded. Try again shortly."
    })) {
      return reply;
    }

    const input = barcodeLookupRequestSchema.parse(request.body);
    const result = await resolveBarcode(app.prisma, input.barcode, input.barcodeFormat);

    return result;
  });
};
