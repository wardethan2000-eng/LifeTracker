import { randomUUID } from "node:crypto";
import {
  createInvitationSchema,
  acceptInvitationSchema,
  invitationStatusSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertOwner, assertMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toInvitationResponse } from "../../lib/serializers/index.js";
import { syncInvitationToSearchIndex } from "../../lib/search-index.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const invitationParamsSchema = householdParamsSchema.extend({
  invitationId: z.string().cuid()
});

const listInvitationsQuerySchema = z.object({
  status: invitationStatusSchema.optional()
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

        await createActivityLogger(app.prisma, request.auth.userId).log("invitation", invitation.id, "member.invited", params.householdId, { email: input.email });

    void syncInvitationToSearchIndex(app.prisma, invitation.id).catch(console.error);

    return reply.code(201).send(toInvitationResponse(invitation));
  });

  // ── List invitations for household ──────────────────────────────

  app.get("/v1/households/:householdId/invitations", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listInvitationsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
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
      return notFound(reply, "Invitation");
    }

    if (invitation.status !== "pending") {
      return reply.code(400).send({ message: `Invitation has already been ${invitation.status}.` });
    }

    if (invitation.expiresAt < new Date()) {
      const expiredInvitation = await app.prisma.householdInvitation.update({
        where: { id: invitation.id },
        data: { status: "expired" }
      });

      void syncInvitationToSearchIndex(app.prisma, expiredInvitation.id).catch(console.error);

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
      return notFound(reply, "Household");
    }

        await createActivityLogger(app.prisma, request.auth.userId).log("invitation", invitation.id, "member.joined", invitation.householdId, { email: invitation.email });

    void syncInvitationToSearchIndex(app.prisma, invitation.id).catch(console.error);

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
      return notFound(reply, "Pending invitation");
    }

    const updated = await app.prisma.householdInvitation.update({
      where: { id: invitation.id },
      data: { status: "revoked" }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("invitation", invitation.id, "member.invitation_revoked", params.householdId, { email: invitation.email });

    void syncInvitationToSearchIndex(app.prisma, updated.id).catch(console.error);

    return toInvitationResponse(updated);
  });
};
