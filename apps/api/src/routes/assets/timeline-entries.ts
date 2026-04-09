import {
  createAssetTimelineEntrySchema,
  updateAssetTimelineEntrySchema
} from "@aegis/types";
import { ASSET_CATEGORY_PREFIX, buildAssetEntryPayload, parseAssetEntryPayload } from "@aegis/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toInputJsonValue, parseTags } from "../../lib/prisma-json.js";
import { toEntryAsTimelineEntry } from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncEntryToSearchIndex } from "../../lib/search-index.js";
import { notFound } from "../../lib/errors.js";

import { assetParamsSchema } from "../../lib/schemas.js";

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

const parseMeasurements = (value: unknown): Array<{ name: string; value: number; unit: string }> => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is { name: string; value: number; unit: string } =>
      m !== null && typeof m === "object" && !Array.isArray(m) &&
      typeof (m as Record<string, unknown>).name === "string" &&
      typeof (m as Record<string, unknown>).value === "number" &&
      typeof (m as Record<string, unknown>).unit === "string"
  );
};

export const timelineEntryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/timeline-entries", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listTimelineEntriesQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    let cursorWhere = {};

    if (query.cursor) {
      const cursorEntry = await app.prisma.entry.findFirst({
        where: {
          id: query.cursor,
          entityType: "asset",
          entityId: asset.id
        },
        select: { id: true, entryDate: true }
      });

      if (!cursorEntry) {
        return reply.code(400).send({ message: "Invalid timeline entry cursor." });
      }

      cursorWhere = {
        OR: [
          { entryDate: { lt: cursorEntry.entryDate } },
          { entryDate: cursorEntry.entryDate, id: { lt: cursorEntry.id } }
        ]
      };
    }

    const entries = await app.prisma.entry.findMany({
      where: {
        entityType: "asset",
        entityId: asset.id,
        ...(query.category ? { tags: { array_contains: [`${ASSET_CATEGORY_PREFIX}${query.category}`] } } : {}),
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

    return entries.map(toEntryAsTimelineEntry);
  });

  app.post("/v1/assets/:assetId/timeline-entries", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createAssetTimelineEntrySchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const details = buildAssetEntryPayload({
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      cost: input.cost ?? null,
      vendor: input.vendor ?? null,
      tags: input.tags ?? []
    });

    const entry = await app.prisma.entry.create({
      data: {
        householdId: asset.householdId,
        createdById: request.auth.userId,
        title: input.title,
        body: details.body,
        entryDate: new Date(input.entryDate),
        entityType: "asset",
        entityId: asset.id,
        entryType: details.entryType,
        measurements: toInputJsonValue(details.measurements),
        tags: toInputJsonValue(details.tags),
        attachmentName: details.attachmentName
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("timeline_entry", entry.id, "timeline_entry.created", asset.householdId, {
        title: entry.title,
        assetId: asset.id,
        assetName: asset.name
      });

    void syncEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return reply.code(201).send(toEntryAsTimelineEntry(entry));
  });

  app.get("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const entry = await app.prisma.entry.findFirst({
      where: {
        id: params.entryId,
        entityType: "asset",
        entityId: asset.id
      }
    });

    if (!entry) {
      return notFound(reply, "Timeline entry");
    }

    return toEntryAsTimelineEntry(entry);
  });

  app.patch("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const input = updateAssetTimelineEntrySchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.entryId,
        entityType: "asset",
        entityId: asset.id
      }
    });

    if (!existing) {
      return notFound(reply, "Timeline entry");
    }

    if (existing.createdById !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the entry creator can edit this timeline entry." });
    }

    const current = parseAssetEntryPayload({
      title: existing.title,
      body: existing.body,
      entryType: existing.entryType,
      tags: parseTags(existing.tags),
      measurements: parseMeasurements(existing.measurements),
      attachmentName: existing.attachmentName
    });

    const details = buildAssetEntryPayload({
      title: input.title ?? existing.title ?? "",
      description: input.description !== undefined ? input.description : current.description,
      category: input.category !== undefined ? input.category : current.category,
      cost: input.cost !== undefined ? input.cost : current.cost,
      vendor: input.vendor !== undefined ? input.vendor : current.vendor,
      tags: input.tags !== undefined ? input.tags : current.tags
    });

    const entry = await app.prisma.entry.update({
      where: { id: existing.id },
      data: {
        title: input.title ?? existing.title,
        body: details.body,
        entryType: details.entryType,
        measurements: toInputJsonValue(details.measurements),
        tags: toInputJsonValue(details.tags),
        attachmentName: details.attachmentName,
        ...(input.entryDate !== undefined ? { entryDate: new Date(input.entryDate) } : {})
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("timeline_entry", entry.id, "timeline_entry.updated", asset.householdId, {
        title: entry.title,
        assetId: asset.id,
        assetName: asset.name
      });

    void syncEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return toEntryAsTimelineEntry(entry);
  });

  app.delete("/v1/assets/:assetId/timeline-entries/:entryId", async (request, reply) => {
    const params = entryParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.entryId,
        entityType: "asset",
        entityId: asset.id
      }
    });

    if (!existing) {
      return notFound(reply, "Timeline entry");
    }

    if (existing.createdById !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the entry creator can delete this timeline entry." });
    }

    await app.prisma.entry.delete({
      where: { id: existing.id }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("timeline_entry", existing.id, "timeline_entry.deleted", asset.householdId, {
        title: existing.title,
        assetId: asset.id,
        assetName: asset.name
      });

    void removeSearchIndexEntry(app.prisma, "entry", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};