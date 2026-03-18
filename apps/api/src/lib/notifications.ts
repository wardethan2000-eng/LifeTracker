import type {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
  PrismaClient,
  User
} from "@prisma/client";
import {
  maintenanceTriggerSchema,
  notificationConfigSchema,
  notificationPreferencesSchema,
  type NotificationPreferences
} from "@lifekeeper/types";
import { toNotificationResponse } from "./serializers/index.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

type NotificationPhase = "upcoming" | "due_soon" | "due" | "overdue";

interface Recipient {
  userId: string;
  preferences: NotificationPreferences;
}

interface ScheduleCandidate {
  id: string;
  name: string;
  description: string | null;
  triggerConfig: Prisma.JsonValue;
  notificationConfig: Prisma.JsonValue;
  lastCompletedAt: Date | null;
  nextDueAt: Date | null;
  nextDueMetricValue: number | null;
  assignedToId: string | null;
  asset: {
    id: string;
    name: string;
    visibility: "shared" | "personal";
    ownerId: string | null;
    createdById: string;
    householdId: string;
    household: {
      members: Array<{
        userId: string;
        user: Pick<User, "id" | "notificationPreferences">;
      }>;
    };
    createdBy: Pick<User, "id" | "notificationPreferences">;
    owner: Pick<User, "id" | "notificationPreferences"> | null;
  };
  assignedTo: Pick<User, "id" | "notificationPreferences"> | null;
  metric: {
    currentValue: number;
    unit: string;
  } | null;
}

interface NotificationEvent {
  type: NotificationType;
  escalationLevel: number;
  scheduledFor: Date;
  title: string;
  body: string;
  payload: Prisma.InputJsonValue;
  dedupeSuffix: string;
}

interface LowStockCandidate {
  id: string;
  householdId: string;
  name: string;
  quantityOnHand: number;
  reorderThreshold: number;
  unit: string;
  preferredSupplier: string | null;
  household: {
    members: Array<{
      userId: string;
      user: Pick<User, "id" | "notificationPreferences">;
    }>;
  };
}

export interface NotificationScanResult {
  createdCount: number;
  createdNotificationIds: string[];
}

const parsePreferences = (value: Prisma.JsonValue | null | undefined): NotificationPreferences => notificationPreferencesSchema.parse(value ?? {});

const phaseRank = (phase: NotificationPhase): number => {
  switch (phase) {
    case "upcoming":
      return 0;
    case "due_soon":
      return 1;
    case "due":
      return 2;
    case "overdue":
      return 3;
  }
};

const phaseByRank = (rank: number): NotificationPhase => {
  if (rank <= 0) {
    return "upcoming";
  }

  if (rank === 1) {
    return "due_soon";
  }

  if (rank === 2) {
    return "due";
  }

  return "overdue";
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const describeDuePoint = (schedule: ScheduleCandidate): string => {
  if (schedule.nextDueAt) {
    return `due on ${schedule.nextDueAt.toISOString().slice(0, 10)}`;
  }

  if (typeof schedule.nextDueMetricValue === "number") {
    const unit = schedule.metric?.unit ?? "units";
    return `due at ${schedule.nextDueMetricValue} ${unit}`;
  }

  return "due soon";
};

const resolveChannels = (
  scheduleChannels: NotificationChannel[],
  preferences: NotificationPreferences
): NotificationChannel[] => {
  if (preferences.pauseAll) {
    return [];
  }

  const enabled = scheduleChannels.filter((channel) => preferences.enabledChannels.includes(channel));

  if (preferences.preferDigest && enabled.includes("digest")) {
    return ["digest"];
  }

  return enabled;
};

const getDatePhase = (dueAt: Date | null, leadDays: number, now: Date): NotificationPhase => {
  if (!dueAt) {
    return "upcoming";
  }

  if (now > dueAt) {
    return "overdue";
  }

  if (now >= dueAt) {
    return "due";
  }

  const leadAt = addDays(dueAt, -leadDays);

  if (now >= leadAt) {
    return "due_soon";
  }

  return "upcoming";
};

const getUsagePhase = (
  dueMetricValue: number | null,
  currentMetricValue: number | null,
  leadValue: number
): NotificationPhase => {
  if (typeof dueMetricValue !== "number" || typeof currentMetricValue !== "number") {
    return "upcoming";
  }

  if (currentMetricValue > dueMetricValue) {
    return "overdue";
  }

  if (currentMetricValue >= dueMetricValue) {
    return "due";
  }

  if (currentMetricValue >= dueMetricValue - leadValue) {
    return "due_soon";
  }

  return "upcoming";
};

const resolveSchedulePhase = (schedule: ScheduleCandidate, now: Date): NotificationPhase => {
  const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
  const config = notificationConfigSchema.parse(schedule.notificationConfig);
  const currentMetricValue = schedule.metric?.currentValue ?? null;
  const dateLeadDays = config.upcomingLeadDays ?? (trigger.type === "interval" || trigger.type === "seasonal" || trigger.type === "one_time"
    ? trigger.leadTimeDays
    : trigger.type === "compound"
      ? trigger.leadTimeDays
      : 0);
  const usageLeadValue = config.upcomingLeadValue ?? (trigger.type === "usage"
    ? trigger.leadTimeValue
    : trigger.type === "compound"
      ? trigger.leadTimeValue
      : 0);
  const datePhase = getDatePhase(schedule.nextDueAt, dateLeadDays, now);
  const usagePhase = getUsagePhase(schedule.nextDueMetricValue, currentMetricValue, usageLeadValue);

  switch (trigger.type) {
    case "interval":
    case "seasonal":
    case "one_time":
      return datePhase;
    case "usage":
      return usagePhase;
    case "compound":
      if (trigger.logic === "whichever_first") {
        return phaseByRank(Math.max(phaseRank(datePhase), phaseRank(usagePhase)));
      }

      return phaseByRank(Math.min(phaseRank(datePhase), phaseRank(usagePhase)));
  }
};

const buildCycleKey = (schedule: ScheduleCandidate): string => [
  schedule.id,
  schedule.nextDueAt?.toISOString() ?? "no-date",
  schedule.nextDueMetricValue?.toString() ?? "no-usage",
  schedule.lastCompletedAt?.toISOString() ?? "never"
].join(":");

const buildBasePayload = (schedule: ScheduleCandidate, cycleKey: string): Prisma.InputJsonValue => ({
  cycleKey,
  assetName: schedule.asset.name,
  scheduleName: schedule.name,
  nextDueAt: schedule.nextDueAt?.toISOString() ?? null,
  nextDueMetricValue: schedule.nextDueMetricValue ?? null,
  currentMetricValue: schedule.metric?.currentValue ?? null,
  metricUnit: schedule.metric?.unit ?? null
}) as Prisma.InputJsonValue;

const buildNotificationEvents = (schedule: ScheduleCandidate, now: Date): NotificationEvent[] => {
  const config = notificationConfigSchema.parse(schedule.notificationConfig);
  const phase = resolveSchedulePhase(schedule, now);
  const cycleKey = buildCycleKey(schedule);
  const events: NotificationEvent[] = [];
  const basePayload = buildBasePayload(schedule, cycleKey);

  if (phase === "due_soon") {
    events.push({
      type: "due_soon",
      escalationLevel: 0,
      scheduledFor: now,
      title: `${schedule.name} is coming up for ${schedule.asset.name}`,
      body: `${schedule.name} for ${schedule.asset.name} is ${describeDuePoint(schedule)}.`,
      payload: basePayload,
      dedupeSuffix: "due-soon"
    });
  }

  if ((phase === "due" || phase === "overdue") && config.sendAtDue) {
    events.push({
      type: "due",
      escalationLevel: 0,
      scheduledFor: schedule.nextDueAt ?? now,
      title: `${schedule.name} is due for ${schedule.asset.name}`,
      body: `${schedule.name} for ${schedule.asset.name} is now due.`,
      payload: basePayload,
      dedupeSuffix: "due"
    });
  }

  if (phase === "overdue") {
    const cadenceDays = config.overdueCadenceDays ?? 0;
    let escalationLevel = 0;

    if (schedule.nextDueAt && cadenceDays > 0) {
      const millisecondsSinceDue = Math.max(0, now.getTime() - schedule.nextDueAt.getTime());
      escalationLevel = Math.floor(millisecondsSinceDue / (cadenceDays * 24 * 60 * 60 * 1000));
    }

    if (config.maxOverdueNotifications === undefined || escalationLevel < config.maxOverdueNotifications) {
      events.push({
        type: "overdue",
        escalationLevel,
        scheduledFor: now,
        title: `${schedule.name} is overdue for ${schedule.asset.name}`,
        body: `${schedule.name} for ${schedule.asset.name} is overdue.`,
        payload: basePayload,
        dedupeSuffix: `overdue-${escalationLevel}`
      });
    }
  }

  return events;
};

const isUniqueConstraintError = (error: unknown): boolean => Boolean(
  error
  && typeof error === "object"
  && "code" in error
  && (error as { code?: string }).code === "P2002"
);

const getRecipients = (schedule: ScheduleCandidate): Recipient[] => {
  if (schedule.assignedToId && schedule.assignedTo) {
    return [{
      userId: schedule.assignedTo.id,
      preferences: parsePreferences(schedule.assignedTo.notificationPreferences)
    }];
  }

  if (schedule.asset.visibility === "personal") {
    const recipient = schedule.asset.owner ?? schedule.asset.createdBy;

    return [{
      userId: recipient.id,
      preferences: parsePreferences(recipient.notificationPreferences)
    }];
  }

  return schedule.asset.household.members.map((member) => ({
    userId: member.userId,
    preferences: parsePreferences(member.user.notificationPreferences)
  }));
};

const getHouseholdRecipients = (item: LowStockCandidate): Recipient[] => item.household.members.map((member) => ({
  userId: member.userId,
  preferences: parsePreferences(member.user.notificationPreferences)
}));

const formatQuantityValue = (value: number): string => Number.isInteger(value)
  ? String(value)
  : value.toFixed(2).replace(/\.0+$|0+$/g, "").replace(/\.$/, "");

const createNotificationRecord = async (
  prisma: PrismaExecutor,
  schedule: ScheduleCandidate,
  recipient: Recipient,
  channel: NotificationChannel,
  event: NotificationEvent,
  now: Date
) => {
  const dedupeKey = `${recipient.userId}:${channel}:${schedule.id}:${event.dedupeSuffix}:${buildCycleKey(schedule)}`;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: recipient.userId,
        householdId: schedule.asset.householdId,
        assetId: schedule.asset.id,
        scheduleId: schedule.id,
        dedupeKey,
        type: event.type,
        channel,
        status: "pending",
        title: event.title,
        body: event.body,
        scheduledFor: event.scheduledFor,
        escalationLevel: event.escalationLevel,
        payload: {
          ...(event.payload as Record<string, unknown>),
          createdAt: now.toISOString()
        } as Prisma.InputJsonValue
      }
    });

    return notification.id;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
};

const hasRecentLowStockNotification = async (
  prisma: PrismaExecutor,
  itemId: string,
  householdId: string,
  recipient: Recipient,
  channel: NotificationChannel,
  since: Date
) => prisma.notification.findFirst({
  where: {
    userId: recipient.userId,
    householdId,
    channel,
    type: "inventory_low_stock",
    createdAt: {
      gte: since
    },
    dedupeKey: {
      startsWith: `${recipient.userId}:${channel}:${itemId}:inventory-low-stock:`
    }
  },
  select: {
    id: true
  }
});

const createLowStockNotificationRecord = async (
  prisma: PrismaExecutor,
  item: LowStockCandidate,
  recipient: Recipient,
  channel: NotificationChannel,
  now: Date
) => {
  const recentNotification = await hasRecentLowStockNotification(
    prisma,
    item.id,
    item.householdId,
    recipient,
    channel,
    new Date(now.getTime() - (24 * 60 * 60 * 1000))
  );

  if (recentNotification) {
    return null;
  }

  const supplierText = item.preferredSupplier ? ` Supplier: ${item.preferredSupplier}.` : "";

  const notification = await prisma.notification.create({
    data: {
      userId: recipient.userId,
      householdId: item.householdId,
      dedupeKey: `${recipient.userId}:${channel}:${item.id}:inventory-low-stock:${now.toISOString()}`,
      type: "inventory_low_stock",
      channel,
      status: "pending",
      title: `Low stock: ${item.name}`,
      body: `${formatQuantityValue(item.quantityOnHand)} ${item.unit} remaining (reorder at ${formatQuantityValue(item.reorderThreshold)}).${supplierText}`,
      scheduledFor: now,
      escalationLevel: 0,
      payload: {
        entityType: "inventory_item",
        entityId: item.id,
        itemName: item.name,
        quantityOnHand: item.quantityOnHand,
        reorderThreshold: item.reorderThreshold,
        unit: item.unit,
        preferredSupplier: item.preferredSupplier,
        createdAt: now.toISOString()
      } as Prisma.InputJsonValue
    }
  });

  return notification.id;
};

export const scanAndCreateNotifications = async (
  prisma: PrismaClient,
  options: {
    householdId?: string;
    now?: Date;
  } = {}
): Promise<NotificationScanResult> => {
  const now = options.now ?? new Date();
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      asset: {
        deletedAt: null,
        isArchived: false,
        ...(options.householdId ? { householdId: options.householdId } : {})
      }
    },
    include: {
      metric: {
        select: {
          currentValue: true,
          unit: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          notificationPreferences: true
        }
      },
      asset: {
        select: {
          id: true,
          name: true,
          visibility: true,
          ownerId: true,
          createdById: true,
          householdId: true,
          owner: {
            select: {
              id: true,
              notificationPreferences: true
            }
          },
          createdBy: {
            select: {
              id: true,
              notificationPreferences: true
            }
          },
          household: {
            select: {
              members: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      id: true,
                      notificationPreferences: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  const createdNotificationIds: string[] = [];

  for (const schedule of schedules) {
    const config = notificationConfigSchema.parse(schedule.notificationConfig);
    const events = buildNotificationEvents(schedule as ScheduleCandidate, now);
    const recipients = getRecipients(schedule as ScheduleCandidate);

    for (const recipient of recipients) {
      const channels = resolveChannels(config.channels as NotificationChannel[], recipient.preferences);

      for (const channel of channels) {
        for (const event of events) {
          const notificationId = await createNotificationRecord(
            prisma,
            schedule as ScheduleCandidate,
            recipient,
            channel,
            event,
            now
          );

          if (notificationId) {
            createdNotificationIds.push(notificationId);
          }
        }
      }
    }
  }

  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      deletedAt: null,
      itemType: "consumable",
      reorderThreshold: {
        not: null
      },
      ...(options.householdId ? { householdId: options.householdId } : {})
    },
    include: {
      household: {
        select: {
          members: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  notificationPreferences: true
                }
              }
            }
          }
        }
      }
    }
  });

  for (const item of lowStockItems) {
    if (item.reorderThreshold === null || item.quantityOnHand > item.reorderThreshold) {
      continue;
    }

    const recipients = getHouseholdRecipients(item as LowStockCandidate);

    for (const recipient of recipients) {
      const channels = resolveChannels(recipient.preferences.enabledChannels, recipient.preferences);

      for (const channel of channels) {
        const notificationId = await createLowStockNotificationRecord(
          prisma,
          item as LowStockCandidate,
          recipient,
          channel,
          now
        );

        if (notificationId) {
          createdNotificationIds.push(notificationId);
        }
      }
    }
  }

  return {
    createdCount: createdNotificationIds.length,
    createdNotificationIds
  };
};

type DeliveryMode = "log" | "noop";

const getDeliveryMode = (): DeliveryMode => (process.env.NOTIFICATION_DELIVERY_MODE as DeliveryMode | undefined) ?? "log";

const deliverToAdapter = async (notification: ReturnType<typeof toNotificationResponse>, mode: DeliveryMode): Promise<void> => {
  if (mode === "noop") {
    return;
  }

  console.info("[notification-delivery]", JSON.stringify({
    channel: notification.channel,
    type: notification.type,
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    payload: notification.payload
  }));
};

export const deliverPendingNotification = async (
  prisma: PrismaClient,
  notificationId: string
): Promise<{ status: NotificationStatus; delivered: boolean }> => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) {
    return { status: "failed", delivered: false };
  }

  if (notification.status !== "pending") {
    return { status: notification.status, delivered: false };
  }

  try {
    await deliverToAdapter(toNotificationResponse(notification), getDeliveryMode());
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "sent",
        sentAt: new Date()
      }
    });

    return { status: "sent", delivered: true };
  } catch {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "failed"
      }
    });

    return { status: "failed", delivered: false };
  }
};