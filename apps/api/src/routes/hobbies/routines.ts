import {
  createHobbyPracticeRoutineInputSchema,
  hobbyPracticeRoutineComplianceQuerySchema,
  hobbyPracticeRoutineListQuerySchema,
  hobbyPracticeRoutineListResponseSchema,
  updateHobbyPracticeRoutineInputSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { createActivityLogger } from "../../lib/activity-log.js";
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
import { notFound } from "../../lib/errors.js";
import { hobbyParamsSchema } from "../../lib/schemas.js";

const routineParamsSchema = hobbyParamsSchema.extend({
  routineId: z.string().cuid(),
});

export const hobbyRoutineRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/routines";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = hobbyPracticeRoutineListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const routines = await app.prisma.hobbyPracticeRoutine.findMany({
      where: {
        hobbyId,
        householdId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...cursorWhere(query.cursor),
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

    const { items, nextCursor } = buildCursorPage(routines, query.limit);

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

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({ where: { id: hobbyId, householdId }, select: { id: true } });
    if (!hobby) {
      return notFound(reply, "Hobby");
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

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_routine_created", householdId, { routineId: routine.id, routineName: routine.name });

    return reply.code(201).send(toHobbyPracticeRoutineResponse(routine));
  });

  app.get(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
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
      return notFound(reply, "Practice routine");
    }

    const completedDates = routine.sessions.map((session) => session.completedDate ?? session.createdAt);
    return reply.send(toHobbyPracticeRoutineSummaryResponse(routine, buildRoutineSummaryMetrics(routine, completedDates)));
  });

  app.patch(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const input = updateHobbyPracticeRoutineInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
    });
    if (!existing) {
      return notFound(reply, "Practice routine");
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

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_routine_updated", householdId, { routineId: routine.id, routineName: routine.name });

    return reply.send(toHobbyPracticeRoutineResponse(routine));
  });

  app.delete(`${BASE}/:routineId`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyPracticeRoutine.findFirst({
      where: { id: routineId, hobbyId, householdId },
    });
    if (!existing) {
      return notFound(reply, "Practice routine");
    }

    await app.prisma.hobbyPracticeRoutine.delete({ where: { id: existing.id } });
        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_routine_deleted", householdId, { routineId: existing.id, routineName: existing.name });

    return reply.code(204).send();
  });

  app.get(`${BASE}/:routineId/compliance`, async (request, reply) => {
    const { householdId, hobbyId, routineId } = routineParamsSchema.parse(request.params);
    const query = hobbyPracticeRoutineComplianceQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
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
      return notFound(reply, "Practice routine");
    }

    const completedDates = routine.sessions.map((session) => session.completedDate ?? session.createdAt);
    const summary = buildRoutineComplianceSummary(routine, completedDates, new Date(query.startDate), new Date(query.endDate));

    return reply.send(toHobbyPracticeRoutineComplianceSummaryResponse(summary));
  });
};