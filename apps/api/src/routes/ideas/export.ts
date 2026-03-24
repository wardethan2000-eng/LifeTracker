import { ideaCategorySchema, ideaPrioritySchema, ideaStageSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { csvValue } from "../../lib/csv.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const importIdeaItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  stage: ideaStageSchema.optional().default("spark"),
  priority: ideaPrioritySchema.optional().default("medium"),
  category: ideaCategorySchema.optional()
});

const importIdeasSchema = z.object({
  items: z.array(importIdeaItemSchema).min(1).max(500)
});

export const ideaExportRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/ideas/export
  app.get("/v1/households/:householdId/ideas/export", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);

    if (!(await requireHouseholdMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const ideas = await app.prisma.idea.findMany({
      where: { householdId },
      orderBy: [{ stage: "asc" }, { title: "asc" }]
    });

    const headers = [
      "id", "title", "description", "stage", "priority", "category",
      "archivedAt", "createdAt", "updatedAt"
    ];

    const csvString = [
      headers.join(","),
      ...ideas.map((i) =>
        [
          csvValue(i.id),
          csvValue(i.title),
          csvValue(i.description),
          csvValue(i.stage),
          csvValue(i.priority),
          csvValue(i.category),
          csvValue(i.archivedAt?.toISOString() ?? null),
          csvValue(i.createdAt.toISOString()),
          csvValue(i.updatedAt.toISOString())
        ].join(",")
      )
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="ideas-export.csv"')
      .send(csvString);
  });

  // POST /v1/households/:householdId/ideas/import
  app.post("/v1/households/:householdId/ideas/import", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = importIdeasSchema.parse(request.body);

    if (!(await requireHouseholdMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const createdItems: Array<{ id: string; title: string; stage: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    let skipped = 0;

    for (const [index, item] of input.items.entries()) {
      try {
        const duplicate = await app.prisma.idea.findFirst({
          where: {
            householdId,
            archivedAt: null,
            title: { equals: item.title, mode: "insensitive" }
          }
        });

        if (duplicate) {
          skipped += 1;
          continue;
        }

        const idea = await app.prisma.idea.create({
          data: {
            householdId,
            createdById: request.auth.userId,
            title: item.title,
            description: item.description ?? null,
            stage: item.stage,
            priority: item.priority,
            category: item.category ?? null,
            notes: toInputJsonValue([]),
            links: toInputJsonValue([]),
            materials: toInputJsonValue([]),
            steps: toInputJsonValue([])
          }
        });

        createdItems.push({ id: idea.id, title: idea.title, stage: idea.stage });
      } catch (error) {
        errors.push({
          index,
          message: error instanceof Error ? error.message : "Failed to import idea."
        });
      }
    }

    return reply.code(200).send({ created: createdItems.length, skipped, errors, createdItems });
  });
};
