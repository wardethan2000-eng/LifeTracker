import { barcodeLookupRequestSchema, barcodeImageQuerySchema } from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { applyTier, buildRateLimitKey } from "../lib/rate-limit-tiers.js";
import { resolveBarcode, detectBarcodeFormat } from "../lib/barcode-lookup.js";
import { generateBarcodePng, generateBarcodeSvg } from "../lib/barcode-image.js";

export const barcodeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/barcode/lookup", async (request, reply) => {
    if (await applyTier(request, reply, "barcode", buildRateLimitKey(request, request.auth.userId))) {
      return reply;
    }

    const input = barcodeLookupRequestSchema.parse(request.body);
    const result = await resolveBarcode(app.prisma, input.barcode, input.barcodeFormat);

    return result;
  });

  app.get("/v1/barcode/image", async (request, reply) => {
    if (await applyTier(request, reply, "barcode-image", buildRateLimitKey(request, request.auth.userId))) {
      return reply;
    }

    const query = barcodeImageQuerySchema.parse(request.query);
    const format = detectBarcodeFormat(query.value, query.format);

    reply.header("Cache-Control", "public, max-age=86400");

    if (query.output === "svg") {
      const svg = await generateBarcodeSvg({ value: query.value, format });
      return reply.header("content-type", "image/svg+xml; charset=utf-8").send(svg);
    }

    const png = await generateBarcodePng({ value: query.value, format, scale: query.scale });
    return reply.header("content-type", "image/png").send(png);
  });
};
