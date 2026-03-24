import { projectStatusSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { csvValue } from "../../lib/csv.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const importProjectItemSchema = z.object({
  name: z.string().min(1).max(200),
  status: projectStatusSchema.optional().default("planning"),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  budgetAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(5000).optional()
});

const importProjectsSchema = z.object({
  items: z.array(importProjectItemSchema).min(1).max(500)
});

export const projectExportRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/projects/export
  app.get("/v1/households/:householdId/projects/export", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const projects = await app.prisma.project.findMany({
      where: { householdId, deletedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });

    const headers = [
      "id", "name", "status", "description", "startDate", "targetEndDate",
      "budgetAmount", "notes", "createdAt", "updatedAt"
    ];

    const csvString = [
      headers.join(","),
      ...projects.map((p) =>
        [
          csvValue(p.id),
          csvValue(p.name),
          csvValue(p.status),
          csvValue(p.description),
          csvValue(p.startDate?.toISOString() ?? null),
          csvValue(p.targetEndDate?.toISOString() ?? null),
          csvValue(p.budgetAmount),
          csvValue(p.notes),
          csvValue(p.createdAt.toISOString()),
          csvValue(p.updatedAt.toISOString())
        ].join(",")
      )
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="projects-export.csv"')
      .send(csvString);
  });

  // POST /v1/households/:householdId/projects/import
  app.post("/v1/households/:householdId/projects/import", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = importProjectsSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, householdId, request.auth.userId, reply)) {
      return;
    }

    const createdItems: Array<{ id: string; name: string; status: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    let skipped = 0;

    for (const [index, item] of input.items.entries()) {
      try {
        const duplicate = await app.prisma.project.findFirst({
          where: {
            householdId,
            deletedAt: null,
            name: { equals: item.name, mode: "insensitive" }
          }
        });

        if (duplicate) {
          skipped += 1;
          continue;
        }

        const project = await app.prisma.project.create({
          data: {
            householdId,
            name: item.name,
            status: item.status,
            description: item.description ?? null,
            startDate: item.startDate ? new Date(item.startDate) : null,
            targetEndDate: item.targetEndDate ? new Date(item.targetEndDate) : null,
            budgetAmount: item.budgetAmount ?? null,
            notes: item.notes ?? null
          }
        });

        createdItems.push({ id: project.id, name: project.name, status: project.status });
      } catch (error) {
        errors.push({
          index,
          message: error instanceof Error ? error.message : "Failed to import project."
        });
      }
    }

    return reply.code(200).send({ created: createdItems.length, skipped, errors, createdItems });
  });
};
