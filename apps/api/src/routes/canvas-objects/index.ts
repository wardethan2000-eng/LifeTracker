import {
  createCanvasObjectSchema,
  updateCanvasObjectSchema,
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toCanvasObjectResponse } from "../../lib/serializers/index.js";
import { notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const canvasObjectParamsSchema = householdParamsSchema.extend({
  objectId: z.string().cuid(),
});

const listCanvasObjectsQuerySchema = z.object({
  category: z.string().optional(),
});

export const canvasObjectRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/canvas-objects
  app.get("/v1/households/:householdId/canvas-objects", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = listCanvasObjectsQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) return;

    const objects = await app.prisma.canvasObject.findMany({
      where: {
        householdId,
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(objects.map(toCanvasObjectResponse));
  });

  // GET /v1/households/:householdId/canvas-objects/:objectId
  app.get("/v1/households/:householdId/canvas-objects/:objectId", async (request, reply) => {
    const { householdId, objectId } = canvasObjectParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) return;

    const obj = await app.prisma.canvasObject.findFirst({
      where: { id: objectId, householdId, deletedAt: null },
    });
    if (!obj) return notFound(reply, "Canvas object not found");

    return reply.send(toCanvasObjectResponse(obj));
  });

  // POST /v1/households/:householdId/canvas-objects
  app.post("/v1/households/:householdId/canvas-objects", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const body = createCanvasObjectSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) return;

    const obj = await app.prisma.canvasObject.create({
      data: {
        householdId,
        name: body.name,
        category: body.category,
        imageSource: body.imageSource,
        presetKey: body.presetKey ?? null,
        attachmentId: body.attachmentId ?? null,
        maskData: body.maskData ?? null,
      },
    });

    const logger = createActivityLogger(app.prisma, userId);
    await logger.log("canvas_object", obj.id, "canvas_object.created", householdId, { name: obj.name });

    return reply.code(201).send(toCanvasObjectResponse(obj));
  });

  // PATCH /v1/households/:householdId/canvas-objects/:objectId
  app.patch("/v1/households/:householdId/canvas-objects/:objectId", async (request, reply) => {
    const { householdId, objectId } = canvasObjectParamsSchema.parse(request.params);
    const body = updateCanvasObjectSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) return;

    const existing = await app.prisma.canvasObject.findFirst({
      where: { id: objectId, householdId, deletedAt: null },
    });
    if (!existing) return notFound(reply, "Canvas object not found");

    const obj = await app.prisma.canvasObject.update({
      where: { id: objectId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.imageSource !== undefined ? { imageSource: body.imageSource } : {}),
        ...(body.maskData !== undefined ? { maskData: body.maskData } : {}),
        ...(body.attachmentId !== undefined ? { attachmentId: body.attachmentId } : {}),
      },
    });

    const logger = createActivityLogger(app.prisma, userId);
    await logger.log("canvas_object", obj.id, "canvas_object.updated", householdId, { name: obj.name });

    return reply.send(toCanvasObjectResponse(obj));
  });

  // DELETE /v1/households/:householdId/canvas-objects/:objectId
  app.delete("/v1/households/:householdId/canvas-objects/:objectId", async (request, reply) => {
    const { householdId, objectId } = canvasObjectParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) return;

    const existing = await app.prisma.canvasObject.findFirst({
      where: { id: objectId, householdId, deletedAt: null },
    });
    if (!existing) return notFound(reply, "Canvas object not found");

    await app.prisma.canvasObject.update({
      where: { id: objectId },
      data: { deletedAt: new Date() },
    });

    const logger = createActivityLogger(app.prisma, userId);
    await logger.log("canvas_object", objectId, "canvas_object.deleted", householdId, { name: existing.name });

    return reply.code(204).send();
  });
};
