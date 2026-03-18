import { Prisma } from "@prisma/client";
import {
  createHobbyPracticeGoalInputSchema,
  hobbyPracticeGoalListQuerySchema,
  hobbyPracticeGoalListResponseSchema,
  updateHobbyPracticeGoalInputSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
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

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
});

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

    if (!await checkMembership(app.prisma, householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const goals = await app.prisma.hobbyPracticeGoal.findMany({
      where: {
        hobbyId,
        householdId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
    });

    const hasMore = goals.length > query.limit;
    const items = hasMore ? goals.slice(0, query.limit) : goals;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return reply.send(hobbyPracticeGoalListResponseSchema.parse({
      items: items.map((goal) => toHobbyPracticeGoalSummaryResponse(goal, toProgressPercentage(goal.currentValue, goal.targetValue))),
      nextCursor,
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyPracticeGoalInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await getScopedHobby(app.prisma, householdId, hobbyId);
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found." });
    }

    if (input.goalType === "metric_target" && !input.metricDefinitionId) {
      return reply.code(400).send({ message: "metricDefinitionId is required for metric_target goals." });
    }

    if (input.metricDefinitionId && !await validateMetricDefinition(app.prisma, hobbyId, householdId, input.metricDefinitionId)) {
      return reply.code(400).send({ message: "Metric definition must belong to this hobby." });
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
    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_goal_created",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { goalId: goal.id, goalName: goal.name },
    });

    return reply.code(201).send(toHobbyPracticeGoalResponse(goal));
  });

  app.get(`${BASE}/:goalId`, async (request, reply) => {
    const { householdId, hobbyId, goalId } = goalParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const goal = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!goal) {
      return reply.code(404).send({ message: "Practice goal not found." });
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

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Practice goal not found." });
    }

    const nextGoalType = input.goalType ?? existing.goalType;
    const nextMetricDefinitionId = input.metricDefinitionId === undefined ? existing.metricDefinitionId : input.metricDefinitionId;

    if (nextGoalType === "metric_target" && !nextMetricDefinitionId) {
      return reply.code(400).send({ message: "metricDefinitionId is required for metric_target goals." });
    }

    if (nextMetricDefinitionId && !await validateMetricDefinition(app.prisma, hobbyId, householdId, nextMetricDefinitionId)) {
      return reply.code(400).send({ message: "Metric definition must belong to this hobby." });
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
    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_goal_updated",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { goalId: goal.id, goalName: goal.name },
    });

    return reply.send(toHobbyPracticeGoalResponse(goal));
  });

  app.delete(`${BASE}/:goalId`, async (request, reply) => {
    const { householdId, hobbyId, goalId } = goalParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyPracticeGoal.findFirst({
      where: { id: goalId, hobbyId, householdId },
    });
    if (!existing) {
      return reply.code(404).send({ message: "Practice goal not found." });
    }

    await app.prisma.hobbyPracticeGoal.delete({ where: { id: existing.id } });
    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "hobby_practice_goal_deleted",
      entityType: "hobby",
      entityId: hobbyId,
      metadata: { goalId: existing.id, goalName: existing.name },
    });

    return reply.code(204).send();
  });
};