import { searchQuerySchema, searchResponseSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { assertMembership } from "../../lib/asset-access.js";
import { applyTier } from "../../lib/rate-limit-tiers.js";
import { querySearchIndex } from "../../lib/search-index.js";
import { forbidden } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/search", async (request, reply) => {
    if (await applyTier(request, reply, "search")) return reply;
    const params = householdParamsSchema.parse(request.params);
    const query = searchQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const include = query.include ?? query.types;

    const response = await querySearchIndex(app.prisma, {
      householdId: params.householdId,
      q: query.q,
      limit: query.limit,
      fuzzy: query.fuzzy,
      includeHistory: query.includeHistory,
      ...(include ? { include } : {})
    });

    return searchResponseSchema.parse(response);
  });
};