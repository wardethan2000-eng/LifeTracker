import { assetDetailResponseSchema, dueWorkItemSchema, householdDashboardSchema, maintenanceTriggerSchema } from "@aegis/types";
import type { PrismaClient } from "@prisma/client";
import { getAccessibleAsset, getMembership, personalAssetAccessWhere } from "./asset-access.js";
import { toMaintenanceLogResponse } from "./maintenance-logs.js";
import { toAssetResponse, toNotificationResponse, toUsageMetricResponse } from "./serializers/index.js";
import { toMaintenanceScheduleResponse } from "./schedule-state.js";

export class DashboardNotFoundError extends Error {
  constructor(message = "Household not found.") {
    super(message);
  }
}

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

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const computeScheduleOverviewStatus = (
  schedule: {
    nextDueAt: Date | null;
    nextDueMetricValue: number | null;
    metricCurrentValue: number | null;
    leadTimeDays: number;
  },
  now: Date
): "overdue" | "due" | "upcoming" => {
  if (schedule.nextDueAt && schedule.nextDueAt < now) {
    return "overdue";
  }

  if (schedule.nextDueAt) {
    const dueWindowStart = new Date(schedule.nextDueAt.getTime() - (schedule.leadTimeDays * MILLISECONDS_PER_DAY));

    if (dueWindowStart < now) {
      return "due";
    }
  }

  if (
    schedule.nextDueMetricValue !== null
    && schedule.metricCurrentValue !== null
    && schedule.metricCurrentValue >= schedule.nextDueMetricValue
  ) {
    return "overdue";
  }

  return "upcoming";
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
  const lookahead = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      isActive: true,
      OR: [
        { nextDueAt: { lte: lookahead } },
        { nextDueMetricValue: { not: null } }
      ],
      asset: {
        householdId,
        isArchived: false,
        ...personalAssetAccessWhere(userId)
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
  const [membership, household, dueWork, assets, notifications, unreadNotificationCount] = await Promise.all([
    getMembership(prisma, householdId, userId),
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
        ...personalAssetAccessWhere(userId)
      },
      include: {
        schedules: {
          where: { isActive: true },
          select: {
            nextDueAt: true,
            nextDueMetricValue: true,
            triggerConfig: true,
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
      take: 20,
      orderBy: { createdAt: "desc" }
    }),
    prisma.notification.findMany({
      where: {
        userId,
        householdId
      },
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      take: options.notificationLimit ?? 8
    }),
    prisma.notification.count({
      where: {
        userId,
        householdId,
        readAt: null
      }
    })
  ]);

  if (!membership) {
    throw new Error("Dashboard membership context is unavailable.");
  }

  if (!household) {
    throw new DashboardNotFoundError();
  }

  const now = new Date();

  const assetOverviews = assets.map((asset) => {
    let dueScheduleCount = 0;
    let overdueScheduleCount = 0;
    let earliestNextDueAt: string | null = null;

    for (const schedule of asset.schedules) {
      const trigger = maintenanceTriggerSchema.safeParse(schedule.triggerConfig);
      const leadTimeDays = trigger.success && "leadTimeDays" in trigger.data
        ? (trigger.data.leadTimeDays ?? 0)
        : 0;
      const status = computeScheduleOverviewStatus({
        nextDueAt: schedule.nextDueAt,
        nextDueMetricValue: schedule.nextDueMetricValue,
        metricCurrentValue: schedule.metric?.currentValue ?? null,
        leadTimeDays
      }, now);

      if (status === "due") {
        dueScheduleCount++;
      }

      if (status === "overdue") {
        overdueScheduleCount++;
      }

      if (schedule.nextDueAt) {
        const nextDueAtIso = schedule.nextDueAt.toISOString();

        if (!earliestNextDueAt || nextDueAtIso < earliestNextDueAt) {
          earliestNextDueAt = nextDueAtIso;
        }
      }
    }

    return {
      asset: toAssetResponse(asset),
      dueScheduleCount,
      overdueScheduleCount,
      nextDueAt: earliestNextDueAt,
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
      unreadNotificationCount
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
      hobbyLinks: {
        include: {
          hobby: {
            select: { id: true, name: true, hobbyType: true, status: true }
          }
        }
      },
      projectAssets: {
        include: {
          project: {
            select: { id: true, name: true, status: true, householdId: true }
          }
        },
        orderBy: { createdAt: "desc" }
      },
      inventoryLinks: {
        where: {
          inventoryItem: { deletedAt: null }
        },
        include: {
          inventoryItem: {
            select: { id: true, name: true, unit: true, quantityOnHand: true }
          }
        },
        orderBy: { createdAt: "desc" }
      },
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
        where: { deletedAt: null },
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
    hobbyLinks: detail.hobbyLinks.map((link) => ({
      id: link.id,
      hobbyId: link.hobbyId,
      hobbyName: link.hobby.name,
      hobbyType: link.hobby.hobbyType ?? null,
      hobbyStatus: link.hobby.status,
      role: link.role ?? null,
      notes: link.notes ?? null
    })),
    projectLinks: detail.projectAssets.map((pa) => ({
      id: pa.id,
      projectId: pa.projectId,
      relationship: pa.relationship,
      role: pa.role ?? null,
      notes: pa.notes ?? null,
      project: {
        id: pa.project.id,
        name: pa.project.name,
        status: pa.project.status,
        householdId: pa.project.householdId
      },
      createdAt: pa.createdAt.toISOString(),
      updatedAt: pa.updatedAt.toISOString()
    })),
    inventoryLinks: detail.inventoryLinks.map((link) => ({
      id: link.id,
      assetId: link.assetId,
      inventoryItemId: link.inventoryItemId,
      notes: link.notes ?? null,
      recommendedQuantity: link.recommendedQuantity ?? null,
      inventoryItem: {
        id: link.inventoryItem.id,
        name: link.inventoryItem.name,
        unit: link.inventoryItem.unit,
        quantityOnHand: link.inventoryItem.quantityOnHand
      },
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString()
    })),
    dueScheduleCount: schedules.filter((schedule) => schedule.status === "due").length,
    overdueScheduleCount: schedules.filter((schedule) => schedule.status === "overdue").length
  });
};