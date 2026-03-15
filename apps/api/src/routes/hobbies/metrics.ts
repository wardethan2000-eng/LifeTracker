import {
  createHobbyMetricDefinitionInputSchema,
  updateHobbyMetricDefinitionInputSchema,
  createHobbyMetricReadingInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";

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

    await assertMembership(app.prisma, householdId, userId);

    const metrics = await app.prisma.hobbyMetricDefinition.findMany({
      where: { hobbyId, hobby: { householdId } },
      orderBy: { name: "asc" }
    });

    return reply.send(metrics.map((m) => ({
      id: m.id,
      hobbyId: m.hobbyId,
      name: m.name,
      unit: m.unit,
      description: m.description,
      metricType: m.metricType,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })));
  });

  // POST .../metrics
  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyMetricDefinitionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ error: "Hobby not found" });
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

    return reply.code(201).send({
      id: metric.id,
      hobbyId: metric.hobbyId,
      name: metric.name,
      unit: metric.unit,
      description: metric.description,
      metricType: metric.metricType,
      createdAt: metric.createdAt.toISOString(),
      updatedAt: metric.updatedAt.toISOString(),
    });
  });

  // PATCH .../metrics/:metricId
  app.patch(`${BASE}/:metricId`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const input = updateHobbyMetricDefinitionInputSchema.parse(request.body);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ error: "Metric definition not found" });
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

    return reply.send({
      id: metric.id,
      hobbyId: metric.hobbyId,
      name: metric.name,
      unit: metric.unit,
      description: metric.description,
      metricType: metric.metricType,
      createdAt: metric.createdAt.toISOString(),
      updatedAt: metric.updatedAt.toISOString(),
    });
  });

  // DELETE .../metrics/:metricId
  app.delete(`${BASE}/:metricId`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ error: "Metric definition not found" });
    }

    await app.prisma.hobbyMetricDefinition.delete({ where: { id: metricId } });

    return reply.code(204).send();
  });

  // GET .../metrics/:metricId/readings
  app.get(`${BASE}/:metricId/readings`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const query = listReadingsQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

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

    return reply.send({
      items: items.map((r) => ({
        id: r.id,
        metricDefinitionId: r.metricDefinitionId,
        sessionId: r.sessionId,
        value: r.value,
        readingDate: r.readingDate.toISOString(),
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    });
  });

  // POST .../metrics/:metricId/readings
  app.post(`${BASE}/:metricId/readings`, async (request, reply) => {
    const { householdId, hobbyId, metricId } = metricParamsSchema.parse(request.params);
    const input = createHobbyMetricReadingInputSchema.parse(request.body);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const metric = await app.prisma.hobbyMetricDefinition.findFirst({
      where: { id: metricId, hobbyId, hobby: { householdId } }
    });
    if (!metric) {
      return reply.code(404).send({ error: "Metric definition not found" });
    }

    const reading = await app.prisma.hobbyMetricReading.create({
      data: {
        metricDefinitionId: metricId,
        sessionId: input.sessionId ?? null,
        value: input.value,
        readingDate: new Date(input.readingDate),
        notes: input.notes ?? null,
      }
    });

    return reply.code(201).send({
      id: reading.id,
      metricDefinitionId: reading.metricDefinitionId,
      sessionId: reading.sessionId,
      value: reading.value,
      readingDate: reading.readingDate.toISOString(),
      notes: reading.notes,
      createdAt: reading.createdAt.toISOString(),
    });
  });

  // DELETE .../metrics/:metricId/readings/:readingId
  app.delete(`${BASE}/:metricId/readings/:readingId`, async (request, reply) => {
    const { householdId, hobbyId, metricId, readingId } = readingParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.hobbyMetricReading.findFirst({
      where: {
        id: readingId,
        metricDefinitionId: metricId,
        metricDefinition: { hobbyId, hobby: { householdId } }
      }
    });
    if (!existing) {
      return reply.code(404).send({ error: "Reading not found" });
    }

    await app.prisma.hobbyMetricReading.delete({ where: { id: readingId } });

    return reply.code(204).send();
  });
};
