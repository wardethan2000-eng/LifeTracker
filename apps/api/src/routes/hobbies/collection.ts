import { Prisma } from "@prisma/client";
import {
  bulkUpdateHobbyCollectionItemStatusInputSchema,
  createHobbyCollectionItemInputSchema,
  hobbyCollectionItemListQuerySchema,
  hobbyCollectionItemListResponseSchema,
  updateHobbyCollectionItemInputSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { logActivity } from "../../lib/activity-log.js";
import { resolveEntryEntityContexts } from "../../lib/entries.js";
import {
  entryResponseInclude,
  toEntryResponse,
  toHobbyCollectionItemDetailResponse,
  toHobbyCollectionItemMetricReadingResponse,
  toHobbyCollectionItemResponse,
  toHobbyCollectionItemSessionResponse,
} from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncHobbyCollectionItemToSearchIndex } from "../../lib/search-index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
});

const collectionItemParamsSchema = hobbyParamsSchema.extend({
  collectionItemId: z.string().cuid(),
});

export const hobbyCollectionRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/collection";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = hobbyCollectionItemListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const rawItems = await app.prisma.hobbyCollectionItem.findMany({
      where: {
        hobbyId,
        householdId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.location ? { location: query.location } : {}),
        ...(query.tag ? { tags: { array_contains: [query.tag] } } : {}),
        ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
        ...cursorWhere(query.cursor),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    const { items, nextCursor } = buildCursorPage(rawItems, query.limit);

    return reply.send(hobbyCollectionItemListResponseSchema.parse({
      items: items.map(toHobbyCollectionItemResponse),
      nextCursor,
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyCollectionItemInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({ where: { id: hobbyId, householdId }, select: { id: true } });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found." });
    }

    if (input.parentItemId) {
      const parent = await app.prisma.hobbyCollectionItem.findFirst({
        where: { id: input.parentItemId, hobbyId, householdId },
        select: { id: true },
      });
      if (!parent) {
        return reply.code(400).send({ message: "parentItemId must belong to this hobby." });
      }
    }

    const item = await app.prisma.hobbyCollectionItem.create({
      data: {
        hobbyId,
        householdId,
        createdById: userId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "active",
        acquiredDate: input.acquiredDate ? new Date(input.acquiredDate) : null,
        retiredDate: input.retiredDate ? new Date(input.retiredDate) : null,
        coverImageUrl: input.coverImageUrl ?? null,
        location: input.location ?? null,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        quantity: input.quantity ?? 1,
        tags: (input.tags ?? []) as Prisma.InputJsonValue,
        notes: input.notes ?? null,
        parentItemId: input.parentItemId ?? null,
      },
    });

    await Promise.all([
      logActivity(app.prisma, {
        householdId,
        userId,
        action: "hobby_collection_item_created",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { collectionItemId: item.id, collectionItemName: item.name },
      }),
      syncHobbyCollectionItemToSearchIndex(app.prisma, item.id),
    ]);

    return reply.code(201).send(toHobbyCollectionItemResponse(item));
  });

  app.get(`${BASE}/:collectionItemId`, async (request, reply) => {
    const { householdId, hobbyId, collectionItemId } = collectionItemParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const item = await app.prisma.hobbyCollectionItem.findFirst({
      where: { id: collectionItemId, hobbyId, householdId },
      include: {
        childItems: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!item) {
      return reply.code(404).send({ message: "Collection item not found." });
    }

    const [sessions, entries, metricReadings] = await Promise.all([
      app.prisma.hobbySession.findMany({
        where: { hobbyId, collectionItemId },
        orderBy: [{ completedDate: "desc" }, { createdAt: "desc" }],
        include: {
          recipe: { select: { name: true } },
          routine: { select: { name: true } },
        },
      }),
      app.prisma.entry.findMany({
        where: {
          householdId,
          entityType: "hobby_collection_item",
          entityId: collectionItemId,
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        include: entryResponseInclude,
      }),
      app.prisma.hobbyMetricReading.findMany({
        where: {
          session: {
            collectionItemId,
            hobbyId,
          },
        },
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        include: {
          metricDefinition: { select: { name: true, unit: true } },
          session: { select: { name: true } },
        },
      }),
    ]);

    const contexts = await resolveEntryEntityContexts(app.prisma, householdId, entries);
    const entryTimeline = entries.map((entry) => {
      const context = contexts.get(`${entry.entityType}:${entry.entityId}`);
      if (!context) {
        throw new Error(`Missing entry context for ${entry.entityType}:${entry.entityId}`);
      }

      return toEntryResponse(entry, context);
    });

    return reply.send(toHobbyCollectionItemDetailResponse(item, {
      childItems: item.childItems,
      sessionHistory: sessions.map((session) => ({
        ...session,
        recipeName: session.recipe?.name ?? null,
        routineName: session.routine?.name ?? null,
      })),
      entryTimeline,
      metricReadings: metricReadings.map((reading) => ({
        id: reading.id,
        metricDefinitionId: reading.metricDefinitionId,
        sessionId: reading.sessionId,
        value: reading.value,
        readingDate: reading.readingDate,
        notes: reading.notes,
        createdAt: reading.createdAt,
        metricName: reading.metricDefinition.name,
        metricUnit: reading.metricDefinition.unit,
        sessionName: reading.session?.name ?? null,
      })),
    }));
  });

  app.patch(`${BASE}/:collectionItemId`, async (request, reply) => {
    const { householdId, hobbyId, collectionItemId } = collectionItemParamsSchema.parse(request.params);
    const input = updateHobbyCollectionItemInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyCollectionItem.findFirst({
      where: { id: collectionItemId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Collection item not found." });
    }

    const nextParentItemId = input.parentItemId === undefined ? existing.parentItemId : input.parentItemId;
    if (nextParentItemId) {
      if (nextParentItemId === existing.id) {
        return reply.code(400).send({ message: "Collection item cannot be its own parent." });
      }

      const parent = await app.prisma.hobbyCollectionItem.findFirst({
        where: { id: nextParentItemId, hobbyId, householdId },
        select: { id: true },
      });
      if (!parent) {
        return reply.code(400).send({ message: "parentItemId must belong to this hobby." });
      }
    }

    const item = await app.prisma.hobbyCollectionItem.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.acquiredDate !== undefined ? { acquiredDate: input.acquiredDate ? new Date(input.acquiredDate) : null } : {}),
        ...(input.retiredDate !== undefined ? { retiredDate: input.retiredDate ? new Date(input.retiredDate) : null } : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl ?? null } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.parentItemId !== undefined ? { parentItemId: input.parentItemId ?? null } : {}),
      },
    });

    await Promise.all([
      logActivity(app.prisma, {
        householdId,
        userId,
        action: "hobby_collection_item_updated",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { collectionItemId: item.id, collectionItemName: item.name },
      }),
      syncHobbyCollectionItemToSearchIndex(app.prisma, item.id),
    ]);

    return reply.send(toHobbyCollectionItemResponse(item));
  });

  app.post(`${BASE}/bulk-status`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = bulkUpdateHobbyCollectionItemStatusInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const items = await app.prisma.hobbyCollectionItem.findMany({
      where: {
        hobbyId,
        householdId,
        ...(input.location ? { location: input.location } : {}),
        ...(input.itemIds ? { id: { in: input.itemIds } } : {}),
      },
      select: { id: true, name: true },
    });

    if (items.length === 0) {
      return reply.send({ updatedCount: 0, items: [] });
    }

    await app.prisma.hobbyCollectionItem.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { status: input.status },
    });

    await Promise.all([
      ...items.map((item) => syncHobbyCollectionItemToSearchIndex(app.prisma, item.id)),
      logActivity(app.prisma, {
        householdId,
        userId,
        action: "hobby_collection_item_bulk_status_updated",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { status: input.status, updatedCount: items.length },
      }),
    ]);

    return reply.send({ updatedCount: items.length, items });
  });

  app.delete(`${BASE}/:collectionItemId`, async (request, reply) => {
    const { householdId, hobbyId, collectionItemId } = collectionItemParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyCollectionItem.findFirst({
      where: { id: collectionItemId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Collection item not found." });
    }

    await app.prisma.hobbyCollectionItem.delete({ where: { id: existing.id } });
    await Promise.all([
      logActivity(app.prisma, {
        householdId,
        userId,
        action: "hobby_collection_item_deleted",
        entityType: "hobby",
        entityId: hobbyId,
        metadata: { collectionItemId: existing.id, collectionItemName: existing.name },
      }),
      removeSearchIndexEntry(app.prisma, "hobby_collection_item", existing.id),
    ]);

    return reply.code(204).send();
  });
};