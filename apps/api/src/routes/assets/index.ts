import type { Prisma } from "@prisma/client";
import {
  assetCategorySchema,
  assetLabelDataSchema,
  assetLookupQuerySchema,
  assetSchema,
  createOffsetPaginationQuerySchema,
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
import { sendQrCode } from "../../lib/qr.js";
import { z } from "zod";
import {
  requireHouseholdMembership,
  getAccessibleAsset,
  personalAssetAccessWhere
} from "../../lib/asset-access.js";
import { buildOffsetPage } from "../../lib/pagination.js";
import {
  buildAssetScanUrl,
  ensureAssetTag
} from "../../lib/asset-tags.js";
import { csvValue } from "../../lib/csv.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import { toAssetResponse } from "../../lib/serializers/index.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { syncAssetFamilyToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { softDeleteData, optionallyIncludeDeleted } from "../../lib/soft-delete.js";

const assetIdParamsSchema = z.object({
  assetId: z.string().cuid()
});

const listAssetsQuerySchema = createOffsetPaginationQuerySchema({
  defaultLimit: 25,
  maxLimit: 100
}).extend({
  householdId: z.string().cuid(),
  includeArchived: z.coerce.boolean().default(false),
  includeDeleted: z.coerce.boolean().default(false)
});

const assetLabelQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  size: z.coerce.number().int().min(100).max(1000).default(300)
});

const bulkArchiveBodySchema = z.object({
  householdId: z.string().cuid(),
  assetIds: z.array(z.string().cuid()).optional(),
  applyToAll: z.boolean().optional(),
}).refine(
  (data) => data.applyToAll === true || (data.assetIds !== undefined && data.assetIds.length >= 1),
  { message: "Either applyToAll must be true or assetIds must have at least one item." }
);

const bulkReassignCategoryBodySchema = z.object({
  householdId: z.string().cuid(),
  assetIds: z.array(z.string().cuid()).optional(),
  applyToAll: z.boolean().optional(),
  category: assetCategorySchema,
}).refine(
  (data) => data.applyToAll === true || (data.assetIds !== undefined && data.assetIds.length >= 1),
  { message: "Either applyToAll must be true or assetIds must have at least one item." }
);

const assetExportQuerySchema = z.object({
  householdId: z.string().cuid()
});

export const assetRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets", async (request, reply) => {
    const query = listAssetsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, query.householdId, request.auth.userId, reply)) {
      return;
    }

    const where: Prisma.AssetWhereInput = {
      householdId: query.householdId,
      ...personalAssetAccessWhere(request.auth.userId),
      ...(query.includeArchived ? {} : { isArchived: false }),
      ...optionallyIncludeDeleted(query.includeDeleted)
    };

    if (query.paginated) {
      const [assets, total] = await Promise.all([
        app.prisma.asset.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: query.offset,
          take: query.limit
        }),
        app.prisma.asset.count({ where })
      ]);

      return buildOffsetPage(
        assets.map((asset) => toAssetResponse(asset)),
        total,
        query
      );
    }

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
      return notFound(reply, "Asset");
    }

    return toAssetResponse(asset);
  });

  // ── Bulk operations ────────────────────────────────────────────────

  app.post("/v1/assets/bulk/archive", async (request, reply) => {
    const input = bulkArchiveBodySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, input.householdId, request.auth.userId, reply)) {
      return;
    }

    let accessible: Array<{ id: string; name: string }>;
    let failed: Array<{ id: string | undefined; label: string | null; error: string }>;

    if (input.applyToAll) {
      accessible = await app.prisma.asset.findMany({
        where: {
          householdId: input.householdId,
          deletedAt: null,
          isArchived: false,
          ...personalAssetAccessWhere(request.auth.userId)
        },
        select: { id: true, name: true }
      });
      failed = [];
    } else {
      const assetIds = input.assetIds!;
      const found = await app.prisma.asset.findMany({
        where: {
          id: { in: assetIds },
          householdId: input.householdId,
          deletedAt: null,
          ...personalAssetAccessWhere(request.auth.userId)
        },
        select: { id: true, name: true }
      });
      const accessibleIds = new Set(found.map((a) => a.id));
      failed = assetIds
        .filter((id) => !accessibleIds.has(id))
        .map((id) => ({ id, label: null, error: "Asset not found or not accessible." }));
      accessible = found;
    }

    if (accessible.length > 0) {
      await app.prisma.$transaction(async (tx) => {
        await tx.asset.updateMany({
          where: { id: { in: accessible.map((a) => a.id) } },
          data: softDeleteData()
        });
      });

      await createActivityLogger(app.prisma, request.auth.userId).log("asset", input.householdId, "asset.bulk_archived", input.householdId, { count: accessible.length, assetIds: accessible.map((a) => a.id) });

      for (const asset of accessible) {
        void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);
      }
    }

    return reply.send({ succeeded: accessible.length, failed });
  });

  app.post("/v1/assets/bulk/category", async (request, reply) => {
    const input = bulkReassignCategoryBodySchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, input.householdId, request.auth.userId, reply)) {
      return;
    }

    let accessible: Array<{ id: string; name: string }>;
    let failed: Array<{ id: string | undefined; label: string | null; error: string }>;

    if (input.applyToAll) {
      accessible = await app.prisma.asset.findMany({
        where: {
          householdId: input.householdId,
          deletedAt: null,
          ...personalAssetAccessWhere(request.auth.userId)
        },
        select: { id: true, name: true }
      });
      failed = [];
    } else {
      const assetIds = input.assetIds!;
      const found = await app.prisma.asset.findMany({
        where: {
          id: { in: assetIds },
          householdId: input.householdId,
          deletedAt: null,
          ...personalAssetAccessWhere(request.auth.userId)
        },
        select: { id: true, name: true }
      });
      const accessibleIds = new Set(found.map((a) => a.id));
      failed = assetIds
        .filter((id) => !accessibleIds.has(id))
        .map((id) => ({ id, label: null, error: "Asset not found or not accessible." }));
      accessible = found;
    }

    if (accessible.length > 0) {
      await app.prisma.$transaction(async (tx) => {
        await tx.asset.updateMany({
          where: { id: { in: accessible.map((a) => a.id) } },
          data: { category: input.category }
        });
      });

      await createActivityLogger(app.prisma, request.auth.userId).log("asset", input.householdId, "asset.bulk_category_changed", input.householdId, { count: accessible.length, category: input.category, assetIds: accessible.map((a) => a.id) });

      for (const asset of accessible) {
        void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);
      }
    }

    return reply.send({ succeeded: accessible.length, failed });
  });

  app.get("/v1/assets/export", async (request, reply) => {
    const query = assetExportQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, query.householdId, request.auth.userId, reply)) {
      return;
    }

    const assets = await app.prisma.asset.findMany({
      where: {
        householdId: query.householdId,
        deletedAt: null,
        ...personalAssetAccessWhere(request.auth.userId)
      },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    const headers = ["assetTag", "name", "category", "visibility", "purchaseDate", "purchasePrice", "warrantyExpiration", "location"];

    const rows = assets.map((asset) => {
      const purchase = (asset.purchaseDetails as Record<string, unknown> | null) ?? {};
      const warranty = (asset.warrantyDetails as Record<string, unknown> | null) ?? {};
      const location = (asset.locationDetails as Record<string, unknown> | null) ?? {};
      const locationStr = [location.propertyName, location.room].filter(Boolean).join(", ");

      return [
        csvValue(asset.assetTag ?? `LK-${asset.id.slice(-8).toUpperCase()}`),
        csvValue(asset.name),
        csvValue(asset.category),
        csvValue(asset.visibility),
        csvValue(asset.purchaseDate?.toISOString().split("T")[0] ?? null),
        csvValue(typeof purchase.price === "number" ? purchase.price : null),
        csvValue(typeof warranty.endDate === "string" ? warranty.endDate.split("T")[0] : null),
        csvValue(locationStr || null)
      ].join(",");
    });

    const csvString = [headers.join(","), ...rows].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="assets-export.csv"')
      .send(csvString);
  });

  app.post("/v1/assets", async (request, reply) => {
    const input = createAssetSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, input.householdId, request.auth.userId, reply)) {
      return;
    }

    // Validate parent asset if specified
    if (input.parentAssetId) {
      const parent = await app.prisma.asset.findFirst({
        where: { id: input.parentAssetId, householdId: input.householdId },
        select: { id: true }
      });

      if (!parent) {
        return badRequest(reply, "Parent asset not found or belongs to a different household.");
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

        await createActivityLogger(app.prisma, request.auth.userId).log("asset", asset.id, "asset.created", input.householdId, { name: asset.name, category: asset.category, assetTag });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

    return reply.code(201).send(toAssetResponse(asset));
  });

  app.get("/v1/assets/:assetId/label", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const query = assetLabelQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const assetTag = asset.assetTag ?? await ensureAssetTag(app.prisma, asset.id);
    const payloadUrl = buildAssetScanUrl(assetTag);

    return sendQrCode(reply, payloadUrl, { format: query.format, size: query.size });
  });

  app.get("/v1/assets/:assetId/label/data", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
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
      qrPayloadUrl: buildAssetScanUrl(assetTag)
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
      return notFound(reply, "Asset");
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
      return notFound(reply, "Asset");
    }

    // Validate parent asset if specified
    if (input.parentAssetId !== undefined && input.parentAssetId !== null) {
      const parent = await app.prisma.asset.findFirst({
        where: { id: input.parentAssetId, householdId: existing.householdId },
        select: { id: true }
      });

      if (!parent) {
        return badRequest(reply, "Parent asset not found or belongs to a different household.");
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

        await createActivityLogger(app.prisma, request.auth.userId).log("asset", asset.id, "asset.updated", existing.householdId, { name: asset.name });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/archive", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return notFound(reply, "Asset");

    // Detach child assets so they become top-level
    await app.prisma.asset.updateMany({
      where: { parentAssetId: existing.id },
      data: { parentAssetId: null }
    });

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: { isArchived: true }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("asset", asset.id, "asset.archived", existing.householdId, { name: existing.name });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/unarchive", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return notFound(reply, "Asset");

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
    if (!existing) return notFound(reply, "Asset");

    const asset = await app.prisma.asset.update({
      where: { id: existing.id },
      data: softDeleteData()
    });

    void syncAssetFamilyToSearchIndex(app.prisma, asset.id).catch(console.error);

    return toAssetResponse(asset);
  });

  app.post("/v1/assets/:assetId/restore", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return notFound(reply, "Asset");

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
      return notFound(reply, "Asset");
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
      return notFound(reply, "Asset");
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

        await createActivityLogger(app.prisma, request.auth.userId).log("asset", asset.id, "asset.condition_recorded", existing.householdId, { name: existing.name, score: input.score });

    return toAssetResponse(asset);
  });

  // ── Delete impact ──────────────────────────────────────────────────

  app.get("/v1/assets/:assetId/delete-impact", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);
    const existing = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);
    if (!existing) return notFound(reply, "Asset");

    const [schedules, logs, entries, comments, transfers] = await Promise.all([
      app.prisma.maintenanceSchedule.count({ where: { assetId: existing.id, deletedAt: null } }),
      app.prisma.maintenanceLog.count({ where: { assetId: existing.id, deletedAt: null } }),
      app.prisma.entry.count({ where: { entityType: "asset", entityId: existing.id } }),
      app.prisma.comment.count({ where: { assetId: existing.id, deletedAt: null } }),
      app.prisma.assetTransfer.count({ where: { assetId: existing.id } }),
    ]);

    return { schedules, logs, entries, comments, transfers };
  });

  // ── Permanent purge (hard-delete from Trash) ───────────────────────

  app.delete("/v1/assets/:assetId/purge", async (request, reply) => {
    const params = assetIdParamsSchema.parse(request.params);

    const existing = await app.prisma.asset.findFirst({
      where: {
        id: params.assetId,
        household: { members: { some: { userId: request.auth.userId } } },
        ...personalAssetAccessWhere(request.auth.userId)
      }
    });

    if (!existing) return notFound(reply, "Asset");
    if (!existing.deletedAt) return badRequest(reply, "Asset must be moved to Trash before it can be permanently deleted.");

    await app.prisma.asset.delete({ where: { id: existing.id } });

    void removeSearchIndexEntry(app.prisma, "asset", existing.id).catch(console.error);

    await createActivityLogger(app.prisma, request.auth.userId).log("asset", existing.id, "asset.purged", existing.householdId, { name: existing.name });

    return reply.code(204).send();
  });
};
