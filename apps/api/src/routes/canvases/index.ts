import {
  batchUpdateCanvasNodesSchema,
  createCanvasEdgeSchema,
  createCanvasNodeSchema,
  createIdeaCanvasSchema,
  ideaCanvasEdgeSchema,
  ideaCanvasNodeSchema,
  ideaCanvasSchema,
  ideaCanvasSummarySchema,
  updateCanvasEdgeSchema,
  updateCanvasNodeSchema,
  updateCanvasSettingsSchema,
  updateIdeaCanvasSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { notFound } from "../../lib/errors.js";
import { softDeleteData } from "../../lib/soft-delete.js";
import { householdParamsSchema as householdParams } from "../../lib/schemas.js";

const canvasParams = householdParams.extend({ canvasId: z.string().cuid() });
const nodeParams = canvasParams.extend({ nodeId: z.string().cuid() });
const edgeParams = canvasParams.extend({ edgeId: z.string().cuid() });

const canvasInclude = {
  nodes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  edges: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.IdeaCanvasInclude;

function serializeNode(n: {
  id: string; canvasId: string; entryId: string | null; label: string; body: string | null;
  x: number; y: number; x2: number; y2: number; width: number; height: number;
  color: string | null; strokeColor: string | null; fillColor: string | null; strokeWidth: number;
  shape: string; objectType: string; rotation: number; sortOrder: number; imageUrl: string | null;
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
  backgroundImageUrl: string | null; snapToGrid: boolean; gridSize: number;
  createdById: string; createdAt: Date; updatedAt: Date; deletedAt?: Date | null;
  nodes: Array<{
    id: string; canvasId: string; entryId: string | null; label: string; body: string | null;
    x: number; y: number; x2: number; y2: number; width: number; height: number;
    color: string | null; strokeColor: string | null; fillColor: string | null; strokeWidth: number;
    shape: string; objectType: string; rotation: number; sortOrder: number; imageUrl: string | null;
    createdAt: Date; updatedAt: Date;
  }>;
  edges: Array<{ id: string; canvasId: string; sourceNodeId: string; targetNodeId: string; label: string | null; style: string; createdAt: Date; updatedAt: Date }>;
};

function serializeCanvas(c: CanvasWithRelations) {
  return ideaCanvasSchema.parse({
    ...c,
    nodes: c.nodes.map(serializeNode),
    edges: c.edges.map(serializeEdge),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

function serializeSummary(c: {
  id: string; householdId: string; name: string; entityType: string | null; entityId: string | null;
  createdAt: Date; updatedAt: Date;
  _count: { nodes: number; edges: number };
}) {
  return ideaCanvasSummarySchema.parse({
    id: c.id,
    householdId: c.householdId,
    name: c.name,
    entityType: c.entityType,
    entityId: c.entityId,
    nodeCount: c._count.nodes,
    edgeCount: c._count.edges,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  });
}

export const ideaCanvasRoutes: FastifyPluginAsync = async (app) => {

  // ─── Canvas CRUD ───────────────────────────────────────────────────────────

  // GET /v1/households/:householdId/canvases — list summaries
  app.get("/v1/households/:householdId/canvases", async (request) => {
    const { householdId } = householdParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const canvases = await app.prisma.ideaCanvas.findMany({
      where: { householdId, deletedAt: null },
      include: { _count: { select: { nodes: true, edges: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return canvases.map(serializeSummary);
  });

  // GET /v1/households/:householdId/canvases/:canvasId — get full canvas with nodes + edges
  app.get("/v1/households/:householdId/canvases/:canvasId", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
      include: canvasInclude,
    });
    if (!canvas) return notFound(reply, "Canvas");

    return serializeCanvas(canvas as unknown as CanvasWithRelations);
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
    if (input.snapToGrid !== undefined) data.snapToGrid = input.snapToGrid;
    if (input.gridSize !== undefined) data.gridSize = input.gridSize;

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
    if (sourceNode.objectType !== "flowchart" || targetNode.objectType !== "flowchart") {
      return reply.code(400).send({ message: "Edges can only connect flowchart nodes" });
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
};
