import { createShareLinkSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toShareLinkResponse } from "../../lib/serializers/index.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

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
      return forbidden(reply);
    }

    const asset = await app.prisma.asset.findFirst({
      where: {
        id: input.assetId,
        householdId: params.householdId
      }
    });

    if (!asset) {
      return notFound(reply, "Asset");
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

        await createActivityLogger(app.prisma, request.auth.userId).log("share_link", shareLink.id, "share_link.created", params.householdId, {
        assetId: asset.id,
        label: shareLink.label
      });

    return reply.code(201).send(toShareLinkResponse(shareLink));
  });

  app.get("/v1/households/:householdId/share-links", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = shareLinkListQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
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
      return forbidden(reply);
    }

    const existing = await app.prisma.shareLink.findFirst({
      where: {
        id: params.shareLinkId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return notFound(reply, "Share link");
    }

    const shareLink = await app.prisma.shareLink.update({
      where: {
        id: existing.id
      },
      data: {
        isRevoked: true
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("share_link", shareLink.id, "share_link.revoked", params.householdId, {
        assetId: shareLink.assetId,
        label: shareLink.label
      });

    return toShareLinkResponse(shareLink);
  });
};