import { linkPreviewRequestSchema } from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { assertMembership } from "../../lib/asset-access.js";
import { extractLinkPreview, normalizeLinkPreviewUrl } from "../../lib/link-preview.js";
import { forbidden } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

function detectRetailerFromUrl(value: string): string | null {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "homedepot.com" || hostname.endsWith(".homedepot.com")) {
      return "Home Depot";
    }

    if (hostname === "amazon.com" || hostname.endsWith(".amazon.com")) {
      return "Amazon";
    }

    return null;
  } catch {
    return null;
  }
}

export const householdLinkPreviewRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/link-preview", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const rawBody = typeof request.body === "object" && request.body !== null
      ? request.body as Record<string, unknown>
      : {};

    const input = linkPreviewRequestSchema.parse({
      url: typeof rawBody.url === "string"
        ? normalizeLinkPreviewUrl(rawBody.url) ?? rawBody.url.trim()
        : rawBody.url
    });

    try {
      const result = await extractLinkPreview(input.url);
      return result;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const retailer = detectRetailerFromUrl(input.url);
      const blockedMessage = retailer && /HTTP 403/i.test(detail)
        ? `${retailer} blocked automated extraction from the server. Try a different retailer link, or use the page details manually if the partial import is not enough.`
        : null;

      request.log.warn({ err, url: input.url }, "link-preview extraction failed");
      return reply.code(422).send({
        message: blockedMessage
          ?? `Unable to extract product information from this URL. The site may be blocking automated requests or the page structure is not recognized.${detail ? ` (${detail})` : ""}`
      });
    }
  });
};
