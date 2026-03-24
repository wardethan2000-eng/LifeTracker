import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { applyTier, buildRateLimitKey } from "../../lib/rate-limit-tiers.js";
import { toPublicAssetReportResponse } from "../../lib/serializers/index.js";
import { buildAssetCostSummary, buildAssetTimeline } from "../exports/index.js";

const publicShareParamsSchema = z.object({
  token: z.string().min(1)
});

export const publicShareRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/public/share/:token", async (request, reply) => {
    const params = publicShareParamsSchema.parse(request.params);

    if (await applyTier(request, reply, "public-share", buildRateLimitKey(request, params.token))) {
      return reply;
    }

    const shareLink = await app.prisma.shareLink.findUnique({
      where: {
        token: params.token
      }
    });

    if (!shareLink) {
      return reply.code(404).send({ message: "This link is not valid." });
    }

    if (shareLink.isRevoked) {
      return reply.code(410).send({ message: "This link has been revoked." });
    }

    if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ message: "This link has expired." });
    }

    await app.prisma.shareLink.update({
      where: {
        id: shareLink.id
      },
      data: {
        viewCount: {
          increment: 1
        },
        lastViewedAt: new Date()
      }
    });

    const asset = await app.prisma.asset.findUnique({
      where: {
        id: shareLink.assetId
      },
      select: {
        id: true,
        householdId: true,
        conditionHistory: true,
        name: true,
        category: true,
        manufacturer: true,
        model: true
      }
    });

    if (!asset) {
      return reply.code(404).send({ message: "This link is not valid." });
    }

    const range = {
      ...(shareLink.dateRangeStart ? { since: shareLink.dateRangeStart.toISOString() } : {}),
      ...(shareLink.dateRangeEnd ? { until: shareLink.dateRangeEnd.toISOString() } : {})
    };
    const [timelineItems, costSummary] = await Promise.all([
      buildAssetTimeline(app.prisma, asset, range),
      buildAssetCostSummary(app.prisma, asset.id, range)
    ]);

    return toPublicAssetReportResponse({
      asset: {
        name: asset.name,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        year: null
      },
      timelineItems,
      costSummary: {
        lifetimeCost: costSummary.lifetimeCost,
        logCount: costSummary.logCount
      },
      generatedAt: new Date(),
      dateRangeStart: shareLink.dateRangeStart,
      dateRangeEnd: shareLink.dateRangeEnd
    });
  });
};