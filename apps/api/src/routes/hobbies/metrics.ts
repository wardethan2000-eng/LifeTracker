import {
  createHobbyMetricDefinitionInputSchema,
  updateHobbyMetricDefinitionInputSchema,
  createHobbyMetricReadingInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { recalculatePracticeGoalsForHobby } from "../../lib/hobby-practice.js";
import {
  toHobbyMetricDefinitionResponse,
  toHobbyMetricReadingPageResponse,
  toHobbyMetricReadingResponse
} from "../../lib/serializers/index.js";
import { syncEntryToSearchIndex } from "../../lib/search-index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

const metricParamsSchema = hobbyParamsSchema.extend({
  metricId: z.string().cuid()
});

const readingParamsSchema = metricParamsSchema.extend({
  readingId: z.string().cuid()
});

const listReadingsQuerySchema = z.object({
  sessionId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

export const hobbyMetricRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/metrics";

  // GET .../metrics
  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const metrics = await app.prisma.hobbyMetricDefinition.findMany({
      where: { hobbyId, hobby: { householdId } },
      orderBy: { name: "asc" }
    });

    return reply.send(metrics.map(toHobbyMetricDefinitionResponse));
  });

  // POST .../metrics
  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyMetricDefinitionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const metric = await app.prisma.hobbyMetricDefinition.create({
      data: {
        hobbyId,
        name: input.name,
        unit: input.unit,
        description: input.description ?? null,
        metricType: input.metricType ?? "numeric",
      }
    });

    return reply.code(201).send(toHobbyMetricDefinitionResponse(metric));
  });

  // PATCH .../metrics/:metricId
  app.patch(`${BASE}/:metricId`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const input = updateHobbyMetricDefinitionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Metric definition not found" });
    }

    const metric = await app.prisma.hobbyMetricDefinition.update({
      where: { id: metricId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.metricType !== undefined ? { metricType: input.metricType } : {}),
      }
    });

    return reply.send(toHobbyMetricDefinitionResponse(metric));
  });

  // DELETE .../metrics/:metricId
  app.delete(`${BASE}/:metricId`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Metric definition not found" });
    }

    await app.prisma.hobbyMetricDefinition.delete({ where: { id: metricId } });

    return reply.code(204).send();
  });

  // GET .../metrics/:metricId/readings
  app.get(`${BASE}/:metricId/readings`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const query = listReadingsQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const limit = query.limit ?? 50;

    const readings = await app.prisma.hobbyMetricReading.findMany({
      where: {
        metricDefinitionId: metricId,
        metricDefinition: { hobbyId, hobby: { householdId } },
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.startDate || query.endDate ? {
          readingDate: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          }
        } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {})
      },
      orderBy: { readingDate: "desc" },
      take: limit + 1,
    });

    const hasMore = readings.length > limit;
    const items = hasMore ? readings.slice(0, limit) : readings;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return reply.send(toHobbyMetricReadingPageResponse({
      items,
      nextCursor
    }));
  });

  // POST .../metrics/:metricId/readings
  app.post(`${BASE}/:metricId/readings`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const input = createHobbyMetricReadingInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const metric = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!metric) {
      return reply.code(404).send({ message: "Metric definition not found" });
    }

    if (input.sessionId) {
      const session = await app.prisma.hobbySession.findFirst({
        where: { id: input.sessionId, hobbyId, hobby: { householdId } },
        select: { id: true },
      });
      if (!session) {
        return reply.code(400).send({ message: "Session must belong to this hobby." });
      }
    }

    let createdEntryIds: string[] = [];
    const reading = await app.prisma.$transaction(async (tx) => {
      const created = await tx.hobbyMetricReading.create({
        data: {
          metricDefinitionId: metricId,
          sessionId: input.sessionId ?? null,
          value: input.value,
          readingDate: new Date(input.readingDate),
          notes: input.notes ?? null,
        }
      });

      createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
      return created;
    });

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));

    return reply.code(201).send(toHobbyMetricReadingResponse(reading));
  });

  // DELETE .../metrics/:metricId/readings/:readingId
  app.delete(`${BASE}/:metricId/readings/:readingId`, async (request, reply) => {
    const { householdId, hobbyId, metricId, readingId } = readingParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyMetricReading.findFirst({
      where: {
        id: readingId,
        metricDefinitionId: metricId,
        metricDefinition: { hobbyId, hobby: { householdId } }
      }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Reading not found" });
    }

    let createdEntryIds: string[] = [];
    await app.prisma.$transaction(async (tx) => {
      await tx.hobbyMetricReading.delete({ where: { id: readingId } });
      createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
    });

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));

    return reply.code(204).send();
  });
};

