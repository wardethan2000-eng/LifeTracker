import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { isCountableCycle } from "../../lib/compliance-analytics.js";
import { addUtcMonths, getMonthRange, startOfUtcMonth, toMonthKey } from "../../lib/date-utils.js";
import {
  toAssetComparisonPayloadResponse,
  toMemberContributionPayloadResponse,
  toYearOverYearPayloadResponse
} from "../../lib/serializers/index.js";
import { buildCompletionCycleLedger } from "../../services/schedule-adherence.js";
import type { CompletionCycleRecord } from "@lifekeeper/types";

const MAX_YEAR_OVER_YEAR_COMPARISON_YEARS = 5;

const assetComparisonQuerySchema = z.object({
  householdId: z.string().cuid(),
  assetIds: z.string().transform((value, context) => {
    const ids = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const uniqueIds = Array.from(new Set(ids));

    if (uniqueIds.length < 2 || uniqueIds.length > 5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assetIds must contain between 2 and 5 asset IDs."
      });
      return z.NEVER;
    }

    return uniqueIds;
  }),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const yearOverYearQuerySchema = z.object({
  householdId: z.string().cuid(),
  assetId: z.string().cuid().optional(),
  years: z.string().transform((value, context) => {
    const years = Array.from(new Set(
      value
        .split(",")
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry) && entry > 0)
    ));

    if (years.length > MAX_YEAR_OVER_YEAR_COMPARISON_YEARS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `years must contain no more than ${MAX_YEAR_OVER_YEAR_COMPARISON_YEARS} values.`
      });
      return z.NEVER;
    }

    return years;
  }).optional()
});

const memberContributionQuerySchema = z.object({
  householdId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const toNumber = (value: number | null | undefined): number => value ?? 0;

const toPercentageChange = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
};

const summarizeCycles = (cycles: CompletionCycleRecord[]): {
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number | null;
} => {
  const eligibleCycles = cycles.filter(isCountableCycle);
  const onTimeCount = eligibleCycles.filter((cycle) => cycle.deltaInDays <= 0).length;
  const lateCount = eligibleCycles.length - onTimeCount;

  return {
    onTimeCount,
    lateCount,
    onTimeRate: eligibleCycles.length > 0 ? (onTimeCount / eligibleCycles.length) * 100 : null
  };
};

const filterCompletedCyclesInRange = (
  cycles: CompletionCycleRecord[],
  startDate?: string,
  endDate?: string
): CompletionCycleRecord[] => cycles.filter((cycle) => {
  if (!cycle.completedAt) {
    return false;
  }

  const completedAt = new Date(cycle.completedAt);

  return (!startDate || completedAt >= new Date(startDate))
    && (!endDate || completedAt <= new Date(endDate));
});

const toDateRangeFilter = (startDate?: string, endDate?: string): Pick<Prisma.MaintenanceLogWhereInput, "completedAt"> | Record<string, never> => {
  if (!startDate && !endDate) {
    return {};
  }

  return {
    completedAt: {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {})
    }
  };
};

export const comparativeAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/analytics/comparative/assets", async (request, reply) => {
    const query = assetComparisonQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const assets = await app.prisma.asset.findMany({
      where: {
        id: { in: query.assetIds },
        householdId: query.householdId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        category: true
      }
    });

    if (assets.length !== query.assetIds.length) {
      return reply.code(400).send({ message: "One or more selected assets were not found in this household." });
    }

    const dateFilter = toDateRangeFilter(query.startDate, query.endDate);
    const [logs, parts, schedules] = await Promise.all([
      app.prisma.maintenanceLog.findMany({
        where: {
          assetId: { in: query.assetIds },
          ...dateFilter
        },
        select: {
          id: true,
          assetId: true,
          completedAt: true,
          cost: true,
          scheduleId: true
        },
        orderBy: {
          completedAt: "asc"
        }
      }),
      app.prisma.maintenanceLogPart.findMany({
        where: {
          inventoryItemId: { not: null },
          log: {
            assetId: { in: query.assetIds },
            ...dateFilter
          }
        },
        select: {
          quantity: true,
          unitCost: true,
          inventoryItemId: true,
          name: true,
          inventoryItem: {
            select: {
              name: true
            }
          },
          log: {
            select: {
              assetId: true
            }
          }
        }
      }),
      app.prisma.maintenanceSchedule.findMany({
        where: {
          assetId: { in: query.assetIds },
          deletedAt: null
        },
        select: {
          id: true,
          assetId: true
        }
      })
    ]);

    const adherenceCycles = schedules.length > 0
      ? filterCompletedCyclesInRange(
          await buildCompletionCycleLedger(app.prisma, {
            scheduleIds: schedules.map((schedule) => schedule.id),
            includeOpenCycles: false
          }),
          query.startDate,
          query.endDate
        )
      : [];

    const monthKeys = Array.from(new Set(logs.map((log) => toMonthKey(log.completedAt)))).sort();
    const logsByAssetId = logs.reduce<Map<string, typeof logs>>((map, log) => {
      const existing = map.get(log.assetId);

      if (existing) {
        existing.push(log);
      } else {
        map.set(log.assetId, [log]);
      }

      return map;
    }, new Map());
    const partsByAssetId = parts.reduce<Map<string, typeof parts>>((map, part) => {
      const assetId = part.log.assetId;
      const existing = map.get(assetId);

      if (existing) {
        existing.push(part);
      } else {
        map.set(assetId, [part]);
      }

      return map;
    }, new Map());
    const cyclesByAssetId = adherenceCycles.reduce<Map<string, CompletionCycleRecord[]>>((map, cycle) => {
      const existing = map.get(cycle.assetId);

      if (existing) {
        existing.push(cycle);
      } else {
        map.set(cycle.assetId, [cycle]);
      }

      return map;
    }, new Map());

    return toAssetComparisonPayloadResponse({
      assets: assets.map((asset) => {
        const assetLogs = logsByAssetId.get(asset.id) ?? [];
        const assetParts = partsByAssetId.get(asset.id) ?? [];
        const assetCycleSummary = summarizeCycles(cyclesByAssetId.get(asset.id) ?? []);
        const monthlyCostMap = assetLogs.reduce<Map<string, number>>((map, log) => {
          const month = toMonthKey(log.completedAt);
          map.set(month, (map.get(month) ?? 0) + toNumber(log.cost));
          return map;
        }, new Map());
        const partMap = assetParts.reduce<Map<string, { itemName: string; totalQuantityConsumed: number; totalCost: number }>>((map, part) => {
          const itemName = part.inventoryItem?.name ?? part.name;
          const existing = map.get(itemName) ?? {
            itemName,
            totalQuantityConsumed: 0,
            totalCost: 0
          };

          existing.totalQuantityConsumed += part.quantity;
          existing.totalCost += part.quantity * toNumber(part.unitCost);
          map.set(itemName, existing);
          return map;
        }, new Map());

        return {
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category,
          totalMaintenanceCost: assetLogs.reduce((sum, log) => sum + toNumber(log.cost), 0),
          totalMaintenanceLogCount: assetLogs.length,
          onTimeCompletionCount: assetCycleSummary.onTimeCount,
          lateCompletionCount: assetCycleSummary.lateCount,
          onTimeCompletionRate: assetCycleSummary.onTimeRate,
          // TODO: Switch this rollup to inventory transactions if asset linkage becomes first-class there.
          totalPartsConsumed: assetParts.length,
          totalPartsCost: assetParts.reduce((sum, part) => sum + (part.quantity * toNumber(part.unitCost)), 0),
          monthlyCostBreakdown: monthKeys.map((month) => ({
            month,
            cost: monthlyCostMap.get(month) ?? 0
          })),
          topParts: Array.from(partMap.values())
            .sort((left, right) => right.totalQuantityConsumed - left.totalQuantityConsumed || right.totalCost - left.totalCost)
            .slice(0, 5)
        };
      })
    });
  });

  app.get("/v1/analytics/comparative/year-over-year", async (request, reply) => {
    const query = yearOverYearQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    if (query.assetId) {
      const asset = await app.prisma.asset.findFirst({
        where: {
          id: query.assetId,
          householdId: query.householdId,
          deletedAt: null
        },
        select: { id: true }
      });

      if (!asset) {
        return reply.code(404).send({ message: "Asset not found." });
      }
    }

    const yearBounds = query.years && query.years.length > 0
      ? {
          gte: new Date(Date.UTC(Math.min(...query.years), 0, 1, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(Math.max(...query.years), 11, 31, 23, 59, 59, 999))
        }
      : undefined;

    const logs = await app.prisma.maintenanceLog.findMany({
      where: {
        asset: {
          householdId: query.householdId
        },
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(yearBounds ? { completedAt: yearBounds } : {})
      },
      select: {
        completedAt: true,
        cost: true,
        scheduleId: true
      },
      orderBy: {
        completedAt: "asc"
      }
    });

    const years = (() => {
      if (query.years && query.years.length > 0) {
        return [...query.years].sort((left, right) => left - right);
      }

      const distinctYears = Array.from(new Set(logs.map((log) => log.completedAt.getUTCFullYear()))).sort((left, right) => right - left);
      return distinctYears.slice(0, 2).sort((left, right) => left - right);
    })();
    const yearSet = new Set(years);
    const summaries = years.map((year) => {
      const yearLogs = logs.filter((log) => log.completedAt.getUTCFullYear() === year);
      const monthlyCostMap = yearLogs.reduce<Map<number, number>>((map, log) => {
        const month = log.completedAt.getUTCMonth() + 1;
        map.set(month, (map.get(month) ?? 0) + toNumber(log.cost));
        return map;
      }, new Map());
      const distinctScheduleIds = new Set(yearLogs.flatMap((log) => log.scheduleId ? [log.scheduleId] : []));
      const totalCost = yearLogs.reduce((sum, log) => sum + toNumber(log.cost), 0);

      return {
        year,
        totalCost,
        totalLogCount: yearLogs.length,
        averageCostPerLog: yearLogs.length > 0 ? totalCost / yearLogs.length : 0,
        distinctScheduleCount: distinctScheduleIds.size,
        monthlyCostBreakdown: Array.from({ length: 12 }, (_, index) => ({
          month: index + 1,
          cost: monthlyCostMap.get(index + 1) ?? 0
        }))
      };
    });

    const delta = summaries.length >= 2
      ? (() => {
          const previous = summaries[summaries.length - 2]!;
          const current = summaries[summaries.length - 1]!;

          return {
            previousYear: previous.year,
            currentYear: current.year,
            costChangeAbsolute: current.totalCost - previous.totalCost,
            costChangePercentage: toPercentageChange(current.totalCost, previous.totalCost),
            logCountChangeAbsolute: current.totalLogCount - previous.totalLogCount,
            logCountChangePercentage: toPercentageChange(current.totalLogCount, previous.totalLogCount)
          };
        })()
      : null;

    const emptyYears = query.years && query.years.length > 0
      ? query.years.filter((year) => !yearSet.has(year))
      : [];
    void emptyYears;

    return toYearOverYearPayloadResponse({
      entityId: query.assetId ?? "household",
      years: summaries,
      yearOverYearDelta: delta
    });
  });

  app.get("/v1/analytics/comparative/member-contributions", async (request, reply) => {
    const query = memberContributionQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, query.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const defaultEnd = new Date();
    const defaultStart = addUtcMonths(startOfUtcMonth(defaultEnd), -11);
    const start = query.startDate ? new Date(query.startDate) : defaultStart;
    const end = query.endDate ? new Date(query.endDate) : defaultEnd;
    const monthKeys = getMonthRange(start, end);

    const [memberships, logs] = await Promise.all([
      app.prisma.householdMember.findMany({
        where: {
          householdId: query.householdId
        },
        select: {
          user: {
            select: {
              id: true,
              displayName: true
            }
          }
        },
        orderBy: {
          joinedAt: "asc"
        }
      }),
      app.prisma.maintenanceLog.findMany({
        where: {
          asset: {
            householdId: query.householdId
          },
          completedAt: {
            gte: start,
            lte: end
          }
        },
        select: {
          completedById: true,
          assetId: true,
          cost: true,
          laborHours: true,
          completedAt: true,
          asset: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          completedAt: "asc"
        }
      })
    ]);

    const logsByUserId = logs.reduce<Map<string, typeof logs>>((map, log) => {
      const existing = map.get(log.completedById);

      if (existing) {
        existing.push(log);
      } else {
        map.set(log.completedById, [log]);
      }

      return map;
    }, new Map());

    return toMemberContributionPayloadResponse({
      members: memberships.map((membership) => {
        const userLogs = logsByUserId.get(membership.user.id) ?? [];
        const monthlyCounts = userLogs.reduce<Map<string, number>>((map, log) => {
          const month = toMonthKey(log.completedAt);
          map.set(month, (map.get(month) ?? 0) + 1);
          return map;
        }, new Map());
        const assetCounts = userLogs.reduce<Map<string, { assetId: string; assetName: string; logCount: number }>>((map, log) => {
          const existing = map.get(log.assetId) ?? {
            assetId: log.assetId,
            assetName: log.asset.name,
            logCount: 0
          };

          existing.logCount += 1;
          map.set(log.assetId, existing);
          return map;
        }, new Map());
        const mostActiveAsset = Array.from(assetCounts.values())
          .sort((left, right) => right.logCount - left.logCount || left.assetName.localeCompare(right.assetName))[0] ?? null;

        return {
          userId: membership.user.id,
          userDisplayName: membership.user.displayName ?? null,
          // TODO: Populate avatar URLs if the user profile model stores one in the future.
          userAvatarUrl: null,
          totalMaintenanceLogsCompleted: userLogs.length,
          totalCostOfWorkLogged: userLogs.reduce((sum, log) => sum + toNumber(log.cost), 0),
          totalLaborHoursLogged: userLogs.reduce((sum, log) => sum + toNumber(log.laborHours), 0),
          distinctAssetCount: assetCounts.size,
          monthlyActivityBreakdown: monthKeys.map((month) => ({
            month,
            logCount: monthlyCounts.get(month) ?? 0
          })),
          mostActiveAsset: mostActiveAsset
            ? {
                assetId: mostActiveAsset.assetId,
                assetName: mostActiveAsset.assetName
              }
            : null
        };
      }),
      householdTotals: {
        totalLogs: logs.length,
        totalCost: logs.reduce((sum, log) => sum + toNumber(log.cost), 0),
        totalLaborHours: logs.reduce((sum, log) => sum + toNumber(log.laborHours), 0)
      }
    });
  });
};