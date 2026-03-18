import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, getAccessibleAsset, personalAssetAccessWhere } from "../../lib/asset-access.js";
import {
  toCategoryAdherencePayloadResponse,
  toComplianceReportPayloadResponse,
  toOnTimeRatePayloadResponse,
  toOverdueTrendPayloadResponse,
  toRegulatoryAssetOptionsResponse
} from "../../lib/serializers/index.js";
import { getComplianceStatus } from "../../lib/compliance-monitor.js";
import { buildCompletionCycleLedger } from "../../services/schedule-adherence.js";
import type {
  CompletionCycleRecord,
  ComplianceStatus,
  RegulatoryAssetOption
} from "@lifekeeper/types";

const householdAnalyticsQuerySchema = z.object({
  householdId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  assetId: z.string().cuid().optional()
});

const complianceReportParamsSchema = z.object({
  assetId: z.string().cuid()
});

const complianceReportQuerySchema = z.object({
  householdId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  gracePeriodDays: z.coerce.number().int().min(0).default(0)
});

const regulatoryAssetsQuerySchema = z.object({
  householdId: z.string().cuid()
});

type ScheduleSummary = {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  asset: {
    id: string;
    name: string;
    category: string;
  };
};

type ComplianceSummary = {
  totalCycles: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  averageDaysLate: number | null;
};

const toMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  1,
  0,
  0,
  0,
  0
));

const subtractMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() - months,
  date.getUTCDate(),
  0,
  0,
  0,
  0
));

const getTrailingYearRange = (): { start: Date; end: Date } => {
  const end = new Date();
  const start = subtractMonths(end, 12);
  return { start, end };
};

const getMonthRange = (start: Date, end: Date): string[] => {
  if (start > end) {
    return [];
  }

  const months: string[] = [];
  let cursor = startOfUtcMonth(start);
  const endMonth = startOfUtcMonth(end);

  while (cursor <= endMonth) {
    months.push(toMonthKey(cursor));
    cursor = addUtcMonths(cursor, 1);
  }

  return months;
};

const isCountableCycle = (cycle: CompletionCycleRecord): cycle is CompletionCycleRecord & {
  dueDate: string;
  completedAt: string;
  deltaInDays: number;
} => cycle.dueDate !== null && cycle.completedAt !== null && cycle.deltaInDays !== null;

const isLateCycle = (cycle: CompletionCycleRecord): cycle is CompletionCycleRecord & {
  dueDate: string;
  completedAt: string;
  deltaInDays: number;
} => isCountableCycle(cycle) && cycle.deltaInDays > 0;

const summarizeCycles = (cycles: CompletionCycleRecord[]): ComplianceSummary => {
  const eligibleCycles = cycles.filter(isCountableCycle);
  const onTimeCount = eligibleCycles.filter((cycle) => cycle.deltaInDays <= 0).length;
  const lateCycles = eligibleCycles.filter((cycle) => cycle.deltaInDays > 0);
  const lateCount = lateCycles.length;

  return {
    totalCycles: eligibleCycles.length,
    onTimeCount,
    lateCount,
    onTimeRate: eligibleCycles.length > 0 ? (onTimeCount / eligibleCycles.length) * 100 : 0,
    averageDaysLate: lateCycles.length > 0
      ? lateCycles.reduce((sum, cycle) => sum + cycle.deltaInDays, 0) / lateCycles.length
      : null
  };
};

const filterCompletedCyclesInRange = (cycles: CompletionCycleRecord[], start: Date, end: Date): CompletionCycleRecord[] => cycles.filter((cycle) => {
  if (!cycle.completedAt) {
    return false;
  }

  const completedAt = new Date(cycle.completedAt);
  return completedAt >= start && completedAt <= end;
});

const filterReportCyclesInRange = (
  cycles: CompletionCycleRecord[],
  startDate?: Date,
  endDate?: Date
): CompletionCycleRecord[] => cycles.filter((cycle) => {
  if (!startDate && !endDate) {
    return true;
  }

  const effectiveDate = cycle.completedAt ? new Date(cycle.completedAt) : cycle.dueDate ? new Date(cycle.dueDate) : null;

  if (!effectiveDate) {
    return false;
  }

  return (!startDate || effectiveDate >= startDate) && (!endDate || effectiveDate <= endDate);
});

const getAccessibleScheduleWhere = (query: { householdId: string; assetId?: string | undefined }, userId: string): Prisma.MaintenanceScheduleWhereInput => ({
  isActive: true,
  ...(query.assetId ? { assetId: query.assetId } : {}),
  asset: {
    householdId: query.householdId,
    deletedAt: null,
    isArchived: false,
    ...personalAssetAccessWhere(userId)
  }
});

const getTrendDirection = (points: Array<{ overdueCount: number }>): "improving" | "worsening" | "stable" => {
  if (points.length < 2) {
    return "stable";
  }

  const recent = points.slice(-3);
  const prior = points.slice(-6, -3);

  if (recent.length === 0 || prior.length === 0) {
    return "stable";
  }

  const recentAverage = recent.reduce((sum, point) => sum + point.overdueCount, 0) / recent.length;
  const priorAverage = prior.reduce((sum, point) => sum + point.overdueCount, 0) / prior.length;

  if (priorAverage === 0) {
    return recentAverage > 0 ? "worsening" : "stable";
  }

  const ratio = (recentAverage - priorAverage) / priorAverage;

  if (ratio <= -0.1) {
    return "improving";
  }

  if (ratio >= 0.1) {
    return "worsening";
  }

  return "stable";
};

export const complianceAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/analytics/compliance/on-time-rate", async (request, reply) => {
    const query = householdAnalyticsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const { start, end } = query.startDate || query.endDate
      ? {
          start: query.startDate ? new Date(query.startDate) : getTrailingYearRange().start,
          end: query.endDate ? new Date(query.endDate) : new Date()
        }
      : getTrailingYearRange();

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: getAccessibleScheduleWhere(query, request.auth.userId),
      select: {
        id: true,
        name: true,
        asset: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });

    const cycles = filterCompletedCyclesInRange(
      await buildCompletionCycleLedger(app.prisma, { scheduleIds: schedules.map((schedule) => schedule.id) }),
      start,
      end
    );

    const summary = summarizeCycles(cycles);
    const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const byAsset = Array.from(cycles.reduce<Map<string, CompletionCycleRecord[]>>((map, cycle) => {
      const bucket = map.get(cycle.assetId);
      if (bucket) {
        bucket.push(cycle);
      } else {
        map.set(cycle.assetId, [cycle]);
      }
      return map;
    }, new Map()).entries())
      .map(([assetId, assetCycles]) => ({
        assetId,
        assetName: assetCycles[0]?.assetName ?? scheduleById.get(assetCycles[0]?.scheduleId ?? "")?.asset.name ?? "Unknown asset",
        ...summarizeCycles(assetCycles)
      }))
      .sort((left, right) => right.totalCycles - left.totalCycles || left.assetName.localeCompare(right.assetName));

    const byCategory = Array.from(cycles.reduce<Map<string, CompletionCycleRecord[]>>((map, cycle) => {
      const bucket = map.get(cycle.assetCategory);
      if (bucket) {
        bucket.push(cycle);
      } else {
        map.set(cycle.assetCategory, [cycle]);
      }
      return map;
    }, new Map()).entries())
      .map(([category, categoryCycles]) => ({
        category,
        ...summarizeCycles(categoryCycles)
      }))
      .sort((left, right) => left.onTimeRate - right.onTimeRate || right.totalCycles - left.totalCycles);

    const byMember = Array.from(cycles.reduce<Map<string, CompletionCycleRecord[]>>((map, cycle) => {
      if (!cycle.completedById) {
        return map;
      }

      const bucket = map.get(cycle.completedById);
      if (bucket) {
        bucket.push(cycle);
      } else {
        map.set(cycle.completedById, [cycle]);
      }
      return map;
    }, new Map()).entries())
      .map(([userId, memberCycles]) => ({
        userId,
        userName: memberCycles[0]?.completedByName ?? null,
        ...summarizeCycles(memberCycles)
      }))
      .sort((left, right) => left.onTimeRate - right.onTimeRate || right.totalCycles - left.totalCycles);

    return toOnTimeRatePayloadResponse({
      summary,
      breakdowns: {
        byAsset,
        byCategory,
        byMember
      }
    });
  });

  app.get("/v1/analytics/compliance/overdue-trend", async (request, reply) => {
    const query = householdAnalyticsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const { start, end } = query.startDate || query.endDate
      ? {
          start: query.startDate ? new Date(query.startDate) : getTrailingYearRange().start,
          end: query.endDate ? new Date(query.endDate) : new Date()
        }
      : getTrailingYearRange();

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: getAccessibleScheduleWhere(query, request.auth.userId),
      select: { id: true }
    });

    const cycles = filterCompletedCyclesInRange(
      await buildCompletionCycleLedger(app.prisma, { scheduleIds: schedules.map((schedule) => schedule.id) }),
      start,
      end
    );
    const monthKeys = getMonthRange(start, end);
    const lateCycles = cycles.filter(isLateCycle);
    const allCompletedByMonth = cycles.reduce<Map<string, number>>((map, cycle) => {
      if (!cycle.completedAt) {
        return map;
      }

      const key = toMonthKey(new Date(cycle.completedAt));
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map());
    const lateByMonth = lateCycles.reduce<Map<string, number[]>>((map, cycle) => {
      const key = toMonthKey(new Date(cycle.completedAt));
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(cycle.deltaInDays);
      } else {
        map.set(key, [cycle.deltaInDays]);
      }
      return map;
    }, new Map());

    const months = monthKeys.map((month) => {
      const lateDeltas = lateByMonth.get(month) ?? [];

      return {
        month,
        overdueCount: lateDeltas.length,
        averageDaysLate: lateDeltas.length > 0
          ? lateDeltas.reduce((sum, value) => sum + value, 0) / lateDeltas.length
          : null,
        totalCompletions: allCompletedByMonth.get(month) ?? 0
      };
    });

    return toOverdueTrendPayloadResponse({
      months,
      trendDirection: getTrendDirection(months)
    });
  });

  app.get("/v1/analytics/compliance/category-adherence", async (request, reply) => {
    const query = householdAnalyticsQuerySchema.omit({ assetId: true }).parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const { start, end } = query.startDate || query.endDate
      ? {
          start: query.startDate ? new Date(query.startDate) : getTrailingYearRange().start,
          end: query.endDate ? new Date(query.endDate) : new Date()
        }
      : getTrailingYearRange();

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: getAccessibleScheduleWhere(query, request.auth.userId),
      select: {
        id: true,
        name: true,
        asset: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });

    const cycles = filterCompletedCyclesInRange(
      await buildCompletionCycleLedger(app.prisma, { scheduleIds: schedules.map((schedule) => schedule.id) }),
      start,
      end
    );
    const schedulesByCategory = schedules.reduce<Map<string, ScheduleSummary[]>>((map, schedule) => {
      const bucket = map.get(schedule.asset.category);
      if (bucket) {
        bucket.push(schedule as ScheduleSummary);
      } else {
        map.set(schedule.asset.category, [schedule as ScheduleSummary]);
      }
      return map;
    }, new Map());

    const categories = Array.from(schedulesByCategory.entries()).map(([category, categorySchedules]) => {
      const categoryCycles = cycles.filter((cycle) => cycle.assetCategory === category);
      const scheduleSummaries = categorySchedules.map((schedule) => ({
        schedule,
        summary: summarizeCycles(categoryCycles.filter((cycle) => cycle.scheduleId === schedule.id))
      }));
      const worstSchedule = scheduleSummaries.length > 0
        ? [...scheduleSummaries]
            .sort((left, right) => left.summary.onTimeRate - right.summary.onTimeRate || right.summary.totalCycles - left.summary.totalCycles)[0]
        : null;

      return {
        category,
        activeScheduleCount: categorySchedules.length,
        totalCyclesInPeriod: summarizeCycles(categoryCycles).totalCycles,
        onTimeRate: summarizeCycles(categoryCycles).onTimeRate,
        averageDaysLate: summarizeCycles(categoryCycles).averageDaysLate,
        worstSchedule: worstSchedule ? {
          scheduleId: worstSchedule.schedule.id,
          scheduleName: worstSchedule.schedule.name,
          assetName: worstSchedule.schedule.asset.name,
          onTimeRate: worstSchedule.summary.onTimeRate
        } : null
      };
    }).sort((left, right) => left.onTimeRate - right.onTimeRate || right.totalCyclesInPeriod - left.totalCyclesInPeriod);

    return toCategoryAdherencePayloadResponse({ categories });
  });

  app.get("/v1/analytics/compliance/report/:assetId", async (request, reply) => {
    const params = complianceReportParamsSchema.parse(request.params);
    const query = complianceReportQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset || asset.householdId !== query.householdId) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const regulatorySchedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        assetId: asset.id,
        deletedAt: null,
        isRegulatory: true,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        asset: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (regulatorySchedules.length === 0) {
      return toComplianceReportPayloadResponse({
        assetId: asset.id,
        assetName: asset.name,
        assetCategory: asset.category,
        reportGeneratedAt: new Date().toISOString(),
        regulatorySchedules: [],
        overallComplianceStatus: "compliant",
        summary: {
          totalRegulatorySchedules: 0,
          compliantCount: 0,
          nonCompliantCount: 0,
          currentCount: 0
        }
      });
    }

    const cycleLedger = await buildCompletionCycleLedger(app.prisma, {
      scheduleIds: regulatorySchedules.map((schedule) => schedule.id)
    });

    const scheduleReports = regulatorySchedules.map((schedule) => {
      const cycles = filterReportCyclesInRange(
        cycleLedger.filter((cycle) => cycle.scheduleId === schedule.id),
        query.startDate ? new Date(query.startDate) : undefined,
        query.endDate ? new Date(query.endDate) : undefined
      );
      const complianceStatus = getComplianceStatus(cycles, query.gracePeriodDays);

      return {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        description: schedule.description,
        triggerType: schedule.triggerType,
        cycles,
        complianceStatus
      };
    });

    const summary = {
      totalRegulatorySchedules: scheduleReports.length,
      compliantCount: scheduleReports.filter((schedule) => schedule.complianceStatus === "compliant").length,
      nonCompliantCount: scheduleReports.filter((schedule) => schedule.complianceStatus === "non-compliant").length,
      currentCount: scheduleReports.filter((schedule) => schedule.complianceStatus === "current").length
    };
    const overallComplianceStatus: ComplianceStatus = summary.nonCompliantCount > 0
      ? "non-compliant"
      : summary.currentCount > 0
        ? "current"
        : "compliant";

    return toComplianceReportPayloadResponse({
      assetId: asset.id,
      assetName: asset.name,
      assetCategory: asset.category,
      reportGeneratedAt: new Date().toISOString(),
      regulatorySchedules: scheduleReports,
      overallComplianceStatus,
      summary
    });
  });

  app.get("/v1/analytics/compliance/regulatory-assets", async (request, reply) => {
    const query = regulatoryAssetsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const assets = await app.prisma.asset.findMany({
      where: {
        householdId: query.householdId,
        deletedAt: null,
        isArchived: false,
        ...personalAssetAccessWhere(request.auth.userId),
        schedules: {
          some: {
            deletedAt: null,
            isActive: true,
            isRegulatory: true
          }
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        _count: {
          select: {
            schedules: {
              where: {
                deletedAt: null,
                isActive: true,
                isRegulatory: true
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const payload: RegulatoryAssetOption[] = assets.map((asset) => ({
      assetId: asset.id,
      assetName: asset.name,
      assetCategory: asset.category,
      regulatoryScheduleCount: asset._count.schedules
    }));

    return toRegulatoryAssetOptionsResponse(payload);
  });
};