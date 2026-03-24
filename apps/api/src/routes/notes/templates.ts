import {
  createNoteTemplateSchema,
  noteTemplateSchema,
  updateNoteTemplateSchema,
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { parseTags } from "../../lib/prisma-json.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const templateParamsSchema = householdParamsSchema.extend({
  templateId: z.string().cuid()
});

const parseFlags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === "string");
  return [];
};

const toTemplateResponse = (t: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  bodyTemplate: string;
  entryType: string;
  defaultTags: unknown;
  defaultFlags: unknown;
  isBuiltIn: boolean;
  sortOrder: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) => noteTemplateSchema.parse({
  id: t.id,
  householdId: t.householdId,
  name: t.name,
  description: t.description,
  bodyTemplate: t.bodyTemplate,
  entryType: t.entryType,
  defaultTags: parseTags(t.defaultTags),
  defaultFlags: parseFlags(t.defaultFlags),
  isBuiltIn: t.isBuiltIn,
  sortOrder: t.sortOrder,
  createdById: t.createdById,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString()
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

    return templates.map(toTemplateResponse);
  });

  // GET /v1/households/:householdId/note-templates/:templateId
  app.get("/v1/households/:householdId/note-templates/:templateId", async (request, reply) => {
    const { householdId, templateId } = templateParamsSchema.parse(request.params);
    await assertMembership(app.prisma, householdId, request.auth.userId);

    const template = await app.prisma.noteTemplate.findFirst({
      where: { id: templateId, householdId, deletedAt: null }
    });
    if (!template) {
      return reply.code(404).send({ message: "Template not found" });
    }

    return toTemplateResponse(template);
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

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_template_created",
      entityType: "note_template",
      entityId: template.id,
      metadata: { name: template.name }
    });

    reply.code(201);
    return toTemplateResponse(template);
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
      return reply.code(404).send({ message: "Template not found" });
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

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_template_updated",
      entityType: "note_template",
      entityId: template.id,
      metadata: { name: template.name }
    });

    return toTemplateResponse(template);
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
      return reply.code(404).send({ message: "Template not found" });
    }
    if (existing.isBuiltIn) {
      return reply.code(403).send({ message: "Built-in templates cannot be deleted" });
    }

    await app.prisma.noteTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() }
    });

    await logActivity(app.prisma, {
      householdId,
      userId,
      action: "note_template_deleted",
      entityType: "note_template",
      entityId: templateId,
      metadata: { name: existing.name }
    });

    return { success: true };
  });
};
