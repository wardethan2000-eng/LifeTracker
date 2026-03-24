import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { householdUsageHighlightListSchema } from "@lifekeeper/types";
import {
  bucketUsageRates,
  calculateUsageRate,
  computeCostPerUnit,
  correlateMetrics,
  detectUsageAnomaly,
  projectMultipleSchedules
} from "@lifekeeper/utils";
import { assertMembership, getAccessibleAsset, personalAssetAccessWhere } from "../../lib/asset-access.js";
import {
  toAssetMetricCorrelationMatrixResponse,
  toEnhancedUsageProjectionResponse,
  toUsageCostNormalizationResponse,
  toUsageRateAnalyticsResponse
} from "../../lib/serializers/index.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { assetParamsSchema, householdParamsSchema } from "../../lib/schemas.js";

const metricParamsSchema = assetParamsSchema.extend({
  metricId: z.string().cuid()
});

const rateAnalyticsQuerySchema = z.object({
  bucketSize: z.enum(["week", "month"]).default("month"),
  lookback: z.coerce.number().int().min(1).max(3650).default(365)
});

const householdUsageHighlightsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
  assetLimit: z.coerce.number().int().min(1).max(40).default(12),
  lookback: z.coerce.number().int().min(30).max(3650).default(365),
  bucketSize: z.enum(["week", "month"]).default("month")
});

export const usageMetricAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/metrics/analytics/highlights", async (request, reply) => {
    const startedAt = process.hrtime.bigint();
    const params = householdParamsSchema.parse(request.params);
    const query = householdUsageHighlightsQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - query.lookback);

    const assets = await app.prisma.asset.findMany({
      where: {
        householdId: params.householdId,
        isArchived: false,
        ...personalAssetAccessWhere(request.auth.userId)
      },
      select: {
        id: true,
        name: true,
        category: true,
        usageMetrics: {
          select: {
            id: true,
            name: true,
            currentValue: true,
            entries: {
              where: {
                recordedAt: {
                  gte: since
                }
              },
              select: {
                value: true,
                recordedAt: true
              },
              orderBy: {
                recordedAt: "asc"
              }
            }
          }
        },
        schedules: {
          where: {
            isActive: true,
            metricId: { not: null },
            nextDueMetricValue: { not: null }
          },
          select: {
            id: true,
            name: true,
            metricId: true,
            nextDueMetricValue: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.assetLimit
    });

    const highlights = assets
      .map((asset) => {
        if (asset.usageMetrics.length === 0) {
          return null;
        }

        let anomalyCount = 0;
        const projectedDates: string[] = [];
        const metricNames = asset.usageMetrics.map((metric) => metric.name);

        for (const metric of asset.usageMetrics) {
          const bucketed = bucketUsageRates(
            metric.entries.map((entry) => ({
              value: entry.value,
              date: entry.recordedAt
            })),
            query.bucketSize
          );
          const anomalyResult = detectUsageAnomaly(bucketed);
          anomalyCount += anomalyResult.buckets.filter((bucket) => bucket.isAnomaly && !bucket.insufficientData).length;

          const scheduleInputs = asset.schedules
            .filter((schedule) => schedule.metricId === metric.id)
            .map((schedule) => ({
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              nextDueMetricValue: schedule.nextDueMetricValue as number
            }));

          if (scheduleInputs.length === 0) {
            continue;
          }

          const ratePerDay = calculateUsageRate(
            metric.entries.map((entry) => ({
              value: entry.value,
              date: entry.recordedAt
            }))
          );

          const projections = projectMultipleSchedules(metric.currentValue, ratePerDay, scheduleInputs);

          projectedDates.push(
            ...projections
              .filter((projection) => projection.projectedDate)
              .map((projection) => projection.projectedDate as string)
          );
        }

        projectedDates.sort((left, right) => left.localeCompare(right));

        return {
          assetId: asset.id,
          assetName: asset.name,
          category: asset.category,
          metricCount: asset.usageMetrics.length,
          anomalyCount,
          projectedScheduleCount: projectedDates.length,
          nextProjectedDue: projectedDates[0] ?? null,
          metricNames
        };
      })
      .filter((highlight): highlight is NonNullable<typeof highlight> => highlight !== null)
      .sort((left, right) => (
        right.metricCount - left.metricCount
        || right.projectedScheduleCount - left.projectedScheduleCount
        || right.anomalyCount - left.anomalyCount
      ))
      .slice(0, query.limit);

    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    request.log.info({
      householdId: params.householdId,
      assetSampleCount: assets.length,
      highlightCount: highlights.length,
      elapsedMs: Number(elapsedMs.toFixed(2))
    }, "usage-highlights computed");

    return householdUsageHighlightListSchema.parse(highlights);
  });

  app.get("/v1/assets/:assetId/metrics/:metricId/analytics/rates", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const query = rateAnalyticsQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return notFound(reply, "Usage metric");
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - query.lookback);

    const entries = await app.prisma.usageMetricEntry.findMany({
      where: {
        metricId: metric.id,
        recordedAt: {
          gte: since
        }
      },
      orderBy: { recordedAt: "asc" }
    });

    const anomalyResult = detectUsageAnomaly(
      bucketUsageRates(entries.map((entry) => ({ value: entry.value, date: entry.recordedAt })), query.bucketSize)
    );

    return toUsageRateAnalyticsResponse({
      metricId: metric.id,
      bucketSize: query.bucketSize,
      mean: anomalyResult.mean,
      stddev: anomalyResult.stddev,
      buckets: anomalyResult.buckets
    });
  });

  app.get("/v1/assets/:assetId/metrics/:metricId/analytics/cost-normalization", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return notFound(reply, "Usage metric");
    }

    const [baselineEntry, logs] = await Promise.all([
      app.prisma.usageMetricEntry.findFirst({
        where: { metricId: metric.id },
        orderBy: { recordedAt: "asc" },
        select: { value: true }
      }),
      app.prisma.maintenanceLog.findMany({
        where: {
          assetId: asset.id,
          cost: { not: null },
          usageValue: { not: null }
        },
        orderBy: { completedAt: "asc" },
        select: {
          title: true,
          cost: true,
          usageValue: true,
          completedAt: true
        }
      })
    ]);

    const baseline = baselineEntry?.value ?? 0;
    const normalized = computeCostPerUnit(
      logs.map((log) => ({
        cost: log.cost ?? 0,
        usageValueAtCompletion: log.usageValue ?? 0,
        completedAt: log.completedAt
      })),
      baseline
    );

    let previousUsageValue = baseline;
    const entryTitles = logs.reduce<Array<{ logTitle: string; completedAt: Date }>>((accumulator, log) => {
      const usageValueAtCompletion = log.usageValue ?? 0;
      const incrementalUsage = usageValueAtCompletion - previousUsageValue;
      previousUsageValue = usageValueAtCompletion;

      if (incrementalUsage > 0) {
        accumulator.push({
          logTitle: log.title,
          completedAt: log.completedAt
        });
      }

      return accumulator;
    }, []);

    return toUsageCostNormalizationResponse({
      metricId: metric.id,
      metricName: metric.name,
      metricUnit: metric.unit,
      totalCost: normalized.totalCost,
      totalUsage: normalized.totalUsage,
      averageCostPerUnit: normalized.averageCostPerUnit,
      entries: normalized.entries.map((entry, index) => ({
        ...entry,
        logTitle: entryTitles[index]?.logTitle ?? "Maintenance"
      }))
    });
  });

  app.get("/v1/assets/:assetId/metrics/:metricId/analytics/projections", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return notFound(reply, "Usage metric");
    }

    const [entries, schedules] = await Promise.all([
      app.prisma.usageMetricEntry.findMany({
        where: { metricId: metric.id },
        orderBy: { recordedAt: "desc" },
        take: 100
      }),
      app.prisma.maintenanceSchedule.findMany({
        where: {
          assetId: asset.id,
          metricId: metric.id,
          isActive: true,
          nextDueMetricValue: { not: null }
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          nextDueMetricValue: true
        }
      })
    ]);

    const ratePerDay = calculateUsageRate(entries.map((entry) => ({ value: entry.value, date: entry.recordedAt })));

    return toEnhancedUsageProjectionResponse({
      metricId: metric.id,
      currentValue: metric.currentValue,
      currentRate: ratePerDay,
      rateUnit: `${metric.unit}/day`,
      scheduleProjections: projectMultipleSchedules(
        metric.currentValue,
        ratePerDay,
        schedules
          .filter((schedule) => typeof schedule.nextDueMetricValue === "number")
          .map((schedule) => ({
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            nextDueMetricValue: schedule.nextDueMetricValue as number
          }))
      )
    });
  });

  app.get("/v1/assets/:assetId/metrics/analytics/correlations", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    const metrics = await app.prisma.usageMetric.findMany({
      where: { assetId: asset.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            entries: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (metrics.length < 2) {
      return toAssetMetricCorrelationMatrixResponse({
        assetId: asset.id,
        pairs: []
      });
    }

    const selectedMetrics = [...metrics]
      .sort((left, right) => right._count.entries - left._count.entries)
      .slice(0, 6);

    const selectedMetricIds = selectedMetrics.map((metric) => metric.id);
    const entriesByMetricId = new Map<string, Array<{ value: number; recordedAt: Date }>>();
    const allMetricEntries = await app.prisma.usageMetricEntry.findMany({
      where: {
        metricId: {
          in: selectedMetricIds
        }
      },
      orderBy: [
        { metricId: "asc" },
        { recordedAt: "desc" }
      ],
      select: {
        metricId: true,
        value: true,
        recordedAt: true
      }
    });

    for (const entry of allMetricEntries) {
      const currentEntries = entriesByMetricId.get(entry.metricId) ?? [];

      if (currentEntries.length >= 200) {
        continue;
      }

      currentEntries.push({
        value: entry.value,
        recordedAt: entry.recordedAt
      });
      entriesByMetricId.set(entry.metricId, currentEntries);
    }

    const metricEntries = selectedMetrics.map((metric) => ({
      metric,
      entries: entriesByMetricId.get(metric.id) ?? []
    }));

    const pairs: Array<{
      metricA: { id: string; name: string };
      metricB: { id: string; name: string };
      correlation: number;
      meanRatio: number;
      divergenceTrend: string;
      ratioSeries: Array<{ date: string; ratio: number }>;
    }> = [];

    for (let leftIndex = 0; leftIndex < metricEntries.length - 1; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < metricEntries.length; rightIndex += 1) {
        const left = metricEntries[leftIndex]!;
        const right = metricEntries[rightIndex]!;
        const correlation = correlateMetrics(
          left.entries.map((entry) => ({ value: entry.value, date: entry.recordedAt })),
          right.entries.map((entry) => ({ value: entry.value, date: entry.recordedAt }))
        );

        pairs.push({
          metricA: { id: left.metric.id, name: left.metric.name },
          metricB: { id: right.metric.id, name: right.metric.name },
          correlation: correlation.correlation,
          meanRatio: correlation.meanRatio,
          divergenceTrend: correlation.divergenceTrend,
          ratioSeries: correlation.ratioSeries
        });
      }
    }

    return toAssetMetricCorrelationMatrixResponse({
      assetId: asset.id,
      pairs
    });
  });
};