import type { Asset, Notification, Prisma, UsageMetric, User } from "@prisma/client";
import {
  assetFieldDefinitionsSchema,
  assetSchema,
  notificationPreferencesSchema,
  notificationSchema,
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

export const toAssetResponse = (asset: Pick<Asset, "id" | "householdId" | "createdById" | "name" | "category" | "visibility" | "description" | "manufacturer" | "model" | "serialNumber" | "purchaseDate" | "assetTypeKey" | "assetTypeLabel" | "assetTypeDescription" | "assetTypeSource" | "assetTypeVersion" | "fieldDefinitions" | "customFields" | "isArchived" | "createdAt" | "updatedAt">) => assetSchema.parse({
  ...asset,
  purchaseDate: asset.purchaseDate?.toISOString() ?? null,
  fieldDefinitions: assetFieldDefinitionsSchema.parse(asset.fieldDefinitions ?? []),
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