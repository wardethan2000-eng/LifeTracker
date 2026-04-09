import type { Prisma, User } from "@prisma/client";
import {
  notificationPreferencesSchema,
  shallowUserSchema,
  userProfileSchema
} from "@aegis/types";

export const parseNotificationPreferences = (value: Prisma.JsonValue | null | undefined) =>
  notificationPreferencesSchema.parse(value ?? {});

export const toShallowUserResponse = (user: Pick<User, "id" | "displayName">) =>
  shallowUserSchema.parse({
    id: user.id,
    displayName: user.displayName ?? null
  });

export const toUserProfileResponse = (
  user: Pick<User, "id" | "clerkUserId" | "email" | "displayName" | "notificationPreferences" | "createdAt" | "updatedAt">
) => userProfileSchema.parse({
  ...user,
  notificationPreferences: parseNotificationPreferences(user.notificationPreferences),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});