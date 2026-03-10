import type { Prisma } from "@prisma/client";
import {
  assetSchema,
  createAssetSchema,
  updateAssetSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  assertMembership,
  getAccessibleAsset
} from "../../lib/asset-access.js";

const assetIdParamsSchema = z.object({
  assetId: z.string().cuid()
});

const listAssetsQuerySchema = z.object({
  householdId: z.string().cuid(),
  includeArchived: z.coerce.boolean().default(false)
});

const toAssetResponse = (asset: {
  id: string;
  householdId: string;
  createdById: string;
  name: string;
  category: string;
  visibility: string;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: Date | null;
  customFields: Prisma.JsonValue;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => assetSchema.parse({
  ...asset,
  purchaseDate: asset.purchaseDate?.toISOString() ?? null,
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString()
});

export const assetRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets", async (request, reply) => {
    const query = listAssetsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.AssetWhereInput = {
      householdId: query.householdId,
      OR: [
        { visibility: "shared" },
        { createdById: request.auth.userId }
      ],
      ...(query.includeArchived ? {} : { isArchived: false })
    };

    const assets = await app.prisma.asset.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      }
    });

    return assets.map(toAssetResponse);
  });

  app.post("/v1/assets", async (request, reply) => {
    const input = createAssetSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, input.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const data: Prisma.AssetUncheckedCreateInput = {
      householdId: input.householdId,
      createdById: request.auth.userId,
      name: input.name,
      category: input.category,
      visibility: input.visibility,
      customFields: input.customFields
    };

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.manufacturer !== undefined) {
      data.manufacturer = input.manufacturer;
    }

    if (input.model !== undefined) {
      data.model = input.model;
    }

    if (input.serialNumber !== undefined) {
      data.serialNumber = input.serialNumber;
    }

    if (input.purchaseDate !== undefined) {
      data.purchaseDate = new Date(input.purchaseDate);
    }

    const asset = await app.prisma.asset.create({ data });

    return reply.code(201).send(toAssetResponse(asset));
  });

  app.get("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);

    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    return toAssetResponse(asset);
  });

  app.patch("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const input = updateAssetSchema.parse(request.body);

    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!existing) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const data: Prisma.AssetUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.category !== undefined) {
      data.category = input.category;
    }

    if (input.visibility !== undefined) {
      data.visibility = input.visibility;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.manufacturer !== undefined) {
      data.manufacturer = input.manufacturer;
    }

    if (input.model !== undefined) {
      data.model = input.model;
    }

    if (input.serialNumber !== undefined) {
      data.serialNumber = input.serialNumber;
    }

    if (input.purchaseDate !== undefined) {
      data.purchaseDate = new Date(input.purchaseDate);
    }

    if (input.customFields !== undefined) {
      data.customFields = input.customFields;
    }

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data
    });

    return toAssetResponse(asset);
  });

  app.delete("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);

    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!existing) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    await app.prisma.asset.delete({
      where: { id: existing.id }
    });

    return reply.code(204).send();
  });
};
