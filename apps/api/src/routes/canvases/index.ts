import {
  batchUpdateCanvasNodesSchema,
  createCanvasEdgeSchema,
  createCanvasLayerSchema,
  createCanvasNodeSchema,
  createIdeaCanvasSchema,
  ideaCanvasEdgeSchema,
  ideaCanvasLayerSchema,
  ideaCanvasNodeSchema,
  ideaCanvasSchema,
  ideaCanvasSummarySchema,
  reorderCanvasLayersSchema,
  updateCanvasEdgeSchema,
  updateCanvasLayerSchema,
  updateCanvasNodeSchema,
  updateCanvasSettingsSchema,
  updateIdeaCanvasSchema,
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { generateCanvasPdf, readImageSize } from "../../lib/pdf-canvas.js";
import { notFound } from "../../lib/errors.js";
import { softDeleteData } from "../../lib/soft-delete.js";
import { householdParamsSchema as householdParams } from "../../lib/schemas.js";

const canvasParams = householdParams.extend({ canvasId: z.string().cuid() });
const nodeParams = canvasParams.extend({ nodeId: z.string().cuid() });
const edgeParams = canvasParams.extend({ edgeId: z.string().cuid() });
const layerParams = canvasParams.extend({ layerId: z.string().cuid() });

const canvasInclude = {
  nodes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  edges: { orderBy: { createdAt: "asc" } },
  layers: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.IdeaCanvasInclude;

function serializeNode(n: {
  id: string; canvasId: string; entryId: string | null; label: string; body: string | null;
  x: number; y: number; x2: number; y2: number; width: number; height: number;
  color: string | null; strokeColor: string | null; fillColor: string | null; strokeWidth: number;
  fontSize?: number;
  shape: string; objectType: string; rotation: number; sortOrder: number; imageUrl: string | null;
  maskJson?: string | null;
  wallThickness?: number; wallAngle?: number | null; wallHeight?: number | null; physicalLength?: number | null;
  parentNodeId?: string | null;
  pointAx?: number | null; pointAy?: number | null; pointBx?: number | null; pointBy?: number | null;
  pointsJson?: string | null;
  groupId?: string | null;
  layerId?: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return ideaCanvasNodeSchema.parse({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  });
}

function serializeEdge(e: { id: string; canvasId: string; sourceNodeId: string; targetNodeId: string; label: string | null; style: string; createdAt: Date; updatedAt: Date }) {
  return ideaCanvasEdgeSchema.parse({
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  });
}

type CanvasWithRelations = {
  id: string; householdId: string; name: string; entityType: string | null; entityId: string | null;
  zoom: number; panX: number; panY: number;
  physicalWidth: number | null; physicalHeight: number | null; physicalUnit: string | null;
  backgroundImageUrl: string | null; backgroundImageOpacity: number; snapToGrid: boolean; gridSize: number;
  canvasMode: string; showDimensions: boolean;
  guides?: unknown;
  createdById: string; createdAt: Date; updatedAt: Date; deletedAt?: Date | null;
  nodes: Array<{
    id: string; canvasId: string; entryId: string | null; label: string; body: string | null;
    x: number; y: number; x2: number; y2: number; width: number; height: number;
    color: string | null; strokeColor: string | null; fillColor: string | null; strokeWidth: number;
    fontSize?: number;
    shape: string; objectType: string; rotation: number; sortOrder: number; imageUrl: string | null;
    maskJson?: string | null;
    wallThickness?: number; wallAngle?: number | null; physicalLength?: number | null;
    parentNodeId?: string | null;
    pointAx?: number | null; pointAy?: number | null; pointBx?: number | null; pointBy?: number | null;
    groupId?: string | null;
    layerId?: string | null;
    createdAt: Date; updatedAt: Date;
  }>;
  edges: Array<{ id: string; canvasId: string; sourceNodeId: string; targetNodeId: string; label: string | null; style: string; createdAt: Date; updatedAt: Date }>;
  layers: Array<{ id: string; canvasId: string; name: string; visible: boolean; locked: boolean; sortOrder: number; opacity: number; createdAt: Date; updatedAt: Date }>;
};

function serializeCanvas(c: CanvasWithRelations) {
  return ideaCanvasSchema.parse({
    ...c,
    guides: Array.isArray(c.guides) ? c.guides : [],
    nodes: c.nodes.map(serializeNode),
    edges: c.edges.map(serializeEdge),
    layers: c.layers.map((l) => ideaCanvasLayerSchema.parse({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

function serializeSummary(c: {
  id: string; householdId: string; name: string; entityType: string | null; entityId: string | null;
  canvasMode: string;
  createdAt: Date; updatedAt: Date;
  _count: { nodes: number; edges: number };
}) {
  return ideaCanvasSummarySchema.parse({
    id: c.id,
    householdId: c.householdId,
    name: c.name,
    entityType: c.entityType,
    entityId: c.entityId,
    canvasMode: c.canvasMode,
    nodeCount: c._count.nodes,
    edgeCount: c._count.edges,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

export const ideaCanvasRoutes: FastifyPluginAsync = async (app) => {

  // ─── Canvas CRUD ───────────────────────────────────────────────────────────

  // GET /v1/households/:householdId/canvases — list summaries
  // Optional query params: ?entityType=asset&entityId=xxx
  app.get("/v1/households/:householdId/canvases", async (request) => {
    const { householdId } = householdParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const query = z.object({
      entityType: z.string().max(50).optional(),
      entityId: z.string().optional(),
      include: z.enum(["geometry"]).optional(),
    }).parse(request.query);

    const where = {
      householdId,
      deletedAt: null,
      ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
      ...(query.entityId !== undefined ? { entityId: query.entityId } : {}),
    };

    if (query.include === "geometry") {
      const canvases = await app.prisma.ideaCanvas.findMany({
        where,
        include: {
          nodes: {
            select: {
              id: true, x: true, y: true, x2: true, y2: true, width: true, height: true,
              objectType: true, shape: true, color: true, strokeColor: true, fillColor: true,
              strokeWidth: true, rotation: true, sortOrder: true, label: true, imageUrl: true,
              maskJson: true, pointsJson: true,
              pointAx: true, pointAy: true, pointBx: true, pointBy: true,
              wallThickness: true, wallAngle: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          edges: {
            select: { id: true, sourceNodeId: true, targetNodeId: true, label: true, style: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      return canvases.map((c) => ({
        id: c.id,
        householdId: c.householdId,
        name: c.name,
        entityType: c.entityType,
        entityId: c.entityId,
        canvasMode: c.canvasMode,
        nodes: c.nodes,
        edges: c.edges,
        updatedAt: c.updatedAt.toISOString(),
      }));
    }

    const canvases = await app.prisma.ideaCanvas.findMany({
      where,
      include: { _count: { select: { nodes: true, edges: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return canvases.map(serializeSummary);
  });

  // GET /v1/households/:householdId/canvases/:canvasId — get full canvas with nodes + edges + layers
  app.get("/v1/households/:householdId/canvases/:canvasId", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    let canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
      include: canvasInclude,
    });
    if (!canvas) return notFound(reply, "Canvas");

    // Backward-compat: auto-create a default layer if none exist
    if (!canvas.layers || canvas.layers.length === 0) {
      await app.prisma.ideaCanvasLayer.create({
        data: { canvas: { connect: { id: canvasId } }, name: "Default", sortOrder: 0 },
      });
      canvas = await app.prisma.ideaCanvas.findFirst({
        where: { id: canvasId },
        include: canvasInclude,
      }) as typeof canvas;
    }

    return serializeCanvas(canvas as unknown as CanvasWithRelations);
  });

  // GET /v1/households/:householdId/canvases/:canvasId/export/pdf
  app.get("/v1/households/:householdId/canvases/:canvasId/export/pdf", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
      include: canvasInclude,
    });
    if (!canvas) return notFound(reply, "Canvas");

    const nodes = (canvas as unknown as CanvasWithRelations).nodes;
    const ppu = canvas.gridSize > 0 ? canvas.gridSize : null;

    // Resolve background image from S3 if stored as attachment reference
    let backgroundImage: Parameters<typeof generateCanvasPdf>[0]["backgroundImage"];
    if (canvas.backgroundImageUrl?.startsWith("attachment:")) {
      const attachmentId = canvas.backgroundImageUrl.slice("attachment:".length);
      const attachment = await app.prisma.attachment.findFirst({
        where: { id: attachmentId, householdId, deletedAt: null },
      });
      if (attachment) {
        const buf = await app.storage.getObjectBuffer(attachment.storageKey);
        if (buf) {
          const dims = readImageSize(buf);
          if (dims) {
            backgroundImage = {
              buffer: buf,
              x: canvas.backgroundImageX,
              y: canvas.backgroundImageY,
              scale: canvas.backgroundImageScale,
              opacity: canvas.backgroundImageOpacity,
              naturalWidth: dims.width,
              naturalHeight: dims.height,
            };
          }
        }
      }
    }

    // Resolve node images from S3 (only for image/object nodes with attachment references)
    const nodeImages = new Map<string, Buffer>();
    const imageNodes = nodes.filter(
      (n) => (n.objectType === "image" || n.objectType === "object") && n.imageUrl?.startsWith("attachment:"),
    );
    await Promise.all(
      imageNodes.map(async (n) => {
        const attachmentId = n.imageUrl!.slice("attachment:".length);
        const attachment = await app.prisma.attachment.findFirst({
          where: { id: attachmentId, householdId, deletedAt: null },
        });
        if (!attachment) return;
        const buf = await app.storage.getObjectBuffer(attachment.storageKey);
        if (buf) nodeImages.set(n.id, buf);
      }),
    );

    const doc = generateCanvasPdf({
      name: canvas.name,
      canvasMode: canvas.canvasMode,
      physicalUnit: canvas.physicalUnit,
      pixelsPerUnit: ppu,
      showDimensions: canvas.showDimensions,
      backgroundImage,
      nodeImages: nodeImages.size > 0 ? nodeImages : undefined,
      nodes: nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        x2: n.x2,
        y2: n.y2,
        width: n.width,
        height: n.height,
        objectType: n.objectType,
        shape: n.shape,
        label: n.label,
        color: n.color,
        strokeColor: n.strokeColor,
        fillColor: n.fillColor,
        strokeWidth: n.strokeWidth,
        rotation: n.rotation,
        sortOrder: n.sortOrder,
        maskJson: n.maskJson,
        pointsJson: n.pointsJson,
        pointAx: n.pointAx,
        pointAy: n.pointAy,
        pointBx: n.pointBx,
        pointBy: n.pointBy,
        wallThickness: n.wallThickness ?? null,
        fontSize: n.fontSize ?? 14,
      })),
      edges: (canvas as unknown as CanvasWithRelations).edges.map((e) => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        label: e.label,
        style: e.style,
      })),
    });

    const safeName = canvas.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `attachment; filename="${safeName}.pdf"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  // POST /v1/households/:householdId/canvases — create
  app.post("/v1/households/:householdId/canvases", async (request, reply) => {
    const { householdId } = householdParams.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = createIdeaCanvasSchema.parse(request.body);

    const canvas = await app.prisma.ideaCanvas.create({
      data: {
        household: { connect: { id: householdId } },
        createdBy: { connect: { id: userId } },
        name: input.name,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        canvasMode: (input.canvasMode ?? "diagram") as "diagram" | "floorplan" | "freehand",
        layers: {
          create: [{ name: "Default", sortOrder: 0 }],
        },
      },
      include: canvasInclude,
    });

        await createActivityLogger(app.prisma, userId).log("idea_canvas", canvas.id, "idea_canvas_created", householdId, { name: canvas.name });

    reply.code(201);
    return serializeCanvas(canvas as unknown as CanvasWithRelations);
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId — update name/viewport
  app.patch("/v1/households/:householdId/canvases/:canvasId", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = updateIdeaCanvasSchema.parse(request.body);

    const existing = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!existing) return notFound(reply, "Canvas");

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.zoom !== undefined) data.zoom = input.zoom;
    if (input.panX !== undefined) data.panX = input.panX;
    if (input.panY !== undefined) data.panY = input.panY;

    const canvas = await app.prisma.ideaCanvas.update({
      where: { id: canvasId },
      data,
      include: canvasInclude,
    });

    if (input.name !== undefined) {
            await createActivityLogger(app.prisma, userId).log("idea_canvas", canvas.id, "idea_canvas_updated", householdId, { name: canvas.name });
    }

    return serializeCanvas(canvas as unknown as CanvasWithRelations);
  });

  // DELETE /v1/households/:householdId/canvases/:canvasId — soft delete
  app.delete("/v1/households/:householdId/canvases/:canvasId", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!existing) return notFound(reply, "Canvas");

    await app.prisma.ideaCanvas.update({
      where: { id: canvasId },
      data: softDeleteData(),
    });

        await createActivityLogger(app.prisma, userId).log("idea_canvas", canvasId, "idea_canvas_deleted", householdId, { name: existing.name });

    reply.code(204);
    return;
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/settings — update physical dimensions, snap, background
  app.patch("/v1/households/:householdId/canvases/:canvasId/settings", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = updateCanvasSettingsSchema.parse(request.body);

    const existing = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!existing) return notFound(reply, "Canvas");

    const data: Record<string, unknown> = {};
    if (input.physicalWidth !== undefined) data.physicalWidth = input.physicalWidth;
    if (input.physicalHeight !== undefined) data.physicalHeight = input.physicalHeight;
    if (input.physicalUnit !== undefined) data.physicalUnit = input.physicalUnit;
    if (input.backgroundImageUrl !== undefined) data.backgroundImageUrl = input.backgroundImageUrl;
    if (input.backgroundImageOpacity !== undefined) data.backgroundImageOpacity = input.backgroundImageOpacity;
    if (input.backgroundImageX !== undefined) data.backgroundImageX = input.backgroundImageX;
    if (input.backgroundImageY !== undefined) data.backgroundImageY = input.backgroundImageY;
    if (input.backgroundImageScale !== undefined) data.backgroundImageScale = input.backgroundImageScale;
    if (input.snapToGrid !== undefined) data.snapToGrid = input.snapToGrid;
    if (input.gridSize !== undefined) data.gridSize = input.gridSize;
    if (input.showDimensions !== undefined) data.showDimensions = input.showDimensions;
    if (input.guides !== undefined) data.guides = input.guides;

    const canvas = await app.prisma.ideaCanvas.update({
      where: { id: canvasId },
      data,
      include: canvasInclude,
    });

    return serializeCanvas(canvas as unknown as CanvasWithRelations);
  });

  // ─── Node CRUD ─────────────────────────────────────────────────────────────

  // POST /v1/households/:householdId/canvases/:canvasId/nodes
  app.post("/v1/households/:householdId/canvases/:canvasId/nodes", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = createCanvasNodeSchema.parse(request.body);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!canvas) return notFound(reply, "Canvas");

    const node = await app.prisma.ideaCanvasNode.create({
      data: {
        canvas: { connect: { id: canvasId } },
        label: input.label,
        body: input.body ?? null,
        ...(input.entryId ? { entry: { connect: { id: input.entryId } } } : {}),
        x: input.x ?? 0,
        y: input.y ?? 0,
        x2: input.x2 ?? 0,
        y2: input.y2 ?? 0,
        width: input.width ?? 160,
        height: input.height ?? 80,
        color: input.color ?? null,
        strokeColor: input.strokeColor ?? null,
        fillColor: input.fillColor ?? null,
        strokeWidth: input.strokeWidth ?? 1,
        shape: input.shape ?? "rectangle",
        objectType: input.objectType ?? "flowchart",
        rotation: input.rotation ?? 0,
        sortOrder: input.sortOrder ?? 0,
        imageUrl: input.imageUrl ?? null,
        wallThickness: input.wallThickness ?? 6,
        wallAngle: input.wallAngle ?? null,
        wallHeight: input.wallHeight ?? null,
        physicalLength: input.physicalLength ?? null,
        parentNodeId: input.parentNodeId ?? null,
        pointAx: input.pointAx ?? null,
        pointAy: input.pointAy ?? null,
        pointBx: input.pointBx ?? null,
        pointBy: input.pointBy ?? null,
        pointsJson: input.pointsJson ?? null,
        ...(input.layerId ? { layer: { connect: { id: input.layerId } } } : {}),
      },
    });

    reply.code(201);
    return serializeNode(node);
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/nodes/:nodeId
  app.patch("/v1/households/:householdId/canvases/:canvasId/nodes/:nodeId", async (request, reply) => {
    const { householdId, canvasId, nodeId } = nodeParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = updateCanvasNodeSchema.parse(request.body);

    const node = await app.prisma.ideaCanvasNode.findFirst({
      where: { id: nodeId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!node) return notFound(reply, "Node");

    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data.label = input.label;
    if (input.body !== undefined) data.body = input.body;
    if (input.entryId !== undefined) data.entryId = input.entryId;
    if (input.x !== undefined) data.x = input.x;
    if (input.y !== undefined) data.y = input.y;
    if (input.x2 !== undefined) data.x2 = input.x2;
    if (input.y2 !== undefined) data.y2 = input.y2;
    if (input.width !== undefined) data.width = input.width;
    if (input.height !== undefined) data.height = input.height;
    if (input.color !== undefined) data.color = input.color;
    if (input.strokeColor !== undefined) data.strokeColor = input.strokeColor;
    if (input.fillColor !== undefined) data.fillColor = input.fillColor;
    if (input.strokeWidth !== undefined) data.strokeWidth = input.strokeWidth;
    if (input.shape !== undefined) data.shape = input.shape;
    if (input.objectType !== undefined) data.objectType = input.objectType;
    if (input.rotation !== undefined) data.rotation = input.rotation;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.wallThickness !== undefined) data.wallThickness = input.wallThickness;
    if (input.wallAngle !== undefined) data.wallAngle = input.wallAngle;
    if (input.physicalLength !== undefined) data.physicalLength = input.physicalLength;
    if (input.parentNodeId !== undefined) data.parentNodeId = input.parentNodeId;
    if (input.pointAx !== undefined) data.pointAx = input.pointAx;
    if (input.pointAy !== undefined) data.pointAy = input.pointAy;
    if (input.pointBx !== undefined) data.pointBx = input.pointBx;
    if (input.pointBy !== undefined) data.pointBy = input.pointBy;
    if (input.wallHeight !== undefined) data.wallHeight = input.wallHeight;
    if (input.pointsJson !== undefined) data.pointsJson = input.pointsJson;
    if (input.layerId !== undefined) data.layerId = input.layerId;

    const updated = await app.prisma.ideaCanvasNode.update({
      where: { id: nodeId },
      data,
    });

    return serializeNode(updated);
  });

  // DELETE /v1/households/:householdId/canvases/:canvasId/nodes/:nodeId
  app.delete("/v1/households/:householdId/canvases/:canvasId/nodes/:nodeId", async (request, reply) => {
    const { householdId, canvasId, nodeId } = nodeParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const node = await app.prisma.ideaCanvasNode.findFirst({
      where: { id: nodeId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!node) return notFound(reply, "Node");

    await app.prisma.ideaCanvasNode.delete({ where: { id: nodeId } });

    reply.code(204);
    return;
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/nodes/batch — bulk position update
  app.patch("/v1/households/:householdId/canvases/:canvasId/nodes/batch", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = batchUpdateCanvasNodesSchema.parse(request.body);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!canvas) return notFound(reply, "Canvas");

    await app.prisma.$transaction(
      input.nodes.map((n) => {
        const data: Record<string, unknown> = {};
        if (n.x !== undefined) data.x = n.x;
        if (n.y !== undefined) data.y = n.y;
        if (n.x2 !== undefined) data.x2 = n.x2;
        if (n.y2 !== undefined) data.y2 = n.y2;
        if (n.width !== undefined) data.width = n.width;
        if (n.height !== undefined) data.height = n.height;
        if (n.wallAngle !== undefined) data.wallAngle = n.wallAngle;
        if (n.sortOrder !== undefined) data.sortOrder = n.sortOrder;
        if (n.layerId !== undefined) data.layerId = n.layerId;
        return app.prisma.ideaCanvasNode.updateMany({
          where: { id: n.id, canvasId },
          data,
        });
      })
    );

    // Return updated canvas
    const updated = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId },
      include: canvasInclude,
    });

    return serializeCanvas(updated as unknown as CanvasWithRelations);
  });

  // ─── Edge CRUD ─────────────────────────────────────────────────────────────

  // POST /v1/households/:householdId/canvases/:canvasId/edges
  app.post("/v1/households/:householdId/canvases/:canvasId/edges", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = createCanvasEdgeSchema.parse(request.body);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!canvas) return notFound(reply, "Canvas");

    if (input.sourceNodeId === input.targetNodeId) {
      return reply.code(400).send({ message: "Self-loops are not allowed" });
    }

    // Verify source and target nodes belong to this canvas and are flowchart nodes
    const [sourceNode, targetNode] = await Promise.all([
      app.prisma.ideaCanvasNode.findFirst({ where: { id: input.sourceNodeId, canvasId } }),
      app.prisma.ideaCanvasNode.findFirst({ where: { id: input.targetNodeId, canvasId } }),
    ]);
    if (!sourceNode || !targetNode) {
      return reply.code(400).send({ message: "Source and target nodes must belong to the same canvas" });
    }
    const EDGE_SUPPORTED_TYPES = new Set(["flowchart", "rect", "circle", "text"]);
    if (!EDGE_SUPPORTED_TYPES.has(sourceNode.objectType) || !EDGE_SUPPORTED_TYPES.has(targetNode.objectType)) {
      return reply.code(400).send({ message: "Edges can only connect diagram nodes, not floorplan elements" });
    }

    const edge = await app.prisma.ideaCanvasEdge.create({
      data: {
        canvas: { connect: { id: canvasId } },
        sourceNode: { connect: { id: input.sourceNodeId } },
        targetNode: { connect: { id: input.targetNodeId } },
        label: input.label ?? null,
        style: input.style ?? "solid",
      },
    });

    reply.code(201);
    return serializeEdge(edge);
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/edges/:edgeId
  app.patch("/v1/households/:householdId/canvases/:canvasId/edges/:edgeId", async (request, reply) => {
    const { householdId, canvasId, edgeId } = edgeParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = updateCanvasEdgeSchema.parse(request.body);

    const edge = await app.prisma.ideaCanvasEdge.findFirst({
      where: { id: edgeId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!edge) return notFound(reply, "Edge");

    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data.label = input.label;
    if (input.style !== undefined) data.style = input.style;

    const updated = await app.prisma.ideaCanvasEdge.update({
      where: { id: edgeId },
      data,
    });

    return serializeEdge(updated);
  });

  // DELETE /v1/households/:householdId/canvases/:canvasId/edges/:edgeId
  app.delete("/v1/households/:householdId/canvases/:canvasId/edges/:edgeId", async (request, reply) => {
    const { householdId, canvasId, edgeId } = edgeParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const edge = await app.prisma.ideaCanvasEdge.findFirst({
      where: { id: edgeId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!edge) return notFound(reply, "Edge");

    await app.prisma.ideaCanvasEdge.delete({ where: { id: edgeId } });

    reply.code(204);
    return;
  });

  // ─── Layer CRUD ────────────────────────────────────────────────────────────

  // POST /v1/households/:householdId/canvases/:canvasId/layers
  app.post("/v1/households/:householdId/canvases/:canvasId/layers", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = createCanvasLayerSchema.parse(request.body);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
      include: { _count: { select: { layers: true } } },
    });
    if (!canvas) return notFound(reply, "Canvas");
    if ((canvas as unknown as { _count: { layers: number } })._count.layers >= 20) {
      return reply.code(400).send({ message: "Canvas cannot have more than 20 layers" });
    }

    const maxOrder = await app.prisma.ideaCanvasLayer.aggregate({
      where: { canvasId },
      _max: { sortOrder: true },
    });
    const nextOrder = input.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1);

    const layer = await app.prisma.ideaCanvasLayer.create({
      data: {
        canvas: { connect: { id: canvasId } },
        name: input.name,
        visible: input.visible ?? true,
        locked: input.locked ?? false,
        sortOrder: nextOrder,
        opacity: input.opacity ?? 1,
      },
    });

    reply.code(201);
    return ideaCanvasLayerSchema.parse({
      ...layer,
      createdAt: layer.createdAt.toISOString(),
      updatedAt: layer.updatedAt.toISOString(),
    });
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/layers/:layerId
  app.patch("/v1/households/:householdId/canvases/:canvasId/layers/:layerId", async (request, reply) => {
    const { householdId, canvasId, layerId } = layerParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = updateCanvasLayerSchema.parse(request.body);

    const layer = await app.prisma.ideaCanvasLayer.findFirst({
      where: { id: layerId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!layer) return notFound(reply, "Layer");

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.visible !== undefined) data.visible = input.visible;
    if (input.locked !== undefined) data.locked = input.locked;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.opacity !== undefined) data.opacity = input.opacity;

    const updated = await app.prisma.ideaCanvasLayer.update({ where: { id: layerId }, data });
    return ideaCanvasLayerSchema.parse({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  // PATCH /v1/households/:householdId/canvases/:canvasId/layers/reorder
  app.patch("/v1/households/:householdId/canvases/:canvasId/layers/reorder", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);
    const input = reorderCanvasLayersSchema.parse(request.body);

    await app.prisma.$transaction(
      input.layers.map((l) =>
        app.prisma.ideaCanvasLayer.updateMany({
          where: { id: l.id, canvasId },
          data: { sortOrder: l.sortOrder },
        })
      )
    );

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId },
      include: canvasInclude,
    });
    return serializeCanvas(canvas as unknown as CanvasWithRelations);
  });

  // DELETE /v1/households/:householdId/canvases/:canvasId/layers/:layerId
  app.delete("/v1/households/:householdId/canvases/:canvasId/layers/:layerId", async (request, reply) => {
    const { householdId, canvasId, layerId } = layerParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const layer = await app.prisma.ideaCanvasLayer.findFirst({
      where: { id: layerId, canvas: { id: canvasId, householdId, deletedAt: null } },
    });
    if (!layer) return notFound(reply, "Layer");

    // Check that we're not deleting the last layer
    const layerCount = await app.prisma.ideaCanvasLayer.count({ where: { canvasId } });
    if (layerCount <= 1) {
      return reply.code(400).send({ message: "Canvas must have at least one layer" });
    }

    // Reassign orphaned nodes to the lowest-sortOrder remaining layer
    const remaining = await app.prisma.ideaCanvasLayer.findFirst({
      where: { canvasId, id: { not: layerId } },
      orderBy: { sortOrder: "asc" },
    });
    if (remaining) {
      await app.prisma.ideaCanvasNode.updateMany({
        where: { canvasId, layerId },
        data: { layerId: remaining.id },
      });
    }

    await app.prisma.ideaCanvasLayer.delete({ where: { id: layerId } });

    reply.code(204);
    return;
  });
};
