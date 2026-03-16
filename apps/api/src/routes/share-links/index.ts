import { createShareLinkSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { toShareLinkResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const deleteShareLinkParamsSchema = householdParamsSchema.extend({
  shareLinkId: z.string().cuid()
});

const shareLinkListQuerySchema = z.object({
  assetId: z.string().cuid().optional()
});

export const shareLinkRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/share-links", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createShareLinkSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const asset = await app.prisma.asset.findFirst({
      where: {
        id: input.assetId,
        householdId: params.householdId
      }
    });

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const shareLink = await app.prisma.shareLink.create({
      data: {
        householdId: params.householdId,
        assetId: asset.id,
        createdById: request.auth.userId,
        token: nanoid(32),
        label: input.label ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        dateRangeStart: input.dateRangeStart ? new Date(input.dateRangeStart) : null,
        dateRangeEnd: input.dateRangeEnd ? new Date(input.dateRangeEnd) : null
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "share_link.created",
      entityType: "share_link",
      entityId: shareLink.id,
      metadata: {
        assetId: asset.id,
        label: shareLink.label
      }
    });

    return reply.code(201).send(toShareLinkResponse(shareLink));
  });

  app.get("/v1/households/:householdId/share-links", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = shareLinkListQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const shareLinks = await app.prisma.shareLink.findMany({
      where: {
        householdId: params.householdId,
        ...(query.assetId ? { assetId: query.assetId } : {})
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return shareLinks.map(toShareLinkResponse);
  });

  app.delete("/v1/households/:householdId/share-links/:shareLinkId", async (request, reply) => {
    const params = deleteShareLinkParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.shareLink.findFirst({
      where: {
        id: params.shareLinkId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Share link not found." });
    }

    const shareLink = await app.prisma.shareLink.update({
      where: {
        id: existing.id
      },
      data: {
        isRevoked: true
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "share_link.revoked",
      entityType: "share_link",
      entityId: shareLink.id,
      metadata: {
        assetId: shareLink.assetId,
        label: shareLink.label
      }
    });

    return toShareLinkResponse(shareLink);
  });
};