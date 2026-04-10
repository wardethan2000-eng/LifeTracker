import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createPlaybookSchema,
  updatePlaybookSchema,
  createPlaybookItemSchema,
  updatePlaybookItemSchema,
  reorderPlaybookItemsSchema,
  createPlaybookRunSchema,
  updatePlaybookRunItemSchema
} from "@aegis/types";
import { assertMembership } from "../../lib/asset-access.js";
import {
  toPlaybookResponse,
  toPlaybookSummaryResponse,
  toPlaybookItemResponse,
  toPlaybookRunResponse,
  toPlaybookRunItemResponse
} from "../../lib/serializers/index.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const playbookParamsSchema = householdParamsSchema.extend({
  playbookId: z.string().cuid()
});
const itemParamsSchema = playbookParamsSchema.extend({
  itemId: z.string().cuid()
});
const runParamsSchema = playbookParamsSchema.extend({
  runId: z.string().cuid()
});
const runItemParamsSchema = runParamsSchema.extend({
  runItemId: z.string().cuid()
});

const playbookItemInclude = {
  asset: { select: { id: true, name: true, category: true } },
  inventoryItem: { select: { id: true, name: true } },
  procedure: { select: { id: true, title: true } },
  space: { select: { id: true, name: true } }
} as const;

export const playbookRoutes: FastifyPluginAsync = async (app) => {
  // ── LIST PLAYBOOKS ────────────────────────────────────────────────
  app.get("/v1/households/:householdId/playbooks", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const playbooks = await app.prisma.playbook.findMany({
      where: { householdId: params.householdId, deletedAt: null },
      include: {
        _count: { select: { items: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } }
      },
      orderBy: [{ triggerMonth: "asc" }, { title: "asc" }]
    });
    return playbooks.map(toPlaybookSummaryResponse);
  });

  // ── GET PLAYBOOK ──────────────────────────────────────────────────
  app.get("/v1/households/:householdId/playbooks/:playbookId", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const pb = await app.prisma.playbook.findFirst({
      where: { id: params.playbookId, householdId: params.householdId, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" }, include: playbookItemInclude } }
    });
    if (!pb) return notFound(reply, "Playbook");
    return toPlaybookResponse(pb);
  });

  // ── CREATE PLAYBOOK ───────────────────────────────────────────────
  app.post("/v1/households/:householdId/playbooks", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createPlaybookSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const pb = await app.prisma.playbook.create({
      data: {
        householdId: params.householdId,
        title: input.title,
        description: input.description ?? null,
        triggerMonth: input.triggerMonth ?? null,
        triggerDay: input.triggerDay ?? null,
        leadDays: input.leadDays,
        items: input.items ? {
          create: input.items.map((item, i) => ({
            sortOrder: item.sortOrder ?? i,
            label: item.label,
            notes: item.notes ?? null,
            assetId: item.assetId ?? null,
            inventoryItemId: item.inventoryItemId ?? null,
            procedureId: item.procedureId ?? null,
            spaceId: item.spaceId ?? null
          }))
        } : undefined
      },
      include: { items: { orderBy: { sortOrder: "asc" }, include: playbookItemInclude } }
    });

    await createActivityLogger(app.prisma, request.auth.userId).log("playbook", pb.id, "playbook.created", params.householdId, { title: pb.title });
    return reply.code(201).send(toPlaybookResponse(pb));
  });

  // ── UPDATE PLAYBOOK ───────────────────────────────────────────────
  app.patch("/v1/households/:householdId/playbooks/:playbookId", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    const input = updatePlaybookSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.playbook.findFirst({ where: { id: params.playbookId, householdId: params.householdId, deletedAt: null } });
    if (!existing) return notFound(reply, "Playbook");

    const pb = await app.prisma.playbook.update({
      where: { id: params.playbookId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.triggerMonth !== undefined ? { triggerMonth: input.triggerMonth } : {}),
        ...(input.triggerDay !== undefined ? { triggerDay: input.triggerDay } : {}),
        ...(input.leadDays !== undefined ? { leadDays: input.leadDays } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      include: { items: { orderBy: { sortOrder: "asc" }, include: playbookItemInclude } }
    });

    await createActivityLogger(app.prisma, request.auth.userId).log("playbook", pb.id, "playbook.updated", params.householdId, { title: pb.title });
    return toPlaybookResponse(pb);
  });

  // ── DELETE PLAYBOOK (soft) ────────────────────────────────────────
  app.delete("/v1/households/:householdId/playbooks/:playbookId", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.playbook.findFirst({ where: { id: params.playbookId, householdId: params.householdId, deletedAt: null } });
    if (!existing) return notFound(reply, "Playbook");

    await app.prisma.playbook.update({ where: { id: params.playbookId }, data: { deletedAt: new Date() } });
    await createActivityLogger(app.prisma, request.auth.userId).log("playbook", params.playbookId, "playbook.deleted", params.householdId, { title: existing.title });
    return reply.code(204).send();
  });

  // ── ADD ITEM ──────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/playbooks/:playbookId/items", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    const input = createPlaybookItemSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const pb = await app.prisma.playbook.findFirst({ where: { id: params.playbookId, householdId: params.householdId, deletedAt: null } });
    if (!pb) return notFound(reply, "Playbook");

    const maxOrder = await app.prisma.playbookItem.aggregate({ where: { playbookId: params.playbookId }, _max: { sortOrder: true } });
    const nextOrder = input.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1);

    const item = await app.prisma.playbookItem.create({
      data: {
        playbookId: params.playbookId,
        sortOrder: nextOrder,
        label: input.label,
        notes: input.notes ?? null,
        assetId: input.assetId ?? null,
        inventoryItemId: input.inventoryItemId ?? null,
        procedureId: input.procedureId ?? null,
        spaceId: input.spaceId ?? null
      },
      include: playbookItemInclude
    });
    return reply.code(201).send(toPlaybookItemResponse(item));
  });

  // ── UPDATE ITEM ───────────────────────────────────────────────────
  app.patch("/v1/households/:householdId/playbooks/:playbookId/items/:itemId", async (request, reply) => {
    const params = itemParamsSchema.parse(request.params);
    const input = updatePlaybookItemSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const item = await app.prisma.playbookItem.findFirst({
      where: { id: params.itemId, playbook: { id: params.playbookId, householdId: params.householdId, deletedAt: null } }
    });
    if (!item) return notFound(reply, "Playbook item");

    const updated = await app.prisma.playbookItem.update({
      where: { id: params.itemId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.assetId !== undefined ? { assetId: input.assetId ?? null } : {}),
        ...(input.inventoryItemId !== undefined ? { inventoryItemId: input.inventoryItemId ?? null } : {}),
        ...(input.procedureId !== undefined ? { procedureId: input.procedureId ?? null } : {}),
        ...(input.spaceId !== undefined ? { spaceId: input.spaceId ?? null } : {})
      },
      include: playbookItemInclude
    });
    return toPlaybookItemResponse(updated);
  });

  // ── DELETE ITEM ───────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/playbooks/:playbookId/items/:itemId", async (request, reply) => {
    const params = itemParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const item = await app.prisma.playbookItem.findFirst({
      where: { id: params.itemId, playbook: { id: params.playbookId, householdId: params.householdId, deletedAt: null } }
    });
    if (!item) return notFound(reply, "Playbook item");

    await app.prisma.playbookItem.delete({ where: { id: params.itemId } });
    return reply.code(204).send();
  });

  // ── REORDER ITEMS ─────────────────────────────────────────────────
  app.put("/v1/households/:householdId/playbooks/:playbookId/items/order", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    const input = reorderPlaybookItemsSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const pb = await app.prisma.playbook.findFirst({ where: { id: params.playbookId, householdId: params.householdId, deletedAt: null } });
    if (!pb) return notFound(reply, "Playbook");

    await app.prisma.$transaction(
      input.orderedIds.map((id, i) =>
        app.prisma.playbookItem.update({ where: { id }, data: { sortOrder: i } })
      )
    );
    return reply.code(204).send();
  });

  // ── START A RUN ───────────────────────────────────────────────────
  app.post("/v1/households/:householdId/playbooks/:playbookId/runs", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    const input = createPlaybookRunSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const pb = await app.prisma.playbook.findFirst({
      where: { id: params.playbookId, householdId: params.householdId, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    if (!pb) return notFound(reply, "Playbook");

    const run = await app.prisma.playbookRun.create({
      data: {
        playbookId: params.playbookId,
        title: input.title ?? null,
        notes: input.notes ?? null,
        items: {
          create: pb.items.map((item) => ({
            playbookItemId: item.id
          }))
        }
      },
      include: {
        items: {
          include: {
            playbookItem: { include: playbookItemInclude }
          }
        }
      }
    });

    await createActivityLogger(app.prisma, request.auth.userId).log("playbook", pb.id, "playbook.run_started", params.householdId, { title: pb.title, runTitle: run.title });
    return reply.code(201).send(toPlaybookRunResponse(run));
  });

  // ── LIST RUNS ─────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/playbooks/:playbookId/runs", async (request, reply) => {
    const params = playbookParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const runs = await app.prisma.playbookRun.findMany({
      where: { playbook: { id: params.playbookId, householdId: params.householdId } },
      include: {
        items: {
          include: {
            playbookItem: { include: playbookItemInclude }
          }
        }
      },
      orderBy: { startedAt: "desc" }
    });
    return runs.map(toPlaybookRunResponse);
  });

  // ── GET RUN ───────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/playbooks/:playbookId/runs/:runId", async (request, reply) => {
    const params = runParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const run = await app.prisma.playbookRun.findFirst({
      where: { id: params.runId, playbook: { id: params.playbookId, householdId: params.householdId } },
      include: {
        items: {
          include: {
            playbookItem: { include: playbookItemInclude }
          }
        }
      }
    });
    if (!run) return notFound(reply, "Run");
    return toPlaybookRunResponse(run);
  });

  // ── UPDATE RUN ITEM (check/uncheck) ───────────────────────────────
  app.patch("/v1/households/:householdId/playbooks/:playbookId/runs/:runId/items/:runItemId", async (request, reply) => {
    const params = runItemParamsSchema.parse(request.params);
    const input = updatePlaybookRunItemSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const runItem = await app.prisma.playbookRunItem.findFirst({
      where: { id: params.runItemId, run: { id: params.runId, playbook: { id: params.playbookId, householdId: params.householdId } } }
    });
    if (!runItem) return notFound(reply, "Run item");

    const updated = await app.prisma.playbookRunItem.update({
      where: { id: params.runItemId },
      data: {
        ...(input.isCompleted !== undefined ? {
          isCompleted: input.isCompleted,
          completedAt: input.isCompleted ? new Date() : null
        } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {})
      },
      include: { playbookItem: { include: playbookItemInclude } }
    });

    // Auto-complete run if all items done
    if (input.isCompleted) {
      const run = await app.prisma.playbookRun.findUnique({
        where: { id: params.runId },
        include: { items: true }
      });
      if (run && run.items.every((ri) => ri.id === params.runItemId ? true : ri.isCompleted)) {
        await app.prisma.playbookRun.update({
          where: { id: params.runId },
          data: { completedAt: new Date() }
        });
      }
    }

    return toPlaybookRunItemResponse(updated);
  });
};
