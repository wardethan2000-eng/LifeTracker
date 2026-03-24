import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { householdParamsSchema } from "../lib/schemas.js";
import { assertMembership, assertOwner } from "../lib/asset-access.js";

export type HouseholdContext = {
  householdId: string;
  userId: string;
};

export type HouseholdPreHandlerOptions = {
  /** When true, verifies the user is an owner rather than just a member. */
  requireOwner?: boolean;
};

/**
 * Returns a Fastify preHandler that:
 *  1. Parses `householdId` from route params (sends 400 if invalid)
 *  2. Verifies household membership (or ownership when `requireOwner` is set), sends 403 on failure
 *  3. Attaches `request.householdContext = { householdId, userId }` for use in the handler
 *
 * Usage:
 *   app.get("/v1/households/:householdId/...", { preHandler: [makeHouseholdPreHandler(app)] }, async (request, reply) => {
 *     const { householdId, userId } = request.householdContext;
 *     // ...
 *   });
 */
export function makeHouseholdPreHandler(
  app: FastifyInstance,
  options?: HouseholdPreHandlerOptions
) {
  return async function householdPreHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const parsed = householdParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ message: "Invalid householdId parameter." });
      return;
    }

    const { householdId } = parsed.data;
    const userId = request.auth.userId;

    try {
      if (options?.requireOwner) {
        await assertOwner(app.prisma, householdId, userId);
      } else {
        await assertMembership(app.prisma, householdId, userId);
      }
    } catch {
      reply.code(403).send({ message: "Forbidden." });
      return;
    }

    request.householdContext = { householdId, userId };
  };
}
