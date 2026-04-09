import {
  createNoteTemplateSchema,
  updateNoteTemplateSchema,
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { notFound } from "../../lib/errors.js";
import { softDeleteData } from "../../lib/soft-delete.js";
import { householdParamsSchema } from "../../lib/schemas.js";
import { toNoteTemplateResponse } from "../../lib/serializers/index.js";

const templateParamsSchema = householdParamsSchema.extend({
  templateId: z.string().cuid()
});

export const noteTemplateRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/households/:householdId/note-templates — list built-in + custom
  app.get("/v1/households/:householdId/note-templates", async (request) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const templates = await app.prisma.noteTemplate.findMany({
      where: { householdId, deletedAt: null },
      orderBy: [{ isBuiltIn: "desc" }, { sortOrder: "asc" }, { name: "asc" }]
    });

    return templates.map(toNoteTemplateResponse);
  });

  // GET /v1/households/:householdId/note-templates/:templateId
  app.get("/v1/households/:householdId/note-templates/:templateId", async (request, reply) => {
    const { householdId, templateId } = templateParamsSchema.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const template = await app.prisma.noteTemplate.findFirst({
      where: { id: templateId, householdId, deletedAt: null }
    });
    if (!template) {
      return notFound(reply, "Template");
    }

    return toNoteTemplateResponse(template);
  });

  // POST /v1/households/:householdId/note-templates — create custom template
  app.post("/v1/households/:householdId/note-templates", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = createNoteTemplateSchema.parse(request.body);

    const template = await app.prisma.noteTemplate.create({
      data: {
        household: { connect: { id: householdId } },
        createdBy: { connect: { id: userId } },
        name: input.name,
        description: input.description ?? null,
        bodyTemplate: input.bodyTemplate,
        entryType: input.entryType ?? "note",
        defaultTags: input.defaultTags ?? [],
        defaultFlags: input.defaultFlags ?? [],
        isBuiltIn: false,
        sortOrder: input.sortOrder ?? 0
      }
    });

        await createActivityLogger(app.prisma, userId).log("note_template", template.id, "note_template_created", householdId, { name: template.name });

    reply.code(201);
    return toNoteTemplateResponse(template);
  });

  // PATCH /v1/households/:householdId/note-templates/:templateId — update (not built-in)
  app.patch("/v1/households/:householdId/note-templates/:templateId", async (request, reply) => {
    const { householdId, templateId } = templateParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);
    const input = updateNoteTemplateSchema.parse(request.body);

    const existing = await app.prisma.noteTemplate.findFirst({
      where: { id: templateId, householdId, deletedAt: null }
    });
    if (!existing) {
      return notFound(reply, "Template");
    }
    if (existing.isBuiltIn) {
      return reply.code(403).send({ message: "Built-in templates cannot be modified" });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.bodyTemplate !== undefined) data.bodyTemplate = input.bodyTemplate;
    if (input.entryType !== undefined) data.entryType = input.entryType;
    if (input.defaultTags !== undefined) data.defaultTags = input.defaultTags;
    if (input.defaultFlags !== undefined) data.defaultFlags = input.defaultFlags;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const template = await app.prisma.noteTemplate.update({
      where: { id: templateId },
      data
    });

        await createActivityLogger(app.prisma, userId).log("note_template", template.id, "note_template_updated", householdId, { name: template.name });

    return toNoteTemplateResponse(template);
  });

  // DELETE /v1/households/:householdId/note-templates/:templateId — soft delete (not built-in)
  app.delete("/v1/households/:householdId/note-templates/:templateId", async (request, reply) => {
    const { householdId, templateId } = templateParamsSchema.parse(request.params);
    const userId = request.auth.userId;
    await assertMembership(app.prisma, householdId, userId);

    const existing = await app.prisma.noteTemplate.findFirst({
      where: { id: templateId, householdId, deletedAt: null }
    });
    if (!existing) {
      return notFound(reply, "Template");
    }
    if (existing.isBuiltIn) {
      return reply.code(403).send({ message: "Built-in templates cannot be deleted" });
    }

    await app.prisma.noteTemplate.update({
      where: { id: templateId },
      data: softDeleteData()
    });

        await createActivityLogger(app.prisma, userId).log("note_template", templateId, "note_template_deleted", householdId, { name: existing.name });

    return reply.code(204).send();
  });
};
