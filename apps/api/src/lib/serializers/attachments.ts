import type { Attachment as PrismaAttachment } from "@prisma/client";
import { attachmentSchema } from "@aegis/types";
import { toShallowUserResponse } from "./users.js";

export const toAttachmentResponse = (
  attachment: PrismaAttachment & { uploadedBy?: { id: string; displayName: string | null } | null }
) => attachmentSchema.parse({
  id: attachment.id,
  householdId: attachment.householdId,
  uploadedById: attachment.uploadedById,
  uploadedBy: attachment.uploadedBy ? toShallowUserResponse(attachment.uploadedBy) : null,
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
  deletedAt: attachment.deletedAt?.toISOString() ?? null,
  createdAt: attachment.createdAt.toISOString(),
  updatedAt: attachment.updatedAt.toISOString()
});