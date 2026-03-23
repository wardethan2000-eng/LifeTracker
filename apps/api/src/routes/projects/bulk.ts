import {
  bulkChangeProjectStatusSchema,
  bulkCompleteTasksSchema,
  bulkReassignTasksSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import { syncProjectDerivedStatuses } from "../../lib/project-status.js";
import { syncProjectToSearchIndex } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const projectParamsSchema = householdParamsSchema.extend({
  projectId: z.string().cuid()
});

type ProjectFailedItem = {
  projectId: string;
  name: string | null;
  message: string;
};

type TaskFailedItem = {
  taskId: string;
  title: string | null;
  message: string;
};

export const projectBulkRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/projects/bulk/status", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkChangeProjectStatusSchema.parse({ ...body, householdId: params.householdId });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const projects = await app.prisma.project.findMany({
      where: {
        id: { in: input.projectIds },
        householdId: params.householdId,
        deletedAt: null
      },
      select: { id: true, name: true }
    });

    const found = new Set(projects.map((p) => p.id));

    const failed: ProjectFailedItem[] = input.projectIds
      .filter((id) => !found.has(id))
      .map((id) => ({ projectId: id, name: null, message: "Project not found." }));

    let succeeded = 0;

    for (const project of projects) {
      try {
        await app.prisma.project.update({
          where: { id: project.id },
          data: { status: input.status }
        });

        succeeded++;

        void syncProjectToSearchIndex(app.prisma, project.id).catch(console.error);
      } catch (err) {
        failed.push({
          projectId: project.id,
          name: project.name,
          message: err instanceof Error ? err.message : "Failed to update project status."
        });
      }
    }

    if (succeeded > 0) {
      await Promise.all([
        logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "project.bulk_status_changed",
          entityType: "project",
          entityId: params.householdId,
          metadata: { count: succeeded, status: input.status }
        }),
        enqueueNotificationScan({ householdId: params.householdId })
      ]);
    }

    return { succeeded, failed };
  });

  app.post("/v1/households/:householdId/projects/:projectId/tasks/bulk/complete", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkCompleteTasksSchema.parse({
      ...body,
      householdId: params.householdId,
      projectId: params.projectId
    });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const tasks = await app.prisma.projectTask.findMany({
      where: {
        id: { in: input.taskIds },
        deletedAt: null,
        project: {
          id: params.projectId,
          householdId: params.householdId,
          deletedAt: null
        }
      },
      select: { id: true, title: true, status: true }
    });

    const found = new Set(tasks.map((t) => t.id));

    const failed: TaskFailedItem[] = input.taskIds
      .filter((id) => !found.has(id))
      .map((id) => ({ taskId: id, title: null, message: "Task not found." }));

    const toComplete = tasks.filter((t) => t.status !== "completed");
    const alreadyDone = tasks.length - toComplete.length;
    let succeeded = alreadyDone;

    if (toComplete.length > 0) {
      try {
        const now = new Date();

        await app.prisma.$transaction(async (tx) => {
          await tx.projectTask.updateMany({
            where: { id: { in: toComplete.map((t) => t.id) } },
            data: { status: "completed", completedAt: now, isCompleted: true }
          });

          await syncProjectDerivedStatuses(tx, params.projectId);
        });

        succeeded += toComplete.length;

        await logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "project.bulk_tasks_completed",
          entityType: "project",
          entityId: params.projectId,
          metadata: { count: toComplete.length }
        });

        void syncProjectToSearchIndex(app.prisma, params.projectId).catch(console.error);
      } catch (err) {
        for (const task of toComplete) {
          failed.push({
            taskId: task.id,
            title: task.title,
            message: err instanceof Error ? err.message : "Failed to complete task."
          });
        }
      }
    }

    return { succeeded, failed };
  });

  app.post("/v1/households/:householdId/projects/:projectId/tasks/bulk/reassign", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = request.body as Record<string, unknown>;
    const input = bulkReassignTasksSchema.parse({
      ...body,
      householdId: params.householdId,
      projectId: params.projectId
    });

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: params.projectId, deletedAt: null },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Referenced phase not found in this project." });
      }
    }

    if (input.assignedToId) {
      const membership = await app.prisma.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: params.householdId,
            userId: input.assignedToId
          }
        }
      });

      if (!membership) {
        return reply.code(400).send({ message: "Assigned user is not a member of this household." });
      }
    }

    const tasks = await app.prisma.projectTask.findMany({
      where: {
        id: { in: input.taskIds },
        deletedAt: null,
        project: {
          id: params.projectId,
          householdId: params.householdId,
          deletedAt: null
        }
      },
      select: { id: true, title: true }
    });

    const found = new Set(tasks.map((t) => t.id));

    const failed: TaskFailedItem[] = input.taskIds
      .filter((id) => !found.has(id))
      .map((id) => ({ taskId: id, title: null, message: "Task not found." }));

    let succeeded = 0;

    if (tasks.length > 0) {
      try {
        const updateData: {
          phaseId?: string | null;
          assignedToId?: string | null;
        } = {};

        if (input.phaseId !== undefined) {
          updateData.phaseId = input.phaseId;
        }

        if (input.assignedToId !== undefined) {
          updateData.assignedToId = input.assignedToId;
        }

        await app.prisma.projectTask.updateMany({
          where: { id: { in: tasks.map((t) => t.id) } },
          data: updateData
        });

        succeeded = tasks.length;

        await logActivity(app.prisma, {
          householdId: params.householdId,
          userId: request.auth.userId,
          action: "project.bulk_tasks_reassigned",
          entityType: "project",
          entityId: params.projectId,
          metadata: {
            count: tasks.length,
            phaseId: input.phaseId,
            assignedToId: input.assignedToId
          }
        });

        void syncProjectToSearchIndex(app.prisma, params.projectId).catch(console.error);
      } catch (err) {
        for (const task of tasks) {
          failed.push({
            taskId: task.id,
            title: task.title,
            message: err instanceof Error ? err.message : "Failed to reassign task."
          });
        }
      }
    }

    return { succeeded, failed };
  });
};
