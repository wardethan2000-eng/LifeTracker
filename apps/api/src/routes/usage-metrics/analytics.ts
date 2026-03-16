import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  bucketUsageRates,
  calculateUsageRate,
  computeCostPerUnit,
  correlateMetrics,
  detectUsageAnomaly,
  projectMultipleSchedules
} from "@lifekeeper/utils";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  toAssetMetricCorrelationMatrixResponse,
  toEnhancedUsageProjectionResponse,
  toUsageCostNormalizationResponse,
  toUsageRateAnalyticsResponse
} from "../../lib/serializers/index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const metricParamsSchema = assetParamsSchema.extend({
  metricId: z.string().cuid()
});

const rateAnalyticsQuerySchema = z.object({
  bucketSize: z.enum(["week", "month"]).default("month"),
  lookback: z.coerce.number().int().min(1).max(3650).default(365)
});

export const usageMetricAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/metrics/:metricId/analytics/rates", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const query = rateAnalyticsQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
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
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
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
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
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
      return reply.code(404).send({ message: "Asset not found." });
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

    const metricEntries = await Promise.all(
      selectedMetrics.map(async (metric) => ({
        metric,
        entries: await app.prisma.usageMetricEntry.findMany({
          where: { metricId: metric.id },
          orderBy: { recordedAt: "desc" },
          take: 200,
          select: {
            value: true,
            recordedAt: true
          }
        })
      }))
    );

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