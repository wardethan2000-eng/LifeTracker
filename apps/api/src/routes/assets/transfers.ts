import {
  assetTransferListSchema,
  createAssetTransferSchema
} from "@aegis/types";
import type { Asset, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, assertOwner, getMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toAssetTransferResponse } from "../../lib/serializers/index.js";
import { syncAssetFamilyToSearchIndex, syncAssetTransferToSearchIndex } from "../../lib/search-index.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { assetParamsSchema, householdParamsSchema } from "../../lib/schemas.js";

const householdTransferQuerySchema = z.object({
  since: z.string().datetime().optional(),
  transferType: z.enum(["reassignment", "household_transfer"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

type TransferableAsset = Pick<Asset, "id" | "householdId" | "createdById" | "ownerId" | "parentAssetId" | "name">;

const getResponsibleUserId = (asset: Pick<Asset, "ownerId" | "createdById">): string => asset.ownerId ?? asset.createdById;

const getTransferAsset = async (
  prisma: PrismaClient,
  assetId: string,
  userId: string
): Promise<TransferableAsset | null> => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      householdId: true,
      createdById: true,
      ownerId: true,
      parentAssetId: true,
      name: true
    }
  });

  if (!asset) {
    return null;
  }

  try {
    await assertMembership(prisma, asset.householdId, userId);
  } catch {
    return null;
  }

  return asset;
};

const collectTransferScopeAssets = async (
  tx: PrismaClient,
  rootAsset: TransferableAsset
): Promise<TransferableAsset[]> => {
  const assets = await tx.asset.findMany({
    where: {
      householdId: rootAsset.householdId,
      deletedAt: null
    },
    select: {
      id: true,
      householdId: true,
      createdById: true,
      ownerId: true,
      parentAssetId: true,
      name: true
    }
  });

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const childrenByParentId = new Map<string, TransferableAsset[]>();

  for (const asset of assets) {
    if (!asset.parentAssetId) {
      continue;
    }

    const existing = childrenByParentId.get(asset.parentAssetId) ?? [];
    existing.push(asset);
    childrenByParentId.set(asset.parentAssetId, existing);
  }

  const queue = [rootAsset.id];
  const seen = new Set<string>();
  const scope: TransferableAsset[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || seen.has(currentId)) {
      continue;
    }

    seen.add(currentId);

    const asset = assetsById.get(currentId);
    if (!asset) {
      continue;
    }

    scope.push(asset);

    for (const child of childrenByParentId.get(currentId) ?? []) {
      queue.push(child.id);
    }
  }

  return scope;
};

export const assetTransferRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/assets/:assetId/transfers", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createAssetTransferSchema.parse(request.body);
    const asset = await getTransferAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const fromUserId = getResponsibleUserId(asset);

    if (input.transferType === "reassignment") {
      if (input.toUserId === fromUserId) {
        return reply.code(400).send({ message: "Asset is already assigned to that user." });
      }

      const targetMembership = await getMembership(app.prisma, asset.householdId, input.toUserId);
      if (!targetMembership) {
        return reply.code(400).send({ message: "Target user must be a member of the current household." });
      }

      const transfer = await app.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: asset.id },
          data: { ownerId: input.toUserId }
        });

        const created = await tx.assetTransfer.create({
          data: {
            assetId: asset.id,
            transferType: "reassignment",
            fromHouseholdId: asset.householdId,
            fromUserId,
            toUserId: input.toUserId,
            initiatedById: request.auth.userId,
            reason: input.reason ?? null,
            notes: input.notes ?? null
          },
          include: {
            fromUser: { select: { id: true, displayName: true } },
            toUser: { select: { id: true, displayName: true } },
            initiatedBy: { select: { id: true, displayName: true } }
          }
        });

                await createActivityLogger(tx, request.auth.userId).log("asset", asset.id, "asset.reassigned", asset.householdId, {
            assetName: asset.name,
            fromUserId,
            toUserId: input.toUserId,
            reason: input.reason ?? null
          });

        return created;
      });

      void syncAssetTransferToSearchIndex(app.prisma, transfer.id).catch(console.error);

      return reply.code(201).send(toAssetTransferResponse(transfer, {
        fromUser: transfer.fromUser,
        toUser: transfer.toUser,
        initiatedBy: transfer.initiatedBy
      }));
    }

    if (!input.toHouseholdId) {
      return reply.code(400).send({ message: "toHouseholdId is required for household transfers." });
    }

    const targetHouseholdId = input.toHouseholdId;

    if (targetHouseholdId === asset.householdId) {
      return reply.code(400).send({ message: "Use reassignment for transfers within the same household." });
    }

    try {
      await assertOwner(app.prisma, asset.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "Only household owners can initiate inter-household transfers." });
    }

    const targetMembership = await getMembership(app.prisma, targetHouseholdId, input.toUserId);
    if (!targetMembership) {
      return reply.code(400).send({ message: "Target user must be a member of the destination household." });
    }

    const transferResult = await app.prisma.$transaction(async (tx) => {
      const scopeAssets = await collectTransferScopeAssets(tx as unknown as PrismaClient, asset);
      const assetIds = scopeAssets.map((entry) => entry.id);
      const now = new Date();

      await tx.asset.updateMany({
        where: { id: { in: assetIds } },
        data: {
          householdId: targetHouseholdId,
          ownerId: input.toUserId
        }
      });

      const notifications = await tx.notification.findMany({
        where: {
          OR: [
            { assetId: { in: assetIds } },
            { schedule: { assetId: { in: assetIds } } }
          ]
        },
        select: { id: true }
      });

      await Promise.all(notifications.map((notification) => tx.notification.update({
        where: { id: notification.id },
        data: { householdId: targetHouseholdId }
      })));

      await tx.assetTransfer.createMany({
        data: scopeAssets.map((entry) => ({
          assetId: entry.id,
          transferType: "household_transfer",
          fromHouseholdId: entry.householdId,
          toHouseholdId: targetHouseholdId,
          fromUserId: getResponsibleUserId(entry),
          toUserId: input.toUserId,
          initiatedById: request.auth.userId,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          transferredAt: now,
          createdAt: now
        }))
      });

      const createdTransfers = await tx.assetTransfer.findMany({
        where: {
          assetId: { in: assetIds },
          transferType: "household_transfer",
          initiatedById: request.auth.userId,
          transferredAt: now
        },
        include: {
          fromUser: { select: { id: true, displayName: true } },
          toUser: { select: { id: true, displayName: true } },
          initiatedBy: { select: { id: true, displayName: true } }
        }
      });

      const created = createdTransfers.find((entry) => entry.assetId === asset.id);

      if (!created) {
        throw new Error("Asset transfer record was not created for the requested asset.");
      }

            await createActivityLogger(tx, request.auth.userId).log("asset", asset.id, "asset.household_transferred_out", asset.householdId, {
          assetName: asset.name,
          movedAssetIds: assetIds,
          movedAssetCount: assetIds.length,
          toHouseholdId: targetHouseholdId,
          toUserId: input.toUserId,
          reason: input.reason ?? null
        });

            await createActivityLogger(tx, request.auth.userId).log("asset", asset.id, "asset.household_transferred_in", targetHouseholdId, {
          assetName: asset.name,
          movedAssetIds: assetIds,
          movedAssetCount: assetIds.length,
          fromHouseholdId: asset.householdId,
          toUserId: input.toUserId,
          reason: input.reason ?? null
        });

      return {
        created,
        assetIds,
        transferIds: createdTransfers.map((entry) => entry.id)
      };
    });

    void Promise.all([
      ...transferResult.assetIds.map((assetId) => syncAssetFamilyToSearchIndex(app.prisma, assetId)),
      ...transferResult.transferIds.map((transferId) => syncAssetTransferToSearchIndex(app.prisma, transferId))
    ]).catch(console.error);

    return reply.code(201).send(toAssetTransferResponse(transferResult.created, {
      fromUser: transferResult.created.fromUser,
      toUser: transferResult.created.toUser,
      initiatedBy: transferResult.created.initiatedBy
    }));
  });

  app.get("/v1/assets/:assetId/transfers", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await app.prisma.asset.findUnique({
      where: { id: params.assetId },
      select: {
        id: true,
        householdId: true
      }
    });

    if (!asset) {
      return notFound(reply, "Asset");
    }

    try {
      await assertMembership(app.prisma, asset.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const transfers = await app.prisma.assetTransfer.findMany({
      where: { assetId: asset.id },
      include: {
        fromUser: { select: { id: true, displayName: true } },
        toUser: { select: { id: true, displayName: true } },
        initiatedBy: { select: { id: true, displayName: true } }
      },
      orderBy: [
        { transferredAt: "desc" },
        { createdAt: "desc" }
      ]
    });

    return assetTransferListSchema.parse({
      items: transfers.map((entry) => toAssetTransferResponse(entry, {
        fromUser: entry.fromUser,
        toUser: entry.toUser,
        initiatedBy: entry.initiatedBy
      })),
      nextCursor: null
    });
  });

  app.get("/v1/households/:householdId/transfers", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = householdTransferQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const transfers = await app.prisma.assetTransfer.findMany({
      where: {
        OR: [
          { fromHouseholdId: params.householdId },
          { toHouseholdId: params.householdId }
        ],
        ...(query.transferType ? { transferType: query.transferType } : {}),
        ...(query.since ? { transferredAt: { gte: new Date(query.since) } } : {})
      },
      include: {
        fromUser: { select: { id: true, displayName: true } },
        toUser: { select: { id: true, displayName: true } },
        initiatedBy: { select: { id: true, displayName: true } }
      },
      take: query.limit + 1,
      ...(query.cursor ? {
        cursor: { id: query.cursor },
        skip: 1
      } : {}),
      orderBy: [
        { transferredAt: "desc" },
        { id: "desc" }
      ]
    });

    const page = transfers.slice(0, query.limit);
    const overflowTransfer = transfers[query.limit];
    const nextCursor = transfers.length > query.limit && overflowTransfer
      ? overflowTransfer.id
      : null;

    return assetTransferListSchema.parse({
      items: page.map((entry) => toAssetTransferResponse(entry, {
        fromUser: entry.fromUser,
        toUser: entry.toUser,
        initiatedBy: entry.initiatedBy
      })),
      nextCursor
    });
  });
};