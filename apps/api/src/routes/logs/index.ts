import type { Prisma } from "@prisma/client";
import {
  createMaintenanceLogSchema,
  createMaintenanceLogPartSchema,
  updateMaintenanceLogSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { enqueueNotificationScan } from "../../lib/queues.js";
import {
  syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse
} from "../../lib/maintenance-logs.js";
import { toMaintenanceLogPartResponse } from "../../lib/presenters.js";
import { logActivity } from "../../lib/activity-log.js";

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
      include: { parts: true },
      orderBy: [
        { completedAt: "desc" },
        { createdAt: "desc" }
      ]
    });

    return logs.map(log => toMaintenanceLogResponse(log, log.parts));
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

    // Validate serviceProviderId if provided
    if (input.serviceProviderId) {
      const provider = await app.prisma.serviceProvider.findFirst({
        where: { id: input.serviceProviderId, householdId: asset.householdId },
        select: { id: true }
      });

      if (!provider) {
        return reply.code(400).send({ message: "Service provider not found or belongs to a different household." });
      }
    }

    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    const data: Prisma.MaintenanceLogUncheckedCreateInput = {
      assetId: asset.id,
      scheduleId: input.scheduleId ?? null,
      completedById: request.auth.userId,
      serviceProviderId: input.serviceProviderId ?? null,
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

    // Create log and parts in a single transaction
    const log = await app.prisma.$transaction(async (tx) => {
      const createdLog = await tx.maintenanceLog.create({ data });

      if (input.parts && input.parts.length > 0) {
        await tx.maintenanceLogPart.createMany({
          data: input.parts.map(part => ({
            logId: createdLog.id,
            name: part.name,
            partNumber: part.partNumber ?? null,
            quantity: part.quantity ?? 1,
            unitCost: part.unitCost ?? null,
            supplier: part.supplier ?? null,
            notes: part.notes ?? null
          }))
        });
      }

      return tx.maintenanceLog.findUniqueOrThrow({
        where: { id: createdLog.id },
        include: { parts: true }
      });
    });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    await logActivity(app.prisma, {
      householdId: asset.householdId,
      userId: request.auth.userId,
      action: "log.created",
      entityType: "log",
      entityId: log.id,
      metadata: { title: log.title, assetId: asset.id }
    });

    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(201).send(toMaintenanceLogResponse(log, log.parts));
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
      },
      include: { parts: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    return toMaintenanceLogResponse(log, log.parts);
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
      data,
      include: { parts: true }
    });

    if (log.scheduleId) {
      await syncScheduleCompletionFromLogs(app.prisma, log.scheduleId);
    }

    await enqueueNotificationScan({ householdId: asset.householdId });

    return toMaintenanceLogResponse(log, log.parts);
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

    await enqueueNotificationScan({ householdId: asset.householdId });

    return reply.code(204).send();
  });

  // ── Log Parts CRUD ─────────────────────────────────────────────────

  const partParamsSchema = logParamsSchema.extend({
    partId: z.string().cuid()
  });

  app.post("/v1/assets/:assetId/logs/:logId/parts", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const input = createMaintenanceLogPartSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const part = await app.prisma.maintenanceLogPart.create({
      data: {
        logId: log.id,
        name: input.name,
        partNumber: input.partNumber ?? null,
        quantity: input.quantity ?? 1,
        unitCost: input.unitCost ?? null,
        supplier: input.supplier ?? null,
        notes: input.notes ?? null
      }
    });

    return reply.code(201).send(toMaintenanceLogPartResponse(part));
  });

  app.get("/v1/assets/:assetId/logs/:logId/parts", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const parts = await app.prisma.maintenanceLogPart.findMany({
      where: { logId: log.id },
      orderBy: { createdAt: "asc" }
    });

    return parts.map(toMaintenanceLogPartResponse);
  });

  app.delete("/v1/assets/:assetId/logs/:logId/parts/:partId", async (request, reply) => {
    const params = partParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const log = await app.prisma.maintenanceLog.findFirst({
      where: { id: params.logId, assetId: asset.id },
      select: { id: true }
    });

    if (!log) {
      return reply.code(404).send({ message: "Maintenance log not found." });
    }

    const part = await app.prisma.maintenanceLogPart.findFirst({
      where: { id: params.partId, logId: log.id }
    });

    if (!part) {
      return reply.code(404).send({ message: "Part not found." });
    }

    await app.prisma.maintenanceLogPart.delete({ where: { id: part.id } });

    return reply.code(204).send();
  });
};
