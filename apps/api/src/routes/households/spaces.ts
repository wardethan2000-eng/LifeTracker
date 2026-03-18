import type { Prisma, PrismaClient } from "@prisma/client";
import {
  addSpaceItemInputSchema,
  createSpaceInputSchema,
  moveSpaceInputSchema,
  spaceGeneralItemInputSchema,
  spaceGeneralItemSchema,
  spaceInventoryLinkDetailSchema,
  spaceTypeSchema,
  updateSpaceGeneralItemInputSchema,
  updateSpaceInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { createBatchLabelPdf, createSingleLabelPdf } from "../../lib/qr-label-pdf.js";
import {
  serializeSpace,
  serializeSpaceList,
  toInventoryItemSummaryResponse
} from "../../lib/serializers/index.js";
import {
  buildSpaceScanUrl,
  ensureSpaceScanTag,
  generateShortCode,
  generateSpaceScanTag,
  getSpaceBreadcrumb,
  getSpaceTree
} from "../../lib/spaces.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const spaceParamsSchema = householdParamsSchema.extend({
  spaceId: z.string().cuid()
});

const spaceItemParamsSchema = spaceParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const generalItemParamsSchema = spaceParamsSchema.extend({
  generalItemId: z.string().cuid()
});

const spaceListQuerySchema = z.object({
  parentSpaceId: z.string().optional(),
  type: spaceTypeSchema.optional(),
  search: z.string().min(1).max(200).optional(),
  includeDeleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

const qrCodeQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("svg"),
  size: z.coerce.number().int().min(100).max(1000).default(300)
});

const batchLabelBodySchema = z.object({
  spaceIds: z.array(z.string().cuid()).min(1).max(240)
});

const spaceContentsSchema = z.object({
  inventoryItems: z.array(spaceInventoryLinkDetailSchema),
  generalItems: z.array(spaceGeneralItemSchema),
  childSpaces: z.object({
    count: z.number().int().min(0),
    names: z.array(z.string())
  })
});

const activeChildrenOrderBy = [
  { sortOrder: "asc" as const },
  { name: "asc" as const }
];

const spaceDetailInclude = {
  parent: true,
  children: {
    where: { deletedAt: null },
    orderBy: activeChildrenOrderBy
  },
  spaceItems: {
    include: {
      inventoryItem: true
    },
    where: {
      inventoryItem: {
        deletedAt: null
      }
    },
    orderBy: [
      { createdAt: "desc" as const },
      { id: "desc" as const }
    ]
  },
  generalItems: {
    where: { deletedAt: null },
    orderBy: [
      { createdAt: "desc" as const },
      { id: "desc" as const }
    ]
  }
} satisfies Prisma.SpaceInclude;

const serializeSpaceItemLink = (
  link: {
    id: string;
    spaceId: string;
    inventoryItemId: string;
    quantity: number | null;
    notes: string | null;
    placedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem: Prisma.InventoryItemGetPayload<{}>;
  }
) => spaceInventoryLinkDetailSchema.parse({
  id: link.id,
  spaceId: link.spaceId,
  inventoryItemId: link.inventoryItemId,
  quantity: link.quantity ?? null,
  notes: link.notes ?? null,
  placedAt: link.placedAt.toISOString(),
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString(),
  inventoryItem: toInventoryItemSummaryResponse(link.inventoryItem)
});

const serializeGeneralItem = (item: {
  id: string;
  spaceId: string;
  householdId: string;
  name: string;
  description: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) => spaceGeneralItemSchema.parse({
  id: item.id,
  spaceId: item.spaceId,
  householdId: item.householdId,
  name: item.name,
  description: item.description ?? null,
  notes: item.notes ?? null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt?.toISOString() ?? null
});

const ensureMembership = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  householdId: string,
  userId: string
): Promise<boolean> => checkMembership(prisma, householdId, userId);

const getSpaceOrNull = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  householdId: string,
  spaceId: string,
  options: { includeDeleted?: boolean } = {}
) => prisma.space.findFirst({
  where: {
    id: spaceId,
    householdId,
    ...(options.includeDeleted ? {} : { deletedAt: null })
  }
});

const assertParentCandidate = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  householdId: string,
  spaceId: string,
  parentSpaceId: string | null
): Promise<string | null> => {
  if (parentSpaceId === null) {
    return null;
  }

  if (parentSpaceId === spaceId) {
    throw new Error("A space cannot be its own parent.");
  }

  const visited = new Set<string>();
  let currentSpaceId: string | null = parentSpaceId;

  while (currentSpaceId) {
    if (visited.has(currentSpaceId)) {
      throw new Error("Circular space hierarchy detected.");
    }

    visited.add(currentSpaceId);

    const currentSpace: { id: string; parentSpaceId: string | null } | null = await prisma.space.findFirst({
      where: {
        id: currentSpaceId,
        householdId,
        deletedAt: null
      },
      select: {
        id: true,
        parentSpaceId: true
      }
    });

    if (!currentSpace) {
      throw new Error("Parent space not found in this household.");
    }

    if (currentSpace.id === spaceId) {
      throw new Error("A space cannot become its own descendant.");
    }

    currentSpaceId = currentSpace.parentSpaceId;
  }

  return parentSpaceId;
};

const collectDescendantIds = (
  spaces: Array<{ id: string; parentSpaceId: string | null }>,
  rootSpaceId: string
): string[] => {
  const childrenByParent = new Map<string | null, string[]>();

  for (const space of spaces) {
    const existing = childrenByParent.get(space.parentSpaceId) ?? [];
    existing.push(space.id);
    childrenByParent.set(space.parentSpaceId, existing);
  }

  const ids = new Set<string>();
  const queue = [rootSpaceId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || ids.has(currentId)) {
      continue;
    }

    ids.add(currentId);

    for (const childId of childrenByParent.get(currentId) ?? []) {
      queue.push(childId);
    }
  }

  return [...ids];
};

export const householdSpaceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/spaces", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createSpaceInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const created = await app.prisma.$transaction(async (tx) => {
      const parentSpaceId = input.parentSpaceId
        ? await assertParentCandidate(tx, params.householdId, "__new__", input.parentSpaceId)
        : null;

      const space = await tx.space.create({
        data: {
          householdId: params.householdId,
          shortCode: await generateShortCode(tx, params.householdId),
          scanTag: await generateSpaceScanTag(tx),
          name: input.name,
          type: input.type,
          parentSpaceId,
          description: input.description ?? null,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? 0
        },
        include: spaceDetailInclude
      });

      return space;
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, created.id);

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "space.created",
      entityType: "inventory_item",
      entityId: created.id,
      metadata: {
        name: created.name,
        type: created.type,
        shortCode: created.shortCode
      }
    });

    return reply.code(201).send(serializeSpace(created, { breadcrumb }));
  });

  app.get("/v1/households/:householdId/spaces", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = spaceListQuerySchema.parse(request.query);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.SpaceWhereInput = {
      householdId: params.householdId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { shortCode: { contains: query.search.toUpperCase(), mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (query.parentSpaceId !== undefined) {
      if (query.parentSpaceId === "null") {
        where.parentSpaceId = null;
      } else {
        where.parentSpaceId = z.string().cuid().parse(query.parentSpaceId);
      }
    }

    const spaces = await app.prisma.space.findMany({
      where,
      include: spaceDetailInclude,
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
        { id: "asc" }
      ],
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      take: query.limit + 1
    });

    const page = spaces.slice(0, query.limit);
    const nextCursor = spaces.length > query.limit ? spaces[query.limit]?.id ?? null : null;
    const breadcrumbs = await Promise.all(page.map((space) => getSpaceBreadcrumb(app.prisma, space.id)));
    const breadcrumbsById = page.reduce<Record<string, Awaited<ReturnType<typeof getSpaceBreadcrumb>>>>((accumulator, space, index) => {
      const breadcrumb = breadcrumbs[index];

      if (breadcrumb) {
        accumulator[space.id] = breadcrumb;
      }

      return accumulator;
    }, {});

    return {
      items: serializeSpaceList(page, {
        breadcrumbsById
      }),
      nextCursor
    };
  });

  app.get("/v1/households/:householdId/spaces/tree", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const tree = await getSpaceTree(app.prisma, params.householdId);
    return serializeSpaceList(tree);
  });

  app.post("/v1/households/:householdId/spaces/labels/batch", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = batchLabelBodySchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const spaces = await app.prisma.space.findMany({
      where: {
        householdId: params.householdId,
        id: { in: input.spaceIds },
        deletedAt: null
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" }
      ]
    });

    if (spaces.length !== input.spaceIds.length) {
      return reply.code(404).send({ message: "One or more spaces were not found." });
    }

    const breadcrumbs = await Promise.all(spaces.map((space) => getSpaceBreadcrumb(app.prisma, space.id)));
    const labels = await Promise.all(spaces.map(async (space, index) => {
      const scanTag = space.scanTag ?? await ensureSpaceScanTag(app.prisma, space.id);
      const breadcrumb = breadcrumbs[index] ?? [];

      return {
        code: space.shortCode,
        title: space.name,
        footer: breadcrumb.map((segment) => segment.name).join(" > "),
        qrPayloadUrl: buildSpaceScanUrl(scanTag)
      };
    }));

    const doc = await createBatchLabelPdf(labels);

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `inline; filename="space-labels-${params.householdId}.pdf"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/households/:householdId/spaces/:spaceId/qr", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const query = qrCodeQuerySchema.parse(request.query);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const scanTag = space.scanTag ?? await ensureSpaceScanTag(app.prisma, space.id);
    const payloadUrl = buildSpaceScanUrl(scanTag);

    if (query.format === "svg") {
      const svg = await QRCode.toString(payloadUrl, {
        type: "svg",
        width: query.size,
        margin: 1
      });

      return reply
        .header("content-type", "image/svg+xml; charset=utf-8")
        .send(svg);
    }

    const png = await QRCode.toBuffer(payloadUrl, {
      type: "png",
      width: query.size,
      margin: 1
    });

    return reply
      .header("content-type", "image/png")
      .send(png);
  });

  app.get("/v1/households/:householdId/spaces/:spaceId/label", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const [scanTag, breadcrumb] = await Promise.all([
      space.scanTag ?? ensureSpaceScanTag(app.prisma, space.id),
      getSpaceBreadcrumb(app.prisma, space.id)
    ]);

    const doc = await createSingleLabelPdf({
      code: space.shortCode,
      title: space.name,
      footer: breadcrumb.map((segment) => segment.name).join(" > "),
      qrPayloadUrl: buildSpaceScanUrl(scanTag)
    });

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `inline; filename="space-label-${space.shortCode.toLowerCase()}.pdf"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/households/:householdId/spaces/:spaceId", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await app.prisma.space.findFirst({
      where: {
        id: params.spaceId,
        householdId: params.householdId,
        deletedAt: null
      },
      include: spaceDetailInclude
    });

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, space.id);
    return serializeSpace(space, { breadcrumb });
  });

  app.patch("/v1/households/:householdId/spaces/:spaceId", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const input = updateSpaceInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!existing) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const nextParentSpaceId = input.parentSpaceId !== undefined
      ? await assertParentCandidate(app.prisma, params.householdId, params.spaceId, input.parentSpaceId)
      : undefined;

    const updated = await app.prisma.space.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(nextParentSpaceId !== undefined ? { parentSpaceId: nextParentSpaceId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
      },
      include: spaceDetailInclude
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, updated.id);

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "space.updated",
      entityType: "inventory_item",
      entityId: updated.id,
      metadata: {
        name: updated.name,
        type: updated.type
      }
    });

    return serializeSpace(updated, { breadcrumb });
  });

  app.delete("/v1/households/:householdId/spaces/:spaceId", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!existing) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const allSpaces = await app.prisma.space.findMany({
      where: { householdId: params.householdId },
      select: {
        id: true,
        parentSpaceId: true
      }
    });
    const affectedSpaceIds = collectDescendantIds(allSpaces, existing.id);
    const deletedAt = new Date();

    await app.prisma.$transaction(async (tx) => {
      await tx.spaceInventoryItem.deleteMany({
        where: {
          spaceId: { in: affectedSpaceIds }
        }
      });

      await tx.spaceGeneralItem.updateMany({
        where: {
          spaceId: { in: affectedSpaceIds },
          deletedAt: null
        },
        data: { deletedAt }
      });

      await tx.space.updateMany({
        where: {
          id: { in: affectedSpaceIds }
        },
        data: { deletedAt }
      });
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "space.deleted",
      entityType: "inventory_item",
      entityId: existing.id,
      metadata: {
        affectedSpaceCount: affectedSpaceIds.length,
        name: existing.name
      }
    });

    return reply.code(204).send();
  });

  app.post("/v1/households/:householdId/spaces/:spaceId/restore", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId, { includeDeleted: true });

    if (!existing || existing.deletedAt === null) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const parent = existing.parentSpaceId
      ? await app.prisma.space.findFirst({
          where: {
            id: existing.parentSpaceId,
            householdId: params.householdId,
            deletedAt: null
          },
          select: { id: true }
        })
      : null;

    const restored = await app.prisma.space.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        parentSpaceId: existing.parentSpaceId && !parent ? null : existing.parentSpaceId
      },
      include: spaceDetailInclude
    });

    await app.prisma.spaceGeneralItem.updateMany({
      where: {
        spaceId: restored.id
      },
      data: { deletedAt: null }
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, restored.id);

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "space.restored",
      entityType: "inventory_item",
      entityId: restored.id,
      metadata: {
        name: restored.name
      }
    });

    return serializeSpace(restored, { breadcrumb });
  });

  app.post("/v1/households/:householdId/spaces/:spaceId/items", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const input = addSpaceItemInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const [space, inventoryItem] = await Promise.all([
      getSpaceOrNull(app.prisma, params.householdId, params.spaceId),
      app.prisma.inventoryItem.findFirst({
        where: {
          id: input.inventoryItemId,
          householdId: params.householdId,
          deletedAt: null
        }
      })
    ]);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    if (!inventoryItem) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const link = await app.prisma.spaceInventoryItem.upsert({
      where: {
        spaceId_inventoryItemId: {
          spaceId: space.id,
          inventoryItemId: inventoryItem.id
        }
      },
      update: {
        quantity: input.quantity ?? null,
        notes: input.notes ?? null
      },
      create: {
        spaceId: space.id,
        inventoryItemId: inventoryItem.id,
        quantity: input.quantity ?? null,
        notes: input.notes ?? null
      },
      include: {
        inventoryItem: true
      }
    });

    return reply.code(201).send(serializeSpaceItemLink(link));
  });

  app.delete("/v1/households/:householdId/spaces/:spaceId/items/:inventoryItemId", async (request, reply) => {
    const params = spaceItemParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    await app.prisma.spaceInventoryItem.deleteMany({
      where: {
        spaceId: params.spaceId,
        inventoryItemId: params.inventoryItemId
      }
    });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/spaces/:spaceId/items", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const items = await app.prisma.spaceInventoryItem.findMany({
      where: {
        spaceId: params.spaceId,
        inventoryItem: {
          deletedAt: null
        }
      },
      include: {
        inventoryItem: true
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    return items.map(serializeSpaceItemLink);
  });

  app.post("/v1/households/:householdId/spaces/:spaceId/general-items", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const input = spaceGeneralItemInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const item = await app.prisma.spaceGeneralItem.create({
      data: {
        spaceId: space.id,
        householdId: params.householdId,
        name: input.name,
        description: input.description ?? null,
        notes: input.notes ?? null
      }
    });

    return reply.code(201).send(serializeGeneralItem(item));
  });

  app.patch("/v1/households/:householdId/spaces/:spaceId/general-items/:generalItemId", async (request, reply) => {
    const params = generalItemParamsSchema.parse(request.params);
    const input = updateSpaceGeneralItemInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.spaceGeneralItem.findFirst({
      where: {
        id: params.generalItemId,
        spaceId: params.spaceId,
        householdId: params.householdId,
        deletedAt: null
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "General item not found." });
    }

    const updated = await app.prisma.spaceGeneralItem.update({
      where: { id: item.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {})
      }
    });

    return serializeGeneralItem(updated);
  });

  app.delete("/v1/households/:householdId/spaces/:spaceId/general-items/:generalItemId", async (request, reply) => {
    const params = generalItemParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.spaceGeneralItem.findFirst({
      where: {
        id: params.generalItemId,
        spaceId: params.spaceId,
        householdId: params.householdId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!item) {
      return reply.code(404).send({ message: "General item not found." });
    }

    await app.prisma.spaceGeneralItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() }
    });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/spaces/:spaceId/contents", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const [inventoryItems, generalItems, childSpaces] = await Promise.all([
      app.prisma.spaceInventoryItem.findMany({
        where: {
          spaceId: params.spaceId,
          inventoryItem: {
            deletedAt: null
          }
        },
        include: {
          inventoryItem: true
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ]
      }),
      app.prisma.spaceGeneralItem.findMany({
        where: {
          spaceId: params.spaceId,
          householdId: params.householdId,
          deletedAt: null
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ]
      }),
      app.prisma.space.findMany({
        where: {
          parentSpaceId: params.spaceId,
          householdId: params.householdId,
          deletedAt: null
        },
        select: {
          name: true
        },
        orderBy: activeChildrenOrderBy
      })
    ]);

    return spaceContentsSchema.parse({
      inventoryItems: inventoryItems.map(serializeSpaceItemLink),
      generalItems: generalItems.map(serializeGeneralItem),
      childSpaces: {
        count: childSpaces.length,
        names: childSpaces.map((child) => child.name)
      }
    });
  });

  app.post("/v1/households/:householdId/spaces/:spaceId/move", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const input = moveSpaceInputSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!existing) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const newParentSpaceId = await assertParentCandidate(app.prisma, params.householdId, existing.id, input.newParentSpaceId);
    const moved = await app.prisma.space.update({
      where: { id: existing.id },
      data: { parentSpaceId: newParentSpaceId },
      include: spaceDetailInclude
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, moved.id);

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "space.moved",
      entityType: "inventory_item",
      entityId: moved.id,
      metadata: {
        previousParentSpaceId: existing.parentSpaceId,
        newParentSpaceId
      }
    });

    return serializeSpace(moved, { breadcrumb });
  });
};