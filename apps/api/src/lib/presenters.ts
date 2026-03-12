import type { Asset, MaintenanceLogPart, Notification, Prisma, ServiceProvider, UsageMetric, UsageMetricEntry, User } from "@prisma/client";
import {
  assetFieldDefinitionsSchema,
  assetSchema,
  maintenanceLogPartSchema,
  notificationPreferencesSchema,
  notificationSchema,
  serviceProviderSchema,
  usageMetricEntrySchema,
  usageMetricResponseSchema,
  userProfileSchema
} from "@lifekeeper/types";

export const parseNotificationPreferences = (value: Prisma.JsonValue | null | undefined) => notificationPreferencesSchema.parse(value ?? {});

export const toUserProfileResponse = (user: Pick<User, "id" | "clerkUserId" | "email" | "displayName" | "notificationPreferences" | "createdAt" | "updatedAt">) => userProfileSchema.parse({
  ...user,
  notificationPreferences: parseNotificationPreferences(user.notificationPreferences),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

export const toAssetResponse = (
  asset: Pick<Asset, "id" | "householdId" | "createdById" | "parentAssetId" | "name" | "category" | "visibility" | "description" | "manufacturer" | "model" | "serialNumber" | "purchaseDate" | "purchaseDetails" | "warrantyDetails" | "locationDetails" | "insuranceDetails" | "dispositionDetails" | "conditionScore" | "conditionHistory" | "assetTypeKey" | "assetTypeLabel" | "assetTypeDescription" | "assetTypeSource" | "assetTypeVersion" | "fieldDefinitions" | "customFields" | "isArchived" | "deletedAt" | "createdAt" | "updatedAt">,
  relations?: {
    parentAsset?: { id: string; name: string; category: string } | null;
    childAssets?: { id: string; name: string; category: string }[];
  }
) => assetSchema.parse({
  ...asset,
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

export const toUsageMetricResponse = (metric: Pick<UsageMetric, "id" | "assetId" | "name" | "unit" | "currentValue" | "lastRecordedAt" | "createdAt" | "updatedAt">) => usageMetricResponseSchema.parse({
  ...metric,
  lastRecordedAt: metric.lastRecordedAt?.toISOString() ?? null,
  createdAt: metric.createdAt.toISOString(),
  updatedAt: metric.updatedAt.toISOString()
});

export const toNotificationResponse = (notification: Pick<Notification, "id" | "userId" | "householdId" | "assetId" | "scheduleId" | "dedupeKey" | "type" | "channel" | "status" | "title" | "body" | "scheduledFor" | "sentAt" | "readAt" | "escalationLevel" | "payload" | "createdAt" | "updatedAt">) => notificationSchema.parse({
  ...notification,
  scheduledFor: notification.scheduledFor.toISOString(),
  sentAt: notification.sentAt?.toISOString() ?? null,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString()
});

export const toUsageMetricEntryResponse = (entry: Pick<UsageMetricEntry, "id" | "metricId" | "value" | "recordedAt" | "source" | "notes" | "createdAt" | "updatedAt">) => usageMetricEntrySchema.parse({
  ...entry,
  recordedAt: entry.recordedAt.toISOString(),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
});

export const toServiceProviderResponse = (provider: Pick<ServiceProvider, "id" | "householdId" | "name" | "specialty" | "phone" | "email" | "website" | "address" | "rating" | "notes" | "createdAt" | "updatedAt">) => serviceProviderSchema.parse({
  ...provider,
  createdAt: provider.createdAt.toISOString(),
  updatedAt: provider.updatedAt.toISOString()
});

export const toMaintenanceLogPartResponse = (part: Pick<MaintenanceLogPart, "id" | "logId" | "name" | "partNumber" | "quantity" | "unitCost" | "supplier" | "notes" | "createdAt" | "updatedAt">) => maintenanceLogPartSchema.parse({
  ...part,
  createdAt: part.createdAt.toISOString(),
  updatedAt: part.updatedAt.toISOString()
});