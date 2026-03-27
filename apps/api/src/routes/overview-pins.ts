import { createOverviewPinSchema, overviewPinSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const MAX_PINS_PER_ENTITY = 20;

export const overviewPinRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/overview-pins?entityType=asset&entityId=xxx
  app.get("/v1/overview-pins", async (request) => {
    const query = z.object({
      entityType: z.string().min(1).max(50),
      entityId: z.string().min(1).max(50),
    }).parse(request.query);

    const pins = await app.prisma.overviewPin.findMany({
      where: {
        userId: request.auth.userId,
        entityType: query.entityType,
        entityId: query.entityId,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (pins.length === 0) return [];

    const canvasIds = pins.filter((p) => p.itemType === "canvas").map((p) => p.itemId);
    const attachmentIds = pins.filter((p) => p.itemType === "attachment").map((p) => p.itemId);

    const [canvases, attachments] = await Promise.all([
      canvasIds.length > 0
        ? app.prisma.ideaCanvas.findMany({
            where: { id: { in: canvasIds } },
            select: {
              id: true,
              name: true,
              canvasMode: true,
              updatedAt: true,
              nodes: { select: { id: true } },
              edges: { select: { id: true } },
            },
          })
        : [],
      attachmentIds.length > 0
        ? app.prisma.attachment.findMany({
            where: { id: { in: attachmentIds } },
            select: {
              id: true,
              originalFilename: true,
              mimeType: true,
              thumbnailKey: true,
              caption: true,
              storageKey: true,
            },
          })
        : [],
    ]);

    const canvasMap = new Map(canvases.map((c) => [c.id, c]));
    const attachmentMap = new Map(attachments.map((a) => [a.id, a]));

    return pins.map((pin) => {
      const canvas = pin.itemType === "canvas" ? (canvasMap.get(pin.itemId) ?? null) : null;
      const attachment = pin.itemType === "attachment" ? (attachmentMap.get(pin.itemId) ?? null) : null;

      return overviewPinSchema.parse({
        id: pin.id,
        itemType: pin.itemType,
        itemId: pin.itemId,
        sortOrder: pin.sortOrder,
        createdAt: pin.createdAt.toISOString(),
        canvas: canvas
          ? {
              id: canvas.id,
              name: canvas.name,
              canvasMode: canvas.canvasMode,
              nodeCount: canvas.nodes.length,
              edgeCount: canvas.edges.length,
              updatedAt: canvas.updatedAt.toISOString(),
            }
          : null,
        attachment: attachment
          ? {
              id: attachment.id,
              originalFilename: attachment.originalFilename,
              mimeType: attachment.mimeType,
              thumbnailKey: attachment.thumbnailKey,
              caption: attachment.caption,
              storageKey: attachment.storageKey,
            }
          : null,
      });
    });
  });

  // POST /v1/overview-pins
  app.post("/v1/overview-pins", async (request, reply) => {
    const body = createOverviewPinSchema.parse(request.body);

    const existingCount = await app.prisma.overviewPin.count({
      where: {
        userId: request.auth.userId,
        entityType: body.entityType,
        entityId: body.entityId,
      },
    });

    if (existingCount >= MAX_PINS_PER_ENTITY) {
      return reply.code(422).send({
        message: `Maximum of ${MAX_PINS_PER_ENTITY} pinned items per overview. Remove a pin first.`,
      });
    }

    const pin = await app.prisma.overviewPin.upsert({
      where: {
        userId_entityType_entityId_itemType_itemId: {
          userId: request.auth.userId,
          entityType: body.entityType,
          entityId: body.entityId,
          itemType: body.itemType,
          itemId: body.itemId,
        },
      },
      update: {},
      create: {
        userId: request.auth.userId,
        entityType: body.entityType,
        entityId: body.entityId,
        itemType: body.itemType,
        itemId: body.itemId,
        sortOrder: existingCount,
      },
    });

    return reply.code(201).send({ id: pin.id });
  });

  // DELETE /v1/overview-pins/:pinId
  app.delete("/v1/overview-pins/:pinId", async (request, reply) => {
    const { pinId } = z.object({ pinId: z.string() }).parse(request.params);

    const pin = await app.prisma.overviewPin.findFirst({
      where: { id: pinId, userId: request.auth.userId },
    });

    if (!pin) {
      return reply.code(404).send({ message: "Pin not found." });
    }

    await app.prisma.overviewPin.delete({ where: { id: pinId } });

    return reply.code(204).send();
  });
};
