import { Prisma } from "@prisma/client";
import { commentSchema } from "@aegis/types";
import { toShallowUserResponse } from "./users.js";

export const commentResponseInclude = Prisma.validator<Prisma.CommentInclude>()({
  author: { select: { id: true, displayName: true } }
});

export type CommentResponseRecord = Prisma.CommentGetPayload<{
  include: typeof commentResponseInclude;
}>;

export const toCommentResponse = (comment: CommentResponseRecord) => commentSchema.parse({
  id: comment.id,
  householdId: comment.householdId,
  entityType: comment.entityType,
  entityId: comment.entityId,
  assetId: comment.assetId,
  projectId: comment.projectId,
  hobbyId: comment.hobbyId,
  inventoryItemId: comment.inventoryItemId,
  authorId: comment.authorId,
  author: toShallowUserResponse(comment.author),
  body: comment.body,
  parentCommentId: comment.parentCommentId,
  editedAt: comment.editedAt?.toISOString() ?? null,
  deletedAt: comment.deletedAt?.toISOString() ?? null,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString()
});