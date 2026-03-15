import type { Asset, AssetTransfer, User } from "@prisma/client";
import {
  assetFieldDefinitionsSchema,
  assetSchema,
  assetTransferSchema
} from "@lifekeeper/types";
import { toShallowUserResponse } from "./users.js";

export const toAssetResponse = (
  asset: Pick<Asset, "id" | "householdId" | "createdById" | "ownerId" | "parentAssetId" | "assetTag" | "name" | "category" | "visibility" | "description" | "manufacturer" | "model" | "serialNumber" | "purchaseDate" | "purchaseDetails" | "warrantyDetails" | "locationDetails" | "insuranceDetails" | "dispositionDetails" | "conditionScore" | "conditionHistory" | "assetTypeKey" | "assetTypeLabel" | "assetTypeDescription" | "assetTypeSource" | "assetTypeVersion" | "fieldDefinitions" | "customFields" | "isArchived" | "deletedAt" | "createdAt" | "updatedAt">,
  relations?: {
    parentAsset?: { id: string; name: string; category: string } | null;
    childAssets?: { id: string; name: string; category: string }[];
  }
) => assetSchema.parse({
  ...asset,
  assetTag: asset.assetTag ?? `LK-${asset.id.slice(-8).toUpperCase()}`,
  purchaseDate: asset.purchaseDate?.toISOString() ?? null,
  deletedAt: asset.deletedAt?.toISOString() ?? null,
  fieldDefinitions: assetFieldDefinitionsSchema.parse(asset.fieldDefinitions ?? []),
  purchaseDetails: asset.purchaseDetails ?? null,
  warrantyDetails: asset.warrantyDetails ?? null,
  locationDetails: asset.locationDetails ?? null,
  insuranceDetails: asset.insuranceDetails ?? null,
  dispositionDetails: asset.dispositionDetails ?? null,
  conditionScore: asset.conditionScore ?? null,
  conditionHistory: asset.conditionHistory ?? [],
  parentAssetId: asset.parentAssetId ?? null,
  parentAsset: relations?.parentAsset ?? null,
  childAssets: relations?.childAssets ?? [],
  createdAt: asset.createdAt.toISOString(),
  updatedAt: asset.updatedAt.toISOString()
});

export const toAssetTransferResponse = (
  transfer: Pick<AssetTransfer, "id" | "assetId" | "transferType" | "fromHouseholdId" | "toHouseholdId" | "fromUserId" | "toUserId" | "initiatedById" | "reason" | "notes" | "transferredAt" | "createdAt">,
  relations: {
    fromUser: Pick<User, "id" | "displayName">;
    toUser: Pick<User, "id" | "displayName">;
    initiatedBy: Pick<User, "id" | "displayName">;
  }
) => assetTransferSchema.parse({
  ...transfer,
  toHouseholdId: transfer.toHouseholdId ?? null,
  reason: transfer.reason ?? null,
  notes: transfer.notes ?? null,
  transferredAt: transfer.transferredAt.toISOString(),
  createdAt: transfer.createdAt.toISOString(),
  fromUser: toShallowUserResponse(relations.fromUser),
  toUser: toShallowUserResponse(relations.toUser),
  initiatedBy: toShallowUserResponse(relations.initiatedBy)
});