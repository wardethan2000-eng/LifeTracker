import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const importScheduleItemSchema = z.object({
  assetId: z.string().cuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  intervalDays: z.coerce.number().int().min(1).max(3650),
  estimatedCost: z.coerce.number().min(0).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).optional(),
  isRegulatory: z.coerce.boolean().optional().default(false)
});

const importSchedulesSchema = z.object({
  items: z.array(importScheduleItemSchema).min(1).max(500)
});

const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const csvValue = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return csvEscape(String(value));
};

export const scheduleExportRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/schedules/export
  app.get("/v1/households/:householdId/schedules/export", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);

    if (!(await checkMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const schedules = await app.prisma.maintenanceSchedule.findMany({
      where: {
        deletedAt: null,
        asset: { householdId }
      },
      include: {
        asset: { select: { id: true, name: true } }
      },
      orderBy: [{ asset: { name: "asc" } }, { name: "asc" }]
    });

    const headers = [
      "id", "assetId", "assetName", "name", "description", "triggerType",
      "isActive", "isRegulatory", "estimatedCost", "estimatedMinutes",
      "lastCompletedAt", "nextDueAt", "createdAt", "updatedAt"
    ];

    const csvString = [
      headers.join(","),
      ...schedules.map((s) =>
        [
          csvValue(s.id),
          csvValue(s.assetId),
          csvValue(s.asset.name),
          csvValue(s.name),
          csvValue(s.description),
          csvValue(s.triggerType),
          csvValue(String(s.isActive)),
          csvValue(String(s.isRegulatory)),
          csvValue(s.estimatedCost),
          csvValue(s.estimatedMinutes),
          csvValue(s.lastCompletedAt?.toISOString() ?? null),
          csvValue(s.nextDueAt?.toISOString() ?? null),
          csvValue(s.createdAt.toISOString()),
          csvValue(s.updatedAt.toISOString())
        ].join(",")
      )
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="schedules-export.csv"')
      .send(csvString);
  });

  // POST /v1/households/:householdId/schedules/import
  app.post("/v1/households/:householdId/schedules/import", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = importSchedulesSchema.parse(request.body);

    if (!(await checkMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const createdItems: Array<{ id: string; name: string; assetId: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    let skipped = 0;

    for (const [index, item] of input.items.entries()) {
      try {
        // Verify the asset belongs to this household
        const asset = await app.prisma.asset.findFirst({
          where: { id: item.assetId, householdId, deletedAt: null }
        });

        if (!asset) {
          errors.push({ index, message: `Asset ${item.assetId} not found in this household.` });
          continue;
        }

        // Skip duplicate schedule name on same asset
        const duplicate = await app.prisma.maintenanceSchedule.findFirst({
          where: {
            assetId: item.assetId,
            deletedAt: null,
            name: { equals: item.name, mode: "insensitive" }
          }
        });

        if (duplicate) {
          skipped += 1;
          continue;
        }

        const triggerConfig = {
          type: "interval" as const,
          intervalDays: item.intervalDays,
          leadTimeDays: 0
        };

        const schedule = await app.prisma.maintenanceSchedule.create({
          data: {
            assetId: item.assetId,
            name: item.name,
            description: item.description ?? null,
            triggerType: "interval",
            triggerConfig: toInputJsonValue(triggerConfig),
            notificationConfig: toInputJsonValue({
              channels: ["push"],
              sendAtDue: true,
              digest: false
            }),
            estimatedCost: item.estimatedCost ?? null,
            estimatedMinutes: item.estimatedMinutes ?? null,
            isRegulatory: item.isRegulatory ?? false
          }
        });

        createdItems.push({ id: schedule.id, name: schedule.name, assetId: schedule.assetId });
      } catch (error) {
        errors.push({
          index,
          message: error instanceof Error ? error.message : "Failed to import schedule."
        });
      }
    }

    return reply.code(200).send({ created: createdItems.length, skipped, errors, createdItems });
  });
};
