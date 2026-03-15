import { linkPreviewRequestSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { extractLinkPreview, normalizeLinkPreviewUrl } from "../../lib/link-preview.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

export const householdLinkPreviewRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/link-preview", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
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
      request.log.warn({ err, url: input.url }, "link-preview extraction failed");
      return reply.code(422).send({
        message: `Unable to extract product information from this URL. The site may be blocking automated requests or the page structure is not recognized.${detail ? ` (${detail})` : ""}`
      });
    }
  });
};
