import type { Prisma } from "@prisma/client";
import {
  assetSchema,
  createAssetSchema,
  createConditionAssessmentSchema,
  purchaseDetailsSchema,
  warrantyDetailsSchema,
  locationDetailsSchema,
  insuranceDetailsSchema,
  dispositionDetailsSchema,
  conditionEntrySchema,
  updateAssetSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  assertMembership,
  getAccessibleAsset
} from "../../lib/asset-access.js";
import { toAssetResponse } from "../../lib/presenters.js";

const assetIdParamsSchema = z.object({
  assetId: z.string().cuid()
});

const listAssetsQuerySchema = z.object({
  householdId: z.string().cuid(),
  includeArchived: z.coerce.boolean().default(false),
  includeDeleted: z.coerce.boolean().default(false)
});

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

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
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...(query.includeDeleted ? {} : { deletedAt: null })
    };

    const assets = await app.prisma.asset.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      }
    });

    return assets.map(a => toAssetResponse(a));
  });

  app.post("/v1/assets", async (request, reply) => {
    const input = createAssetSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, input.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    // Validate parent asset if specified
    if (input.parentAssetId) {
      const parent = await app.prisma.asset.findFirst({
        where: { id: input.parentAssetId, householdId: input.householdId },
        select: { id: true }
      });

      if (!parent) {
        return reply.code(400).send({ message: "Parent asset not found or belongs to a different household." });
      }
    }

    const data: Prisma.AssetUncheckedCreateInput = {
      householdId: input.householdId,
      createdById: request.auth.userId,
      name: input.name,
      category: input.category,
      visibility: input.visibility,
      assetTypeSource: input.assetTypeSource,
      assetTypeVersion: input.assetTypeVersion,
      fieldDefinitions: toInputJsonValue(input.fieldDefinitions),
      customFields: input.customFields
    };

    if (input.parentAssetId !== undefined) data.parentAssetId = input.parentAssetId;
    if (input.description !== undefined) data.description = input.description;
    if (input.manufacturer !== undefined) data.manufacturer = input.manufacturer;
    if (input.model !== undefined) data.model = input.model;
    if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber;
    if (input.purchaseDate !== undefined) data.purchaseDate = new Date(input.purchaseDate);
    if (input.assetTypeKey !== undefined) data.assetTypeKey = input.assetTypeKey;
    if (input.assetTypeLabel !== undefined) data.assetTypeLabel = input.assetTypeLabel;
    if (input.assetTypeDescription !== undefined) data.assetTypeDescription = input.assetTypeDescription;
    if (input.purchaseDetails !== undefined) data.purchaseDetails = toInputJsonValue(input.purchaseDetails);
    if (input.warrantyDetails !== undefined) data.warrantyDetails = toInputJsonValue(input.warrantyDetails);
    if (input.locationDetails !== undefined) data.locationDetails = toInputJsonValue(input.locationDetails);
    if (input.insuranceDetails !== undefined) data.insuranceDetails = toInputJsonValue(input.insuranceDetails);
    if (input.dispositionDetails !== undefined) data.dispositionDetails = toInputJsonValue(input.dispositionDetails);
    if (input.conditionScore !== undefined) data.conditionScore = input.conditionScore;

    const asset = await app.prisma.asset.create({ data });

    return reply.code(201).send(toAssetResponse(asset));
  });

  app.get("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);

    const asset = await app.prisma.asset.findFirst({
      where: {
        id: params.assetId,
        household: { members: { some: { userId: request.auth.userId } } },
        OR: [{ visibility: "shared" }, { createdById: request.auth.userId }]
      },
      include: {
        parentAsset: { select: { id: true, name: true, category: true } },
        childAssets: { select: { id: true, name: true, category: true } }
      }
    });

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    return toAssetResponse(asset, {
      parentAsset: asset.parentAsset,
      childAssets: asset.childAssets
    });
  });

  app.patch("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const input = updateAssetSchema.parse(request.body);

    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!existing) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    // Validate parent asset if specified
    if (input.parentAssetId !== undefined && input.parentAssetId !== null) {
      const parent = await app.prisma.asset.findFirst({
        where: { id: input.parentAssetId, householdId: existing.householdId },
        select: { id: true }
      });

      if (!parent) {
        return reply.code(400).send({ message: "Parent asset not found or belongs to a different household." });
      }

      if (input.parentAssetId === existing.id) {
        return reply.code(400).send({ message: "An asset cannot be its own parent." });
      }
    }

    const data: Prisma.AssetUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.description !== undefined) data.description = input.description;
    if (input.manufacturer !== undefined) data.manufacturer = input.manufacturer;
    if (input.model !== undefined) data.model = input.model;
    if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber;
    if (input.purchaseDate !== undefined) data.purchaseDate = new Date(input.purchaseDate);
    if (input.assetTypeKey !== undefined) data.assetTypeKey = input.assetTypeKey;
    if (input.assetTypeLabel !== undefined) data.assetTypeLabel = input.assetTypeLabel;
    if (input.assetTypeDescription !== undefined) data.assetTypeDescription = input.assetTypeDescription;
    if (input.assetTypeSource !== undefined) data.assetTypeSource = input.assetTypeSource;
    if (input.assetTypeVersion !== undefined) data.assetTypeVersion = input.assetTypeVersion;
    if (input.fieldDefinitions !== undefined) data.fieldDefinitions = toInputJsonValue(input.fieldDefinitions);
    if (input.customFields !== undefined) data.customFields = input.customFields;
    if (input.parentAssetId !== undefined) data.parentAssetId = input.parentAssetId;
    if (input.purchaseDetails !== undefined) data.purchaseDetails = toInputJsonValue(input.purchaseDetails);
    if (input.warrantyDetails !== undefined) data.warrantyDetails = toInputJsonValue(input.warrantyDetails);
    if (input.locationDetails !== undefined) data.locationDetails = toInputJsonValue(input.locationDetails);
    if (input.insuranceDetails !== undefined) data.insuranceDetails = toInputJsonValue(input.insuranceDetails);
    if (input.dispositionDetails !== undefined) data.dispositionDetails = toInputJsonValue(input.dispositionDetails);
    if (input.conditionScore !== undefined) data.conditionScore = input.conditionScore;

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data
    });

    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/archive", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return reply.code(404).send({ message: "Asset not found." });

    // Detach child assets so they become top-level
    await app.prisma.asset.updateMany({
      where: { parentAssetId: existing.id },
      data: { parentAssetId: null }
    });

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: { isArchived: true }
    });
    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/unarchive", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return reply.code(404).send({ message: "Asset not found." });

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: { isArchived: false }
    });
    return toAssetResponse(asset);
  });

  app.delete("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return reply.code(404).send({ message: "Asset not found." });

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });
    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/restore", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return reply.code(404).send({ message: "Asset not found." });

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: { deletedAt: null }
    });
    return toAssetResponse(asset);
  });

  // ── Child assets ───────────────────────────────────────────────────

  app.get("/v1/assets/:assetId/children", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const children = await app.prisma.asset.findMany({
      where: { parentAssetId: asset.id },
      orderBy: { createdAt: "desc" }
    });

    return children.map(c => toAssetResponse(c));
  });

  // ── Condition assessment ───────────────────────────────────────────

  app.post("/v1/assets/:assetId/condition", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const input = createConditionAssessmentSchema.parse(request.body);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!existing) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const history = Array.isArray(existing.conditionHistory) ? existing.conditionHistory : [];
    const newEntry = {
      score: input.score,
      assessedAt: new Date().toISOString(),
      ...(input.notes ? { notes: input.notes } : {})
    };

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: {
        conditionScore: input.score,
        conditionHistory: [...history, newEntry] as Prisma.InputJsonValue
      }
    });

    return toAssetResponse(asset);
  });
};
