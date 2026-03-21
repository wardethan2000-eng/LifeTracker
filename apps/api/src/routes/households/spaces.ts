import type { Prisma, PrismaClient } from "@prisma/client";
import {
  addSpaceItemInputSchema,
  createSpaceInputSchema,
  importSpacesSchema,
  importSpacesResultSchema,
  inventoryItemListResponseSchema,
  moveSpaceInputSchema,
  reorderByOrderedIdsSchema,
  spaceOrphanCountSchema,
  spaceRecentScanListSchema,
  spaceItemHistoryListResponseSchema,
  spaceGeneralItemInputSchema,
  spaceGeneralItemSchema,
  spaceInventoryLinkDetailSchema,
  spaceTypeSchema,
  spaceUtilizationListSchema,
  updateSpaceGeneralItemInputSchema,
  updateSpaceInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import QRCode from "qrcode";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { createBatchLabelPdf, createSingleLabelPdf } from "../../lib/qr-label-pdf.js";
import { removeSearchIndexEntry, syncSpaceToSearchIndex } from "../../lib/search-index.js";
import { recordSpaceScanLog } from "../../lib/space-scan-log.js";
import {
  serializeSpace,
  serializeSpaceItemHistory,
  serializeSpaceRecentScan,
  serializeSpaceList,
  serializeSpaceUtilization,
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

const spaceLookupParamsSchema = householdParamsSchema.extend({
  shortCode: z.string().trim().min(4).max(6)
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

const orphanInventoryQuerySchema = z.object({
  category: z.string().min(1).max(120).optional(),
  search: z.string().min(1).max(200).optional(),
  itemType: z.enum(["consumable", "equipment"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

const recentScanQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10)
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

const spaceHistoryQuerySchema = z.object({
  actions: z.union([z.string(), z.array(z.string())]).optional().transform((value, context) => {
    if (value === undefined) {
      return undefined;
    }

    const raw = Array.isArray(value)
      ? value.flatMap((entry) => entry.split(","))
      : value.split(",");
    const normalized = raw.map((entry) => entry.trim()).filter(Boolean);

    if (normalized.length === 0) {
      return undefined;
    }

    const allowed = new Set(["placed", "removed", "moved_in", "moved_out", "quantity_changed"]);

    for (const action of normalized) {
      if (!allowed.has(action)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actions"],
          message: `Unsupported history action: ${action}`
        });

        return z.NEVER;
      }
    }

    return normalized as Array<"placed" | "removed" | "moved_in" | "moved_out" | "quantity_changed">;
  }),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

const SPACE_HISTORY_MERGE_WINDOW_MS = 5 * 60 * 1000;

const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const csvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return csvEscape(String(value));
};

const normalizeSpaceName = (value: string): string => value.trim().toLowerCase();
const normalizeSpaceShortCode = (value: string): string => value.trim().toUpperCase();

type SpaceTreeNode = Awaited<ReturnType<typeof getSpaceTree>>[number];

type SpaceUtilizationEntryRecord = {
  id: string;
  householdId: string;
  shortCode: string;
  scanTag: string;
  name: string;
  type: SpaceTreeNode["type"];
  parentSpaceId: string | null;
  description: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  breadcrumb: NonNullable<SpaceTreeNode["breadcrumb"]>;
  itemCount: number;
  generalItemCount: number;
  totalItemCount: number;
  lastActivityAt: Date | null;
};

const collectUtilizationEntries = (
  nodes: SpaceTreeNode[],
  lastActivityBySpaceId: Map<string, Date | null>,
  accumulator: SpaceUtilizationEntryRecord[] = []
): number => {
  let total = 0;

  for (const node of nodes) {
    const childTotal = collectUtilizationEntries(node.children ?? [], lastActivityBySpaceId, accumulator);
    const itemCount = node.itemCount ?? 0;
    const generalItemCount = node.generalItemCount ?? 0;
    const totalItemCount = itemCount + generalItemCount + childTotal;

    accumulator.push({
      id: node.id,
      householdId: node.householdId,
      shortCode: node.shortCode,
      scanTag: node.scanTag,
      name: node.name,
      type: node.type,
      parentSpaceId: node.parentSpaceId,
      description: node.description,
      notes: node.notes,
      sortOrder: node.sortOrder,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      deletedAt: node.deletedAt,
      breadcrumb: node.breadcrumb ?? [{ id: node.id, name: node.name, type: node.type }],
      itemCount,
      generalItemCount,
      totalItemCount,
      lastActivityAt: lastActivityBySpaceId.get(node.id) ?? null
    });

    total += totalItemCount;
  }

  return total;
};

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

const syncSpacesToSearchIndex = async (prisma: PrismaClient, spaceIds: string[]): Promise<void> => {
  await Promise.all(spaceIds.map((spaceId) => syncSpaceToSearchIndex(prisma, spaceId)));
};

const removeSpacesFromSearchIndex = async (prisma: PrismaClient, spaceIds: string[]): Promise<void> => {
  await Promise.all(spaceIds.map((spaceId) => removeSearchIndexEntry(prisma, "space", spaceId)));
};

const findRecentInventoryHistory = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  householdId: string,
  inventoryItemId: string,
  performedBy: string
) => prisma.spaceItemHistory.findFirst({
  where: {
    householdId,
    inventoryItemId,
    performedBy,
    action: {
      in: ["removed", "moved_out"]
    },
    createdAt: {
      gte: new Date(Date.now() - SPACE_HISTORY_MERGE_WINDOW_MS)
    }
  },
  orderBy: [
    { createdAt: "desc" },
    { id: "desc" }
  ]
});

const recordGeneralItemHistory = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  params: {
    householdId: string;
    spaceId: string;
    generalItemName: string;
    action: "placed" | "removed";
    notes?: string | null;
    performedBy: string;
  }
): Promise<void> => {
  await prisma.spaceItemHistory.create({
    data: {
      householdId: params.householdId,
      spaceId: params.spaceId,
      generalItemName: params.generalItemName,
      action: params.action,
      notes: params.notes ?? null,
      performedBy: params.performedBy
    }
  });
};

const recordInventoryPlacementHistory = async (
  prisma: Prisma.TransactionClient | PrismaClient,
  params: {
    householdId: string;
    spaceId: string;
    inventoryItemId: string;
    quantity: number | null;
    previousQuantity: number | null;
    notes?: string | null;
    performedBy: string;
  }
): Promise<void> => {
  const recentHistory = await findRecentInventoryHistory(
    prisma,
    params.householdId,
    params.inventoryItemId,
    params.performedBy
  );

  if (recentHistory && recentHistory.spaceId === params.spaceId) {
    await prisma.spaceItemHistory.update({
      where: { id: recentHistory.id },
      data: {
        action: "quantity_changed",
        previousQuantity: recentHistory.quantity,
        quantity: params.quantity,
        notes: params.notes ?? recentHistory.notes ?? null
      }
    });
    return;
  }

  if (recentHistory && recentHistory.spaceId !== params.spaceId) {
    await prisma.spaceItemHistory.update({
      where: { id: recentHistory.id },
      data: {
        action: "moved_out"
      }
    });

    await prisma.spaceItemHistory.create({
      data: {
        householdId: params.householdId,
        spaceId: params.spaceId,
        inventoryItemId: params.inventoryItemId,
        action: "moved_in",
        quantity: recentHistory.quantity ?? params.quantity,
        previousQuantity: params.previousQuantity,
        notes: params.notes ?? null,
        performedBy: params.performedBy
      }
    });
    return;
  }

  await prisma.spaceItemHistory.create({
    data: {
      householdId: params.householdId,
      spaceId: params.spaceId,
      inventoryItemId: params.inventoryItemId,
      action: params.previousQuantity !== params.quantity ? "quantity_changed" : "placed",
      quantity: params.quantity,
      previousQuantity: params.previousQuantity,
      notes: params.notes ?? null,
      performedBy: params.performedBy
    }
  });
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

    void syncSpaceToSearchIndex(app.prisma, created.id).catch(console.error);

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

  app.get("/v1/households/:householdId/spaces/lookup/:shortCode", async (request, reply) => {
    const params = spaceLookupParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await app.prisma.space.findFirst({
      where: {
        householdId: params.householdId,
        shortCode: normalizeSpaceShortCode(params.shortCode),
        deletedAt: null
      },
      include: spaceDetailInclude
    });

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    await recordSpaceScanLog(app.prisma, {
      householdId: params.householdId,
      spaceId: space.id,
      userId: request.auth.userId,
      method: "manual_lookup"
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, space.id);
    return serializeSpace(space, { breadcrumb });
  });

  app.get("/v1/households/:householdId/spaces/analytics/orphans/count", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const count = await app.prisma.inventoryItem.count({
      where: {
        householdId: params.householdId,
        deletedAt: null,
        spaceLinks: {
          none: {}
        }
      }
    });

    return spaceOrphanCountSchema.parse({ count });
  });

  app.get("/v1/households/:householdId/spaces/analytics/orphans", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = orphanInventoryQuerySchema.parse(request.query);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.InventoryItemWhereInput = {
      householdId: params.householdId,
      deletedAt: null,
      spaceLinks: {
        none: {}
      },
      ...(query.category ? { category: query.category } : {}),
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { partNumber: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const items = await app.prisma.inventoryItem.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    const page = items.slice(0, query.limit);
    const nextCursor = items.length > query.limit ? items[query.limit]?.id ?? null : null;

    return inventoryItemListResponseSchema.parse({
      items: page.map(toInventoryItemSummaryResponse),
      nextCursor
    });
  });

  app.get("/v1/households/:householdId/spaces/analytics/utilization", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const [tree, lastActivity] = await Promise.all([
      getSpaceTree(app.prisma, params.householdId),
      app.prisma.spaceItemHistory.groupBy({
        by: ["spaceId"],
        where: {
          householdId: params.householdId
        },
        _max: {
          createdAt: true
        }
      })
    ]);

    const lastActivityBySpaceId = new Map(lastActivity.map((entry) => [entry.spaceId, entry._max.createdAt ?? null]));
    const utilizationEntries: SpaceUtilizationEntryRecord[] = [];
    collectUtilizationEntries(tree, lastActivityBySpaceId, utilizationEntries);

    return spaceUtilizationListSchema.parse(
      utilizationEntries
        .sort((left, right) => {
          if (right.totalItemCount !== left.totalItemCount) {
            return right.totalItemCount - left.totalItemCount;
          }

          return left.name.localeCompare(right.name);
        })
        .map(serializeSpaceUtilization)
    );
  });

  app.get("/v1/households/:householdId/spaces/recent-scans", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = recentScanQuerySchema.parse(request.query);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const entries = await app.prisma.spaceScanLog.findMany({
      where: {
        householdId: params.householdId
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        },
        space: {
          select: {
            id: true,
            householdId: true,
            shortCode: true,
            scanTag: true,
            name: true,
            type: true,
            parentSpaceId: true,
            description: true,
            notes: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          }
        }
      },
      orderBy: [
        { scannedAt: "desc" },
        { id: "desc" }
      ],
      take: query.limit
    });

    const breadcrumbs = await Promise.all(entries.map((entry) => getSpaceBreadcrumb(app.prisma, entry.spaceId)));

    return spaceRecentScanListSchema.parse(entries.map((entry, index) => {
      const breadcrumb = breadcrumbs[index];

      return breadcrumb
        ? serializeSpaceRecentScan(entry, { breadcrumb })
        : serializeSpaceRecentScan(entry);
    }));
  });

  app.get("/v1/households/:householdId/spaces/export", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const spaces = await app.prisma.space.findMany({
      where: {
        householdId: params.householdId,
        deletedAt: null
      },
      include: {
        parent: {
          select: {
            shortCode: true
          }
        },
        spaceItems: {
          include: {
            inventoryItem: {
              select: {
                name: true,
                deletedAt: true
              }
            }
          },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" }
          ]
        },
        generalItems: {
          where: { deletedAt: null },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" }
          ]
        }
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" }
      ]
    });

    const header = ["shortCode", "name", "type", "parentShortCode", "description", "notes", "items", "generalItems"];
    const rows = spaces.map((space) => [
      csvValue(space.shortCode),
      csvValue(space.name),
      csvValue(space.type),
      csvValue(space.parent?.shortCode ?? null),
      csvValue(space.description ?? null),
      csvValue(space.notes ?? null),
      csvValue(space.spaceItems
        .filter((link) => link.inventoryItem.deletedAt === null)
        .map((link) => link.inventoryItem.name)
        .join(", ")),
      csvValue(space.generalItems.map((item) => item.name).join(", "))
    ].join(","));

    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .send([header.join(","), ...rows].join("\n"));
  });

  app.post("/v1/households/:householdId/spaces/import", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = importSpacesSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const nameCounts = new Map<string, number>();

    for (const row of input.spaces) {
      const nameKey = normalizeSpaceName(row.name);
      nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const existingSpaces = await tx.space.findMany({
        where: {
          householdId: params.householdId,
          deletedAt: null
        },
        select: {
          id: true,
          householdId: true,
          shortCode: true,
          scanTag: true,
          name: true,
          type: true,
          parentSpaceId: true,
          description: true,
          notes: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true
        }
      });

      const existingByName = existingSpaces.reduce<Map<string, typeof existingSpaces>>((map, space) => {
        const key = normalizeSpaceName(space.name);
        map.set(key, [...(map.get(key) ?? []), space]);
        return map;
      }, new Map());

      const existingByShortCode = new Map(existingSpaces.map((space) => [normalizeSpaceShortCode(space.shortCode), space]));
      const importedByName = new Map<string, typeof existingSpaces[number]>();
      const errors: Array<{ index: number; message: string }> = [];
      const errorIndexes = new Set<number>();
      const touchedSpaceIds = new Set<string>();
      let created = 0;
      let updated = 0;

      for (const [index, row] of input.spaces.entries()) {
        const nameKey = normalizeSpaceName(row.name);

        if ((nameCounts.get(nameKey) ?? 0) > 1) {
          errors.push({ index, message: `Duplicate space name '${row.name}' appears multiple times in the import.` });
          errorIndexes.add(index);
          continue;
        }

        const matches = existingByName.get(nameKey) ?? [];

        if (matches.length > 1) {
          errors.push({ index, message: `Multiple existing spaces are named '${row.name}'. Use unique names before importing.` });
          errorIndexes.add(index);
          continue;
        }

        if (matches.length === 1) {
          const existing = matches[0]!;
          const saved = await tx.space.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              type: row.type,
              description: row.description ?? null,
              notes: row.notes ?? null
            },
            select: {
              id: true,
              householdId: true,
              shortCode: true,
              scanTag: true,
              name: true,
              type: true,
              parentSpaceId: true,
              description: true,
              notes: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true
            }
          });

          importedByName.set(nameKey, saved);
          existingByShortCode.set(normalizeSpaceShortCode(saved.shortCode), saved);
          touchedSpaceIds.add(saved.id);
          updated += 1;
          continue;
        }

        const createdSpace = await tx.space.create({
          data: {
            householdId: params.householdId,
            shortCode: await generateShortCode(tx, params.householdId),
            scanTag: await generateSpaceScanTag(tx),
            name: row.name,
            type: row.type,
            description: row.description ?? null,
            notes: row.notes ?? null,
            sortOrder: 0
          },
          select: {
            id: true,
            householdId: true,
            shortCode: true,
            scanTag: true,
            name: true,
            type: true,
            parentSpaceId: true,
            description: true,
            notes: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          }
        });

        importedByName.set(nameKey, createdSpace);
        existingByShortCode.set(normalizeSpaceShortCode(createdSpace.shortCode), createdSpace);
        touchedSpaceIds.add(createdSpace.id);
        created += 1;
      }

      for (const [index, row] of input.spaces.entries()) {
        if (errorIndexes.has(index)) {
          continue;
        }

        const current = importedByName.get(normalizeSpaceName(row.name));

        if (!current) {
          continue;
        }

        let desiredParentId: string | null = null;

        if (row.parentShortCode) {
          const parent = existingByShortCode.get(normalizeSpaceShortCode(row.parentShortCode));

          if (!parent) {
            errors.push({ index, message: `Parent short code '${row.parentShortCode}' was not found.` });
            continue;
          }

          desiredParentId = parent.id;
        } else if (row.parentName) {
          const importedParent = importedByName.get(normalizeSpaceName(row.parentName));

          if (importedParent) {
            desiredParentId = importedParent.id;
          } else {
            const matches = existingByName.get(normalizeSpaceName(row.parentName)) ?? [];

            if (matches.length === 0) {
              errors.push({ index, message: `Parent space '${row.parentName}' was not found.` });
              continue;
            }

            if (matches.length > 1) {
              errors.push({ index, message: `Parent name '${row.parentName}' is ambiguous.` });
              continue;
            }

            desiredParentId = matches[0]!.id;
          }
        }

        try {
          const nextParentSpaceId = await assertParentCandidate(tx, params.householdId, current.id, desiredParentId);

          if (nextParentSpaceId !== current.parentSpaceId) {
            const saved = await tx.space.update({
              where: { id: current.id },
              data: {
                parentSpaceId: nextParentSpaceId
              },
              select: {
                id: true,
                householdId: true,
                shortCode: true,
                scanTag: true,
                name: true,
                type: true,
                parentSpaceId: true,
                description: true,
                notes: true,
                sortOrder: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true
              }
            });

            importedByName.set(normalizeSpaceName(saved.name), saved);
            existingByShortCode.set(normalizeSpaceShortCode(saved.shortCode), saved);
          }
        } catch (error) {
          errors.push({
            index,
            message: error instanceof Error ? error.message : "Unable to assign that parent space."
          });
        }
      }

      return {
        created,
        updated,
        errors,
        touchedSpaceIds: [...touchedSpaceIds]
      };
    });

    if (result.created > 0 || result.updated > 0) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "space.imported",
        entityType: "inventory_item",
        entityId: params.householdId,
        metadata: {
          created: result.created,
          updated: result.updated,
          errorCount: result.errors.length
        }
      });

      void syncSpacesToSearchIndex(app.prisma, result.touchedSpaceIds).catch(console.error);
    }

    return importSpacesResultSchema.parse({
      created: result.created,
      updated: result.updated,
      errors: result.errors
    });
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

  app.post("/v1/households/:householdId/spaces/:spaceId/view", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    await recordSpaceScanLog(app.prisma, {
      householdId: params.householdId,
      spaceId: space.id,
      userId: request.auth.userId,
      method: "direct_navigation"
    });

    return reply.code(204).send();
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

    const householdSpaces = await app.prisma.space.findMany({
      where: { householdId: params.householdId },
      select: {
        id: true,
        parentSpaceId: true
      }
    });

    void syncSpacesToSearchIndex(app.prisma, collectDescendantIds(householdSpaces, updated.id)).catch(console.error);

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

    void removeSpacesFromSearchIndex(app.prisma, affectedSpaceIds).catch(console.error);

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

    void syncSpaceToSearchIndex(app.prisma, restored.id).catch(console.error);

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

    const link = await app.prisma.$transaction(async (tx) => {
      const existingLink = await tx.spaceInventoryItem.findUnique({
        where: {
          spaceId_inventoryItemId: {
            spaceId: space.id,
            inventoryItemId: inventoryItem.id
          }
        },
        select: {
          quantity: true
        }
      });

      const nextQuantity = input.quantity ?? null;
      const createdOrUpdated = await tx.spaceInventoryItem.upsert({
        where: {
          spaceId_inventoryItemId: {
            spaceId: space.id,
            inventoryItemId: inventoryItem.id
          }
        },
        update: {
          quantity: nextQuantity,
          notes: input.notes ?? null
        },
        create: {
          spaceId: space.id,
          inventoryItemId: inventoryItem.id,
          quantity: nextQuantity,
          notes: input.notes ?? null
        },
        include: {
          inventoryItem: true
        }
      });

      await recordInventoryPlacementHistory(tx, {
        householdId: params.householdId,
        spaceId: space.id,
        inventoryItemId: inventoryItem.id,
        quantity: nextQuantity,
        previousQuantity: existingLink?.quantity ?? null,
        notes: input.notes ?? null,
        performedBy: request.auth.userId
      });

      return createdOrUpdated;
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

    const existingLink = await app.prisma.spaceInventoryItem.findUnique({
      where: {
        spaceId_inventoryItemId: {
          spaceId: params.spaceId,
          inventoryItemId: params.inventoryItemId
        }
      },
      select: {
        quantity: true,
        notes: true
      }
    });

    if (!existingLink) {
      return reply.code(404).send({ message: "Inventory item assignment not found." });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.spaceInventoryItem.delete({
        where: {
          spaceId_inventoryItemId: {
            spaceId: params.spaceId,
            inventoryItemId: params.inventoryItemId
          }
        }
      });

      await tx.spaceItemHistory.create({
        data: {
          householdId: params.householdId,
          spaceId: params.spaceId,
          inventoryItemId: params.inventoryItemId,
          action: "removed",
          quantity: existingLink.quantity,
          notes: existingLink.notes,
          performedBy: request.auth.userId
        }
      });
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

    const item = await app.prisma.$transaction(async (tx) => {
      const created = await tx.spaceGeneralItem.create({
        data: {
          spaceId: space.id,
          householdId: params.householdId,
          name: input.name,
          description: input.description ?? null,
          notes: input.notes ?? null
        }
      });

      await recordGeneralItemHistory(tx, {
        householdId: params.householdId,
        spaceId: space.id,
        generalItemName: created.name,
        action: "placed",
        notes: created.notes,
        performedBy: request.auth.userId
      });

      return created;
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
      select: { id: true, name: true, notes: true }
    });

    if (!item) {
      return reply.code(404).send({ message: "General item not found." });
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.spaceGeneralItem.update({
        where: { id: item.id },
        data: { deletedAt: new Date() }
      });

      await recordGeneralItemHistory(tx, {
        householdId: params.householdId,
        spaceId: params.spaceId,
        generalItemName: item.name,
        action: "removed",
        notes: item.notes,
        performedBy: request.auth.userId
      });
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

  app.get("/v1/households/:householdId/spaces/:spaceId/history", async (request, reply) => {
    const params = spaceParamsSchema.parse(request.params);
    const query = spaceHistoryQuerySchema.parse(request.query);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const space = await getSpaceOrNull(app.prisma, params.householdId, params.spaceId);

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    const items = await app.prisma.spaceItemHistory.findMany({
      where: {
        householdId: params.householdId,
        spaceId: params.spaceId,
        ...(query.actions ? { action: { in: query.actions } } : {}),
        ...((query.since || query.until)
          ? {
              createdAt: {
                ...(query.since ? { gte: new Date(query.since) } : {}),
                ...(query.until ? { lte: new Date(query.until) } : {})
              }
            }
          : {})
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            deletedAt: true
          }
        },
        performer: {
          select: {
            id: true,
            displayName: true
          }
        },
        space: true
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      take: query.limit + 1
    });

    const page = items.slice(0, query.limit);
    const nextCursor = items.length > query.limit ? items[query.limit]?.id ?? null : null;
    const breadcrumbs = await Promise.all(page.map((entry) => getSpaceBreadcrumb(app.prisma, entry.spaceId)));

    return spaceItemHistoryListResponseSchema.parse({
      items: page.map((entry, index) => {
        const breadcrumb = breadcrumbs[index];

        return serializeSpaceItemHistory(entry, breadcrumb ? { breadcrumb } : {});
      }),
      nextCursor
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

    const householdSpaces = await app.prisma.space.findMany({
      where: { householdId: params.householdId },
      select: {
        id: true,
        parentSpaceId: true
      }
    });

    void syncSpacesToSearchIndex(app.prisma, collectDescendantIds(householdSpaces, moved.id)).catch(console.error);

    return serializeSpace(moved, { breadcrumb });
  });

  // PATCH /v1/households/:householdId/spaces/reorder
  app.patch("/v1/households/:householdId/spaces/reorder", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const { orderedIds } = reorderByOrderedIdsSchema.parse(request.body);

    if (!await ensureMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.space.findMany({
      where: { householdId: params.householdId, deletedAt: null, id: { in: orderedIds } },
      select: { id: true }
    });

    if (existing.length !== orderedIds.length) {
      return reply.code(400).send({ message: "One or more space IDs not found in this household." });
    }

    await app.prisma.$transaction(
      orderedIds.map((id, index) =>
        app.prisma.space.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return reply.send({ orderedIds });
  });
};