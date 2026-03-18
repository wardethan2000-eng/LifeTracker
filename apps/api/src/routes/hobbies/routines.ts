import {
  createHobbyPracticeRoutineInputSchema,
  hobbyPracticeRoutineComplianceQuerySchema,
  hobbyPracticeRoutineListQuerySchema,
  hobbyPracticeRoutineListResponseSchema,
  updateHobbyPracticeRoutineInputSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import {
  buildRoutineComplianceSummary,
  buildRoutineSummaryMetrics,
  recalculatePracticeRoutine,
} from "../../lib/hobby-practice.js";
import {
  toHobbyPracticeRoutineComplianceSummaryResponse,
  toHobbyPracticeRoutineResponse,
  toHobbyPracticeRoutineSummaryResponse,
} from "../../lib/serializers/index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
});

const routineParamsSchema = hobbyParamsSchema.extend({
  routineId: z.string().cuid(),
});

export const hobbyRoutineRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/routines";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = hobbyPracticeRoutineListQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const routines = await app.prisma.hobbyPracticeRoutine.findMany({
      where: {
        hobbyId,
        householdId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      include: {
        sessions: {
          where: {
            OR: [
              { status: "completed" },
              { completedDate: { not: null } },
            ],
          },
          select: {
            completedDate: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = routines.length > query.limit;
    const items = hasMore ? routines.slice(0, query.limit) : routines;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return reply.send(hobbyPracticeRoutineListResponseSchema.parse({
      items: items.map((routine) => {
        const completedDates = routine.sessions.map((session) => session.completedDate ?? session.createdAt);
        const summary = buildRoutineSummaryMetrics(routine, completedDates);
        return toHobbyPracticeRoutineSummaryResponse(routine, summary);
      }),
      nextCursor,
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyPracticeRoutineInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({ where: { id: hobbyId, householdId }, select: { id: true } });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found." });
    }

    const routine = await app.prisma.hobbyPracticeRoutine.create({
      data: {
        hobbyId,
        householdId,
        createdById: userId,
        name: input.name,
        description: input.description ?? null,
        targetDurationMinutes: input.targetDurationMinutes ?? null,
        targetFrequency: input.targetFrequency,
        targetSessionsPerPeriod: input.targetSessionsPerPeriod ?? 1,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_routine_created",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { routineId: routine.id, routineName: routine.name },
    });

    return reply.code(201).send(toHobbyPracticeRoutineResponse(routine));
  });

  app.get(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const routine = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
      include: {
        sessions: {
          where: {
            OR: [
              { status: "completed" },
              { completedDate: { not: null } },
            ],
          },
          select: {
            completedDate: true,
            createdAt: true,
          },
        },
      },
    });
    if (!routine) {
      return reply.code(404).send({ message: "Practice routine not found." });
    }

    const completedDates = routine.sessions.map((session) => session.completedDate ?? session.createdAt);
    return reply.send(toHobbyPracticeRoutineSummaryResponse(routine, buildRoutineSummaryMetrics(routine, completedDates)));
  });

  app.patch(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const input = updateHobbyPracticeRoutineInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Practice routine not found." });
    }

    await app.prisma.hobbyPracticeRoutine.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.targetDurationMinutes !== undefined ? { targetDurationMinutes: input.targetDurationMinutes ?? null } : {}),
        ...(input.targetFrequency !== undefined ? { targetFrequency: input.targetFrequency } : {}),
        ...(input.targetSessionsPerPeriod !== undefined ? { targetSessionsPerPeriod: input.targetSessionsPerPeriod } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    });

    const routine = await recalculatePracticeRoutine(app.prisma, existing.id) ?? await app.prisma.hobbyPracticeRoutine.findUniqueOrThrow({ where: { id: existing.id } });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_routine_updated",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { routineId: routine.id, routineName: routine.name },
    });

    return reply.send(toHobbyPracticeRoutineResponse(routine));
  });

  app.delete(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Practice routine not found." });
    }

    await app.prisma.hobbyPracticeRoutine.delete({ where: { id: existing.id } });
    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_routine_deleted",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { routineId: existing.id, routineName: existing.name },
    });

    return reply.code(204).send();
  });

  app.get(`${BASE}/:routineId/compliance`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const query = hobbyPracticeRoutineComplianceQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const routine = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
      include: {
        sessions: {
          where: {
            OR: [
              { status: "completed" },
              { completedDate: { not: null } },
            ],
          },
          select: {
            completedDate: true,
            createdAt: true,
          },
        },
      },
    });
    if (!routine) {
      return reply.code(404).send({ message: "Practice routine not found." });
    }

    const completedDates = routine.sessions.map((session) => session.completedDate ?? session.createdAt);
    const summary = buildRoutineComplianceSummary(routine, completedDates, new Date(query.startDate), new Date(query.endDate));

    return reply.send(toHobbyPracticeRoutineComplianceSummaryResponse(summary));
  });
};