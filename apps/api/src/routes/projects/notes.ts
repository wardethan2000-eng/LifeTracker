import type { Prisma } from "@prisma/client";
import {
  createProjectNoteSchema,
  updateProjectNoteSchema
} from "@lifekeeper/types";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { toProjectNoteResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const projectParamsSchema = householdParamsSchema.extend({
  projectId: z.string().cuid()
});

const noteParamsSchema = projectParamsSchema.extend({
  noteId: z.string().cuid()
});

const noteListQuerySchema = z.object({
  category: z.string().optional(),
  phaseId: z.string().cuid().optional(),
  pinned: z.enum(["true", "false"]).optional()
});

const ensureMembership = async (app: FastifyInstance, householdId: string, userId: string) => {
  try {
    await assertMembership(app.prisma, householdId, userId);
    return true;
  } catch {
    return false;
  }
};

const getProject = (app: FastifyInstance, householdId: string, projectId: string) => app.prisma.project.findFirst({
  where: { id: projectId, householdId },
  select: { id: true, householdId: true, name: true }
});

export const projectNoteRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/projects/:projectId/notes
  app.get("/v1/households/:householdId/projects/:projectId/notes", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const query = noteListQuerySchema.parse(request.query);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const where: Prisma.ProjectNoteWhereInput = { projectId: project.id };

    if (query.category) {
      where.category = query.category as import("@prisma/client").NoteCategory;
    }

    if (query.phaseId) {
      where.phaseId = query.phaseId;
    }

    if (query.pinned !== undefined) {
      where.isPinned = query.pinned === "true";
    }

    const notes = await app.prisma.projectNote.findMany({
      where,
      include: {
        createdBy: { select: { id: true, displayName: true } },
        phase: { select: { name: true } }
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }]
    });

    return notes.map(toProjectNoteResponse);
  });

  // GET /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.get("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const note = await app.prisma.projectNote.findFirst({
      where: { id: params.noteId, projectId: project.id },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        phase: { select: { name: true } }
      }
    });

    if (!note) {
      return reply.code(404).send({ message: "Project note not found." });
    }

    return toProjectNoteResponse(note);
  });

  // POST /v1/households/:householdId/projects/:projectId/notes
  app.post("/v1/households/:householdId/projects/:projectId/notes", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectNoteSchema.parse(request.body);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Phase not found in this project." });
      }
    }

    const note = await app.prisma.projectNote.create({
      data: {
        projectId: project.id,
        phaseId: input.phaseId ?? null,
        title: input.title,
        body: input.body ?? "",
        url: input.url ?? null,
        category: input.category ?? "general",
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentName: input.attachmentName ?? null,
        isPinned: input.isPinned ?? false,
        createdById: request.auth.userId
      },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        phase: { select: { name: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.note.created",
      entityType: "project_note",
      entityId: note.id,
      metadata: { projectId: project.id, title: note.title, category: note.category }
    });

    return reply.code(201).send(toProjectNoteResponse(note));
  });

  // PATCH /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.patch("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);
    const input = updateProjectNoteSchema.parse(request.body);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const existing = await app.prisma.projectNote.findFirst({
      where: { id: params.noteId, projectId: project.id }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project note not found." });
    }

    if (input.phaseId !== undefined && input.phaseId !== null) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id },
        select: { id: true }
      });

      if (!phase) {
        return reply.code(400).send({ message: "Phase not found in this project." });
      }
    }

    const data: Prisma.ProjectNoteUncheckedUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body ?? "";
    if (input.url !== undefined) data.url = input.url ?? null;
    if (input.category !== undefined) data.category = input.category;
    if (input.phaseId !== undefined) data.phaseId = input.phaseId ?? null;
    if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl ?? null;
    if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName ?? null;
    if (input.isPinned !== undefined) data.isPinned = input.isPinned;

    const updated = await app.prisma.projectNote.update({
      where: { id: existing.id },
      data,
      include: {
        createdBy: { select: { id: true, displayName: true } },
        phase: { select: { name: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.note.updated",
      entityType: "project_note",
      entityId: updated.id,
      metadata: { projectId: project.id, title: updated.title }
    });

    return toProjectNoteResponse(updated);
  });

  // DELETE /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.delete("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);

    if (!await ensureMembership(app, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return reply.code(404).send({ message: "Project not found." });
    }

    const existing = await app.prisma.projectNote.findFirst({
      where: { id: params.noteId, projectId: project.id }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Project note not found." });
    }

    await app.prisma.projectNote.delete({ where: { id: existing.id } });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "project.note.deleted",
      entityType: "project_note",
      entityId: existing.id,
      metadata: { projectId: project.id, title: existing.title }
    });

    return reply.code(204).send();
  });
};
