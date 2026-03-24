import {
  displayPreferencesSchema,
  meResponseSchema,
  updateDisplayPreferencesSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { toUserProfileResponse } from "../lib/serializers/index.js";
import { notFound } from "../lib/errors.js";

const parseDisplayPreferences = (value: unknown) =>
  displayPreferencesSchema.parse(value && typeof value === "object" ? value : {});

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/me", async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return notFound(reply, "Current user");
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

  app.get("/v1/me/display-preferences", async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return notFound(reply, "Current user");
    }

    return displayPreferencesSchema.parse(parseDisplayPreferences(user.displayPreferences));
  });

  app.patch("/v1/me/display-preferences", async (request, reply) => {
    const input = updateDisplayPreferencesSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return notFound(reply, "Current user");
    }

    const current = parseDisplayPreferences(user.displayPreferences);
    const next = displayPreferencesSchema.parse({ ...current, ...input });

    await app.prisma.user.update({
      where: { id: user.id },
      data: { displayPreferences: next }
    });

    return next;
  });

  app.delete("/v1/me", async (request, reply) => {
    const userId = request.auth.userId;

    const memberships = await app.prisma.householdMember.findMany({
      where: { userId },
      include: {
        household: {
          include: { _count: { select: { members: true } } }
        }
      }
    });

    // For households where this user is the sole member, delete the household (cascades all data).
    // For others, just remove the membership.
    for (const membership of memberships) {
      if (membership.household._count.members === 1) {
        await app.prisma.household.delete({ where: { id: membership.householdId } });
      } else {
        await app.prisma.householdMember.delete({ where: { id: membership.id } });
      }
    }

    await app.prisma.user.delete({ where: { id: userId } });

    // Best-effort Clerk deletion (not available in dev bypass mode).
    if (request.auth.clerkUserId) {
      try {
        const { createClerkClient } = await import("@clerk/backend");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerkClient.users.deleteUser(request.auth.clerkUserId);
      } catch (err) {
        app.log.warn({ err }, "Failed to delete Clerk user during account deletion");
      }
    }

    return reply.code(204).send();
  });
};