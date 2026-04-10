import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createProcedureSchema,
  updateProcedureSchema,
  createProcedureStepSchema,
  updateProcedureStepSchema,
  reorderProcedureStepsSchema
} from "@aegis/types";
import { assertMembership } from "../../lib/asset-access.js";
import {
  toProcedureResponse,
  toProcedureSummaryResponse,
  toProcedureStepResponse,
  toProcedureAssetResponse,
  toProcedureToolResponse
} from "../../lib/serializers/index.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const procedureParamsSchema = householdParamsSchema.extend({
  procedureId: z.string().cuid()
});
const stepParamsSchema = procedureParamsSchema.extend({
  stepId: z.string().cuid()
});

const procedureInclude = {
  steps: { orderBy: { sortOrder: "asc" as const } },
  assetLinks: { include: { asset: { select: { id: true, name: true, category: true } } } },
  toolItems: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } }
};

export const procedureRoutes: FastifyPluginAsync = async (app) => {
  // ── LIST ──────────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/procedures", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const procedures = await app.prisma.procedure.findMany({
      where: { householdId: params.householdId, deletedAt: null },
      include: { _count: { select: { steps: true, assetLinks: true } } },
      orderBy: { title: "asc" }
    });
    return procedures.map(toProcedureSummaryResponse);
  });

  // ── GET ───────────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/procedures/:procedureId", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.findFirst({
      where: { id: params.procedureId, householdId: params.householdId, deletedAt: null },
      include: procedureInclude
    });
    if (!proc) return notFound(reply, "Procedure");
    return toProcedureResponse(proc);
  });

  // ── CREATE ────────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/procedures", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createProcedureSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.create({
      data: {
        householdId: params.householdId,
        title: input.title,
        description: input.description ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        steps: input.steps ? {
          create: input.steps.map((s, i) => ({
            sortOrder: s.sortOrder ?? i,
            instruction: s.instruction,
            notes: s.notes ?? null,
            estimatedMinutes: s.estimatedMinutes ?? null,
            warningText: s.warningText ?? null
          }))
        } : undefined,
        assetLinks: input.assetIds ? {
          create: input.assetIds.map((assetId) => ({ assetId }))
        } : undefined,
        toolItems: input.tools ? {
          create: input.tools.map((t) => ({
            inventoryItemId: t.inventoryItemId,
            quantity: t.quantity,
            notes: t.notes ?? null
          }))
        } : undefined
      },
      include: procedureInclude
    });

    await createActivityLogger(app.prisma, request.auth.userId).log("procedure", proc.id, "procedure.created", params.householdId, { title: proc.title });
    return reply.code(201).send(toProcedureResponse(proc));
  });

  // ── UPDATE ────────────────────────────────────────────────────────
  app.patch("/v1/households/:householdId/procedures/:procedureId", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    const input = updateProcedureSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!existing) return notFound(reply, "Procedure");

    const proc = await app.prisma.procedure.update({
      where: { id: params.procedureId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
        version: { increment: 1 }
      },
      include: procedureInclude
    });

    await createActivityLogger(app.prisma, request.auth.userId).log("procedure", proc.id, "procedure.updated", params.householdId, { title: proc.title });
    return toProcedureResponse(proc);
  });

  // ── DELETE (soft) ─────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/procedures/:procedureId", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!existing) return notFound(reply, "Procedure");

    await app.prisma.procedure.update({ where: { id: params.procedureId }, data: { deletedAt: new Date() } });
    await createActivityLogger(app.prisma, request.auth.userId).log("procedure", params.procedureId, "procedure.deleted", params.householdId, { title: existing.title });
    return reply.code(204).send();
  });

  // ── ADD STEP ──────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/procedures/:procedureId/steps", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    const input = createProcedureStepSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!proc) return notFound(reply, "Procedure");

    const maxOrder = await app.prisma.procedureStep.aggregate({ where: { procedureId: params.procedureId }, _max: { sortOrder: true } });
    const nextOrder = input.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1);

    const step = await app.prisma.procedureStep.create({
      data: {
        procedureId: params.procedureId,
        sortOrder: nextOrder,
        instruction: input.instruction,
        notes: input.notes ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        warningText: input.warningText ?? null
      }
    });

    await app.prisma.procedure.update({ where: { id: params.procedureId }, data: { version: { increment: 1 } } });
    return reply.code(201).send(toProcedureStepResponse(step));
  });

  // ── UPDATE STEP ───────────────────────────────────────────────────
  app.patch("/v1/households/:householdId/procedures/:procedureId/steps/:stepId", async (request, reply) => {
    const params = stepParamsSchema.parse(request.params);
    const input = updateProcedureStepSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const step = await app.prisma.procedureStep.findFirst({
      where: { id: params.stepId, procedure: { id: params.procedureId, householdId: params.householdId, deletedAt: null } }
    });
    if (!step) return notFound(reply, "Step");

    const updated = await app.prisma.procedureStep.update({
      where: { id: params.stepId },
      data: {
        ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
        ...(input.warningText !== undefined ? { warningText: input.warningText } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
      }
    });

    await app.prisma.procedure.update({ where: { id: params.procedureId }, data: { version: { increment: 1 } } });
    return toProcedureStepResponse(updated);
  });

  // ── DELETE STEP ───────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/procedures/:procedureId/steps/:stepId", async (request, reply) => {
    const params = stepParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const step = await app.prisma.procedureStep.findFirst({
      where: { id: params.stepId, procedure: { id: params.procedureId, householdId: params.householdId, deletedAt: null } }
    });
    if (!step) return notFound(reply, "Step");

    await app.prisma.procedureStep.delete({ where: { id: params.stepId } });
    await app.prisma.procedure.update({ where: { id: params.procedureId }, data: { version: { increment: 1 } } });
    return reply.code(204).send();
  });

  // ── REORDER STEPS ─────────────────────────────────────────────────
  app.put("/v1/households/:householdId/procedures/:procedureId/steps/order", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    const input = reorderProcedureStepsSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!proc) return notFound(reply, "Procedure");

    await app.prisma.$transaction(
      input.orderedIds.map((id, i) =>
        app.prisma.procedureStep.update({ where: { id }, data: { sortOrder: i } })
      )
    );
    await app.prisma.procedure.update({ where: { id: params.procedureId }, data: { version: { increment: 1 } } });
    return reply.code(204).send();
  });

  // ── LINK ASSET ────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/procedures/:procedureId/assets", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    const { assetId } = z.object({ assetId: z.string().cuid() }).parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!proc) return notFound(reply, "Procedure");

    const link = await app.prisma.procedureAsset.create({
      data: { procedureId: params.procedureId, assetId },
      include: { asset: { select: { id: true, name: true, category: true } } }
    });
    return reply.code(201).send(toProcedureAssetResponse(link));
  });

  // ── UNLINK ASSET ──────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/procedures/:procedureId/assets/:assetId", async (request, reply) => {
    const params = procedureParamsSchema.extend({ assetId: z.string().cuid() }).parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    await app.prisma.procedureAsset.deleteMany({
      where: { procedureId: params.procedureId, assetId: params.assetId }
    });
    return reply.code(204).send();
  });

  // ── ADD TOOL ──────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/procedures/:procedureId/tools", async (request, reply) => {
    const params = procedureParamsSchema.parse(request.params);
    const input = z.object({
      inventoryItemId: z.string().cuid(),
      quantity: z.number().min(0).default(1),
      notes: z.string().max(500).optional()
    }).parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const proc = await app.prisma.procedure.findFirst({ where: { id: params.procedureId, householdId: params.householdId, deletedAt: null } });
    if (!proc) return notFound(reply, "Procedure");

    const tool = await app.prisma.procedureTool.create({
      data: { procedureId: params.procedureId, inventoryItemId: input.inventoryItemId, quantity: input.quantity, notes: input.notes ?? null },
      include: { inventoryItem: { select: { id: true, name: true, unit: true } } }
    });
    return reply.code(201).send(toProcedureToolResponse(tool));
  });

  // ── REMOVE TOOL ───────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/procedures/:procedureId/tools/:inventoryItemId", async (request, reply) => {
    const params = procedureParamsSchema.extend({ inventoryItemId: z.string().cuid() }).parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    await app.prisma.procedureTool.deleteMany({
      where: { procedureId: params.procedureId, inventoryItemId: params.inventoryItemId }
    });
    return reply.code(204).send();
  });
};
