import type { Prisma } from "@prisma/client";
import {
  createHobbyProjectInputSchema,
  createHobbyProjectInventoryItemInputSchema,
  createHobbyProjectMilestoneInputSchema,
  createHobbyProjectWorkLogInputSchema,
  hobbyProjectListQuerySchema,
  hobbyProjectListResponseSchema,
  hobbyProjectWorkLogListQuerySchema,
  hobbyProjectWorkLogListResponseSchema,
  reorderHobbyProjectMilestonesInputSchema,
  updateHobbyProjectInputSchema,
  updateHobbyProjectInventoryItemInputSchema,
  updateHobbyProjectMilestoneInputSchema,
  updateHobbyProjectWorkLogInputSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCursorPage, cursorWhere } from "../../lib/pagination.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import {
  applyInventoryTransaction,
  getHouseholdInventoryItem,
  InventoryError,
} from "../../lib/inventory.js";
import {
  removeSearchIndexEntry,
  syncHobbyProjectToSearchIndex,
} from "../../lib/search-index.js";
import {
  toHobbyProjectDetailResponse,
  toHobbyProjectInventoryItemResponse,
  toHobbyProjectInventoryLinkDetailResponse,
  toHobbyProjectMilestoneResponse,
  toHobbyProjectResponse,
  toHobbyProjectSummaryResponse,
  toHobbyProjectWorkLogResponse,
  toInventoryItemSummaryResponse,
  toInventoryTransactionResponse,
} from "../../lib/serializers/index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { hobbyParamsSchema } from "../../lib/schemas.js";

const hobbyProjectParamsSchema = hobbyParamsSchema.extend({
  projectId: z.string().cuid(),
});

const hobbyProjectMilestoneParamsSchema = hobbyProjectParamsSchema.extend({
  milestoneId: z.string().cuid(),
});

const hobbyProjectWorkLogParamsSchema = hobbyProjectParamsSchema.extend({
  workLogId: z.string().cuid(),
});

const hobbyProjectInventoryItemParamsSchema = hobbyProjectParamsSchema.extend({
  inventoryItemId: z.string().cuid(),
});

const getHobby = (prisma: Prisma.TransactionClient | PrismaClientLike, householdId: string, hobbyId: string) => prisma.hobby.findFirst({
  where: { id: hobbyId, householdId },
  select: { id: true, name: true, householdId: true },
});

type PrismaClientLike = Prisma.TransactionClient & {
  hobby: Prisma.TransactionClient["hobby"];
};

const getHobbyProject = (
  prisma: Prisma.TransactionClient | PrismaClientLike,
  householdId: string,
  hobbyId: string,
  projectId: string
) => prisma.hobbyProject.findFirst({
  where: {
    id: projectId,
    householdId,
    hobbyId,
  },
});

const calculateDaysActive = (project: {
  startDate: Date | null;
  completedDate: Date | null;
  createdAt: Date;
}) => {
  const start = project.startDate ?? project.createdAt;
  const end = project.completedDate ?? new Date();
  const diff = end.getTime() - start.getTime();

  return diff < 0 ? 0 : Math.floor(diff / (1000 * 60 * 60 * 24));
};

const buildProjectStats = (project: {
  milestones: { status: string }[];
  workLogs: { durationMinutes: number | null }[];
}) => {
  const milestoneCount = project.milestones.length;
  const completedMilestoneCount = project.milestones.filter((milestone) => milestone.status === "completed").length;
  const completionPercentage = milestoneCount === 0 ? 0 : (completedMilestoneCount / milestoneCount) * 100;
  const totalLoggedMinutes = project.workLogs.reduce((sum, workLog) => sum + (workLog.durationMinutes ?? 0), 0);

  return {
    milestoneCount,
    completedMilestoneCount,
    completionPercentage,
    totalLoggedHours: totalLoggedMinutes / 60,
  };
};

const maybeSyncProjectSearch = (prisma: PrismaClientLike, projectId: string) => {
  void syncHobbyProjectToSearchIndex(prisma, projectId).catch(console.error);
};

const maybeSyncProjectDeletion = (prisma: PrismaClientLike, projectId: string) => {
  void removeSearchIndexEntry(prisma, "hobby_project", projectId).catch(console.error);
};

const ensureSeriesMatchesHobby = async (
  prisma: PrismaClientLike,
  householdId: string,
  hobbyId: string,
  seriesId: string | null | undefined
) => {
  if (!seriesId) {
    return true;
  }

  const series = await prisma.hobbySeries.findFirst({
    where: { id: seriesId, householdId, hobbyId },
    select: { id: true },
  });

  return Boolean(series);
};

export const hobbyProjectRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/projects";

  app.get(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = hobbyProjectListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const limit = query.limit;
    const orderBy = query.sortBy === "startDate"
      ? [{ startDate: "desc" as const }, { createdAt: "desc" as const }]
      : [{ updatedAt: "desc" as const }];

    const projects = await app.prisma.hobbyProject.findMany({
      where: {
        householdId,
        hobbyId,
        ...(query.status ? { status: query.status } : {}),
        ...cursorWhere(query.cursor),
      },
      orderBy,
      take: limit + 1,
      include: {
        milestones: { select: { status: true } },
        workLogs: { select: { durationMinutes: true } },
      },
    });

    const { items, nextCursor } = buildCursorPage(projects, limit);

    return reply.send(hobbyProjectListResponseSchema.parse({
      items: items.map((project) => toHobbyProjectSummaryResponse(project, buildProjectStats(project))),
      nextCursor,
    }));
  });

  app.post(BASE, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyProjectInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const hobby = await getHobby(app.prisma as PrismaClientLike, householdId, hobbyId);
    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    if (!await ensureSeriesMatchesHobby(app.prisma as PrismaClientLike, householdId, hobbyId, input.seriesId)) {
      return badRequest(reply, "Series must belong to the same hobby.");
    }

    const project = await app.prisma.hobbyProject.create({
      data: {
        hobbyId,
        householdId,
        createdById: userId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "planned",
        startDate: input.startDate ? new Date(input.startDate) : null,
        targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null,
        completedDate: input.completedDate ? new Date(input.completedDate) : null,
        coverImageUrl: input.coverImageUrl ?? null,
        difficulty: input.difficulty ?? null,
        notes: input.notes ?? null,
        tags: (input.tags ?? []) as Prisma.InputJsonValue,
        seriesId: input.seriesId ?? null,
        batchNumber: input.batchNumber ?? null,
      },
    });

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_project_created", householdId, { hobbyProjectId: project.id, hobbyProjectName: project.name });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(201).send(toHobbyProjectResponse(project));
  });

  app.get(`${BASE}/:projectId`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.hobbyProject.findFirst({
      where: { id: projectId, householdId, hobbyId },
      include: {
        milestones: { orderBy: { sortOrder: "asc" } },
        workLogs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 10 },
        inventoryItems: {
          include: { inventoryItem: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const stats = buildProjectStats(project);
    const entryCounts = await app.prisma.entry.groupBy({
      by: ["entryType"],
      where: { householdId, entityType: "hobby_project", entityId: project.id },
      _count: { entryType: true },
    });

    return reply.send(toHobbyProjectDetailResponse(project, {
      milestones: project.milestones,
      recentWorkLogs: project.workLogs,
      inventoryItems: project.inventoryItems,
      totalLoggedHours: stats.totalLoggedHours,
      daysActive: calculateDaysActive(project),
      milestoneCount: stats.milestoneCount,
      completedMilestoneCount: stats.completedMilestoneCount,
      milestoneCompletionPercentage: stats.completionPercentage,
      entryCountsByType: entryCounts.map((entryCount) => ({
        entryType: entryCount.entryType,
        count: entryCount._count.entryType,
      })),
    }));
  });

  app.patch(`${BASE}/:projectId`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const input = updateHobbyProjectInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!existing) {
      return notFound(reply, "Hobby project");
    }

    if (input.seriesId !== undefined && !await ensureSeriesMatchesHobby(app.prisma as PrismaClientLike, householdId, hobbyId, input.seriesId)) {
      return badRequest(reply, "Series must belong to the same hobby.");
    }

    const project = await app.prisma.hobbyProject.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
        ...(input.targetEndDate !== undefined ? { targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : null } : {}),
        ...(input.completedDate !== undefined ? { completedDate: input.completedDate ? new Date(input.completedDate) : null } : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl ?? null } : {}),
        ...(input.difficulty !== undefined ? { difficulty: input.difficulty ?? null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}),
        ...(input.seriesId !== undefined ? { seriesId: input.seriesId ?? null } : {}),
        ...(input.batchNumber !== undefined ? { batchNumber: input.batchNumber ?? null } : {}),
      },
    });

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_project_updated", householdId, { hobbyProjectId: project.id, hobbyProjectName: project.name });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.send(toHobbyProjectResponse(project));
  });

  app.delete(`${BASE}/:projectId`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!existing) {
      return notFound(reply, "Hobby project");
    }

    await app.prisma.hobbyProject.delete({ where: { id: existing.id } });

        await createActivityLogger(app.prisma, userId).log("hobby", hobbyId, "hobby_project_deleted", householdId, { hobbyProjectId: existing.id, hobbyProjectName: existing.name });

    maybeSyncProjectDeletion(app.prisma as PrismaClientLike, existing.id);

    return reply.code(204).send();
  });

  app.get(`${BASE}/:projectId/milestones`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const milestones = await app.prisma.hobbyProjectMilestone.findMany({
      where: { hobbyProjectId: project.id },
      orderBy: { sortOrder: "asc" },
    });

    return reply.send(milestones.map(toHobbyProjectMilestoneResponse));
  });

  app.post(`${BASE}/:projectId/milestones`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const input = createHobbyProjectMilestoneInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const milestoneCount = await app.prisma.hobbyProjectMilestone.count({ where: { hobbyProjectId: project.id } });
    const milestone = await app.prisma.hobbyProjectMilestone.create({
      data: {
        hobbyProjectId: project.id,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "pending",
        sortOrder: input.sortOrder ?? milestoneCount,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        completedDate: input.completedDate ? new Date(input.completedDate) : null,
        notes: input.notes ?? null,
      },
    });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(201).send(toHobbyProjectMilestoneResponse(milestone));
  });

  app.patch(`${BASE}/:projectId/milestones/:milestoneId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, milestoneId } = hobbyProjectMilestoneParamsSchema.parse(request.params);
    const input = updateHobbyProjectMilestoneInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectMilestone.findFirst({
      where: { id: milestoneId, hobbyProjectId: project.id },
    });
    if (!existing) {
      return notFound(reply, "Milestone");
    }

    const milestone = await app.prisma.hobbyProjectMilestone.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.targetDate !== undefined ? { targetDate: input.targetDate ? new Date(input.targetDate) : null } : {}),
        ...(input.completedDate !== undefined ? { completedDate: input.completedDate ? new Date(input.completedDate) : null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.send(toHobbyProjectMilestoneResponse(milestone));
  });

  app.post(`${BASE}/:projectId/milestones/reorder`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const input = reorderHobbyProjectMilestonesInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const milestones = await app.prisma.hobbyProjectMilestone.findMany({
      where: { hobbyProjectId: project.id },
      select: { id: true },
    });
    const existingIds = new Set(milestones.map((milestone) => milestone.id));

    if (input.milestoneIds.some((milestoneId) => !existingIds.has(milestoneId)) || input.milestoneIds.length !== milestones.length) {
      return reply.code(400).send({ message: "Milestone order must include every project milestone exactly once." });
    }

    await app.prisma.$transaction(input.milestoneIds.map((milestoneId, index) => app.prisma.hobbyProjectMilestone.update({
      where: { id: milestoneId },
      data: { sortOrder: index },
    })));

    const reordered = await app.prisma.hobbyProjectMilestone.findMany({
      where: { hobbyProjectId: project.id },
      orderBy: { sortOrder: "asc" },
    });

    return reply.send(reordered.map(toHobbyProjectMilestoneResponse));
  });

  app.delete(`${BASE}/:projectId/milestones/:milestoneId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, milestoneId } = hobbyProjectMilestoneParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectMilestone.findFirst({
      where: { id: milestoneId, hobbyProjectId: project.id },
    });
    if (!existing) {
      return notFound(reply, "Milestone");
    }

    await app.prisma.hobbyProjectMilestone.delete({ where: { id: existing.id } });
    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(204).send();
  });

  app.get(`${BASE}/:projectId/work-logs`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const query = hobbyProjectWorkLogListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const logs = await app.prisma.hobbyProjectWorkLog.findMany({
      where: {
        hobbyProjectId: project.id,
        ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
        ...(query.startDate || query.endDate ? {
          date: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        } : {}),
        ...cursorWhere(query.cursor),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: query.limit + 1,
    });

    const { items, nextCursor } = buildCursorPage(logs, query.limit);
    const totalDurationMinutes = items.reduce((sum, workLog) => sum + (workLog.durationMinutes ?? 0), 0);

    return reply.send(hobbyProjectWorkLogListResponseSchema.parse({
      items: items.map(toHobbyProjectWorkLogResponse),
      nextCursor,
      totalDurationMinutes,
      totalDurationHours: totalDurationMinutes / 60,
    }));
  });

  app.post(`${BASE}/:projectId/work-logs`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const input = createHobbyProjectWorkLogInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    if (input.milestoneId) {
      const milestone = await app.prisma.hobbyProjectMilestone.findFirst({
        where: { id: input.milestoneId, hobbyProjectId: project.id },
        select: { id: true },
      });
      if (!milestone) {
        return badRequest(reply, "Milestone not found for this hobby project.");
      }
    }

    const workLog = await app.prisma.hobbyProjectWorkLog.create({
      data: {
        hobbyProjectId: project.id,
        milestoneId: input.milestoneId ?? null,
        date: new Date(input.date),
        durationMinutes: input.durationMinutes ?? null,
        description: input.description,
        notes: input.notes ?? null,
      },
    });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(201).send(toHobbyProjectWorkLogResponse(workLog));
  });

  app.patch(`${BASE}/:projectId/work-logs/:workLogId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, workLogId } = hobbyProjectWorkLogParamsSchema.parse(request.params);
    const input = updateHobbyProjectWorkLogInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectWorkLog.findFirst({
      where: { id: workLogId, hobbyProjectId: project.id },
    });
    if (!existing) {
      return notFound(reply, "Work log");
    }

    if (input.milestoneId) {
      const milestone = await app.prisma.hobbyProjectMilestone.findFirst({
        where: { id: input.milestoneId, hobbyProjectId: project.id },
        select: { id: true },
      });
      if (!milestone) {
        return badRequest(reply, "Milestone not found for this hobby project.");
      }
    }

    const workLog = await app.prisma.hobbyProjectWorkLog.update({
      where: { id: existing.id },
      data: {
        ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId ?? null } : {}),
        ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      },
    });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.send(toHobbyProjectWorkLogResponse(workLog));
  });

  app.delete(`${BASE}/:projectId/work-logs/:workLogId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, workLogId } = hobbyProjectWorkLogParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectWorkLog.findFirst({
      where: { id: workLogId, hobbyProjectId: project.id },
    });
    if (!existing) {
      return notFound(reply, "Work log");
    }

    await app.prisma.hobbyProjectWorkLog.delete({ where: { id: existing.id } });
    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(204).send();
  });

  app.get(`${BASE}/:projectId/inventory`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const links = await app.prisma.hobbyProjectInventoryItem.findMany({
      where: { hobbyProjectId: project.id },
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(links.map(toHobbyProjectInventoryLinkDetailResponse));
  });

  app.post(`${BASE}/:projectId/inventory`, async (request, reply) => {
    const { householdId, hobbyId, projectId } = hobbyProjectParamsSchema.parse(request.params);
    const input = createHobbyProjectInventoryItemInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, householdId, input.inventoryItemId);
    if (!inventoryItem) {
      return badRequest(reply, "Inventory item not found or belongs to a different household.");
    }

    const existing = await app.prisma.hobbyProjectInventoryItem.findUnique({
      where: {
        hobbyProjectId_inventoryItemId: {
          hobbyProjectId: project.id,
          inventoryItemId: inventoryItem.id,
        },
      },
    });

    if (existing) {
      return reply.code(409).send({ message: "Inventory item is already linked to this hobby project." });
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const link = await tx.hobbyProjectInventoryItem.create({
          data: {
            hobbyProjectId: project.id,
            inventoryItemId: inventoryItem.id,
            quantityNeeded: input.quantityNeeded,
            quantityUsed: input.quantityUsed ?? 0,
            notes: input.notes ?? null,
          },
          include: { inventoryItem: true },
        });

        const transaction = link.quantityUsed > 0
          ? await applyInventoryTransaction(tx, {
              inventoryItemId: inventoryItem.id,
              userId: request.auth.userId,
              input: {
                type: "consume",
                quantity: -link.quantityUsed,
                referenceType: "hobby_project",
                referenceId: project.id,
                notes: `Consumed for hobby project: ${project.name}`,
              },
            })
          : null;

        return { link, transaction };
      });

      maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

      return reply.code(201).send({
        hobbyProjectInventoryItem: toHobbyProjectInventoryLinkDetailResponse(result.link),
        inventoryItem: toInventoryItemSummaryResponse(result.link.inventoryItem),
        transaction: result.transaction ? toInventoryTransactionResponse(result.transaction.transaction) : null,
      });
    } catch (error) {
      if (error instanceof InventoryError) {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });

  app.patch(`${BASE}/:projectId/inventory/:inventoryItemId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, inventoryItemId } = hobbyProjectInventoryItemParamsSchema.parse(request.params);
    const input = updateHobbyProjectInventoryItemInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectInventoryItem.findUnique({
      where: {
        hobbyProjectId_inventoryItemId: {
          hobbyProjectId: project.id,
          inventoryItemId,
        },
      },
      include: { inventoryItem: true },
    });
    if (!existing) {
      return notFound(reply, "Hobby project inventory link");
    }

    const nextQuantityNeeded = input.quantityNeeded ?? existing.quantityNeeded;
    const nextQuantityUsed = input.quantityUsed ?? existing.quantityUsed;
    if (nextQuantityUsed > nextQuantityNeeded) {
      return reply.code(400).send({ message: "Used quantity cannot exceed quantity needed." });
    }

    const delta = nextQuantityUsed - existing.quantityUsed;

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        const link = await tx.hobbyProjectInventoryItem.update({
          where: { id: existing.id },
          data: {
            ...(input.quantityNeeded !== undefined ? { quantityNeeded: input.quantityNeeded } : {}),
            ...(input.quantityUsed !== undefined ? { quantityUsed: input.quantityUsed } : {}),
            ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          },
          include: { inventoryItem: true },
        });

        const transaction = delta === 0
          ? null
          : await applyInventoryTransaction(tx, {
              inventoryItemId: existing.inventoryItemId,
              userId: request.auth.userId,
              input: {
                type: delta > 0 ? "consume" : "adjust",
                quantity: delta > 0 ? -delta : Math.abs(delta),
                referenceType: "hobby_project",
                referenceId: project.id,
                notes: delta > 0
                  ? `Consumed for hobby project: ${project.name}`
                  : `Usage corrected for hobby project: ${project.name}`,
              },
            });

        return { link, transaction };
      });

      maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

      return reply.send({
        hobbyProjectInventoryItem: toHobbyProjectInventoryItemResponse(result.link),
        quantityRemaining: result.link.quantityNeeded - result.link.quantityUsed,
        transaction: result.transaction ? toInventoryTransactionResponse(result.transaction.transaction) : null,
      });
    } catch (error) {
      if (error instanceof InventoryError) {
        return reply.code(400).send({ message: error.message });
      }

      throw error;
    }
  });

  app.delete(`${BASE}/:projectId/inventory/:inventoryItemId`, async (request, reply) => {
    const { householdId, hobbyId, projectId, inventoryItemId } = hobbyProjectInventoryItemParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getHobbyProject(app.prisma as PrismaClientLike, householdId, hobbyId, projectId);
    if (!project) {
      return notFound(reply, "Hobby project");
    }

    const existing = await app.prisma.hobbyProjectInventoryItem.findUnique({
      where: {
        hobbyProjectId_inventoryItemId: {
          hobbyProjectId: project.id,
          inventoryItemId,
        },
      },
    });
    if (!existing) {
      return notFound(reply, "Hobby project inventory link");
    }

    await app.prisma.$transaction(async (tx) => {
      if (existing.quantityUsed > 0) {
        await applyInventoryTransaction(tx, {
          inventoryItemId: existing.inventoryItemId,
          userId: request.auth.userId,
          input: {
            type: "adjust",
            quantity: existing.quantityUsed,
            referenceType: "hobby_project",
            referenceId: project.id,
            notes: `Returned consumed inventory after removing hobby project link: ${project.name}`,
          },
        });
      }

      await tx.hobbyProjectInventoryItem.delete({ where: { id: existing.id } });
    });

    maybeSyncProjectSearch(app.prisma as PrismaClientLike, project.id);

    return reply.code(204).send();
  });
};