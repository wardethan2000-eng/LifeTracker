import type { Notification } from "@prisma/client";
import { householdNotificationListSchema, notificationSchema } from "@lifekeeper/types";

export const toNotificationResponse = (
  notification: Pick<Notification, "id" | "userId" | "householdId" | "assetId" | "scheduleId" | "entryId" | "dedupeKey" | "type" | "channel" | "status" | "title" | "body" | "scheduledFor" | "sentAt" | "readAt" | "escalationLevel" | "payload" | "createdAt" | "updatedAt">
) => notificationSchema.parse({
  ...notification,
  scheduledFor: notification.scheduledFor.toISOString(),
  sentAt: notification.sentAt?.toISOString() ?? null,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString()
});

export const toHouseholdNotificationListResponse = (value: {
  notifications: Array<ReturnType<typeof toNotificationResponse>>;
  unreadCount: number;
  nextCursor?: string | null;
}) => householdNotificationListSchema.parse(value);