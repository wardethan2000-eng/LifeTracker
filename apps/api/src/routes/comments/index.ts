import type { Prisma, PrismaClient } from "@prisma/client";
import {
  createCommentSchema,
  createOffsetPaginationQuerySchema,
  updateCommentSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset, requireHouseholdMembership } from "../../lib/asset-access.js";
import { logAndEmit } from "../../lib/activity-log.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import { buildOffsetPage } from "../../lib/pagination.js";
import { commentResponseInclude, toCommentResponse, type CommentResponseRecord } from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncCommentToSearchIndex } from "../../lib/search-index.js";
import { notFound } from "../../lib/errors.js";
import { softDeleteData } from "../../lib/soft-delete.js";
import { assetParamsSchema, hobbyParamsSchema, projectParamsSchema } from "../../lib/schemas.js";

const inventoryParamsSchema = z.object({
  householdId: z.string().cuid(),
  inventoryItemId: z.string().cuid()
});

const assetCommentParamsSchema = assetParamsSchema.extend({
  commentId: z.string().cuid()
});

const projectCommentParamsSchema = projectParamsSchema.extend({
  commentId: z.string().cuid()
});

const hobbyCommentParamsSchema = hobbyParamsSchema.extend({
  commentId: z.string().cuid()
});

const inventoryCommentParamsSchema = inventoryParamsSchema.extend({
  commentId: z.string().cuid()
});

const listCommentsQuerySchema = createOffsetPaginationQuerySchema({
  defaultLimit: 25,
  maxLimit: 100
});

type CommentRecord = CommentResponseRecord;

type ThreadedCommentResponse = ReturnType<typeof toCommentResponse> & {
  replies: ReturnType<typeof toCommentResponse>[];
};

type CommentEntityType = "asset" | "project" | "hobby" | "inventory_item";

type CommentTarget = {
  householdId: string;
  entityType: CommentEntityType;
  entityId: string;
  targetName: string;
  relationData: {
    assetId?: string;
    projectId?: string;
    hobbyId?: string;
    inventoryItemId?: string;
  };
};

const buildCommentThreads = (
  topLevelComments: CommentRecord[],
  replyComments: CommentRecord[]
): ThreadedCommentResponse[] => {
  const repliesByParent = new Map<string, ReturnType<typeof toCommentResponse>[]>();

  for (const reply of replyComments) {
    if (!reply.parentCommentId) {
      continue;
    }

    const existing = repliesByParent.get(reply.parentCommentId) ?? [];
    existing.push(toCommentResponse(reply));
    repliesByParent.set(reply.parentCommentId, existing);
  }

  return topLevelComments.map((comment) => ({
    ...toCommentResponse(comment),
    replies: repliesByParent.get(comment.id) ?? []
  }));
};

const buildCommentWhere = (target: CommentTarget) => ({
  householdId: target.householdId,
  entityType: target.entityType,
  entityId: target.entityId,
  deletedAt: null
});

const commentInclude = commentResponseInclude;

const listTargetComments = async (
  prisma: PrismaClientLike,
  target: CommentTarget,
  query: z.infer<typeof listCommentsQuerySchema>
) => {
  if (query.paginated) {
    const [topLevelComments, total] = await Promise.all([
      prisma.comment.findMany({
        where: {
          ...buildCommentWhere(target),
          parentCommentId: null
        },
        include: commentInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: query.offset,
        take: query.limit
      }),
      prisma.comment.count({
        where: {
          ...buildCommentWhere(target),
          parentCommentId: null
        }
      })
    ]);

    const replies = topLevelComments.length === 0
      ? []
      : await prisma.comment.findMany({
          where: {
            ...buildCommentWhere(target),
            parentCommentId: {
              in: topLevelComments.map((comment) => comment.id)
            }
          },
          include: commentInclude,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        });

    return buildOffsetPage(buildCommentThreads(topLevelComments, replies), total, query);
  }

  const comments = await prisma.comment.findMany({
    where: buildCommentWhere(target),
    include: commentInclude,
    orderBy: { createdAt: "asc" }
  });

  const topLevelComments = comments.filter((comment) => comment.parentCommentId === null).reverse();
  const replyComments = comments.filter((comment) => comment.parentCommentId !== null);

  return buildCommentThreads(topLevelComments, replyComments);
};

type PrismaClientLike = {
  comment: {
    findMany: PrismaClient["comment"]["findMany"];
    count: PrismaClient["comment"]["count"];
    findFirst: PrismaClient["comment"]["findFirst"];
    create: PrismaClient["comment"]["create"];
    update: PrismaClient["comment"]["update"];
    updateMany: PrismaClient["comment"]["updateMany"];
  };
};

type CommentMutationResult =
  | { comment: CommentRecord }
  | { error: { code: number; message: string } };

const createComment = async (
  app: Parameters<FastifyPluginAsync>[0],
  target: CommentTarget,
  userId: string,
  input: z.infer<typeof createCommentSchema>
): Promise<CommentMutationResult> => {
  if (input.parentCommentId) {
    const parent = await app.prisma.comment.findFirst({
      where: {
        id: input.parentCommentId,
        ...buildCommentWhere(target)
      }
    });

    if (!parent) {
      return { error: { code: 400, message: "Parent comment not found for this target." } } as const;
    }
  }

  const comment = await app.prisma.comment.create({
    data: {
      householdId: target.householdId,
      entityType: target.entityType,
      entityId: target.entityId,
      authorId: userId,
      body: input.body,
      parentCommentId: input.parentCommentId ?? null,
      ...target.relationData
    },
    include: commentInclude
  });

    await logAndEmit(app.prisma, userId, {
    householdId: target.householdId,
    entityType: "comment",
    entityId: comment.id,
    action: "comment.created",
    metadata: {
        targetType: target.entityType,
        targetId: target.entityId,
        targetName: target.targetName,
        bodyPreview: comment.body.slice(0, 100)
      },
  });

  void syncCommentToSearchIndex(app.prisma, comment.id).catch(console.error);

  return { comment } as const;
};

const updateComment = async (
  app: Parameters<FastifyPluginAsync>[0],
  target: CommentTarget,
  commentId: string,
  userId: string,
  input: z.infer<typeof updateCommentSchema>
): Promise<CommentMutationResult> => {
  const existing = await app.prisma.comment.findFirst({
    where: {
      id: commentId,
      ...buildCommentWhere(target)
    }
  });

  if (!existing) {
    return { error: { code: 404, message: "Comment not found." } } as const;
  }

  if (existing.authorId !== userId) {
    return { error: { code: 403, message: "Only the author can edit this comment." } } as const;
  }

  const comment = await app.prisma.comment.update({
    where: { id: existing.id },
    data: {
      body: input.body,
      editedAt: new Date()
    },
    include: commentInclude
  });

    await logAndEmit(app.prisma, userId, {
    householdId: target.householdId,
    entityType: "comment",
    entityId: comment.id,
    action: "comment.updated",
    metadata: {
        targetType: target.entityType,
        targetId: target.entityId,
        targetName: target.targetName,
        bodyPreview: comment.body.slice(0, 100)
      },
  });

  void syncCommentToSearchIndex(app.prisma, comment.id).catch(console.error);

  return { comment } as const;
};

const deleteComment = async (
  app: Parameters<FastifyPluginAsync>[0],
  target: CommentTarget,
  commentId: string,
  userId: string
) => {
  const existing = await app.prisma.comment.findFirst({
    where: {
      id: commentId,
      ...buildCommentWhere(target)
    }
  });

  if (!existing) {
    return { error: { code: 404, message: "Comment not found." } } as const;
  }

  if (existing.authorId !== userId) {
    return { error: { code: 403, message: "Only the author can delete this comment." } } as const;
  }

  await app.prisma.$transaction(async (tx) => {
    await tx.comment.updateMany({
      where: {
        parentCommentId: existing.id,
        deletedAt: null
      },
      data: { parentCommentId: null }
    });

    await tx.comment.update({
      where: { id: existing.id },
      data: softDeleteData()
    });
  });

    await logAndEmit(app.prisma, userId, {
    householdId: target.householdId,
    entityType: "comment",
    entityId: existing.id,
    action: "comment.deleted",
    metadata: {
        targetType: target.entityType,
        targetId: target.entityId,
        targetName: target.targetName,
        bodyPreview: existing.body.slice(0, 100)
      },
  });

  void removeSearchIndexEntry(app.prisma, "comment", existing.id).catch(console.error);

  return { success: true } as const;
};

export const commentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/comments", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    return listTargetComments(app.prisma, {
      householdId: asset.householdId,
      entityType: "asset",
      entityId: asset.id,
      targetName: asset.name,
      relationData: { assetId: asset.id }
    }, query);
  });

  app.post("/v1/assets/:assetId/comments", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createCommentSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const result = await createComment(app, {
      householdId: asset.householdId,
      entityType: "asset",
      entityId: asset.id,
      targetName: asset.name,
      relationData: { assetId: asset.id }
    }, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(toCommentResponse(result.comment));
  });

  app.patch("/v1/assets/:assetId/comments/:commentId", async (request, reply) => {
    const params = assetCommentParamsSchema.parse(request.params);
    const input = updateCommentSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const result = await updateComment(app, {
      householdId: asset.householdId,
      entityType: "asset",
      entityId: asset.id,
      targetName: asset.name,
      relationData: { assetId: asset.id }
    }, params.commentId, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return toCommentResponse(result.comment);
  });

  app.delete("/v1/assets/:assetId/comments/:commentId", async (request, reply) => {
    const params = assetCommentParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const result = await deleteComment(app, {
      householdId: asset.householdId,
      entityType: "asset",
      entityId: asset.id,
      targetName: asset.name,
      relationData: { assetId: asset.id }
    }, params.commentId, request.auth.userId);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/projects/:projectId/comments", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    return listTargetComments(app.prisma, {
      householdId: project.householdId,
      entityType: "project",
      entityId: project.id,
      targetName: project.name,
      relationData: { projectId: project.id }
    }, query);
  });

  app.post("/v1/households/:householdId/projects/:projectId/comments", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const input = createCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    const result = await createComment(app, {
      householdId: project.householdId,
      entityType: "project",
      entityId: project.id,
      targetName: project.name,
      relationData: { projectId: project.id }
    }, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(toCommentResponse(result.comment));
  });

  app.patch("/v1/households/:householdId/projects/:projectId/comments/:commentId", async (request, reply) => {
    const params = projectCommentParamsSchema.parse(request.params);
    const input = updateCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    const result = await updateComment(app, {
      householdId: project.householdId,
      entityType: "project",
      entityId: project.id,
      targetName: project.name,
      relationData: { projectId: project.id }
    }, params.commentId, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return toCommentResponse(result.comment);
  });

  app.delete("/v1/households/:householdId/projects/:projectId/comments/:commentId", async (request, reply) => {
    const params = projectCommentParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const project = await app.prisma.project.findFirst({
      where: { id: params.projectId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!project) {
      return notFound(reply, "Project");
    }

    const result = await deleteComment(app, {
      householdId: project.householdId,
      entityType: "project",
      entityId: project.id,
      targetName: project.name,
      relationData: { projectId: project.id }
    }, params.commentId, request.auth.userId);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/hobbies/:hobbyId/comments", async (request, reply) => {
    const params = hobbyParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: params.hobbyId, householdId: params.householdId },
      select: { id: true, householdId: true, name: true }
    });

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    return listTargetComments(app.prisma, {
      householdId: hobby.householdId,
      entityType: "hobby",
      entityId: hobby.id,
      targetName: hobby.name,
      relationData: { hobbyId: hobby.id }
    }, query);
  });

  app.post("/v1/households/:householdId/hobbies/:hobbyId/comments", async (request, reply) => {
    const params = hobbyParamsSchema.parse(request.params);
    const input = createCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: params.hobbyId, householdId: params.householdId },
      select: { id: true, householdId: true, name: true }
    });

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const result = await createComment(app, {
      householdId: hobby.householdId,
      entityType: "hobby",
      entityId: hobby.id,
      targetName: hobby.name,
      relationData: { hobbyId: hobby.id }
    }, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(toCommentResponse(result.comment));
  });

  app.patch("/v1/households/:householdId/hobbies/:hobbyId/comments/:commentId", async (request, reply) => {
    const params = hobbyCommentParamsSchema.parse(request.params);
    const input = updateCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: params.hobbyId, householdId: params.householdId },
      select: { id: true, householdId: true, name: true }
    });

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const result = await updateComment(app, {
      householdId: hobby.householdId,
      entityType: "hobby",
      entityId: hobby.id,
      targetName: hobby.name,
      relationData: { hobbyId: hobby.id }
    }, params.commentId, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return toCommentResponse(result.comment);
  });

  app.delete("/v1/households/:householdId/hobbies/:hobbyId/comments/:commentId", async (request, reply) => {
    const params = hobbyCommentParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: params.hobbyId, householdId: params.householdId },
      select: { id: true, householdId: true, name: true }
    });

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const result = await deleteComment(app, {
      householdId: hobby.householdId,
      entityType: "hobby",
      entityId: hobby.id,
      targetName: hobby.name,
      relationData: { hobbyId: hobby.id }
    }, params.commentId, request.auth.userId);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/inventory/:inventoryItemId/comments", async (request, reply) => {
    const params = inventoryParamsSchema.parse(request.params);
    const query = listCommentsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const inventoryItem = await app.prisma.inventoryItem.findFirst({
      where: { id: params.inventoryItemId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!inventoryItem) {
      return notFound(reply, "Inventory item");
    }

    return listTargetComments(app.prisma, {
      householdId: inventoryItem.householdId,
      entityType: "inventory_item",
      entityId: inventoryItem.id,
      targetName: inventoryItem.name,
      relationData: { inventoryItemId: inventoryItem.id }
    }, query);
  });

  app.post("/v1/households/:householdId/inventory/:inventoryItemId/comments", async (request, reply) => {
    const params = inventoryParamsSchema.parse(request.params);
    const input = createCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const inventoryItem = await app.prisma.inventoryItem.findFirst({
      where: { id: params.inventoryItemId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!inventoryItem) {
      return notFound(reply, "Inventory item");
    }

    const result = await createComment(app, {
      householdId: inventoryItem.householdId,
      entityType: "inventory_item",
      entityId: inventoryItem.id,
      targetName: inventoryItem.name,
      relationData: { inventoryItemId: inventoryItem.id }
    }, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(toCommentResponse(result.comment));
  });

  app.patch("/v1/households/:householdId/inventory/:inventoryItemId/comments/:commentId", async (request, reply) => {
    const params = inventoryCommentParamsSchema.parse(request.params);
    const input = updateCommentSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const inventoryItem = await app.prisma.inventoryItem.findFirst({
      where: { id: params.inventoryItemId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!inventoryItem) {
      return notFound(reply, "Inventory item");
    }

    const result = await updateComment(app, {
      householdId: inventoryItem.householdId,
      entityType: "inventory_item",
      entityId: inventoryItem.id,
      targetName: inventoryItem.name,
      relationData: { inventoryItemId: inventoryItem.id }
    }, params.commentId, request.auth.userId, input);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return toCommentResponse(result.comment);
  });

  app.delete("/v1/households/:householdId/inventory/:inventoryItemId/comments/:commentId", async (request, reply) => {
    const params = inventoryCommentParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const inventoryItem = await app.prisma.inventoryItem.findFirst({
      where: { id: params.inventoryItemId, householdId: params.householdId, deletedAt: null },
      select: { id: true, householdId: true, name: true }
    });

    if (!inventoryItem) {
      return notFound(reply, "Inventory item");
    }

    const result = await deleteComment(app, {
      householdId: inventoryItem.householdId,
      entityType: "inventory_item",
      entityId: inventoryItem.id,
      targetName: inventoryItem.name,
      relationData: { inventoryItemId: inventoryItem.id }
    }, params.commentId, request.auth.userId);

    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(204).send();
  });
};
