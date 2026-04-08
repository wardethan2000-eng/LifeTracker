import {
  createProjectTaskDependencySchema,
  updateProjectTaskDependencySchema
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { assertTaskDependenciesAcyclic } from "../../lib/project-task-graph.js";
import { toProjectTaskDependencyResponse } from "../../lib/serializers/index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { projectParamsSchema } from "../../lib/schemas.js";

const dependencyParamsSchema = projectParamsSchema.extend({
  dependencyId: z.string().cuid()
});

export const projectDependencyRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/projects/:projectId/dependencies
  app.get("/v1/households/:householdId/projects/:projectId/dependencies", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true }
    });

    if (!project) {
      return notFound(reply, "Project not found.");
    }

    const dependencies = await app.prisma.projectTaskDependency.findMany({
      where: {
        predecessorTask: { projectId: params.projectId, deletedAt: null }
      },
      orderBy: { createdAt: "asc" }
    });

    return reply.send(dependencies.map(toProjectTaskDependencyResponse));
  });

  // POST /v1/households/:householdId/projects/:projectId/dependencies
  app.post("/v1/households/:householdId/projects/:projectId/dependencies", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectTaskDependencySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true }
    });

    if (!project) {
      return notFound(reply, "Project not found.");
    }

    if (input.predecessorTaskId === input.successorTaskId) {
      return badRequest(reply, "A task cannot depend on itself.");
    }

    const projectTasks = await app.prisma.projectTask.findMany({
      where: { projectId: params.projectId, deletedAt: null },
      select: {
        id: true,
        predecessorLinks: { select: { predecessorTaskId: true, successorTaskId: true } }
      }
    });

    const predecessorTask = projectTasks.find((task) => task.id === input.predecessorTaskId);
    const successorTask = projectTasks.find((task) => task.id === input.successorTaskId);

    if (!predecessorTask || !successorTask) {
      return badRequest(reply, "Referenced task not found in this project.");
    }

    const existingDependency = await app.prisma.projectTaskDependency.findUnique({
      where: {
        predecessorTaskId_successorTaskId: {
          predecessorTaskId: input.predecessorTaskId,
          successorTaskId: input.successorTaskId
        }
      }
    });

    if (existingDependency) {
      return reply.code(409).send({ message: "This dependency already exists." });
    }

    const allDependencies = projectTasks.flatMap((task) =>
      task.predecessorLinks.map((link) => ({
        predecessorTaskId: link.predecessorTaskId,
        successorTaskId: task.id
      }))
    );

    try {
      assertTaskDependenciesAcyclic(projectTasks, allDependencies, input.successorTaskId, [input.predecessorTaskId]);
    } catch (err) {
      return reply.code(409).send({ message: err instanceof Error ? err.message : "Dependency would create a cycle." });
    }

    const dependency = await app.prisma.projectTaskDependency.create({
      data: {
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        dependencyType: input.dependencyType ?? "finish_to_start",
        lagDays: input.lagDays ?? 0
      }
    });

    await createActivityLogger(app.prisma, request.auth.userId).log(
      "project_task",
      input.successorTaskId,
      "project.task.dependency.added",
      params.householdId,
      { predecessorTaskId: input.predecessorTaskId, dependencyType: dependency.dependencyType }
    );

    return reply.code(201).send(toProjectTaskDependencyResponse(dependency));
  });

  // PATCH /v1/households/:householdId/projects/:projectId/dependencies/:dependencyId
  app.patch("/v1/households/:householdId/projects/:projectId/dependencies/:dependencyId", async (request, reply) => {
    const params = dependencyParamsSchema.parse(request.params);
    const input = updateProjectTaskDependencySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const dependency = await app.prisma.projectTaskDependency.findFirst({
      where: {
        id: params.dependencyId,
        predecessorTask: { projectId: params.projectId, deletedAt: null }
      }
    });

    if (!dependency) {
      return notFound(reply, "Dependency not found.");
    }

    const updated = await app.prisma.projectTaskDependency.update({
      where: { id: params.dependencyId },
      data: {
        ...(input.dependencyType !== undefined ? { dependencyType: input.dependencyType } : {}),
        ...(input.lagDays !== undefined ? { lagDays: input.lagDays } : {})
      }
    });

    return reply.send(toProjectTaskDependencyResponse(updated));
  });

  // DELETE /v1/households/:householdId/projects/:projectId/dependencies/:dependencyId
  app.delete("/v1/households/:householdId/projects/:projectId/dependencies/:dependencyId", async (request, reply) => {
    const params = dependencyParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const dependency = await app.prisma.projectTaskDependency.findFirst({
      where: {
        id: params.dependencyId,
        predecessorTask: { projectId: params.projectId, deletedAt: null }
      }
    });

    if (!dependency) {
      return notFound(reply, "Dependency not found.");
    }

    await app.prisma.projectTaskDependency.delete({
      where: { id: params.dependencyId }
    });

    await createActivityLogger(app.prisma, request.auth.userId).log(
      "project_task",
      dependency.successorTaskId,
      "project.task.dependency.removed",
      params.householdId,
      { predecessorTaskId: dependency.predecessorTaskId }
    );

    return reply.code(204).send();
  });
};
