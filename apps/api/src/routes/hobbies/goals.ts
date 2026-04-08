import { Prisma } from "@prisma/client";
import {
  createHobbyPracticeGoalInputSchema,
  hobbyPracticeGoalListQuerySchema,
  hobbyPracticeGoalListResponseSchema,
  updateHobbyPracticeGoalInputSchema,
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import {
  buildPracticeGoalProgressHistory,
  recalculatePracticeGoalsForHobby,
  toProgressPercentage,
} from "../../lib/hobby-practice.js";
import {
  toHobbyPracticeGoalDetailResponse,
  toHobbyPracticeGoalResponse,
  toHobbyPracticeGoalSummaryResponse,
} from "../../lib/serializers/index.js";
import { syncEntryToSearchIndex } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { hobbyParamsSchema } from "../../lib/schemas.js";

const goalParamsSchema = hobbyParamsSchema.extend({
  goalId: z.string().cuid(),
});

const getScopedHobby = (prisma: { hobby: { findFirst: Function } }, householdId: string, hobbyId: string) => prisma.hobby.findFirst({
  where: { id: hobbyId, householdId },
  select: { id: true },
});

const validateMetricDefinition = async (
  prisma: { hobbyMetricDefinition: { findFirst: Function } },
  hobbyId: string,
  householdId: string,
  metricDefinitionId: string | null | undefined,
) => {
  if (!metricDefinitionId) {
    return null;
  }

  return prisma.hobbyMetricDefinition.findFirst({
    where: {
      id: metricDefinitionId,
      hobbyId,
      hobby: { householdId },
    },
    select: { id: true },
  });
};

export const hobbyGoalRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/goals";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = hobbyPracticeGoalListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const goals = await app.prisma.hobbyPracticeGoal.findMany({
      where: {
        hobbyId,
        householdId,
        ...(query.status ? { status: query.status } : {}),
        ...cursorWhere(query.cursor),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    const { items, nextCursor } = buildCursorPage(goals, query.limit);

    return reply.send(hobbyPracticeGoalListResponseSchema.parse({
      items: items.map((goal) => toHobbyPracticeGoalSummaryResponse(goal, toProgressPercentage(goal.currentValue, goal.targetValue))),
      nextCursor,
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyPracticeGoalInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await getScopedHobby(app.prisma, householdId, hobbyId);
    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    if (input.goalType === "metric_target" && !input.metricDefinitionId) {
      return badRequest(reply, "metricDefinitionId is required for metric_target goals.");
    }

    if (input.metricDefinitionId && !await validateMetricDefinition(app.prisma, hobbyId, householdId, input.metricDefinitionId)) {
      return badRequest(reply, "Metric definition must belong to this hobby.");
    }

    let createdEntryIds: string[] = [];
    const goal = await app.prisma.$transaction(async (tx) => {
      const created = await tx.hobbyPracticeGoal.create({
        data: {
          hobbyId,
          householdId,
          createdById: userId,
          name: input.name,
          description: input.description ?? null,
          goalType: input.goalType,
          targetValue: input.targetValue,
          currentValue: input.currentValue ?? 0,
          unit: input.unit,
          metricDefinitionId: input.metricDefinitionId ?? null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
          status: input.status ?? "active",
          tags: (input.tags ?? []) as Prisma.InputJsonValue,
        },
      });

      if (input.goalType !== "custom") {
        createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
        return tx.hobbyPracticeGoal.findUniqueOrThrow({ where: { id: created.id } });
      }

      const nextStatus = (input.currentValue ?? 0) >= input.targetValue ? "achieved" : (input.status ?? "active");
      if (nextStatus !== created.status) {
        return tx.hobbyPracticeGoal.update({ where: { id: created.id }, data: { status: nextStatus } });
      }

      return created;
    });

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));
        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_goal_created", householdId, { goalId: goal.id, goalName: goal.name });

    return reply.code(201).send(toHobbyPracticeGoalResponse(goal));
  });

  app.get(`${BASE}/:goalId`, async (request, reply) => {
    const { householdId, hobbyId, goalId } = goalParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const goal = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!goal) {
      return notFound(reply, "Practice goal");
    }

    const progressHistory = await buildPracticeGoalProgressHistory(app.prisma, goal);
    return reply.send(toHobbyPracticeGoalDetailResponse(goal, {
      progressPercentage: toProgressPercentage(goal.currentValue, goal.targetValue),
      progressHistory,
    }));
  });

  app.patch(`${BASE}/:goalId`, async (request, reply) => {
    const { householdId, hobbyId, goalId } = goalParamsSchema.parse(request.params);
    const input = updateHobbyPracticeGoalInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!existing) {
      return notFound(reply, "Practice goal");
    }

    const nextGoalType = input.goalType ?? existing.goalType;
    const nextMetricDefinitionId = input.metricDefinitionId === undefined ? existing.metricDefinitionId : input.metricDefinitionId;

    if (nextGoalType === "metric_target" && !nextMetricDefinitionId) {
      return badRequest(reply, "metricDefinitionId is required for metric_target goals.");
    }

    if (nextMetricDefinitionId && !await validateMetricDefinition(app.prisma, hobbyId, householdId, nextMetricDefinitionId)) {
      return badRequest(reply, "Metric definition must belong to this hobby.");
    }

    let createdEntryIds: string[] = [];
    const goal = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.hobbyPracticeGoal.update({
        where: { id: goalId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.goalType !== undefined ? { goalType: input.goalType } : {}),
          ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
          ...(input.currentValue !== undefined ? { currentValue: input.currentValue } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.metricDefinitionId !== undefined ? { metricDefinitionId: input.metricDefinitionId ?? null } : {}),
          ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
          ...(input.targetDate !== undefined ? { targetDate: input.targetDate ? new Date(input.targetDate) : null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}),
        },
      });

      if ((input.goalType ?? existing.goalType) !== "custom" && !["paused", "abandoned"].includes(updated.status)) {
        createdEntryIds = await recalculatePracticeGoalsForHobby(tx, hobbyId);
        return tx.hobbyPracticeGoal.findUniqueOrThrow({ where: { id: updated.id } });
      }

      const currentValue = input.currentValue ?? updated.currentValue;
      const targetValue = input.targetValue ?? updated.targetValue;
      const nextStatus = currentValue >= targetValue && updated.status === "active" ? "achieved" : updated.status;
      if (nextStatus !== updated.status) {
        return tx.hobbyPracticeGoal.update({ where: { id: updated.id }, data: { status: nextStatus } });
      }

      return updated;
    });

    await Promise.all(createdEntryIds.map((entryId) => syncEntryToSearchIndex(app.prisma, entryId)));
        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_goal_updated", householdId, { goalId: goal.id, goalName: goal.name });

    return reply.send(toHobbyPracticeGoalResponse(goal));
  });

  app.delete(`${BASE}/:goalId`, async (request, reply) => {
    const { householdId, hobbyId, goalId } = goalParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!existing) {
      return notFound(reply, "Practice goal");
    }

    await app.prisma.hobbyPracticeGoal.delete({ where: { id: existing.id } });
        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_practice_goal_deleted", householdId, { goalId: existing.id, goalName: existing.name });

    return reply.code(204).send();
  });
};