import type { Prisma } from "@prisma/client";
import {
  assetLabelDataSchema,
  assetLookupQuerySchema,
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
import QRCode from "qrcode";
import { z } from "zod";
import {
  assertMembership,
  getAccessibleAsset,
  personalAssetAccessWhere
} from "../../lib/asset-access.js";
import {
  buildAssetLabelUrl,
  ensureAssetTag
} from "../../lib/asset-tags.js";
import { toAssetResponse } from "../../lib/presenters.js";
import { logActivity } from "../../lib/activity-log.js";
import { syncAssetFamilyToSearchIndex } from "../../lib/search-index.js";

const assetIdParamsSchema = z.object({
  assetId: z.string().cuid()
});

const listAssetsQuerySchema = z.object({
  householdId: z.string().cuid(),
  includeArchived: z.coerce.boolean().default(false),
  includeDeleted: z.coerce.boolean().default(false)
});

const assetLabelQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  size: z.coerce.number().int().min(100).max(1000).default(300)
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
      ...personalAssetAccessWhere(request.auth.userId),
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

  app.get("/v1/assets/lookup", async (request, reply) => {
    const query = assetLookupQuerySchema.parse(request.query);

    const asset = await app.prisma.asset.findFirst({
      where: {
        assetTag: query.tag,
        household: { members: { some: { userId: request.auth.userId } } },
        OR: [{ visibility: "shared" }, { createdById: request.auth.userId }]
      }
    });

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    return toAssetResponse(asset);
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
      ownerId: request.auth.userId,
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

    const createdAsset = await app.prisma.asset.create({ data });
    const assetTag = await ensureAssetTag(app.prisma, createdAsset.id);
    const asset = {
      ...createdAsset,
      assetTag
    };

    await logActivity(app.prisma, {
      householdId: input.householdId,
      userId: request.auth.userId,
      action: "asset.created",
      entityType: "asset",
      entityId: asset.id,
      metadata: { name: asset.name, category: asset.category, assetTag }
    });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

    return reply.code(201).send(toAssetResponse(asset));
  });

  app.get("/v1/assets/:assetId/label", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const query = assetLabelQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const payloadUrl = buildAssetLabelUrl(asset.id);

    if (query.format === "svg") {
      const svg = await QRCode.toString(payloadUrl, {
        type: "svg",
        width: query.size,
        margin: 1
      });

      return reply
        .header("content-type", "image/svg+xml; charset=utf-8")
        .send(svg);
    }

    const png = await QRCode.toBuffer(payloadUrl, {
      type: "png",
      width: query.size,
      margin: 1
    });

    return reply
      .header("content-type", "image/png")
      .send(png);
  });

  app.get("/v1/assets/:assetId/label/data", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const assetTag = asset.assetTag ?? await ensureAssetTag(app.prisma, asset.id);

    return assetLabelDataSchema.parse({
      assetId: asset.id,
      assetTag,
      name: asset.name,
      serialNumber: asset.serialNumber ?? null,
      category: asset.category,
      manufacturer: asset.manufacturer ?? null,
      model: asset.model ?? null,
      qrPayloadUrl: buildAssetLabelUrl(asset.id)
    });
  });

  app.get("/v1/assets/:assetId", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);

    const asset = await app.prisma.asset.findFirst({
      where: {
        id: params.assetId,
        household: { members: { some: { userId: request.auth.userId } } },
        ...personalAssetAccessWhere(request.auth.userId)
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

    await logActivity(app.prisma, {
      householdId: existing.householdId,
      userId: request.auth.userId,
      action: "asset.updated",
      entityType: "asset",
      entityId: asset.id,
      metadata: { name: asset.name }
    });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

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

    await logActivity(app.prisma, {
      householdId: existing.householdId,
      userId: request.auth.userId,
      action: "asset.archived",
      entityType: "asset",
      entityId: asset.id,
      metadata: { name: existing.name }
    });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

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

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

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

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

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

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

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

    await logActivity(app.prisma, {
      householdId: existing.householdId,
      userId: request.auth.userId,
      action: "asset.condition_recorded",
      entityType: "asset",
      entityId: asset.id,
      metadata: { name: existing.name, score: input.score }
    });

    return toAssetResponse(asset);
  });
};
