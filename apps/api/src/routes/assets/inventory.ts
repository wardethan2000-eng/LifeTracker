import type { Prisma } from "@prisma/client";
import { createAssetInventoryItemSchema } from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  getHouseholdInventoryItem
} from "../../lib/inventory.js";
import { toAssetInventoryLinkDetailResponse } from "../../lib/serializers/index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { assetParamsSchema } from "../../lib/schemas.js";

const assetInventoryItemParamsSchema = assetParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const assetInventoryQuerySchema = z.object({
  lowStock: z.coerce.boolean().optional()
});

export const assetInventoryRoutes: FastifyPluginAsync = async (app) => {
  const lowStockInventoryWhere = {
    reorderThreshold: { not: null },
    quantityOnHand: { lte: app.prisma.inventoryItem.fields.reorderThreshold }
  } satisfies Prisma.InventoryItemWhereInput;

  app.get("/v1/assets/:assetId/inventory", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = assetInventoryQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const links = await app.prisma.assetInventoryItem.findMany({
      where: {
        assetId: asset.id,
        ...(query.lowStock ? {
          inventoryItem: lowStockInventoryWhere
        } : {})
      },
      include: {
        inventoryItem: true,
        asset: {
          select: { id: true, name: true, category: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return links.map(toAssetInventoryLinkDetailResponse);
  });

  app.post("/v1/assets/:assetId/inventory", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createAssetInventoryItemSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const inventoryItem = await getHouseholdInventoryItem(app.prisma, asset.householdId, input.inventoryItemId);

    if (!inventoryItem) {
      return badRequest(reply, "Inventory item not found or belongs to a different household.");
    }

    const existing = await app.prisma.assetInventoryItem.findUnique({
      where: {
        assetId_inventoryItemId: {
          assetId: asset.id,
          inventoryItemId: inventoryItem.id
        }
      },
      include: {
        inventoryItem: true,
        asset: {
          select: { id: true, name: true, category: true }
        }
      }
    });

    if (existing) {
      return reply.code(409).send({ message: "Inventory item is already linked to this asset." });
    }

    const link = await app.prisma.assetInventoryItem.create({
      data: {
        assetId: asset.id,
        inventoryItemId: inventoryItem.id,
        notes: input.notes ?? null,
        recommendedQuantity: input.recommendedQuantity ?? null
      },
      include: {
        inventoryItem: true,
        asset: {
          select: { id: true, name: true, category: true }
        }
      }
    });

    return reply.code(201).send(toAssetInventoryLinkDetailResponse(link));
  });

  app.delete("/v1/assets/:assetId/inventory/:inventoryItemId", async (request, reply) => {
    const params = assetInventoryItemParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const link = await app.prisma.assetInventoryItem.findUnique({
      where: {
        assetId_inventoryItemId: {
          assetId: asset.id,
          inventoryItemId: params.inventoryItemId
        }
      }
    });

    if (!link) {
      return notFound(reply, "Inventory link");
    }

    await app.prisma.assetInventoryItem.delete({ where: { id: link.id } });

    return reply.code(204).send();
  });
};