import {
  createHobbyLogInputSchema,
  updateHobbyLogInputSchema,
  hobbyLogTypeSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

const logParamsSchema = hobbyParamsSchema.extend({
  logId: z.string().cuid()
});

const listLogsQuerySchema = z.object({
  sessionId: z.string().cuid().optional(),
  logType: hobbyLogTypeSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

const toLogResponse = (log: {
  id: string;
  hobbyId: string;
  sessionId: string | null;
  title: string | null;
  content: string;
  logDate: Date;
  logType: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: log.id,
  hobbyId: log.hobbyId,
  sessionId: log.sessionId,
  title: log.title,
  content: log.content,
  logDate: log.logDate.toISOString(),
  logType: log.logType,
  createdAt: log.createdAt.toISOString(),
  updatedAt: log.updatedAt.toISOString(),
});

export const hobbyLogRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/logs";

  // GET .../logs
  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = listLogsQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const limit = query.limit ?? 50;

    const logs = await app.prisma.hobbyLog.findMany({
      where: {
        hobbyId,
        hobby: { householdId },
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.logType ? { logType: query.logType } : {}),
        ...(query.startDate || query.endDate ? {
          logDate: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          }
        } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {})
      },
      orderBy: { logDate: "desc" },
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    return reply.send({
      items: items.map(toLogResponse),
      nextCursor,
    });
  });

  // POST .../logs
  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyLogInputSchema.parse(request.body);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ error: "Hobby not found" });
    }

    const log = await app.prisma.hobbyLog.create({
      data: {
        hobbyId,
        sessionId: input.sessionId ?? null,
        title: input.title ?? null,
        content: input.content,
        logDate: new Date(input.logDate),
        logType: input.logType ?? "note",
      }
    });

    return reply.code(201).send(toLogResponse(log));
  });

  // PATCH .../logs/:logId
  app.patch(`${BASE}/:logId`, async (request, reply) => {
    const { householdId, hobbyId, logId } = logParamsSchema.parse(request.params);
    const input = updateHobbyLogInputSchema.parse(request.body);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.hobbyLog.findFirst({
      where: { id: logId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ error: "Log entry not found" });
    }

    const log = await app.prisma.hobbyLog.update({
      where: { id: logId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.logDate !== undefined ? { logDate: new Date(input.logDate) } : {}),
        ...(input.logType !== undefined ? { logType: input.logType } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      }
    });

    return reply.send(toLogResponse(log));
  });

  // DELETE .../logs/:logId
  app.delete(`${BASE}/:logId`, async (request, reply) => {
    const { householdId, hobbyId, logId } = logParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.hobbyLog.findFirst({
      where: { id: logId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ error: "Log entry not found" });
    }

    await app.prisma.hobbyLog.delete({ where: { id: logId } });

    return reply.code(204).send();
  });
};
