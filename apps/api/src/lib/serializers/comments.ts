import { commentSchema } from "@lifekeeper/types";
import { toShallowUserResponse } from "./users.js";

export const toCommentResponse = (comment: {
  id: string;
  assetId: string;
  authorId: string;
  body: string;
  parentCommentId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; displayName: string | null };
}) => commentSchema.parse({
  id: comment.id,
  assetId: comment.assetId,
  authorId: comment.authorId,
  author: toShallowUserResponse(comment.author),
  body: comment.body,
  parentCommentId: comment.parentCommentId,
  editedAt: comment.editedAt?.toISOString() ?? null,
  deletedAt: comment.deletedAt?.toISOString() ?? null,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString()
});