import {
  createProjectNoteSchema,
  updateProjectNoteSchema
} from "@aegis/types";
import {
  PROJECT_NOTE_CATEGORY_PREFIX,
  buildProjectEntryPayload,
  parseProjectEntryPayload
} from "@aegis/utils";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toInputJsonValue, parseTags } from "../../lib/prisma-json.js";
import { toEntryAsProjectNote } from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncEntryToSearchIndex } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { projectParamsSchema } from "../../lib/schemas.js";

const noteParamsSchema = projectParamsSchema.extend({
  noteId: z.string().cuid()
});

const noteListQuerySchema = z.object({
  category: z.string().optional(),
  phaseId: z.string().cuid().optional(),
  pinned: z.enum(["true", "false"]).optional()
});

const getProject = (app: FastifyInstance, householdId: string, projectId: string) => app.prisma.project.findFirst({
  where: { id: projectId, householdId, deletedAt: null },
  select: { id: true, householdId: true, name: true }
});

export const projectNoteRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/projects/:projectId/notes
  app.get("/v1/households/:householdId/projects/:projectId/notes", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const query = noteListQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return notFound(reply, "Project");
    }

    const categoryFilter = query.category
      ? { tags: { array_contains: [`${PROJECT_NOTE_CATEGORY_PREFIX}${query.category}`] } }
      : {};

    const pinnedFilter = query.pinned !== undefined
      ? query.pinned === "true"
        ? { flags: { some: { flag: "pinned" as const } } }
        : { flags: { none: { flag: "pinned" as const } } }
      : {};

    let entityFilter: object;

    if (query.phaseId) {
      entityFilter = { entityType: "project_phase" as const, entityId: query.phaseId };
    } else {
      const phases = await app.prisma.projectPhase.findMany({
        where: { projectId: project.id },
        select: { id: true }
      });
      const phaseIds = phases.map((p) => p.id);
      entityFilter = {
        OR: [
          { entityType: "project" as const, entityId: project.id },
          ...(phaseIds.length > 0 ? [{ entityType: "project_phase" as const, entityId: { in: phaseIds } }] : [])
        ]
      };
    }

    const entries = await app.prisma.entry.findMany({
      where: {
        householdId: params.householdId,
        ...entityFilter,
        ...categoryFilter,
        ...pinnedFilter
      },
      include: {
        flags: true,
        createdBy: { select: { id: true, displayName: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Sort pinned entries first (stable — createdAt desc order preserved within groups)
    entries.sort((a, b) => {
      const aPin = a.flags.some((f) => f.flag === "pinned") ? 1 : 0;
      const bPin = b.flags.some((f) => f.flag === "pinned") ? 1 : 0;
      return bPin - aPin;
    });

    // Batch-fetch phase names for nested entries
    const phaseEntries = entries.filter((e) => e.entityType === "project_phase");
    const phaseNameMap = new Map<string, string>();

    if (phaseEntries.length > 0) {
      const uniquePhaseIds = [...new Set(phaseEntries.map((e) => e.entityId))];
      const phases = await app.prisma.projectPhase.findMany({
        where: { id: { in: uniquePhaseIds } },
        select: { id: true, name: true }
      });
      for (const phase of phases) {
        phaseNameMap.set(phase.id, phase.name);
      }
    }

    return entries.map((entry) =>
      toEntryAsProjectNote(entry, {
        projectId: project.id,
        phaseName: entry.entityType === "project_phase" ? (phaseNameMap.get(entry.entityId) ?? null) : null
      })
    );
  });

  // GET /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.get("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return notFound(reply, "Project");
    }

    const phases = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true }
    });
    const phaseIds = phases.map((p) => p.id);

    const entry = await app.prisma.entry.findFirst({
      where: {
        id: params.noteId,
        householdId: params.householdId,
        OR: [
          { entityType: "project" as const, entityId: project.id },
          ...(phaseIds.length > 0 ? [{ entityType: "project_phase" as const, entityId: { in: phaseIds } }] : [])
        ]
      },
      include: {
        flags: true,
        createdBy: { select: { id: true, displayName: true } }
      }
    });

    if (!entry) {
      return notFound(reply, "Project note");
    }

    const phaseName = entry.entityType === "project_phase"
      ? (phases.find((p) => p.id === entry.entityId)?.name ?? null)
      : null;

    return toEntryAsProjectNote(entry, { projectId: project.id, phaseName });
  });

  // POST /v1/households/:householdId/projects/:projectId/notes
  app.post("/v1/households/:householdId/projects/:projectId/notes", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createProjectNoteSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return notFound(reply, "Project");
    }

    let phaseName: string | null = null;

    if (input.phaseId) {
      const phase = await app.prisma.projectPhase.findFirst({
        where: { id: input.phaseId, projectId: project.id, deletedAt: null },
        select: { id: true, name: true }
      });

      if (!phase) {
        return badRequest(reply, "Phase not found in this project.");
      }

      phaseName = phase.name;
    }

    const details = buildProjectEntryPayload({
      title: input.title,
      body: input.body ?? null,
      category: input.category ?? null,
      url: input.url ?? null,
      isPinned: input.isPinned ?? false
    });

    const entry = await app.prisma.entry.create({
      data: {
        householdId: params.householdId,
        createdById: request.auth.userId,
        title: input.title,
        body: details.body,
        entryDate: new Date(),
        entityType: input.phaseId ? "project_phase" : "project",
        entityId: input.phaseId ?? project.id,
        entryType: details.entryType,
        tags: toInputJsonValue(details.tags),
        attachmentUrl: details.attachmentUrl,
        attachmentName: details.attachmentName,
        ...(details.flags.length > 0
          ? { flags: { create: details.flags.map((flag) => ({ flag })) } }
          : {})
      },
      include: {
        flags: true,
        createdBy: { select: { id: true, displayName: true } }
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("project_note", entry.id, "project.note.created", params.householdId, { projectId: project.id, title: entry.title, category: input.category ?? "general" });

    void syncEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return reply.code(201).send(toEntryAsProjectNote(entry, { projectId: project.id, phaseName }));
  });

  // PATCH /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.patch("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);
    const input = updateProjectNoteSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return notFound(reply, "Project");
    }

    const phases = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true }
    });
    const phaseIds = phases.map((p) => p.id);

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.noteId,
        householdId: params.householdId,
        OR: [
          { entityType: "project" as const, entityId: project.id },
          ...(phaseIds.length > 0 ? [{ entityType: "project_phase" as const, entityId: { in: phaseIds } }] : [])
        ]
      },
      include: { flags: true }
    });

    if (!existing) {
      return notFound(reply, "Project note");
    }

    // Validate new phaseId if provided
    let newPhaseName: string | null | undefined;

    if (input.phaseId !== undefined && input.phaseId !== null) {
      const phase = phases.find((p) => p.id === input.phaseId);

      if (!phase) {
        return badRequest(reply, "Phase not found in this project.");
      }

      newPhaseName = phase.name;
    }

    // Parse current state to merge with incoming update
    const current = parseProjectEntryPayload({
      title: existing.title,
      body: existing.body,
      entryType: existing.entryType,
      tags: parseTags(existing.tags),
      flags: existing.flags.map((f) => f.flag),
      attachmentUrl: existing.attachmentUrl
    });

    const details = buildProjectEntryPayload({
      title: input.title ?? (existing.title ?? existing.body),
      body: input.body !== undefined ? (input.body ?? null) : current.body || null,
      category: input.category !== undefined ? (input.category ?? null) : current.category,
      url: input.url !== undefined ? (input.url ?? null) : current.url,
      isPinned: input.isPinned !== undefined ? (input.isPinned ?? false) : current.isPinned
    });

    // Determine entity assignment
    let entityType: "project" | "project_phase" = existing.entityType as "project" | "project_phase";
    let entityId = existing.entityId;

    if (input.phaseId !== undefined) {
      if (input.phaseId === null) {
        entityType = "project";
        entityId = project.id;
        newPhaseName = null;
      } else {
        entityType = "project_phase";
        entityId = input.phaseId;
      }
    }

    // Update entry fields
    const updated = await app.prisma.entry.update({
      where: { id: existing.id },
      data: {
        title: input.title !== undefined ? input.title : existing.title,
        body: details.body,
        entityType,
        entityId,
        entryType: details.entryType,
        tags: toInputJsonValue(details.tags),
        attachmentUrl: details.attachmentUrl,
        attachmentName: details.attachmentName
      },
      include: {
        flags: true,
        createdBy: { select: { id: true, displayName: true } }
      }
    });

    // Sync pin flag separately
    const wasPinned = existing.flags.some((f) => f.flag === "pinned");
    const shouldBePinned = details.flags.includes("pinned");

    if (wasPinned && !shouldBePinned) {
      await app.prisma.entryFlagEntry.delete({ where: { entryId_flag: { entryId: existing.id, flag: "pinned" } } });
    } else if (!wasPinned && shouldBePinned) {
      await app.prisma.entryFlagEntry.create({ data: { entryId: existing.id, flag: "pinned" } });
    }

        await createActivityLogger(app.prisma, request.auth.userId).log("project_note", updated.id, "project.note.updated", params.householdId, { projectId: project.id, title: updated.title });

    // Re-fetch with updated flags
    const refreshed = await app.prisma.entry.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        flags: true,
        createdBy: { select: { id: true, displayName: true } }
      }
    });

    const resolvedPhaseName = refreshed.entityType === "project_phase"
      ? (newPhaseName !== undefined
        ? newPhaseName
        : (phases.find((p) => p.id === refreshed.entityId)?.name ?? null))
      : null;

    return toEntryAsProjectNote(refreshed, { projectId: project.id, phaseName: resolvedPhaseName });
  });

  // DELETE /v1/households/:householdId/projects/:projectId/notes/:noteId
  app.delete("/v1/households/:householdId/projects/:projectId/notes/:noteId", async (request, reply) => {
    const params = noteParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await getProject(app, params.householdId, params.projectId);

    if (!project) {
      return notFound(reply, "Project");
    }

    const phases = await app.prisma.projectPhase.findMany({
      where: { projectId: project.id },
      select: { id: true }
    });
    const phaseIds = phases.map((p) => p.id);

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.noteId,
        householdId: params.householdId,
        OR: [
          { entityType: "project" as const, entityId: project.id },
          ...(phaseIds.length > 0 ? [{ entityType: "project_phase" as const, entityId: { in: phaseIds } }] : [])
        ]
      },
      select: { id: true, title: true }
    });

    if (!existing) {
      return notFound(reply, "Project note");
    }

    await app.prisma.entry.delete({ where: { id: existing.id } });

        await createActivityLogger(app.prisma, request.auth.userId).log("project_note", existing.id, "project.note.deleted", params.householdId, { projectId: project.id, title: existing.title });

    await removeSearchIndexEntry(app.prisma, "entry", existing.id);

    return reply.code(204).send();
  });
};
