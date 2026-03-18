import { Prisma } from "@prisma/client";
import {
  createHobbySeriesInputSchema,
  hobbySeriesComparisonSchema,
  hobbySeriesDetailSchema,
  linkHobbySeriesSessionInputSchema,
  seriesStatusSchema,
  updateHobbySeriesInputSchema,
  updateHobbySeriesSessionInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import {
  createEntryEntityKey,
  resolveEntryEntityContexts
} from "../../lib/entries.js";
import {
  getNextHobbySeriesBatchNumber,
  syncHobbySeriesBatchCount,
  updateHobbySessionSeriesLink
} from "../../lib/hobby-series.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import {
  entryResponseInclude,
  toEntryResponse,
  toHobbySeriesSummaryResponse,
  toSessionResponse,
  type EntryResponseRecord
} from "../../lib/serializers/index.js";
import {
  removeSearchIndexEntry,
  syncHobbySeriesToSearchIndex
} from "../../lib/search-index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

const seriesParamsSchema = hobbyParamsSchema.extend({
  seriesId: z.string().cuid()
});

const seriesSessionParamsSchema = seriesParamsSchema.extend({
  sessionId: z.string().cuid()
});

const listSeriesQuerySchema = z.object({
  status: seriesStatusSchema.optional(),
  search: z.string().optional(),
  includeArchived: z.coerce.boolean().default(false)
});

const seriesSummaryInclude = Prisma.validator<Prisma.HobbySeriesInclude>()({
  bestBatchSession: {
    select: { name: true }
  },
  sessions: {
    select: {
      completedDate: true,
      startDate: true,
      createdAt: true
    }
  }
});

const seriesComparisonEntryTypes = ["comparison", "observation"] as const;

const sessionDate = (session: { completedDate: Date | null; startDate: Date | null; createdAt: Date }) => (
  session.completedDate ?? session.startDate ?? session.createdAt
);

const serializeEntries = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  householdId: string,
  entries: EntryResponseRecord[]
) => {
  if (entries.length === 0) {
    return [];
  }

  const contexts = await resolveEntryEntityContexts(
    prisma,
    householdId,
    entries.map((entry) => ({ entityType: entry.entityType, entityId: entry.entityId }))
  );

  return entries.flatMap((entry) => {
    const context = contexts.get(createEntryEntityKey(entry.entityType, entry.entityId));
    return context ? [toEntryResponse(entry, context)] : [];
  });
};

const ensureHobbyExists = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  householdId: string,
  hobbyId: string
) => prisma.hobby.findFirst({
  where: { id: hobbyId, householdId },
  select: { id: true, householdId: true }
});

export const hobbySeriesRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/series";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = listSeriesQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await ensureHobbyExists(app.prisma, householdId, hobbyId);
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const where: Prisma.HobbySeriesWhereInput = {
      hobbyId,
      householdId,
      ...(query.status ? { status: query.status } : {}),
      ...(!query.includeArchived && !query.status ? { status: { not: "archived" } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {})
    };

    const series = await app.prisma.hobbySeries.findMany({
      where,
      include: seriesSummaryInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });

    const items = series
      .map((record) => toHobbySeriesSummaryResponse(record))
      .sort((left, right) => {
        const leftTime = left.lastSessionDate ? Date.parse(left.lastSessionDate) : 0;
        const rightTime = right.lastSessionDate ? Date.parse(right.lastSessionDate) : 0;
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      });

    return reply.send(items);
  });

  app.get(`${BASE}/:seriesId`, async (request, reply) => {
    const { householdId, hobbyId, seriesId } = seriesParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const series = await app.prisma.hobbySeries.findFirst({
      where: { id: seriesId, hobbyId, householdId },
      include: {
        ...seriesSummaryInclude,
        sessions: {
          orderBy: [{ batchNumber: "asc" }, { createdAt: "asc" }],
          include: {
            recipe: { select: { id: true, name: true } },
            metricReadings: {
              orderBy: [{ readingDate: "desc" }, { id: "desc" }],
              include: {
                metricDefinition: {
                  select: {
                    id: true,
                    name: true,
                    unit: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!series) {
      return reply.code(404).send({ message: "Series not found" });
    }

    const entries = await app.prisma.entry.findMany({
      where: {
        householdId,
        entityType: "hobby_series",
        entityId: seriesId
      },
      include: entryResponseInclude,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }]
    });

    const serializedEntries = await serializeEntries(app.prisma, householdId, entries);

    return reply.send(hobbySeriesDetailSchema.parse({
      ...toHobbySeriesSummaryResponse(series),
      sessions: series.sessions.map((session) => ({
        id: session.id,
        hobbyId: session.hobbyId,
        recipeId: session.recipeId,
        seriesId: session.seriesId,
        batchNumber: session.batchNumber,
        name: session.name,
        date: sessionDate(session)?.toISOString() ?? null,
        status: session.status,
        rating: session.rating,
        recipeName: session.recipe?.name ?? null,
        metricReadings: session.metricReadings.map((reading) => ({
          id: reading.id,
          metricDefinitionId: reading.metricDefinitionId,
          metricName: reading.metricDefinition.name,
          metricUnit: reading.metricDefinition.unit,
          value: reading.value,
          readingDate: reading.readingDate.toISOString(),
          notes: reading.notes,
          createdAt: reading.createdAt.toISOString()
        }))
      })),
      entries: serializedEntries
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbySeriesInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await ensureHobbyExists(app.prisma, householdId, hobbyId);
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const sessionIds = Array.from(new Set(input.sessionIds ?? []));
    if (sessionIds.length > 0) {
      const sessions = await app.prisma.hobbySession.findMany({
        where: {
          id: { in: sessionIds },
          hobbyId,
          hobby: { householdId }
        },
        select: {
          id: true,
          seriesId: true
        }
      });

      if (sessions.length !== sessionIds.length) {
        return reply.code(404).send({ message: "One or more sessions were not found." });
      }

      if (sessions.some((session) => session.seriesId !== null)) {
        return reply.code(400).send({ message: "One or more sessions already belong to a series." });
      }
    }

    const series = await app.prisma.$transaction(async (tx) => {
      const created = await tx.hobbySeries.create({
        data: {
          hobbyId,
          householdId,
          name: input.name,
          description: input.description ?? null,
          status: input.status ?? "active",
          tags: toInputJsonValue(input.tags ?? []),
          notes: input.notes ?? null,
          coverImageUrl: input.coverImageUrl ?? null
        }
      });

      for (const [index, sessionId] of sessionIds.entries()) {
        await updateHobbySessionSeriesLink(tx, sessionId, created.id, index + 1);
      }

      return tx.hobbySeries.findUniqueOrThrow({
        where: { id: created.id },
        include: seriesSummaryInclude
      });
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_created",
      entityType: "hobby_series",
      entityId: series.id,
      metadata: { hobbyId, name: series.name, linkedSessionCount: sessionIds.length }
    });

    await syncHobbySeriesToSearchIndex(app.prisma, series.id);

    return reply.code(201).send(toHobbySeriesSummaryResponse(series));
  });

  app.patch(`${BASE}/:seriesId`, async (request, reply) => {
    const { householdId, hobbyId, seriesId } = seriesParamsSchema.parse(request.params);
    const input = updateHobbySeriesInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySeries.findFirst({
      where: { id: seriesId, hobbyId, householdId },
      include: seriesSummaryInclude
    });

    if (!existing) {
      return reply.code(404).send({ message: "Series not found" });
    }

    if (input.bestBatchSessionId) {
      const bestBatch = await app.prisma.hobbySession.findFirst({
        where: {
          id: input.bestBatchSessionId,
          seriesId: existing.id
        },
        select: { id: true }
      });

      if (!bestBatch) {
        return reply.code(400).send({ message: "bestBatchSessionId must reference a session in this series." });
      }
    }

    const updated = await app.prisma.hobbySeries.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: toInputJsonValue(input.tags) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
        ...(input.bestBatchSessionId !== undefined ? { bestBatchSessionId: input.bestBatchSessionId } : {})
      },
      include: seriesSummaryInclude
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_updated",
      entityType: "hobby_series",
      entityId: updated.id,
      metadata: { hobbyId, name: updated.name }
    });

    await syncHobbySeriesToSearchIndex(app.prisma, updated.id);

    return reply.send(toHobbySeriesSummaryResponse(updated));
  });

  app.delete(`${BASE}/:seriesId`, async (request, reply) => {
    const { householdId, hobbyId, seriesId } = seriesParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbySeries.findFirst({
      where: { id: seriesId, hobbyId, householdId },
      select: {
        id: true,
        name: true
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Series not found" });
    }

    const linkedEntries = await app.prisma.entry.findMany({
      where: {
        householdId,
        entityType: "hobby_series",
        entityId: seriesId
      },
      select: { id: true }
    });

    await app.prisma.$transaction(async (tx) => {
      await tx.hobbySession.updateMany({
        where: { seriesId },
        data: {
          seriesId: null,
          batchNumber: null
        }
      });

      await tx.hobbySeries.delete({ where: { id: seriesId } });
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_deleted",
      entityType: "hobby_series",
      entityId: seriesId,
      metadata: { hobbyId, name: existing.name }
    });

    await Promise.all([
      removeSearchIndexEntry(app.prisma, "hobby_series", seriesId),
      ...linkedEntries.map((entry) => removeSearchIndexEntry(app.prisma, "entry", entry.id))
    ]);

    return reply.code(204).send();
  });

  app.post(`${BASE}/:seriesId/sessions`, async (request, reply) => {
    const { householdId, hobbyId, seriesId } = seriesParamsSchema.parse(request.params);
    const input = linkHobbySeriesSessionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const [series, session] = await Promise.all([
      app.prisma.hobbySeries.findFirst({
        where: { id: seriesId, hobbyId, householdId },
        select: { id: true, name: true }
      }),
      app.prisma.hobbySession.findFirst({
        where: { id: input.sessionId, hobbyId, hobby: { householdId } },
        select: {
          id: true,
          seriesId: true
        }
      })
    ]);

    if (!series) {
      return reply.code(404).send({ message: "Series not found" });
    }
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }
    if (session.seriesId === seriesId) {
      return reply.code(400).send({ message: "Session is already linked to this series." });
    }
    if (session.seriesId) {
      return reply.code(400).send({ message: "Session already belongs to a different series." });
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const batchNumber = await getNextHobbySeriesBatchNumber(tx, seriesId);
      return updateHobbySessionSeriesLink(tx, input.sessionId, seriesId, batchNumber);
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_session_linked",
      entityType: "hobby_series",
      entityId: seriesId,
      metadata: { hobbyId, sessionId: updated.id, batchNumber: updated.batchNumber }
    });

    await syncHobbySeriesToSearchIndex(app.prisma, seriesId);

    return reply.code(201).send(toSessionResponse(updated));
  });

  app.delete(`${BASE}/:seriesId/sessions/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, seriesId, sessionId } = seriesSessionParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const session = await app.prisma.hobbySession.findFirst({
      where: {
        id: sessionId,
        hobbyId,
        hobby: { householdId },
        seriesId
      },
      select: { id: true }
    });

    if (!session) {
      return reply.code(404).send({ message: "Session not found in this series." });
    }

    await app.prisma.$transaction(async (tx) => {
      await updateHobbySessionSeriesLink(tx, sessionId, null, null);
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_session_unlinked",
      entityType: "hobby_series",
      entityId: seriesId,
      metadata: { hobbyId, sessionId }
    });

    await syncHobbySeriesToSearchIndex(app.prisma, seriesId);

    return reply.code(204).send();
  });

  app.patch(`${BASE}/:seriesId/sessions/:sessionId`, async (request, reply) => {
    const { householdId, hobbyId, seriesId, sessionId } = seriesSessionParamsSchema.parse(request.params);
    const input = updateHobbySeriesSessionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const [session, conflictingBatch] = await Promise.all([
      app.prisma.hobbySession.findFirst({
        where: {
          id: sessionId,
          hobbyId,
          hobby: { householdId },
          seriesId
        },
        select: { id: true }
      }),
      app.prisma.hobbySession.findFirst({
        where: {
          id: { not: sessionId },
          seriesId,
          batchNumber: input.batchNumber
        },
        select: { id: true }
      })
    ]);

    if (!session) {
      return reply.code(404).send({ message: "Session not found in this series." });
    }
    if (conflictingBatch) {
      return reply.code(409).send({ message: "Another session already uses that batchNumber." });
    }

    const updated = await app.prisma.hobbySession.update({
      where: { id: sessionId },
      data: { batchNumber: input.batchNumber }
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_series_session_reordered",
      entityType: "hobby_series",
      entityId: seriesId,
      metadata: { hobbyId, sessionId, batchNumber: input.batchNumber }
    });

    await syncHobbySeriesToSearchIndex(app.prisma, seriesId);

    return reply.send(toSessionResponse(updated));
  });

  app.get(`${BASE}/:seriesId/compare`, async (request, reply) => {
    const { householdId, hobbyId, seriesId } = seriesParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const series = await app.prisma.hobbySeries.findFirst({
      where: { id: seriesId, hobbyId, householdId },
      include: seriesSummaryInclude
    });

    if (!series) {
      return reply.code(404).send({ message: "Series not found" });
    }

    const sessions = await app.prisma.hobbySession.findMany({
      where: { seriesId: series.id },
      orderBy: [{ batchNumber: "asc" }, { createdAt: "asc" }],
      include: {
        recipe: { select: { name: true } },
        metricReadings: {
          orderBy: [{ metricDefinition: { name: "asc" } }, { readingDate: "desc" }, { id: "desc" }],
          include: {
            metricDefinition: {
              select: {
                id: true,
                name: true,
                unit: true
              }
            }
          }
        }
      }
    });

    const comparisonEntries = await app.prisma.entry.findMany({
      where: {
        householdId,
        entityType: "hobby_session",
        entityId: { in: sessions.map((session) => session.id) },
        entryType: { in: [...seriesComparisonEntryTypes] }
      },
      include: entryResponseInclude,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }]
    });

    const serializedEntries = await serializeEntries(app.prisma, householdId, comparisonEntries);
    const entriesBySessionId = serializedEntries.reduce((map, entry) => {
      const existing = map.get(entry.entityId) ?? [];
      existing.push(entry);
      map.set(entry.entityId, existing);
      return map;
    }, new Map<string, typeof serializedEntries>());

    return reply.send(hobbySeriesComparisonSchema.parse({
      series: toHobbySeriesSummaryResponse(series),
      sessions: sessions.map((session) => {
        const metricGroups = session.metricReadings.reduce((groups, reading) => {
          const key = reading.metricDefinitionId;
          const existing = groups.get(key) ?? {
            metricDefinitionId: reading.metricDefinitionId,
            metricName: reading.metricDefinition.name,
            metricUnit: reading.metricDefinition.unit,
            readings: [] as Array<{
              id: string;
              value: number;
              readingDate: string;
              notes: string | null;
              createdAt: string;
            }>
          };

          existing.readings.push({
            id: reading.id,
            value: reading.value,
            readingDate: reading.readingDate.toISOString(),
            notes: reading.notes,
            createdAt: reading.createdAt.toISOString()
          });
          groups.set(key, existing);
          return groups;
        }, new Map<string, {
          metricDefinitionId: string;
          metricName: string;
          metricUnit: string;
          readings: Array<{
            id: string;
            value: number;
            readingDate: string;
            notes: string | null;
            createdAt: string;
          }>;
        }>());

        return {
          sessionId: session.id,
          name: session.name,
          batchNumber: session.batchNumber,
          date: sessionDate(session)?.toISOString() ?? null,
          status: session.status,
          rating: session.rating,
          recipeName: session.recipe?.name ?? null,
          metricGroups: Array.from(metricGroups.values()),
          entries: entriesBySessionId.get(session.id) ?? []
        };
      })
    }));
  });
};