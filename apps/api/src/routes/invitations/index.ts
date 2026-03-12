import { randomUUID } from "node:crypto";
import {
  createInvitationSchema,
  acceptInvitationSchema,
  invitationStatusSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertOwner, assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const invitationParamsSchema = householdParamsSchema.extend({
  invitationId: z.string().cuid()
});

const listInvitationsQuerySchema = z.object({
  status: invitationStatusSchema.optional()
});

const toInvitationResponse = (invitation: {
  id: string;
  householdId: string;
  invitedByUserId: string;
  email: string;
  status: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: invitation.id,
  householdId: invitation.householdId,
  invitedByUserId: invitation.invitedByUserId,
  email: invitation.email,
  status: invitation.status,
  token: invitation.token,
  expiresAt: invitation.expiresAt.toISOString(),
  acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
  acceptedByUserId: invitation.acceptedByUserId,
  createdAt: invitation.createdAt.toISOString(),
  updatedAt: invitation.updatedAt.toISOString()
});

export const invitationRoutes: FastifyPluginAsync = async (app) => {
  // ── Create invitation (owner only) ──────────────────────────────

  app.post("/v1/households/:householdId/invitations", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createInvitationSchema.parse(request.body);

    try {
      await assertOwner(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "Only household owners can invite members." });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + input.expirationHours * 60 * 60 * 1000);

    const invitation = await app.prisma.householdInvitation.create({
      data: {
        householdId: params.householdId,
        invitedByUserId: request.auth.userId,
        email: input.email,
        token,
        expiresAt
      }
    });

    // TODO: Wire in email send call here once an email provider (SendGrid, SES, etc.) is integrated.
    // For now, the token is returned in the response so the owner can share the link manually.

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "member.invited",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: input.email }
    });

    return reply.code(201).send(toInvitationResponse(invitation));
  });

  // ── List invitations for household ──────────────────────────────

  app.get("/v1/households/:householdId/invitations", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listInvitationsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const invitations = await app.prisma.householdInvitation.findMany({
      where: {
        householdId: params.householdId,
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: "desc" }
    });

    return invitations.map(toInvitationResponse);
  });

  // ── Accept invitation via token ─────────────────────────────────

  app.post("/v1/invitations/accept", async (request, reply) => {
    const input = acceptInvitationSchema.parse(request.body);

    const invitation = await app.prisma.householdInvitation.findUnique({
      where: { token: input.token }
    });

    if (!invitation) {
      return reply.code(404).send({ message: "Invitation not found." });
    }

    if (invitation.status !== "pending") {
      return reply.code(400).send({ message: `Invitation has already been ${invitation.status}.` });
    }

    if (invitation.expiresAt < new Date()) {
      await app.prisma.householdInvitation.update({
        where: { id: invitation.id },
        data: { status: "expired" }
      });

      return reply.code(400).send({ message: "Invitation has expired." });
    }

    const result = await app.prisma.$transaction(async (tx) => {
      // Check if user is already a member
      const existingMembership = await tx.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: invitation.householdId,
            userId: request.auth.userId
          }
        }
      });

      if (existingMembership) {
        // Already a member — just mark the invitation as accepted
        await tx.householdInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
            acceptedByUserId: request.auth.userId
          }
        });
      } else {
        await tx.householdMember.create({
          data: {
            householdId: invitation.householdId,
            userId: request.auth.userId,
            role: "member"
          }
        });

        await tx.householdInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
            acceptedByUserId: request.auth.userId
          }
        });
      }

      const household = await tx.household.findUnique({
        where: { id: invitation.householdId },
        include: { _count: { select: { members: true } } }
      });

      return household;
    });

    if (!result) {
      return reply.code(404).send({ message: "Household not found." });
    }

    await logActivity(app.prisma, {
      householdId: invitation.householdId,
      userId: request.auth.userId,
      action: "member.joined",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email }
    });

    return {
      id: result.id,
      name: result.name,
      createdById: result.createdById,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      memberCount: result._count.members,
      myRole: "member"
    };
  });

  // ── Revoke a pending invitation ─────────────────────────────────

  app.post("/v1/households/:householdId/invitations/:invitationId/revoke", async (request, reply) => {
    const params = invitationParamsSchema.parse(request.params);

    try {
      await assertOwner(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "Only household owners can revoke invitations." });
    }

    const invitation = await app.prisma.householdInvitation.findFirst({
      where: {
        id: params.invitationId,
        householdId: params.householdId,
        status: "pending"
      }
    });

    if (!invitation) {
      return reply.code(404).send({ message: "Pending invitation not found." });
    }

    const updated = await app.prisma.householdInvitation.update({
      where: { id: invitation.id },
      data: { status: "revoked" }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "member.invitation_revoked",
      entityType: "invitation",
      entityId: invitation.id,
      metadata: { email: invitation.email }
    });

    return toInvitationResponse(updated);
  });
};
