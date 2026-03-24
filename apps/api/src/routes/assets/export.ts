import { assetCategorySchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { csvValue } from "../../lib/csv.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const importAssetItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: assetCategorySchema,
  description: z.string().max(1000).optional(),
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  serialNumber: z.string().max(120).optional()
});

const importAssetsSchema = z.object({
  items: z.array(importAssetItemSchema).min(1).max(500)
});

export const assetExportRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/assets/export
  app.get("/v1/households/:householdId/assets/export", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);

    if (!(await checkMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const assets = await app.prisma.asset.findMany({
      where: { householdId, isArchived: false, deletedAt: null },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    const headers = [
      "id", "name", "category", "description", "manufacturer", "model",
      "serialNumber", "conditionScore", "isArchived", "createdAt", "updatedAt"
    ];

    const csvString = [
      headers.join(","),
      ...assets.map((a) =>
        [
          csvValue(a.id),
          csvValue(a.name),
          csvValue(a.category),
          csvValue(a.description),
          csvValue(a.manufacturer),
          csvValue(a.model),
          csvValue(a.serialNumber),
          csvValue(a.conditionScore),
          csvValue(String(a.isArchived)),
          csvValue(a.createdAt.toISOString()),
          csvValue(a.updatedAt.toISOString())
        ].join(",")
      )
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="assets-export.csv"')
      .send(csvString);
  });

  // POST /v1/households/:householdId/assets/import
  app.post("/v1/households/:householdId/assets/import", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = importAssetsSchema.parse(request.body);

    if (!(await checkMembership(app.prisma, householdId, request.auth.userId))) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const createdItems: Array<{ id: string; name: string; category: string }> = [];
    const errors: Array<{ index: number; message: string }> = [];
    let skipped = 0;

    for (const [index, item] of input.items.entries()) {
      try {
        const duplicate = await app.prisma.asset.findFirst({
          where: {
            householdId,
            deletedAt: null,
            name: { equals: item.name, mode: "insensitive" },
            category: item.category
          }
        });

        if (duplicate) {
          skipped += 1;
          continue;
        }

        const asset = await app.prisma.asset.create({
          data: {
            householdId,
            createdById: request.auth.userId,
            name: item.name,
            category: item.category,
            description: item.description ?? null,
            manufacturer: item.manufacturer ?? null,
            model: item.model ?? null,
            serialNumber: item.serialNumber ?? null,
            fieldDefinitions: toInputJsonValue([]),
            customFields: toInputJsonValue({}),
            conditionHistory: toInputJsonValue([])
          }
        });

        createdItems.push({ id: asset.id, name: asset.name, category: asset.category });
      } catch (error) {
        errors.push({
          index,
          message: error instanceof Error ? error.message : "Failed to import asset."
        });
      }
    }

    return reply.code(200).send({ created: createdItems.length, skipped, errors, createdItems });
  });
};
