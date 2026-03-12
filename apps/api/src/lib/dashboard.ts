import { assetDetailResponseSchema, dueWorkItemSchema, householdDashboardSchema } from "@lifekeeper/types";
import type { PrismaClient } from "@prisma/client";
import { assertMembership, getAccessibleAsset, getMembership } from "./asset-access.js";
import { toMaintenanceLogResponse } from "./maintenance-logs.js";
import { toAssetResponse, toNotificationResponse, toUsageMetricResponse } from "./presenters.js";
import { toMaintenanceScheduleResponse } from "./schedule-state.js";

const formatDueSummary = (schedule: ReturnType<typeof toMaintenanceScheduleResponse>, currentMetricValue: number | null, metricUnit: string | null): string => {
  if (schedule.status === "overdue") {
    return `${schedule.name} is overdue.`;
  }

  if (schedule.nextDueAt) {
    return `${schedule.name} is due on ${schedule.nextDueAt.slice(0, 10)}.`;
  }

  if (schedule.nextDueMetricValue !== null) {
    const delta = currentMetricValue === null ? null : Math.max(0, schedule.nextDueMetricValue - currentMetricValue);
    const unit = metricUnit ?? "units";
    return delta === null
      ? `${schedule.name} is due at ${schedule.nextDueMetricValue} ${unit}.`
      : `${schedule.name} is due in ${delta} ${unit}.`;
  }

  return `${schedule.name} needs attention.`;
};

export const listHouseholdDueWork = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  options: {
    limit?: number;
    status?: "all" | "due" | "overdue";
  } = {}
) => {
  await assertMembership(prisma, householdId, userId);

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      isActive: true,
      asset: {
        householdId,
        isArchived: false,
        OR: [
          { visibility: "shared" },
          { createdById: userId }
        ]
      }
    },
    include: {
      metric: {
        select: {
          currentValue: true,
          unit: true
        }
      },
      asset: {
        select: {
          id: true,
          name: true,
          category: true
        }
      }
    },
    orderBy: [
      { nextDueAt: "asc" },
      { updatedAt: "desc" }
    ]
  });

  return schedules
    .map((schedule) => {
      const response = toMaintenanceScheduleResponse(schedule);

      return dueWorkItemSchema.parse({
        assetId: schedule.asset.id,
        assetName: schedule.asset.name,
        assetCategory: schedule.asset.category,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        status: response.status,
        nextDueAt: response.nextDueAt,
        nextDueMetricValue: response.nextDueMetricValue,
        currentMetricValue: schedule.metric?.currentValue ?? null,
        metricUnit: schedule.metric?.unit ?? null,
        summary: formatDueSummary(response, schedule.metric?.currentValue ?? null, schedule.metric?.unit ?? null)
      });
    })
    .filter((item) => options.status === "all" || options.status === undefined
      ? item.status !== "upcoming"
      : item.status === options.status)
    .slice(0, options.limit ?? 25);
};

export const buildHouseholdDashboard = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  options: {
    dueWorkLimit?: number;
    notificationLimit?: number;
  } = {}
) => {
  const membership = await getMembership(prisma, householdId, userId);

  if (!membership) {
    throw new Error("FORBIDDEN");
  }

  const [household, dueWork, assets, notifications] = await Promise.all([
    prisma.household.findUnique({
      where: { id: householdId },
      include: {
        _count: {
          select: { members: true }
        }
      }
    }),
    listHouseholdDueWork(prisma, householdId, userId, {
      limit: options.dueWorkLimit ?? 8,
      status: "all"
    }),
    prisma.asset.findMany({
      where: {
        householdId,
        isArchived: false,
        OR: [
          { visibility: "shared" },
          { createdById: userId }
        ]
      },
      include: {
        schedules: {
          where: { isActive: true },
          include: {
            metric: {
              select: { currentValue: true }
            }
          }
        },
        logs: {
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { completedAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.notification.findMany({
      where: {
        userId,
        householdId
      },
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      take: options.notificationLimit ?? 8
    })
  ]);

  if (!household) {
    throw new Error("NOT_FOUND");
  }

  const assetOverviews = assets.map((asset) => {
    const scheduleResponses = asset.schedules.map(toMaintenanceScheduleResponse);
    const dueScheduleCount = scheduleResponses.filter((schedule) => schedule.status === "due").length;
    const overdueScheduleCount = scheduleResponses.filter((schedule) => schedule.status === "overdue").length;
    const nextDueAt = scheduleResponses
      .map((schedule) => schedule.nextDueAt)
      .filter((value): value is string => value !== null)
      .sort()[0] ?? null;

    return {
      asset: toAssetResponse(asset),
      dueScheduleCount,
      overdueScheduleCount,
      nextDueAt,
      lastCompletedAt: asset.logs[0]?.completedAt.toISOString() ?? null
    };
  });

  return householdDashboardSchema.parse({
    household: {
      id: household.id,
      name: household.name,
      createdById: household.createdById,
      createdAt: household.createdAt.toISOString(),
      updatedAt: household.updatedAt.toISOString(),
      memberCount: household._count.members,
      myRole: membership.role
    },
    stats: {
      assetCount: assets.length,
      dueScheduleCount: dueWork.filter((item) => item.status === "due").length,
      overdueScheduleCount: dueWork.filter((item) => item.status === "overdue").length,
      unreadNotificationCount: await prisma.notification.count({
        where: {
          userId,
          householdId,
          readAt: null
        }
      })
    },
    dueWork,
    assets: assetOverviews,
    notifications: notifications.map(toNotificationResponse)
  });
};

export const buildAssetDetail = async (
  prisma: PrismaClient,
  assetId: string,
  userId: string,
  logLimit = 10
) => {
  const asset = await getAccessibleAsset(prisma, assetId, userId);

  if (!asset) {
    return null;
  }

  const detail = await prisma.asset.findUnique({
    where: { id: asset.id },
    include: {
      parentAsset: { select: { id: true, name: true, category: true } },
      childAssets: { select: { id: true, name: true, category: true } },
      usageMetrics: {
        orderBy: { createdAt: "asc" }
      },
      schedules: {
        where: { isActive: true },
        include: {
          metric: {
            select: {
              currentValue: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      logs: {
        include: { parts: true },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: logLimit
      }
    }
  });

  if (!detail) {
    return null;
  }

  const schedules = detail.schedules.map(toMaintenanceScheduleResponse);

  return assetDetailResponseSchema.parse({
    asset: toAssetResponse(detail, {
      parentAsset: detail.parentAsset,
      childAssets: detail.childAssets
    }),
    metrics: detail.usageMetrics.map(toUsageMetricResponse),
    schedules,
    recentLogs: detail.logs.map(log => toMaintenanceLogResponse(log, log.parts)),
    dueScheduleCount: schedules.filter((schedule) => schedule.status === "due").length,
    overdueScheduleCount: schedules.filter((schedule) => schedule.status === "overdue").length
  });
};