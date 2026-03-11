import { meResponseSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { toUserProfileResponse } from "../lib/presenters.js";

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/me", async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return reply.code(404).send({ message: "Current user not found." });
    }

    const memberships = await app.prisma.householdMember.findMany({
      where: { userId: request.auth.userId },
      include: {
        household: {
          include: {
            _count: {
              select: { members: true }
            }
          }
        }
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    return meResponseSchema.parse({
      user: toUserProfileResponse(user),
      auth: {
        source: request.auth.source,
        clerkUserId: request.auth.clerkUserId
      },
      households: memberships.map((membership) => ({
        id: membership.household.id,
        name: membership.household.name,
        createdById: membership.household.createdById,
        createdAt: membership.household.createdAt.toISOString(),
        updatedAt: membership.household.updatedAt.toISOString(),
        memberCount: membership.household._count.members,
        myRole: membership.role
      }))
    });
  });
};