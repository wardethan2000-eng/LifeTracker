import { scanResolutionResponseSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const scanResolveQuerySchema = z.object({
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
};