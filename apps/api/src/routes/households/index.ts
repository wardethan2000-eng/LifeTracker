import {
  addHouseholdMemberSchema,
  createHouseholdSchema,
  householdMemberSchema,
  householdSummarySchema,
  updateHouseholdMemberSchema,
  updateHouseholdSchema
} from "@lifekeeper/types";
import type { HouseholdRole, Prisma, User } from "@prisma/client";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { assertMembership, assertOwner, getMembership } from "../../lib/asset-access.js";
import { toUserProfileResponse } from "../../lib/serializers/index.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { forbidden, notFound, badRequest } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const memberParamsSchema = householdParamsSchema.extend({
  memberId: z.string().cuid()
});

const toHouseholdSummary = (household: {
  id: string;
  name: string;
  timezone: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    members: number;
  };
}, myRole: HouseholdRole) => householdSummarySchema.parse({
  id: household.id,
  name: household.name,
  timezone: household.timezone,
  createdById: household.createdById,
  createdAt: household.createdAt.toISOString(),
  updatedAt: household.updatedAt.toISOString(),
  memberCount: household._count.members,
  myRole
});

const toHouseholdMember = (member: {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: Pick<User, "id" | "clerkUserId" | "email" | "displayName" | "notificationPreferences" | "createdAt" | "updatedAt">;
}) => householdMemberSchema.parse({
  id: member.id,
  householdId: member.householdId,
  userId: member.userId,
  role: member.role,
  joinedAt: member.joinedAt.toISOString(),
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
  user: toUserProfileResponse(member.user)
});

const resolveMemberCandidateWhere = (input: {
  userId: string | undefined;
  clerkUserId: string | undefined;
  email: string | undefined;
}): Prisma.UserWhereInput => {
  if (input.userId) {
    return { id: input.userId };
  }

  if (input.clerkUserId) {
    return { clerkUserId: input.clerkUserId };
  }

  if (input.email) {
    return { email: input.email };
  }

  throw new Error("A member lookup identifier is required.");
};

const ensureHouseholdOwner = async (app: FastifyInstance, householdId: string, userId: string, reply: FastifyReply) => {
  try {
    await assertOwner(app.prisma, householdId, userId);
    return true;
  } catch {
    await reply.code(403).send({ message: "Only household owners can perform this action." });
    return false;
  }
};

const ensureHouseholdMember = async (app: FastifyInstance, householdId: string, userId: string, reply: FastifyReply) => {
  try {
    await assertMembership(app.prisma, householdId, userId);
    return true;
  } catch {
    await forbidden(reply);
    return false;
  }
};

const assertNotLastOwner = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  membership: { role: HouseholdRole }
): Promise<void> => {
  if (membership.role !== "owner") {
    return;
  }

  const ownerCount = await tx.householdMember.count({
    where: {
      householdId,
      role: "owner"
    }
  });

  if (ownerCount <= 1) {
    throw new Error("A household must retain at least one owner.");
  }
};

export const householdRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households", async (request) => {
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

    return memberships.map((membership) => toHouseholdSummary(membership.household, membership.role));
  });

  app.post("/v1/households", async (request, reply) => {
    const input = createHouseholdSchema.parse(request.body);

    const household = await app.prisma.$transaction(async (tx) => {
      const created = await tx.household.create({
        data: {
          name: input.name,
          createdById: request.auth.userId,
          members: {
            create: {
              userId: request.auth.userId,
              role: "owner"
            }
          }
        },
        include: {
          _count: {
            select: { members: true }
          }
        }
      });

      return created;
    });

    return reply.code(201).send(toHouseholdSummary(household, "owner"));
  });

  app.get("/v1/households/:householdId", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const membership = await getMembership(app.prisma, params.householdId, request.auth.userId);

    if (!membership) {
      return forbidden(reply);
    }

    const household = await app.prisma.household.findUnique({
      where: { id: params.householdId },
      include: {
        _count: {
          select: { members: true }
        }
      }
    });

    if (!household) {
      return notFound(reply, "Household");
    }

    return toHouseholdSummary(household, membership.role);
  });

  app.patch("/v1/households/:householdId", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = updateHouseholdSchema.parse(request.body);

    if (!await ensureHouseholdOwner(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.household.findUnique({
      where: { id: params.householdId },
      include: {
        _count: {
          select: { members: true }
        }
      }
    });

    if (!existing) {
      return notFound(reply, "Household");
    }

    if (input.timezone !== undefined) {
      const isValidTimezone = (() => {
        try { Intl.DateTimeFormat(undefined, { timeZone: input.timezone }); return true; } catch { return false; }
      })();
      if (!isValidTimezone) {
        return reply.code(400).send({ message: "Invalid IANA timezone identifier." });
      }
    }

    const household = await app.prisma.household.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {})
      },
      include: {
        _count: {
          select: { members: true }
        }
      }
    });

    return toHouseholdSummary(household, "owner");
  });

  app.get("/v1/households/:householdId/members", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureHouseholdMember(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const members = await app.prisma.householdMember.findMany({
      where: { householdId: params.householdId },
      include: {
        user: true
      },
      orderBy: [
        { role: "asc" },
        { joinedAt: "asc" }
      ]
    });

    return members.map(toHouseholdMember);
  });

  app.post("/v1/households/:householdId/members", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = addHouseholdMemberSchema.parse(request.body);

    if (!await ensureHouseholdOwner(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const household = await app.prisma.household.findUnique({
      where: { id: params.householdId }
    });

    if (!household) {
      return notFound(reply, "Household");
    }

    const user = await app.prisma.user.findFirst({
      where: resolveMemberCandidateWhere({
        userId: input.userId,
        clerkUserId: input.clerkUserId,
        email: input.email
      })
    });

    if (!user) {
      return notFound(reply, "User");
    }

    const existingMembership = await app.prisma.householdMember.findUnique({
      where: {
        householdId_userId: {
          householdId: params.householdId,
          userId: user.id
        }
      },
      include: { user: true }
    });

    if (existingMembership) {
      return reply.code(409).send({ message: "User is already a member of this household." });
    }

    const membership = await app.prisma.householdMember.create({
      data: {
        householdId: params.householdId,
        userId: user.id,
        role: input.role
      },
      include: {
        user: true
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("household", params.householdId, "member.added", params.householdId, { addedUserId: user.id, role: input.role });

    return reply.code(201).send(toHouseholdMember(membership));
  });

  app.patch("/v1/households/:householdId/members/:memberId", async (request, reply) => {
    const params = memberParamsSchema.parse(request.params);
    const input = updateHouseholdMemberSchema.parse(request.body);

    if (!await ensureHouseholdOwner(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.householdMember.findFirst({
      where: {
        id: params.memberId,
        householdId: params.householdId
      },
      include: {
        user: true
      }
    });

    if (!existing) {
      return notFound(reply, "Household member");
    }

    try {
      const member = await app.prisma.$transaction(async (tx) => {
        if (input.role !== undefined && existing.role === "owner" && input.role !== "owner") {
          await assertNotLastOwner(tx, params.householdId, existing);
        }

        return tx.householdMember.update({
          where: { id: existing.id },
          data: {
            ...(input.role !== undefined ? { role: input.role } : {})
          },
          include: {
            user: true
          }
        });
      });

      return toHouseholdMember(member);
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to update household member."
      });
    }
  });

  app.delete("/v1/households/:householdId/members/:memberId", async (request, reply) => {
    const params = memberParamsSchema.parse(request.params);

    if (!await ensureHouseholdOwner(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.householdMember.findFirst({
      where: {
        id: params.memberId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return notFound(reply, "Household member");
    }

    try {
      await app.prisma.$transaction(async (tx) => {
        await assertNotLastOwner(tx, params.householdId, existing);
        await tx.householdMember.delete({
          where: { id: existing.id }
        });
      });

            await createActivityLogger(app.prisma, request.auth.userId).log("household", params.householdId, "member.removed", params.householdId, { removedUserId: existing.userId });

      return reply.code(204).send();
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to remove household member."
      });
    }
  });

  // ── Trash (Recently Deleted) ─────────────────────────────────────

  app.get("/v1/households/:householdId/trash", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureHouseholdMember(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const [assets, projects, inventoryItems] = await Promise.all([
      app.prisma.asset.findMany({
        where: { householdId: params.householdId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 100
      }),
      app.prisma.project.findMany({
        where: { householdId: params.householdId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 100
      }),
      app.prisma.inventoryItem.findMany({
        where: { householdId: params.householdId, deletedAt: { not: null } },
        select: { id: true, name: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 100
      }),
    ]);

    const items = [
      ...assets.map((a) => ({ id: a.id, type: "asset" as const, name: a.name, deletedAt: a.deletedAt!.toISOString(), householdId: params.householdId })),
      ...projects.map((p) => ({ id: p.id, type: "project" as const, name: p.name, deletedAt: p.deletedAt!.toISOString(), householdId: params.householdId })),
      ...inventoryItems.map((i) => ({ id: i.id, type: "inventory_item" as const, name: i.name, deletedAt: i.deletedAt!.toISOString(), householdId: params.householdId })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

    return { items, total: items.length };
  });

  app.delete("/v1/households/:householdId/trash", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = z.object({
      olderThanDays: z.coerce.number().int().min(0).max(365).optional()
    }).parse(request.query);

    if (!await ensureHouseholdMember(app, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const cutoff = query.olderThanDays !== undefined
      ? new Date(Date.now() - query.olderThanDays * 86400000)
      : undefined;

    const deletedAtFilter = cutoff ? { not: null, lte: cutoff } : { not: null };

    await Promise.all([
      app.prisma.asset.deleteMany({
        where: { householdId: params.householdId, deletedAt: deletedAtFilter as { not: null; lte?: Date } }
      }),
      app.prisma.project.deleteMany({
        where: { householdId: params.householdId, deletedAt: deletedAtFilter as { not: null; lte?: Date } }
      }),
      app.prisma.inventoryItem.deleteMany({
        where: { householdId: params.householdId, deletedAt: deletedAtFilter as { not: null; lte?: Date } }
      }),
    ]);

    await createActivityLogger(app.prisma, request.auth.userId).log("household", params.householdId, "trash.purged", params.householdId, {});

    return reply.code(204).send();
  });
};