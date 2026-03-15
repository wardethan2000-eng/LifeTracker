import type { Prisma } from "@prisma/client";
import {
  createUsageMetricSchema,
  createUsageMetricEntrySchema,
  updateUsageMetricSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import { toUsageMetricResponse, toUsageMetricEntryResponse } from "../../lib/serializers/index.js";
import { recalculateAssetSchedules } from "../../lib/schedule-state.js";
import { calculateUsageRate, projectNextDueValue } from "@lifekeeper/utils";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const metricParamsSchema = assetParamsSchema.extend({
  metricId: z.string().cuid()
});

export const usageMetricRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/metrics", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metrics = await app.prisma.usageMetric.findMany({
      where: { assetId: asset.id },
      orderBy: { createdAt: "asc" }
    });

    return metrics.map(toUsageMetricResponse);
  });

  app.post("/v1/assets/:assetId/metrics", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createUsageMetricSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const data: Prisma.UsageMetricUncheckedCreateInput = {
      assetId: asset.id,
      name: input.name,
      unit: input.unit,
      currentValue: input.currentValue
    };

    if (input.lastRecordedAt !== undefined) {
      data.lastRecordedAt = new Date(input.lastRecordedAt);
    }

    const metric = await app.prisma.usageMetric.create({ data });
    await recalculateAssetSchedules(app.prisma, asset.id);
    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(201).send(toUsageMetricResponse(metric));
  });

  app.get("/v1/assets/:assetId/metrics/:metricId", async (request, reply) => {
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

    return toUsageMetricResponse(metric);
  });

  app.patch("/v1/assets/:assetId/metrics/:metricId", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const input = updateUsageMetricSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Usage metric not found." });
    }

    const data: Prisma.UsageMetricUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.unit !== undefined) {
      data.unit = input.unit;
    }

    if (input.currentValue !== undefined) {
      data.currentValue = input.currentValue;
    }

    if (input.lastRecordedAt !== undefined) {
      data.lastRecordedAt = new Date(input.lastRecordedAt);
    }

    const metric = await app.prisma.usageMetric.update({
      where: { id: existing.id },
      data
    });

    await recalculateAssetSchedules(app.prisma, asset.id);
    await enqueueNotificationScan({ householdId: asset.householdId });

    return toUsageMetricResponse(metric);
  });

  app.delete("/v1/assets/:assetId/metrics/:metricId", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.usageMetric.findFirst({
      where: {
        id: params.metricId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Usage metric not found." });
    }

    const linkedSchedules = await app.prisma.maintenanceSchedule.count({
      where: {
        assetId: asset.id,
        metricId: existing.id
      }
    });

    if (linkedSchedules > 0) {
      return reply.code(409).send({
        message: "This metric is still referenced by maintenance schedules. Update or delete those schedules first."
      });
    }

    await app.prisma.usageMetric.delete({ where: { id: existing.id } });
    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(204).send();
  });

  // ── Usage Metric Entries ─────────────────────────────────────────────

  const entryListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    since: z.string().datetime().optional()
  });

  app.post("/v1/assets/:assetId/metrics/:metricId/entries", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const input = createUsageMetricEntrySchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: { id: params.metricId, assetId: asset.id }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
    }

    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();

    const entry = await app.prisma.usageMetricEntry.create({
      data: {
        metricId: metric.id,
        value: input.value,
        recordedAt,
        source: input.source ?? "manual",
        notes: input.notes ?? null
      }
    });

    // Update parent metric's currentValue and lastRecordedAt to reflect newest reading
    const newest = await app.prisma.usageMetricEntry.findFirst({
      where: { metricId: metric.id },
      orderBy: { recordedAt: "desc" },
      select: { value: true, recordedAt: true }
    });

    if (newest) {
      await app.prisma.usageMetric.update({
        where: { id: metric.id },
        data: {
          currentValue: newest.value,
          lastRecordedAt: newest.recordedAt
        }
      });
    }

    // Recalculate related maintenance schedules
    await recalculateAssetSchedules(app.prisma, asset.id);
    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(201).send(toUsageMetricEntryResponse(entry));
  });

  app.get("/v1/assets/:assetId/metrics/:metricId/entries", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: { id: params.metricId, assetId: asset.id }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
    }

    const where: Prisma.UsageMetricEntryWhereInput = {
      metricId: metric.id,
      ...(query.since ? { recordedAt: { gte: new Date(query.since) } } : {})
    };

    const entries = await app.prisma.usageMetricEntry.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: query.limit
    });

    return entries.map(toUsageMetricEntryResponse);
  });

  app.get("/v1/assets/:assetId/metrics/:metricId/projection", async (request, reply) => {
    const params = metricParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const metric = await app.prisma.usageMetric.findFirst({
      where: { id: params.metricId, assetId: asset.id }
    });

    if (!metric) {
      return reply.code(404).send({ message: "Usage metric not found." });
    }

    const entries = await app.prisma.usageMetricEntry.findMany({
      where: { metricId: metric.id },
      orderBy: { recordedAt: "desc" },
      take: 100
    });

    const pairs = entries.map(e => ({ value: e.value, date: e.recordedAt }));
    const ratePerDay = calculateUsageRate(pairs);

    // Find usage-based schedules linked to this metric to project thresholds
    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: { metricId: metric.id, isActive: true },
      select: { nextDueMetricValue: true }
    });

    const projectedValues: { date: string; value: number }[] = [];

    for (const schedule of schedules) {
      if (typeof schedule.nextDueMetricValue === "number") {
        const projected = projectNextDueValue(
          metric.currentValue,
          ratePerDay,
          schedule.nextDueMetricValue
        );
        if (projected) {
          projectedValues.push({
            date: projected.toISOString(),
            value: schedule.nextDueMetricValue
          });
        }
      }
    }

    return {
      metricId: metric.id,
      currentRate: ratePerDay,
      rateUnit: `${metric.unit}/day`,
      projectedValues
    };
  });
};
