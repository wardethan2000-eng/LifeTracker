import {
  createCommentSchema,
  updateCommentSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { toCommentResponse } from "../../lib/serializers/index.js";
import { syncCommentToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const commentParamsSchema = assetParamsSchema.extend({
  commentId: z.string().cuid()
});

export const commentRoutes: FastifyPluginAsync = async (app) => {
  // ── List comments (threaded) ────────────────────────────────────

  app.get("/v1/assets/:assetId/comments", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const comments = await app.prisma.comment.findMany({
      where: { assetId: asset.id },
      include: {
        author: { select: { id: true, displayName: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    // Build threaded structure: top-level comments with nested replies
    type CommentWithReplies = ReturnType<typeof toCommentResponse> & { replies: ReturnType<typeof toCommentResponse>[] };
    const topLevel: CommentWithReplies[] = [];
    const childMap = new Map<string, ReturnType<typeof toCommentResponse>[]>();

    for (const comment of comments) {
      const response = toCommentResponse(comment);

      if (!comment.parentCommentId) {
        topLevel.push({ ...response, replies: [] });
      } else {
        if (!childMap.has(comment.parentCommentId)) {
          childMap.set(comment.parentCommentId, []);
        }

        childMap.get(comment.parentCommentId)!.push(response);
      }
    }

    // Attach replies to their parents
    for (const parent of topLevel) {
      parent.replies = childMap.get(parent.id) ?? [];
    }

    // Return top-level in descending createdAt order, replies in ascending
    topLevel.reverse();

    return topLevel;
  });

  // ── Create comment ──────────────────────────────────────────────

  app.post("/v1/assets/:assetId/comments", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createCommentSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    if (input.parentCommentId) {
      const parent = await app.prisma.comment.findFirst({
        where: { id: input.parentCommentId, assetId: asset.id }
      });

      if (!parent) {
        return reply.code(400).send({ message: "Parent comment not found or belongs to a different asset." });
      }
    }

    const comment = await app.prisma.comment.create({
      data: {
        assetId: asset.id,
        authorId: request.auth.userId,
        body: input.body,
        parentCommentId: input.parentCommentId ?? null
      },
      include: {
        author: { select: { id: true, displayName: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "comment.created",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        assetId: asset.id,
        assetName: asset.name,
        bodyPreview: comment.body.slice(0, 100)
      }
    });

    void syncCommentToSearchIndex(app.prisma, comment.id).catch(console.error);

    return reply.code(201).send(toCommentResponse(comment));
  });

  // ── Update comment (author only) ───────────────────────────────

  app.patch("/v1/assets/:assetId/comments/:commentId", async (request, reply) => {
    const params = commentParamsSchema.parse(request.params);
    const input = updateCommentSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.comment.findFirst({
      where: { id: params.commentId, assetId: asset.id }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Comment not found." });
    }

    if (existing.authorId !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the author can edit this comment." });
    }

    const comment = await app.prisma.comment.update({
      where: { id: existing.id },
      data: {
        body: input.body,
        editedAt: new Date()
      },
      include: {
        author: { select: { id: true, displayName: true } }
      }
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "comment.updated",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        assetId: asset.id,
        assetName: asset.name,
        bodyPreview: comment.body.slice(0, 100)
      }
    });

    void syncCommentToSearchIndex(app.prisma, comment.id).catch(console.error);

    return toCommentResponse(comment);
  });

  // ── Delete comment ──────────────────────────────────────────────

  app.delete("/v1/assets/:assetId/comments/:commentId", async (request, reply) => {
    const params = commentParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.comment.findFirst({
      where: { id: params.commentId, assetId: asset.id }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Comment not found." });
    }

    if (existing.authorId !== request.auth.userId) {
      return reply.code(403).send({ message: "Only the author can delete this comment." });
    }

    // Design choice: When deleting a parent comment, keep replies as orphaned
    // top-level comments so no discussion is lost. Set their parentCommentId to null.
    // This could be revisited to cascade-delete if desired.
    await app.prisma.$transaction(async (tx) => {
      await tx.comment.updateMany({
        where: { parentCommentId: existing.id },
        data: { parentCommentId: null }
      });

      await tx.comment.delete({ where: { id: existing.id } });
    });

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "comment.deleted",
      entityType: "comment",
      entityId: existing.id,
      metadata: {
        assetId: asset.id,
        assetName: asset.name,
        bodyPreview: existing.body.slice(0, 100)
      }
    });

    void removeSearchIndexEntry(app.prisma, "comment", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};
