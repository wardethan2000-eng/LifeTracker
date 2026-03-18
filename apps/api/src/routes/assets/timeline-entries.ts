import type { Prisma } from "@prisma/client";
import {
  createAssetTimelineEntrySchema,
  updateAssetTimelineEntrySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import { toAssetTimelineEntryResponse } from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncTimelineEntryToSearchIndex } from "../../lib/search-index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const entryParamsSchema = assetParamsSchema.extend({
  entryId: z.string().cuid()
});

const listTimelineEntriesQuerySchema = z.object({
  category: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional()
});

// TODO(2026-06): Remove this legacy CRUD surface after all asset timeline writes and attachments are fully Entry-backed.
export const timelineEntryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/timeline-entries", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listTimelineEntriesQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    let cursorWhere: Prisma.AssetTimelineEntryWhereInput = {};

    if (query.cursor) {
      const cursorEntry = await app.prisma.assetTimelineEntry.findFirst({
        where: {
          id: query.cursor,
          assetId: asset.id
        },
        select: {
          id: true,
          entryDate: true
        }
      });

      if (!cursorEntry) {
        return reply.code(400).send({ message: "Invalid timeline entry cursor." });
      }

      cursorWhere = {
        OR: [
          { entryDate: { lt: cursorEntry.entryDate } },
          {
            entryDate: cursorEntry.entryDate,
            id: { lt: cursorEntry.id }
          }
        ]
      };
    }

    const entries = await app.prisma.assetTimelineEntry.findMany({
      where: {
        assetId: asset.id,
        ...(query.category ? { category: query.category } : {}),
        ...(query.since || query.until
          ? {
              entryDate: {
                ...(query.since ? { gte: new Date(query.since) } : {}),
                ...(query.until ? { lte: new Date(query.until) } : {})
              }
            }
          : {}),
        ...cursorWhere
      },
      orderBy: [
        { entryDate: "desc" },
        { id: "desc" }
      ],
      take: query.limit
    });

    return entries.map(toAssetTimelineEntryResponse);
  });

  app.post("/v1/assets/:assetId/timeline-entries", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createAssetTimelineEntrySchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const entry = await app.prisma.assetTimelineEntry.create({
      data: {
        assetId: asset.id,
        createdById: request.auth.userId,
        title: input.title,
        entryDate: new Date(input.entryDate),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.cost !== undefined ? { cost: input.cost } : {}),
        ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
        ...(input.tags !== undefined ? { tags: toInputJsonValue(input.tags) } : {}),
        ...(input.metadata !== undefined ? { metadata: toInputJsonValue(input.metadata) } : {})
      }
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "timeline_entry.created",
      entityType: "timeline_entry",
      entityId: entry.id,
      metadata: {
        title: entry.title,
        assetId: asset.id,
        assetName: asset.name
      }
    });

    void syncTimelineEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return reply.code(201).send(toAssetTimelineEntryResponse(entry));
  });

  app.get("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const entry = await app.prisma.assetTimelineEntry.findFirst({
      where: {
        id: params.entryId,
        assetId: asset.id
      }
    });

    if (!entry) {
      return reply.code(404).send({ message: "Timeline entry not found." });
    }

    return toAssetTimelineEntryResponse(entry);
  });

  app.patch("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const input = updateAssetTimelineEntrySchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.assetTimelineEntry.findFirst({
      where: {
        id: params.entryId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Timeline entry not found." });
    }

    if (existing.createdById !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the entry creator can edit this timeline entry." });
    }

    const data: Prisma.AssetTimelineEntryUncheckedUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.entryDate !== undefined) data.entryDate = new Date(input.entryDate);
    if (input.category !== undefined) data.category = input.category;
    if (input.cost !== undefined) data.cost = input.cost;
    if (input.vendor !== undefined) data.vendor = input.vendor;
    if (input.tags !== undefined) data.tags = toInputJsonValue(input.tags);
    if (input.metadata !== undefined) data.metadata = toInputJsonValue(input.metadata);

    const entry = await app.prisma.assetTimelineEntry.update({
      where: { id: existing.id },
      data
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "timeline_entry.updated",
      entityType: "timeline_entry",
      entityId: entry.id,
      metadata: {
        title: entry.title,
        assetId: asset.id,
        assetName: asset.name
      }
    });

    void syncTimelineEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return toAssetTimelineEntryResponse(entry);
  });

  app.delete("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.assetTimelineEntry.findFirst({
      where: {
        id: params.entryId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Timeline entry not found." });
    }

    if (existing.createdById !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the entry creator can delete this timeline entry." });
    }

    await app.prisma.assetTimelineEntry.delete({
      where: { id: existing.id }
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "timeline_entry.deleted",
      entityType: "timeline_entry",
      entityId: existing.id,
      metadata: {
        title: existing.title,
        assetId: asset.id,
        assetName: asset.name
      }
    });

    void removeSearchIndexEntry(app.prisma, "timeline_entry", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};