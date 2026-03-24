import { hobbyActivityModeSchema, hobbyStatusSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { csvValue } from "../../lib/csv.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const importHobbyItemSchema = z.object({
  name: z.string().min(1).max(120),
  status: hobbyStatusSchema.optional().default("active"),
  description: z.string().max(2000).optional(),
  activityMode: hobbyActivityModeSchema.optional().default("session"),
  hobbyType: z.string().max(80).optional(),
  notes: z.string().max(5000).optional()
});

const importHobbiesSchema = z.object({
  items: z.array(importHobbyItemSchema).min(1).max(500)
});

export const hobbyExportRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/hobbies/export
  app.get("/v1/households/:householdId/hobbies/export", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);

    if (!(await requireHouseholdMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobbies = await app.prisma.hobby.findMany({
      where: { householdId },
      include: {
        _count: {
          select: { sessions: true, recipes: true }
        }
      },
      orderBy: { name: "asc" }
    });

    // Count completed sessions separately
    const completedCounts = await app.prisma.hobbySession.groupBy({
      by: ["hobbyId"],
      where: {
        hobbyId: { in: hobbies.map((h) => h.id) },
        status: "completed"
      },
      _count: true
    });

    const completedByHobby = new Map(
      completedCounts.map((row) => [row.hobbyId, row._count])
    );

    const headers = [
      "id", "name", "status", "activityMode", "hobbyType", "description",
      "sessionCount", "completedSessionCount", "recipeCount", "notes",
      "createdAt", "updatedAt"
    ];

    const csvString = [
      headers.join(","),
      ...hobbies.map((h) =>
        [
          csvValue(h.id),
          csvValue(h.name),
          csvValue(h.status),
          csvValue(h.activityMode),
          csvValue(h.hobbyType),
          csvValue(h.description),
          csvValue(h._count.sessions),
          csvValue(completedByHobby.get(h.id) ?? 0),
          csvValue(h._count.recipes),
          csvValue(h.notes),
          csvValue(h.createdAt.toISOString()),
          csvValue(h.updatedAt.toISOString())
        ].join(",")
      )
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="hobbies-export.csv"')
      .send(csvString);
  });

  // POST /v1/households/:householdId/hobbies/import
  app.post("/v1/households/:householdId/hobbies/import", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = importHobbiesSchema.parse(request.body);

    if (!(await requireHouseholdMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const createdItems: Array<{ id: string; name: string; status: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    let skipped = 0;

    for (const [index, item] of input.items.entries()) {
      try {
        const duplicate = await app.prisma.hobby.findFirst({
          where: {
            householdId,
            name: { equals: item.name, mode: "insensitive" }
          }
        });

        if (duplicate) {
          skipped += 1;
          continue;
        }

        const hobby = await app.prisma.hobby.create({
          data: {
            householdId,
            createdById: request.auth.userId,
            name: item.name,
            status: item.status,
            description: item.description ?? null,
            activityMode: item.activityMode,
            hobbyType: item.hobbyType ?? null,
            notes: item.notes ?? null,
            customFields: {},
            fieldDefinitions: []
          }
        });

        createdItems.push({ id: hobby.id, name: hobby.name, status: hobby.status });
      } catch (error) {
        errors.push({
          index,
          message: error instanceof Error ? error.message : "Failed to import hobby."
        });
      }
    }

    return reply.code(200).send({ created: createdItems.length, skipped, errors, createdItems });
  });
};
