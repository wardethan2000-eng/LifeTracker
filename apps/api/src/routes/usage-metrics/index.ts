import type { Prisma } from "@prisma/client";
import {
  createUsageMetricSchema,
  usageMetricResponseSchema,
  updateUsageMetricSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { recalculateAssetSchedules } from "../../lib/schedule-state.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const metricParamsSchema = assetParamsSchema.extend({
  metricId: z.string().cuid()
});

const toUsageMetricResponse = (metric: {
  id: string;
  assetId: string;
  name: string;
  unit: string;
  currentValue: number;
  lastRecordedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => usageMetricResponseSchema.parse({
  ...metric,
  lastRecordedAt: metric.lastRecordedAt?.toISOString() ?? null,
  createdAt: metric.createdAt.toISOString(),
  updatedAt: metric.updatedAt.toISOString()
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

    return reply.code(204).send();
  });
};
