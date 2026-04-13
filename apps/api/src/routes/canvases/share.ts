import {
  canvasShareLinkSchema,
  createCanvasShareLinkSchema,
  updateCanvasShareLinkSchema,
  ideaCanvasSchema,
  ideaCanvasNodeSchema,
  ideaCanvasEdgeSchema,
  ideaCanvasLayerSchema,
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { nanoid } from "nanoid";
import { assertMembership } from "../../lib/asset-access.js";
import { notFound, forbidden } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const canvasParams = householdParamsSchema.extend({ canvasId: z.string().cuid() });
const shareLinkParams = canvasParams.extend({ shareLinkId: z.string().cuid() });
const tokenParams = z.object({ token: z.string().min(1) });

const canvasInclude = {
  nodes: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  edges: { orderBy: { createdAt: "asc" } },
  layers: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.IdeaCanvasInclude;

function serializeShareLink(link: {
  id: string; canvasId: string; token: string; permission: string;
  label: string | null; expiresAt: Date | null; createdById: string;
  createdAt: Date; updatedAt: Date;
}) {
  return canvasShareLinkSchema.parse({
    ...link,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  });
}

// ─── Household-scoped share link CRUD (requires auth) ────────────────────────

export const canvasShareRoutes: FastifyPluginAsync = async (app) => {
  // List share links for a canvas
  app.get("/v1/households/:householdId/canvases/:canvasId/share-links", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!canvas) return notFound(reply, "Canvas");

    const links = await app.prisma.canvasShareLink.findMany({
      where: { canvasId },
      orderBy: { createdAt: "desc" },
    });

    return links.map(serializeShareLink);
  });

  // Create a share link
  app.post("/v1/households/:householdId/canvases/:canvasId/share-links", async (request, reply) => {
    const { householdId, canvasId } = canvasParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: canvasId, householdId, deletedAt: null },
    });
    if (!canvas) return notFound(reply, "Canvas");

    const input = createCanvasShareLinkSchema.parse(request.body);

    const link = await app.prisma.canvasShareLink.create({
      data: {
        canvasId,
        token: nanoid(32),
        permission: input.permission ?? "view",
        label: input.label ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: request.auth.userId,
      },
    });

    reply.code(201);
    return serializeShareLink(link);
  });

  // Update a share link
  app.patch("/v1/households/:householdId/canvases/:canvasId/share-links/:shareLinkId", async (request, reply) => {
    const { householdId, canvasId, shareLinkId } = shareLinkParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const link = await app.prisma.canvasShareLink.findFirst({
      where: { id: shareLinkId, canvasId, canvas: { householdId, deletedAt: null } },
    });
    if (!link) return notFound(reply, "Share link");

    const input = updateCanvasShareLinkSchema.parse(request.body);
    const data: Prisma.CanvasShareLinkUpdateInput = {};
    if (input.permission !== undefined) data.permission = input.permission;
    if (input.label !== undefined) data.label = input.label;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    const updated = await app.prisma.canvasShareLink.update({
      where: { id: shareLinkId },
      data,
    });

    return serializeShareLink(updated);
  });

  // Delete a share link
  app.delete("/v1/households/:householdId/canvases/:canvasId/share-links/:shareLinkId", async (request, reply) => {
    const { householdId, canvasId, shareLinkId } = shareLinkParams.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const link = await app.prisma.canvasShareLink.findFirst({
      where: { id: shareLinkId, canvasId, canvas: { householdId, deletedAt: null } },
    });
    if (!link) return notFound(reply, "Share link");

    await app.prisma.canvasShareLink.delete({ where: { id: shareLinkId } });

    reply.code(204);
    return;
  });
};

// ─── Public route (no auth required) ─────────────────────────────────────────

export const publicCanvasShareRoutes: FastifyPluginAsync = async (app) => {
  // Get shared canvas by token
  app.get("/v1/public/canvas/:token", async (request, reply) => {
    const { token } = tokenParams.parse(request.params);

    const link = await app.prisma.canvasShareLink.findUnique({
      where: { token },
      include: {
        canvas: {
          include: canvasInclude,
        },
      },
    });

    if (!link || link.canvas.deletedAt) {
      return reply.code(404).send({ message: "This link is not valid." });
    }

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ message: "This link has expired." });
    }

    const c = link.canvas;
    const canvas = ideaCanvasSchema.parse({
      ...c,
      nodes: c.nodes.map(n => ideaCanvasNodeSchema.parse({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
      edges: c.edges.map(e => ideaCanvasEdgeSchema.parse({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      layers: c.layers.map(l => ideaCanvasLayerSchema.parse({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: null,
    });

    return {
      canvas,
      permission: link.permission,
      shareLabel: link.label,
    };
  });

  // Batch update nodes on a shared canvas (edit permission required)
  app.patch("/v1/public/canvas/:token/nodes", async (request, reply) => {
    const { token } = tokenParams.parse(request.params);

    const link = await app.prisma.canvasShareLink.findUnique({
      where: { token },
    });

    if (!link) {
      return reply.code(404).send({ message: "This link is not valid." });
    }

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ message: "This link has expired." });
    }

    if (link.permission !== "edit") {
      return reply.code(403).send({ message: "This link does not allow editing." });
    }

    const canvas = await app.prisma.ideaCanvas.findFirst({
      where: { id: link.canvasId, deletedAt: null },
    });
    if (!canvas) return reply.code(404).send({ message: "Canvas not found." });

    const input = z.object({
      updates: z.array(z.object({
        id: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
        x2: z.number().optional(),
        y2: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        rotation: z.number().optional(),
        label: z.string().optional(),
      })).min(1).max(200),
    }).parse(request.body);

    for (const update of input.updates) {
      const { id, ...data } = update;
      await app.prisma.ideaCanvasNode.updateMany({
        where: { id, canvasId: canvas.id },
        data,
      });
    }

    return { message: "ok" };
  });
};
