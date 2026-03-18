import type { Prisma, PrismaClient } from "@prisma/client";
import { maintenanceTriggerSchema } from "@lifekeeper/types";
import {
  aggregateCostsByPeriod,
  calculateUsageRate,
  computeLogTotalCost,
  computeScheduleForecast
} from "@lifekeeper/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, getAccessibleAsset } from "../../lib/asset-access.js";
import {
  toAssetCostPerUnitResponse,
  toAssetCostSummaryResponse,
  toCostForecastResponse,
  toHouseholdCostDashboardResponse,
  toHouseholdCostOverviewResponse,
  toServiceProviderSpendResponse
} from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const dashboardQuerySchema = z.object({
  periodMonths: z.coerce.number().int().min(1).max(60).default(12)
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const categoryLabels: Record<string, string> = {
  vehicle: "Vehicle",
  home: "Home",
  marine: "Marine",
  aircraft: "Aircraft",
  yard: "Yard",
  workshop: "Workshop",
  appliance: "Appliance",
  hvac: "HVAC",
  technology: "Technology",
  other: "Other"
};

const categoryLabel = (category: string): string => categoryLabels[category] ?? category;

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  date.getUTCDate(),
  date.getUTCHours(),
  date.getUTCMinutes(),
  date.getUTCSeconds(),
  date.getUTCMilliseconds()
));

const average = (values: number[]): number | null => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

type ScheduleForecastSource = {
  id: string;
  assetId: string;
  assetName: string;
  name: string;
  estimatedCost: number | null;
  triggerType: string;
  triggerConfig: Prisma.JsonValue;
  metricId: string | null;
  nextDueAt: Date | null;
  nextDueMetricValue: number | null;
};

const buildForecastResponse = async (
  prisma: {
    maintenanceLog: { findMany: Function };
    usageMetricEntry: { findMany: Function };
  },
  schedules: ScheduleForecastSource[],
  scope: { householdId: string | null; assetId: string | null }
) => {
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const metricIds = schedules.flatMap((schedule) => schedule.metricId ? [schedule.metricId] : []);

  const [logs, metricEntries] = await Promise.all([
    scheduleIds.length > 0
      ? prisma.maintenanceLog.findMany({
          where: {
            scheduleId: { in: scheduleIds }
          },
          include: {
            parts: {
              select: {
                quantity: true,
                unitCost: true
              }
            }
          },
          orderBy: [
            { scheduleId: "asc" },
            { completedAt: "desc" }
          ]
        })
      : Promise.resolve([]),
    metricIds.length > 0
      ? prisma.usageMetricEntry.findMany({
          where: {
            metricId: { in: metricIds }
          },
          orderBy: [
            { metricId: "asc" },
            { recordedAt: "asc" }
          ]
        })
      : Promise.resolve([])
  ]);

  const recentLogCostsBySchedule = new Map<string, number[]>();

  for (const log of logs as Array<{
    scheduleId: string | null;
    cost: number | null;
    laborHours: number | null;
    laborRate: number | null;
    parts: Array<{ quantity: number; unitCost: number | null }>;
  }>) {
    if (!log.scheduleId) {
      continue;
    }

    const entries = recentLogCostsBySchedule.get(log.scheduleId) ?? [];

    if (entries.length < 10) {
      entries.push(computeLogTotalCost(log).totalCost);
      recentLogCostsBySchedule.set(log.scheduleId, entries);
    }
  }

  const ratePerMetricId = new Map<string, number>();
  const metricEntryGroups = new Map<string, Array<{ value: number; date: Date }>>();

  for (const entry of metricEntries as Array<{ metricId: string; value: number; recordedAt: Date }>) {
    const group = metricEntryGroups.get(entry.metricId) ?? [];
    group.push({ value: entry.value, date: entry.recordedAt });
    metricEntryGroups.set(entry.metricId, group);
  }

  for (const [metricId, entries] of metricEntryGroups.entries()) {
    ratePerMetricId.set(metricId, calculateUsageRate(entries));
  }

  const forecastInput = schedules.map((schedule) => {
    const trigger = maintenanceTriggerSchema.parse(schedule.triggerConfig);
    const ratePerDay = schedule.metricId ? (ratePerMetricId.get(schedule.metricId) ?? 0) : 0;
    let intervalDays: number | null = null;

    switch (trigger.type) {
      case "interval":
        intervalDays = trigger.intervalDays;
        break;
      case "compound":
        intervalDays = trigger.intervalDays;
        break;
      case "usage":
        intervalDays = ratePerDay > 0 ? trigger.intervalValue / ratePerDay : null;
        break;
      case "seasonal":
        intervalDays = 365;
        break;
      case "one_time":
        intervalDays = null;
        break;
    }

    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      estimatedCost: schedule.estimatedCost,
      historicalAverageCost: average(recentLogCostsBySchedule.get(schedule.id) ?? []),
      nextDueAt: schedule.nextDueAt,
      nextDueMetricValue: schedule.nextDueMetricValue,
      ratePerDay: schedule.metricId ? (ratePerMetricId.get(schedule.metricId) ?? null) : null,
      triggerType: schedule.triggerType,
      intervalDays
    };
  });

  const forecast = computeScheduleForecast(forecastInput);
  const assetByScheduleId = new Map(schedules.map((schedule) => [schedule.id, { assetId: schedule.assetId, assetName: schedule.assetName }]));
  const forecastSchedules = forecast.schedules.map((schedule) => ({
    ...schedule,
    assetId: assetByScheduleId.get(schedule.scheduleId)?.assetId ?? "",
    assetName: assetByScheduleId.get(schedule.scheduleId)?.assetName ?? ""
  }));
  const byAssetMap = new Map<string, { assetId: string; assetName: string; cost3m: number; cost6m: number; cost12m: number }>();

  for (const schedule of forecastSchedules) {
    const existing = byAssetMap.get(schedule.assetId) ?? {
      assetId: schedule.assetId,
      assetName: schedule.assetName,
      cost3m: 0,
      cost6m: 0,
      cost12m: 0
    };
    existing.cost3m += schedule.cost3m;
    existing.cost6m += schedule.cost6m;
    existing.cost12m += schedule.cost12m;
    byAssetMap.set(schedule.assetId, existing);
  }

  return toCostForecastResponse({
    householdId: scope.householdId,
    assetId: scope.assetId,
    total3m: forecast.totals.total3m,
    total6m: forecast.totals.total6m,
    total12m: forecast.totals.total12m,
    schedules: forecastSchedules,
    byAsset: Array.from(byAssetMap.values()).sort((left, right) => right.cost12m - left.cost12m)
  });
};

const buildHouseholdCostDashboard = async (
  prisma: PrismaClient,
  householdId: string,
  periodMonths: number
) => {
  const periodEnd = new Date();
  const periodStart = startOfUtcMonth(addUtcMonths(periodEnd, -(periodMonths - 1)));
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      asset: { householdId },
      completedAt: { gte: periodStart }
    },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          category: true
        }
      },
      parts: {
        select: {
          quantity: true,
          unitCost: true
        }
      },
      schedule: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      completedAt: "asc"
    }
  });

  const costEntries = logs.map((log) => ({
    log,
    breakdown: computeLogTotalCost(log)
  }));
  const totalSpend = costEntries.reduce((sum, item) => sum + item.breakdown.totalCost, 0);
  const categoryMap = new Map<string, { category: string; categoryLabel: string; totalCost: number; assetIds: Set<string>; logCount: number }>();
  const assetMap = new Map<string, { assetId: string; assetName: string; category: string; totalCost: number; logCount: number }>();
  const scheduleMap = new Map<string, { scheduleName: string; totalCost: number; occurrences: number }>();

  for (const entry of costEntries) {
    const totalCost = entry.breakdown.totalCost;
    const categoryKey = entry.log.asset.category;
    const categoryEntry = categoryMap.get(categoryKey) ?? {
      category: categoryKey,
      categoryLabel: categoryLabel(categoryKey),
      totalCost: 0,
      assetIds: new Set<string>(),
      logCount: 0
    };
    categoryEntry.totalCost += totalCost;
    categoryEntry.assetIds.add(entry.log.asset.id);
    categoryEntry.logCount += 1;
    categoryMap.set(categoryKey, categoryEntry);

    const assetEntry = assetMap.get(entry.log.asset.id) ?? {
      assetId: entry.log.asset.id,
      assetName: entry.log.asset.name,
      category: entry.log.asset.category,
      totalCost: 0,
      logCount: 0
    };
    assetEntry.totalCost += totalCost;
    assetEntry.logCount += 1;
    assetMap.set(entry.log.asset.id, assetEntry);

    if (entry.log.schedule) {
      const scheduleEntry = scheduleMap.get(entry.log.schedule.id) ?? {
        scheduleName: entry.log.schedule.name,
        totalCost: 0,
        occurrences: 0
      };
      scheduleEntry.totalCost += totalCost;
      scheduleEntry.occurrences += 1;
      scheduleMap.set(entry.log.schedule.id, scheduleEntry);
    }
  }

  const monthly = aggregateCostsByPeriod(costEntries.map((entry) => ({
    totalCost: entry.breakdown.totalCost,
    completedAt: entry.log.completedAt
  })), "month");

  return toHouseholdCostDashboardResponse({
    householdId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalSpend,
    spendByCategory: Array.from(categoryMap.values())
      .map((entry) => ({
        category: entry.category,
        categoryLabel: entry.categoryLabel,
        totalCost: entry.totalCost,
        assetCount: entry.assetIds.size,
        logCount: entry.logCount
      }))
      .sort((left, right) => right.totalCost - left.totalCost),
    spendByAsset: Array.from(assetMap.values()).sort((left, right) => right.totalCost - left.totalCost),
    spendByMonth: monthly.periods.map((entry) => ({
      month: entry.period,
      totalCost: entry.totalCost,
      logCount: entry.logCount
    })),
    topScheduleTypes: Array.from(scheduleMap.values())
      .sort((left, right) => right.totalCost - left.totalCost)
      .slice(0, 15)
  });
};

const buildHouseholdServiceProviderSpend = async (
  prisma: PrismaClient,
  householdId: string
) => {
  const providers = await prisma.serviceProvider.findMany({
    where: { householdId },
    orderBy: { name: "asc" }
  });
  const providerIds = providers.map((provider) => provider.id);
  const monthFloor = startOfUtcMonth(addUtcMonths(new Date(), -23));
  const [maintenanceLogs, projectExpenses] = await Promise.all([
    providerIds.length > 0
      ? prisma.maintenanceLog.findMany({
          where: {
            serviceProviderId: { in: providerIds },
            asset: { householdId }
          },
          include: {
            parts: {
              select: {
                quantity: true,
                unitCost: true
              }
            }
          },
          orderBy: { completedAt: "asc" }
        })
      : Promise.resolve([]),
    providerIds.length > 0
      ? prisma.projectExpense.findMany({
          where: {
            serviceProviderId: { in: providerIds },
            deletedAt: null,
            project: { householdId, deletedAt: null }
          },
          orderBy: { createdAt: "asc" }
        })
      : Promise.resolve([])
  ]);

  const maintenanceSummary = new Map<string, { totalCost: number; count: number; firstUsed: Date | null; lastUsed: Date | null; monthly: Map<string, number> }>();
  const projectSummary = new Map<string, { totalCost: number; count: number; firstUsed: Date | null; lastUsed: Date | null }>();

  for (const log of maintenanceLogs as Array<{
    serviceProviderId: string | null;
    completedAt: Date;
    cost: number | null;
    laborHours: number | null;
    laborRate: number | null;
    parts: Array<{ quantity: number; unitCost: number | null }>;
  }>) {
    if (!log.serviceProviderId) {
      continue;
    }

    const summary = maintenanceSummary.get(log.serviceProviderId) ?? {
      totalCost: 0,
      count: 0,
      firstUsed: null,
      lastUsed: null,
      monthly: new Map<string, number>()
    };
    const totalCost = computeLogTotalCost(log).totalCost;
    summary.totalCost += totalCost;
    summary.count += 1;
    summary.firstUsed = summary.firstUsed ? new Date(Math.min(summary.firstUsed.getTime(), log.completedAt.getTime())) : log.completedAt;
    summary.lastUsed = summary.lastUsed ? new Date(Math.max(summary.lastUsed.getTime(), log.completedAt.getTime())) : log.completedAt;

    if (log.completedAt >= monthFloor) {
      const monthKey = `${log.completedAt.getUTCFullYear()}-${`${log.completedAt.getUTCMonth() + 1}`.padStart(2, "0")}`;
      summary.monthly.set(monthKey, (summary.monthly.get(monthKey) ?? 0) + totalCost);
    }

    maintenanceSummary.set(log.serviceProviderId, summary);
  }

  for (const expense of projectExpenses as Array<{ serviceProviderId: string | null; amount: number; date: Date | null; createdAt: Date }>) {
    if (!expense.serviceProviderId) {
      continue;
    }

    const summary = projectSummary.get(expense.serviceProviderId) ?? {
      totalCost: 0,
      count: 0,
      firstUsed: null,
      lastUsed: null
    };
    const usedAt = expense.date ?? expense.createdAt;
    summary.totalCost += expense.amount;
    summary.count += 1;
    summary.firstUsed = summary.firstUsed ? new Date(Math.min(summary.firstUsed.getTime(), usedAt.getTime())) : usedAt;
    summary.lastUsed = summary.lastUsed ? new Date(Math.max(summary.lastUsed.getTime(), usedAt.getTime())) : usedAt;
    projectSummary.set(expense.serviceProviderId, summary);
  }

  return toServiceProviderSpendResponse({
    householdId,
    providers: providers
      .map((provider) => {
        const maintenance = maintenanceSummary.get(provider.id);
        const project = projectSummary.get(provider.id);
        const firstUsedCandidates = [maintenance?.firstUsed, project?.firstUsed].filter((value): value is Date => Boolean(value));
        const lastUsedCandidates = [maintenance?.lastUsed, project?.lastUsed].filter((value): value is Date => Boolean(value));

        return {
          providerId: provider.id,
          providerName: provider.name,
          specialty: provider.specialty,
          totalMaintenanceCost: maintenance?.totalCost ?? 0,
          maintenanceLogCount: maintenance?.count ?? 0,
          totalProjectCost: project?.totalCost ?? 0,
          projectExpenseCount: project?.count ?? 0,
          totalCombinedCost: (maintenance?.totalCost ?? 0) + (project?.totalCost ?? 0),
          firstUsed: firstUsedCandidates.length > 0
            ? new Date(Math.min(...firstUsedCandidates.map((value) => value.getTime()))).toISOString()
            : null,
          lastUsed: lastUsedCandidates.length > 0
            ? new Date(Math.max(...lastUsedCandidates.map((value) => value.getTime()))).toISOString()
            : null,
          spendByMonth: Array.from(maintenance?.monthly.entries() ?? [])
            .map(([month, cost]) => ({ month, cost }))
            .sort((left, right) => left.month.localeCompare(right.month))
        };
      })
      .sort((left, right) => right.totalCombinedCost - left.totalCombinedCost)
  });
};

const buildHouseholdCostForecast = async (
  prisma: PrismaClient,
  householdId: string
) => {
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      isActive: true,
      asset: { householdId }
    },
    select: {
      id: true,
      assetId: true,
      name: true,
      estimatedCost: true,
      triggerType: true,
      triggerConfig: true,
      metricId: true,
      nextDueAt: true,
      nextDueMetricValue: true,
      asset: {
        select: {
          name: true
        }
      }
    }
  });

  return buildForecastResponse(prisma, schedules.map((schedule) => ({
    ...schedule,
    assetName: schedule.asset.name
  })), {
    householdId,
    assetId: null
  });
};

export const costAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/cost-analytics/dashboard", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = dashboardQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    return buildHouseholdCostDashboard(app.prisma, params.householdId, query.periodMonths);
  });

  app.get("/v1/households/:householdId/cost-analytics/service-providers", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    return buildHouseholdServiceProviderSpend(app.prisma, params.householdId);
  });

  app.get("/v1/households/:householdId/cost-analytics/overview", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const [dashboard, serviceProviderSpend, forecast] = await Promise.all([
      buildHouseholdCostDashboard(app.prisma, params.householdId, 12),
      buildHouseholdServiceProviderSpend(app.prisma, params.householdId),
      buildHouseholdCostForecast(app.prisma, params.householdId)
    ]);

    return toHouseholdCostOverviewResponse({
      dashboard,
      serviceProviderSpend,
      forecast
    });
  });

  app.get("/v1/households/:householdId/cost-analytics/forecast", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    return buildHouseholdCostForecast(app.prisma, params.householdId);
  });

  app.get("/v1/assets/:assetId/cost-analytics/summary", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const logs = await app.prisma.maintenanceLog.findMany({
      where: { assetId: asset.id },
      include: {
        parts: {
          select: {
            quantity: true,
            unitCost: true
          }
        },
        schedule: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { completedAt: "asc" }
    });

    const costEntries = logs.map((log) => ({
      log,
      totalCost: computeLogTotalCost(log).totalCost
    }));
    const lifetimeCost = costEntries.reduce((sum, entry) => sum + entry.totalCost, 0);
    const currentYear = new Date().getUTCFullYear();
    const yearToDateCost = costEntries
      .filter((entry) => entry.log.completedAt.getUTCFullYear() === currentYear)
      .reduce((sum, entry) => sum + entry.totalCost, 0);
    const yearly = aggregateCostsByPeriod(costEntries.map((entry) => ({ totalCost: entry.totalCost, completedAt: entry.log.completedAt })), "year");
    const monthly = aggregateCostsByPeriod(costEntries.map((entry) => ({ totalCost: entry.totalCost, completedAt: entry.log.completedAt })), "month");
    const scheduleMap = new Map<string, { scheduleId: string; scheduleName: string; totalCost: number; occurrences: number }>();

    for (const entry of costEntries) {
      if (!entry.log.schedule) {
        continue;
      }

      const scheduleEntry = scheduleMap.get(entry.log.schedule.id) ?? {
        scheduleId: entry.log.schedule.id,
        scheduleName: entry.log.schedule.name,
        totalCost: 0,
        occurrences: 0
      };
      scheduleEntry.totalCost += entry.totalCost;
      scheduleEntry.occurrences += 1;
      scheduleMap.set(entry.log.schedule.id, scheduleEntry);
    }

    return toAssetCostSummaryResponse({
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      lifetimeCost,
      yearToDateCost,
      rolling12MonthAverage: monthly.rolling12MonthAverage,
      costByYear: yearly.periods.map((entry) => ({
        year: entry.period,
        totalCost: entry.totalCost,
        logCount: entry.logCount
      })),
      costByMonth: monthly.periods.map((entry) => ({
        month: entry.period,
        totalCost: entry.totalCost,
        logCount: entry.logCount
      })),
      topSchedulesByCost: Array.from(scheduleMap.values())
        .sort((left, right) => right.totalCost - left.totalCost)
        .slice(0, 10)
        .map((entry) => ({
          ...entry,
          averageCost: entry.occurrences > 0 ? entry.totalCost / entry.occurrences : 0
        }))
    });
  });

  app.get("/v1/assets/:assetId/cost-analytics/cost-per-unit", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const [metrics, entries, logs] = await Promise.all([
      app.prisma.usageMetric.findMany({
        where: { assetId: asset.id },
        orderBy: { createdAt: "asc" }
      }),
      app.prisma.usageMetricEntry.findMany({
        where: { metric: { assetId: asset.id } },
        orderBy: [
          { metricId: "asc" },
          { recordedAt: "asc" }
        ]
      }),
      app.prisma.maintenanceLog.findMany({
        where: { assetId: asset.id },
        include: {
          parts: {
            select: {
              quantity: true,
              unitCost: true
            }
          }
        },
        orderBy: { completedAt: "asc" }
      })
    ]);

    const metricEntries = new Map<string, Array<{ value: number; recordedAt: Date }>>();

    for (const entry of entries) {
      const group = metricEntries.get(entry.metricId) ?? [];
      group.push({ value: entry.value, recordedAt: entry.recordedAt });
      metricEntries.set(entry.metricId, group);
    }

    const costLogs = logs.map((log) => ({
      completedAt: log.completedAt,
      totalCost: computeLogTotalCost(log).totalCost
    }));

    return toAssetCostPerUnitResponse({
      assetId: asset.id,
      metrics: metrics.map((metric) => {
        const metricLog = metricEntries.get(metric.id) ?? [];
        const earliest = metricLog[0];
        const latest = metricLog[metricLog.length - 1];
        const totalUsage = earliest && latest ? latest.value - earliest.value : 0;
        const totalCost = earliest && latest
          ? costLogs
              .filter((log) => log.completedAt >= earliest.recordedAt && log.completedAt <= latest.recordedAt)
              .reduce((sum, log) => sum + log.totalCost, 0)
          : 0;

        return {
          metricId: metric.id,
          metricName: metric.name,
          metricUnit: metric.unit,
          totalCost,
          totalUsage,
          costPerUnit: totalUsage > 0 ? totalCost / totalUsage : null
        };
      })
    });
  });

  app.get("/v1/assets/:assetId/cost-analytics/forecast", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        assetId: asset.id,
        isActive: true
      },
      select: {
        id: true,
        assetId: true,
        name: true,
        estimatedCost: true,
        triggerType: true,
        triggerConfig: true,
        metricId: true,
        nextDueAt: true,
        nextDueMetricValue: true,
        asset: {
          select: {
            name: true
          }
        }
      }
    });

    return buildForecastResponse(app.prisma, schedules.map((schedule) => ({
      ...schedule,
      assetName: schedule.asset.name
    })), {
      householdId: null,
      assetId: asset.id
    });
  });
};