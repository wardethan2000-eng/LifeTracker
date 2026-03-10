import type { Prisma } from "@prisma/client";
import {
  createMaintenanceLogSchema,
  updateMaintenanceLogSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const logParamsSchema = assetParamsSchema.extend({
  logId: z.string().cuid()
});

const listLogsQuerySchema = z.object({
  scheduleId: z.string().cuid().optional()
});

const toInputJsonValue = (value: Record<string, unknown>): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export const maintenanceLogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/logs", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = listLogsQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    if (query.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: query.scheduleId,
          assetId: asset.id
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }
    }

    const logs = await app.prisma.maintenanceLog.findMany({
      where: {
        assetId: asset.id,
        ...(query.scheduleId ? { scheduleId: query.scheduleId } : {})
      },
      orderBy: [
        { completedAt: "desc" },
        { createdAt: "desc" }
      ]
    });

    return logs.map(toMaintenanceLogResponse);
  });

  app.post("/v1/assets/:assetId/logs", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = createMaintenanceLogSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    let scheduleName: string | undefined;

    if (input.scheduleId) {
      const schedule = await app.prisma.maintenanceSchedule.findFirst({
        where: {
          id: input.scheduleId,
          assetId: asset.id
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!schedule) {
        return reply.code(404).send({ message: "Maintenance schedule not found." });
      }

      scheduleName = schedule.name;
    }

    if (!input.title && !scheduleName) {
      return reply.code(400).send({
        message: "A title is required when the log is not associated with a maintenance schedule."
      });
    }

    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    const data: Prisma.MaintenanceLogUncheckedCreateInput = {
      assetId: asset.id,
      scheduleId: input.scheduleId ?? null,
      completedById: request.auth.userId,
      title: input.title ?? scheduleName ?? "Maintenance completed",
      completedAt,
      metadata: toInputJsonValue(input.metadata)
    };

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    if (input.usageValue !== undefined) {
      data.usageValue = input.usageValue;
    }

    if (input.cost !== undefined) {
      data.cost = input.cost;
    }

    const log = await app.prisma.maintenanceLog.create({ data });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    return reply.code(201).send(toMaintenanceLogResponse(log));
  });

  app.get("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    return toMaintenanceLogResponse(log);
  });

  app.patch("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const input = updateMaintenanceLogSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const data: Prisma.MaintenanceLogUncheckedUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    if (input.completedAt !== undefined) {
      data.completedAt = new Date(input.completedAt);
    }

    if (input.usageValue !== undefined) {
      data.usageValue = input.usageValue;
    }

    if (input.cost !== undefined) {
      data.cost = input.cost;
    }

    if (input.metadata !== undefined) {
      data.metadata = toInputJsonValue(input.metadata);
    }

    const log = await app.prisma.maintenanceLog.update({
      where: { id: existing.id },
      data
    });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    return toMaintenanceLogResponse(log);
  });

  app.delete("/v1/assets/:assetId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const existing = await app.prisma.maintenanceLog.findFirst({
      where: {
        id: params.logId,
        assetId: asset.id
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    await app.prisma.maintenanceLog.delete({
      where: { id: existing.id }
    });

    if (existing.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, existing.scheduleId);
    }

    return reply.code(204).send();
  });
};
