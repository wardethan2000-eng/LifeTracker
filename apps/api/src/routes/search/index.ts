import { searchQuerySchema, searchResponseSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { querySearchIndex } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/search", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = searchQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const response = await querySearchIndex(app.prisma, {
      householdId: params.householdId,
      q: query.q,
      limit: query.limit,
      ...(query.types ? { types: query.types } : {})
    });

    return searchResponseSchema.parse(response);
  });
};