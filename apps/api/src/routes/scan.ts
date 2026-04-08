import { scanResolutionResponseSchema, scanSpaceSummarySchema } from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getSpaceBreadcrumb } from "../lib/spaces.js";
import { notFound } from "../lib/errors.js";

const scanResolveQuerySchema = z.object({
  tag: z.string().trim().min(1).max(120)
});

const scanTagParamsSchema = z.object({
  tag: z.string().trim().min(1).max(120)
});

export const scanRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/scan/resolve", async (request, reply) => {
    const query = scanResolveQuerySchema.parse(request.query);

    const asset = await app.prisma.asset.findFirst({
      where: {
        assetTag: query.tag,
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      }
    });

    if (asset) {
      return scanResolutionResponseSchema.parse({
        type: "asset",
        id: asset.id,
        name: asset.name,
        url: `/assets/${asset.id}`
      });
    }

    const space = await app.prisma.space.findFirst({
      where: {
        scanTag: query.tag,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        shortCode: true
      }
    });

    if (space) {
      return scanResolutionResponseSchema.parse({
        type: "space",
        id: space.id,
        name: space.name,
        shortCode: space.shortCode,
        url: `/inventory/spaces/${space.id}`
      });
    }

    const inventoryItem = await app.prisma.inventoryItem.findFirst({
      where: {
        scanTag: query.tag,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        scanTag: true,
        partNumber: true
      }
    });

    if (inventoryItem) {
      return scanResolutionResponseSchema.parse({
        type: "inventory_item",
        id: inventoryItem.id,
        name: inventoryItem.name,
        scanTag: inventoryItem.scanTag ?? query.tag,
        partNumber: inventoryItem.partNumber ?? null,
        url: `/inventory/${inventoryItem.id}`
      });
    }

    return reply.code(404).send({ message: "Scan tag not found." });
  });

  app.get("/v1/scan/spaces/:tag/summary", async (request, reply) => {
    const params = scanTagParamsSchema.parse(request.params);

    const space = await app.prisma.space.findFirst({
      where: {
        scanTag: params.tag,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        shortCode: true,
        scanTag: true,
        type: true
      }
    });

    if (!space) {
      return notFound(reply, "Space");
    }

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, space.id);

    return scanSpaceSummarySchema.parse({
      id: space.id,
      name: space.name,
      shortCode: space.shortCode,
      scanTag: space.scanTag,
      type: space.type,
      breadcrumb
    });
  });
};