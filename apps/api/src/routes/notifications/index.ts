import {
  notificationPreferencesSchema,
  updateNotificationPreferencesSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { enqueueNotificationDelivery, enqueueNotificationScan } from "../../lib/queues.js";
import {
  parseNotificationPreferences,
  toHouseholdNotificationListResponse,
  toNotificationResponse,
  toUserProfileResponse
} from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const notificationParamsSchema = z.object({
  notificationId: z.string().cuid()
});

const listHouseholdNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["all", "unread", "read"]).default("all")
});

const listNotificationsQuerySchema = z.object({
  householdId: z.string().cuid().optional(),
  status: z.enum(["pending", "sent", "failed", "read"]).optional(),
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const scanNotificationsBodySchema = z.object({
  householdId: z.string().cuid().optional()
});

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/notifications", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listHouseholdNotificationsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const notificationWhere = {
      userId: request.auth.userId,
      householdId: params.householdId,
      ...(query.status === "unread"
        ? { readAt: null }
        : query.status === "read"
          ? { readAt: { not: null } }
          : {})
    };

    const [notifications, unreadCount] = await Promise.all([
      app.prisma.notification.findMany({
        where: notificationWhere,
        orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
        take: query.limit
      }),
      app.prisma.notification.count({
        where: {
          userId: request.auth.userId,
          householdId: params.householdId,
          readAt: null
        }
      })
    ]);

    return toHouseholdNotificationListResponse({
      notifications: notifications.map(toNotificationResponse),
      unreadCount
    });
  });

  app.get("/v1/notifications", async (request) => {
    const query = listNotificationsQuerySchema.parse(request.query);
    const notifications = await app.prisma.notification.findMany({
      where: {
        userId: request.auth.userId,
        ...(query.householdId ? { householdId: query.householdId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.unreadOnly ? { readAt: null } : {})
      },
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      take: query.limit
    });

    return notifications.map(toNotificationResponse);
  });

  app.patch("/v1/notifications/:notificationId/read", async (request, reply) => {
    const params = notificationParamsSchema.parse(request.params);
    const notification = await app.prisma.notification.findFirst({
      where: {
        id: params.notificationId,
        userId: request.auth.userId
      }
    });

    if (!notification) {
      return reply.code(404).send({ message: "Notification not found." });
    }

    const updated = await app.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "read",
        readAt: notification.readAt ?? new Date()
      }
    });

    return toNotificationResponse(updated);
  });

  app.get("/v1/me/notification-preferences", async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return reply.code(404).send({ message: "Current user not found." });
    }

    return notificationPreferencesSchema.parse(parseNotificationPreferences(user.notificationPreferences));
  });

  app.patch("/v1/me/notification-preferences", async (request, reply) => {
    const input = updateNotificationPreferencesSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({
      where: { id: request.auth.userId }
    });

    if (!user) {
      return reply.code(404).send({ message: "Current user not found." });
    }

    const current = parseNotificationPreferences(user.notificationPreferences);
    const nextPreferences = notificationPreferencesSchema.parse({
      ...current,
      ...input
    });
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        notificationPreferences: nextPreferences
      }
    });

    return toUserProfileResponse(updated);
  });

  app.post("/v1/notifications/scan", async (request, reply) => {
    const input = scanNotificationsBodySchema.parse(request.body ?? {});

    if (!input.householdId) {
      return reply.code(400).send({
        message: "householdId is required when enqueueing a notification scan."
      });
    }

    try {
      await assertMembership(app.prisma, input.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const job = await enqueueNotificationScan({ householdId: input.householdId });

    return {
      jobId: job.id,
      queue: "notification-scan"
    };
  });

  app.post("/v1/notifications/:notificationId/deliver", async (request, reply) => {
    const params = notificationParamsSchema.parse(request.params);
    const notification = await app.prisma.notification.findFirst({
      where: {
        id: params.notificationId,
        userId: request.auth.userId
      }
    });

    if (!notification) {
      return reply.code(404).send({ message: "Notification not found." });
    }

    const job = await enqueueNotificationDelivery({ notificationId: notification.id });

    return reply.code(202).send({
      jobId: job.id,
      queue: "notification-delivery"
    });
  });
};