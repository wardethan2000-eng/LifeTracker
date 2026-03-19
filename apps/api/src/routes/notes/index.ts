import {
  createNoteFolderSchema,
  updateNoteFolderSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const folderParamsSchema = householdParamsSchema.extend({
  folderId: z.string().cuid()
});

const MAX_FOLDER_DEPTH = 3;

export const noteFolderRoutes: FastifyPluginAsync = async (app) => {

  const getFolderDepth = async (parentFolderId: string | null | undefined): Promise<number> => {
    if (!parentFolderId) return 1;
    let depth = 1;
    let currentId: string | null = parentFolderId;
    while (currentId) {
      depth++;
      const p: { parentFolderId: string | null } | null = await app.prisma.noteFolder.findUnique({
        where: { id: currentId },
        select: { parentFolderId: true }
      });
      currentId = p?.parentFolderId ?? null;
    }
    return depth;
  };

  // GET /v1/households/:householdId/note-folders — list all folders as flat list
  app.get("/v1/households/:householdId/note-folders", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const folders = await app.prisma.noteFolder.findMany({
      where: { householdId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            entries: true,
            children: { where: { deletedAt: null } }
          }
        }
      }
    });

    return folders.map((f: typeof folders[number]) => ({
      id: f.id,
      householdId: f.householdId,
      parentFolderId: f.parentFolderId,
      name: f.name,
      color: f.color,
      icon: f.icon,
      sortOrder: f.sortOrder,
      createdById: f.createdById,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      entryCount: f._count.entries,
      childCount: f._count.children
    }));
  });

  // POST /v1/households/:householdId/note-folders — create folder
  app.post("/v1/households/:householdId/note-folders", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = createNoteFolderSchema.parse(request.body);

    if (input.parentFolderId) {
      const parent = await app.prisma.noteFolder.findFirst({
        where: { id: input.parentFolderId, householdId, deletedAt: null }
      });
      if (!parent) {
        return reply.code(404).send({ message: "Parent folder not found" });
      }
    }

    const depth = await getFolderDepth(input.parentFolderId);
    if (depth > MAX_FOLDER_DEPTH) {
      return reply.code(400).send({ message: `Folder nesting cannot exceed ${MAX_FOLDER_DEPTH} levels` });
    }

    const folder = await app.prisma.noteFolder.create({
      data: {
        household: { connect: { id: householdId } },
        createdBy: { connect: { id: userId } },
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
        sortOrder: input.sortOrder ?? 0,
        ...(input.parentFolderId
          ? { parent: { connect: { id: input.parentFolderId } } }
          : {})
      }
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_folder_created",
      entityType: "note_folder",
      entityId: folder.id,
      metadata: { name: folder.name }
    });

    reply.code(201);
    return {
      id: folder.id,
      householdId: folder.householdId,
      parentFolderId: folder.parentFolderId,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      sortOrder: folder.sortOrder,
      createdById: folder.createdById,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  });

  // PATCH /v1/households/:householdId/note-folders/:folderId — update folder
  app.patch("/v1/households/:householdId/note-folders/:folderId", async (request, reply) => {
    const { householdId, folderId } = folderParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = updateNoteFolderSchema.parse(request.body);

    const existing = await app.prisma.noteFolder.findFirst({
      where: { id: folderId, householdId, deletedAt: null }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Folder not found" });
    }

    if (input.parentFolderId !== undefined) {
      if (input.parentFolderId === folderId) {
        return reply.code(400).send({ message: "A folder cannot be its own parent" });
      }
      if (input.parentFolderId) {
        const parent = await app.prisma.noteFolder.findFirst({
          where: { id: input.parentFolderId, householdId, deletedAt: null }
        });
        if (!parent) {
          return reply.code(404).send({ message: "Parent folder not found" });
        }
        // Check for circular reference
        let checkId: string | null = input.parentFolderId;
        while (checkId) {
          if (checkId === folderId) {
            return reply.code(400).send({ message: "Circular folder reference detected" });
          }
          const anc: { parentFolderId: string | null } | null = await app.prisma.noteFolder.findUnique({
            where: { id: checkId },
            select: { parentFolderId: true }
          });
          checkId = anc?.parentFolderId ?? null;
        }
      }
      const depth = await getFolderDepth(input.parentFolderId);
      if (depth > MAX_FOLDER_DEPTH) {
        return reply.code(400).send({ message: `Folder nesting cannot exceed ${MAX_FOLDER_DEPTH} levels` });
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.parentFolderId !== undefined) {
      data.parent = input.parentFolderId
        ? { connect: { id: input.parentFolderId } }
        : { disconnect: true };
    }

    const folder = await app.prisma.noteFolder.update({
      where: { id: folderId },
      data
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_folder_updated",
      entityType: "note_folder",
      entityId: folder.id,
      metadata: { name: folder.name }
    });

    return {
      id: folder.id,
      householdId: folder.householdId,
      parentFolderId: folder.parentFolderId,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      sortOrder: folder.sortOrder,
      createdById: folder.createdById,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString()
    };
  });

  // DELETE /v1/households/:householdId/note-folders/:folderId — soft delete folder
  app.delete("/v1/households/:householdId/note-folders/:folderId", async (request, reply) => {
    const { householdId, folderId } = folderParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.noteFolder.findFirst({
      where: { id: folderId, householdId, deletedAt: null }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Folder not found" });
    }

    // Soft-delete folder and orphan children + entries
    await app.prisma.$transaction([
      app.prisma.noteFolder.updateMany({
        where: { parentFolderId: folderId, deletedAt: null },
        data: { parentFolderId: null }
      }),
      app.prisma.entry.updateMany({
        where: { folderId },
        data: { folderId: null }
      }),
      app.prisma.noteFolder.update({
        where: { id: folderId },
        data: { deletedAt: new Date() }
      })
    ]);

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_folder_deleted",
      entityType: "note_folder",
      entityId: folderId,
      metadata: { name: existing.name }
    });

    return { success: true };
  });
};
