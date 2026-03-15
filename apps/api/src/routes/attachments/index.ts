import type { Attachment as PrismaAttachment, PrismaClient } from "@prisma/client";
import {
  attachmentListQuerySchema,
  attachmentSchema,
  createAttachmentUploadSchema,
  updateAttachmentSchema,
} from "@lifekeeper/types";
import type { AttachmentEntityType } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 52_428_800; // 50 MB

const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildStorageKey = (householdId: string, attachmentId: string, filename: string): string =>
  `households/${householdId}/attachments/${attachmentId}/${sanitizeFilename(filename)}`;

const toAttachmentResponse = (
  attachment: PrismaAttachment & { uploadedBy?: { id: string; displayName: string | null } | null }
) => attachmentSchema.parse({
  id: attachment.id,
  householdId: attachment.householdId,
  uploadedById: attachment.uploadedById,
  uploadedBy: attachment.uploadedBy
    ? { id: attachment.uploadedBy.id, displayName: attachment.uploadedBy.displayName }
    : null,
  entityType: attachment.entityType,
  entityId: attachment.entityId,
  storageKey: attachment.storageKey,
  originalFilename: attachment.originalFilename,
  mimeType: attachment.mimeType,
  fileSize: attachment.fileSize,
  thumbnailKey: attachment.thumbnailKey,
  ocrResult: attachment.ocrResult as Record<string, unknown> | null,
  caption: attachment.caption,
  sortOrder: attachment.sortOrder,
  status: attachment.status,
  createdAt: attachment.createdAt.toISOString(),
  updatedAt: attachment.updatedAt.toISOString(),
});

const validateEntityOwnership = async (
  prisma: PrismaClient,
  entityType: AttachmentEntityType,
  entityId: string,
  householdId: string
): Promise<boolean> => {
  switch (entityType) {
    case "asset": {
      const asset = await prisma.asset.findFirst({
        where: { id: entityId, householdId },
        select: { id: true },
      });
      return asset !== null;
    }
    case "maintenance_log": {
      const log = await prisma.maintenanceLog.findFirst({
        where: { id: entityId, asset: { householdId } },
        select: { id: true },
      });
      return log !== null;
    }
    case "project_note": {
      const note = await prisma.projectNote.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return note !== null;
    }
    case "project_expense": {
      const expense = await prisma.projectExpense.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return expense !== null;
    }
    case "project_phase": {
      const phase = await prisma.projectPhase.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return phase !== null;
    }
    case "project_task": {
      const task = await prisma.projectTask.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return task !== null;
    }
    case "inventory_item": {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: entityId, householdId },
        select: { id: true },
      });
      return item !== null;
    }
    default:
      return false;
  }
};

const householdParamsSchema = z.object({
  householdId: z.string().cuid(),
});

const attachmentParamsSchema = z.object({
  householdId: z.string().cuid(),
  attachmentId: z.string().cuid(),
});

export const attachmentRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/households/:householdId/attachments/upload
  app.post("/v1/households/:householdId/attachments/upload", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = createAttachmentUploadSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(body.mimeType)) {
      return reply.code(400).send({
        message: `Unsupported file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      });
    }

    if (body.fileSize > MAX_FILE_SIZE) {
      return reply.code(400).send({
        message: `File size exceeds the maximum of ${MAX_FILE_SIZE / 1_048_576} MB.`,
      });
    }

    const entityValid = await validateEntityOwnership(
      app.prisma,
      body.entityType,
      body.entityId,
      householdId
    );
    if (!entityValid) {
      return reply.code(404).send({ message: "Entity not found or does not belong to this household." });
    }

    const attachment = await app.prisma.attachment.create({
      data: {
        householdId,
        uploadedById: request.auth.userId,
        entityType: body.entityType,
        entityId: body.entityId,
        storageKey: "", // placeholder, will be updated below
        originalFilename: body.filename,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        caption: body.caption ?? null,
        status: "pending",
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    const storageKey = buildStorageKey(householdId, attachment.id, body.filename);

    const updatedAttachment = await app.prisma.attachment.update({
      where: { id: attachment.id },
      data: { storageKey },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    const uploadUrl = await app.storage.generateUploadUrl(storageKey, body.mimeType, body.fileSize);

    return reply.code(201).send({
      attachment: toAttachmentResponse(updatedAttachment),
      uploadUrl,
    });
  });

  // POST /v1/households/:householdId/attachments/:attachmentId/confirm
  app.post("/v1/households/:householdId/attachments/:attachmentId/confirm", async (request, reply) => {
    const { householdId, attachmentId } = attachmentParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const attachment = await app.prisma.attachment.findFirst({
      where: { id: attachmentId, householdId, status: "pending" },
    });
    if (!attachment) {
      return reply.code(404).send({ message: "Attachment not found." });
    }

    const headResult = await app.storage.headObject(attachment.storageKey);
    if (!headResult) {
      return reply.code(400).send({ message: "File not found in storage. The upload may not have completed." });
    }

    const updatedAttachment = await app.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: "active",
        fileSize: headResult.contentLength !== attachment.fileSize ? headResult.contentLength : undefined,
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    await logActivity(app.prisma, {
      householdId,
      userId: request.auth.userId,
      action: "attachment.confirmed",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: {
        parentEntityType: attachment.entityType,
        parentEntityId: attachment.entityId,
        filename: attachment.originalFilename,
      },
    });

    return toAttachmentResponse(updatedAttachment);
  });

  // GET /v1/households/:householdId/attachments
  app.get("/v1/households/:householdId/attachments", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = attachmentListQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Record<string, unknown> = { householdId, status: "active" };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const attachments = await app.prisma.attachment.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    return attachments.map(toAttachmentResponse);
  });

  // GET /v1/households/:householdId/attachments/:attachmentId/download
  app.get("/v1/households/:householdId/attachments/:attachmentId/download", async (request, reply) => {
    const { householdId, attachmentId } = attachmentParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const attachment = await app.prisma.attachment.findFirst({
      where: { id: attachmentId, householdId, status: "active" },
    });
    if (!attachment) {
      return reply.code(404).send({ message: "Attachment not found." });
    }

    const url = await app.storage.generateDownloadUrl(attachment.storageKey, attachment.originalFilename);
    return { url };
  });

  // PATCH /v1/households/:householdId/attachments/:attachmentId
  app.patch("/v1/households/:householdId/attachments/:attachmentId", async (request, reply) => {
    const { householdId, attachmentId } = attachmentParamsSchema.parse(request.params);
    const body = updateAttachmentSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const attachment = await app.prisma.attachment.findFirst({
      where: { id: attachmentId, householdId, status: "active" },
    });
    if (!attachment) {
      return reply.code(404).send({ message: "Attachment not found." });
    }

    const updatedAttachment = await app.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
      },
    });

    return toAttachmentResponse(updatedAttachment);
  });

  // DELETE /v1/households/:householdId/attachments/:attachmentId
  app.delete("/v1/households/:householdId/attachments/:attachmentId", async (request, reply) => {
    const { householdId, attachmentId } = attachmentParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const attachment = await app.prisma.attachment.findFirst({
      where: { id: attachmentId, householdId, status: { not: "deleted" } },
    });
    if (!attachment) {
      return reply.code(404).send({ message: "Attachment not found." });
    }

    await app.prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: "deleted" },
    });

    await logActivity(app.prisma, {
      householdId,
      userId: request.auth.userId,
      action: "attachment.deleted",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: {
        parentEntityType: attachment.entityType,
        parentEntityId: attachment.entityId,
        filename: attachment.originalFilename,
      },
    });

    return reply.code(204).send();
  });
};
