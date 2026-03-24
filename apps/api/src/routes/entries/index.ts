import { Prisma } from "@prisma/client";
import {
  actionableEntryGroupListSchema,
  createEntrySchema,
  entryListQuerySchema,
  entryListResponseSchema,
  entrySchema,
  entrySurfaceQuerySchema,
  updateEntrySchema,
  type EntryEntityType,
  type EntryFlag,
  type EntryListQuery,
  type EntrySortBy
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import {
  createEntryEntityKey,
  resolveEntryEntityContexts,
  validateEntryTarget,
  type EntryEntityContext
} from "../../lib/entries.js";
import { logAndEmit } from "../../lib/activity-log.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import { sanitizeRichTextBody } from "../../lib/sanitize-html.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import {
  entryResponseInclude,
  toActionableEntryGroupResponse,
  toEntryResponse,
  type EntryResponseRecord
} from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncEntryToSearchIndex } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { hobbyParamsSchema, householdParamsSchema, projectParamsSchema } from "../../lib/schemas.js";

const entryParamsSchema = householdParamsSchema.extend({
  entryId: z.string().cuid()
});

const hobbySessionParamsSchema = hobbyParamsSchema.extend({
  sessionId: z.string().cuid()
});

const hobbyCollectionItemParamsSchema = hobbyParamsSchema.extend({
  collectionItemId: z.string().cuid()
});

const assetParamsSchema = householdParamsSchema.extend({
  assetId: z.string().cuid()
});

const inventoryParamsSchema = householdParamsSchema.extend({
  itemId: z.string().cuid()
});

const scopedCreateEntrySchema = createEntrySchema.extend({
  entityType: createEntrySchema.shape.entityType.optional(),
  entityId: createEntrySchema.shape.entityId.optional()
});

type TargetFilter = {
  entityType: EntryEntityType;
  entityId: string;
};

type EntryIdRow = { id: string };

type EntryCursorRow = {
  id: string;
  pinnedRank: number;
  entryDate: Date;
  createdAt: Date;
  sortTitle: string;
};

type ScopedCreateEntryInput = Omit<z.infer<typeof createEntrySchema>, "entityType" | "entityId"> & {
  entityType?: EntryEntityType | undefined;
  entityId?: string | undefined;
};

const PINNED_RANK_SQL = Prisma.sql`(
  CASE WHEN EXISTS (
    SELECT 1
    FROM "EntryFlagEntry" AS pinned_flag
    WHERE pinned_flag."entryId" = e.id
      AND pinned_flag."flag" = 'pinned'
  ) THEN 1 ELSE 0 END
)`;

const buildEntryFilterClauses = (
  householdId: string,
  query: EntryListQuery,
  target?: TargetFilter
): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = [Prisma.sql`e."householdId" = ${householdId}`];

  const entityType = target?.entityType ?? query.entityType;
  const entityId = target?.entityId ?? query.entityId;

  if (entityType && entityId) {
    conditions.push(Prisma.sql`e."entityType"::text = ${entityType}`);
    conditions.push(Prisma.sql`e."entityId" = ${entityId}`);
  }

  if (query.entryType) {
    conditions.push(Prisma.sql`e."entryType"::text = ${query.entryType}`);
  }

  if (query.createdById) {
    conditions.push(Prisma.sql`e."createdById" = ${query.createdById}`);
  }

  if (query.startDate) {
    conditions.push(Prisma.sql`e."entryDate" >= ${new Date(query.startDate)}`);
  }

  if (query.endDate) {
    conditions.push(Prisma.sql`e."entryDate" <= ${new Date(query.endDate)}`);
  }

  if (query.hasMeasurements) {
    conditions.push(Prisma.sql`jsonb_array_length(e."measurements") > 0`);
  }

  if (query.measurementName) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(e."measurements") AS measurement
        WHERE lower(measurement->>'name') = ${query.measurementName.toLowerCase()}
      )
    `);
  }

  if (query.tags && query.tags.length > 0) {
    const lowerTags = query.tags.map((tag) => tag.toLowerCase());
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(e."tags") AS tag(value)
        WHERE lower(tag.value) IN (${Prisma.join(lowerTags)})
      )
    `);
  }

  if (query.search) {
    const likeQuery = `%${query.search}%`;
    conditions.push(Prisma.sql`
      (
        to_tsvector('english', concat_ws(' ', coalesce(e."title", ''), e."body"))
          @@ plainto_tsquery('english', ${query.search})
        OR e."title" ILIKE ${likeQuery}
        OR e."body" ILIKE ${likeQuery}
      )
    `);
  }

  if (query.flags && query.flags.length > 0) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1
        FROM "EntryFlagEntry" AS included_flag
        WHERE included_flag."entryId" = e.id
          AND included_flag."flag"::text IN (${Prisma.join(query.flags)})
      )
    `);
  }

  if (query.excludeFlags && query.excludeFlags.length > 0) {
    conditions.push(Prisma.sql`
      NOT EXISTS (
        SELECT 1
        FROM "EntryFlagEntry" AS excluded_flag
        WHERE excluded_flag."entryId" = e.id
          AND excluded_flag."flag"::text IN (${Prisma.join(query.excludeFlags)})
      )
    `);
  }

  if (query.folderId !== undefined) {
    conditions.push(Prisma.sql`e."folderId" = ${query.folderId}`);
  }

  const archivedExplicitlyIncluded = query.flags?.includes("archived") ?? false;
  if (!query.includeArchived && !archivedExplicitlyIncluded) {
    conditions.push(Prisma.sql`
      NOT EXISTS (
        SELECT 1
        FROM "EntryFlagEntry" AS archived_flag
        WHERE archived_flag."entryId" = e.id
          AND archived_flag."flag" = 'archived'
      )
    `);
  }

  return conditions;
};

const buildFilteredEntriesQuery = (
  householdId: string,
  query: EntryListQuery,
  target?: TargetFilter
) => {
  const clauses = buildEntryFilterClauses(householdId, query, target);

  return Prisma.sql`
    SELECT
      e.id,
      ${PINNED_RANK_SQL} AS "pinnedRank",
      e."entryDate",
      e."createdAt",
      lower(coalesce(e."title", '')) AS "sortTitle"
    FROM "Entry" AS e
    WHERE ${Prisma.join(clauses, " AND ")}
  `;
};

const buildOrderByClause = (sortBy: EntrySortBy): Prisma.Sql => {
  switch (sortBy) {
    case "createdAt":
      return Prisma.sql`ORDER BY "pinnedRank" DESC, "createdAt" DESC, id DESC`;
    case "title":
      return Prisma.sql`ORDER BY "pinnedRank" DESC, "sortTitle" ASC, id ASC`;
    case "entryDate":
    default:
      return Prisma.sql`ORDER BY "pinnedRank" DESC, "entryDate" DESC, id DESC`;
  }
};

const buildCursorClause = (sortBy: EntrySortBy, cursor: EntryCursorRow): Prisma.Sql => {
  switch (sortBy) {
    case "createdAt":
      return Prisma.sql`
        AND (
          "pinnedRank" < ${cursor.pinnedRank}
          OR (
            "pinnedRank" = ${cursor.pinnedRank}
            AND (
              "createdAt" < ${cursor.createdAt}
              OR ("createdAt" = ${cursor.createdAt} AND id < ${cursor.id})
            )
          )
        )
      `;
    case "title":
      return Prisma.sql`
        AND (
          "pinnedRank" < ${cursor.pinnedRank}
          OR (
            "pinnedRank" = ${cursor.pinnedRank}
            AND (
              "sortTitle" > ${cursor.sortTitle}
              OR ("sortTitle" = ${cursor.sortTitle} AND id > ${cursor.id})
            )
          )
        )
      `;
    case "entryDate":
    default:
      return Prisma.sql`
        AND (
          "pinnedRank" < ${cursor.pinnedRank}
          OR (
            "pinnedRank" = ${cursor.pinnedRank}
            AND (
              "entryDate" < ${cursor.entryDate}
              OR ("entryDate" = ${cursor.entryDate} AND id < ${cursor.id})
            )
          )
        )
      `;
  }
};

const getCursorRow = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  householdId: string,
  query: EntryListQuery,
  target?: TargetFilter
): Promise<EntryCursorRow | null> => {
  if (!query.cursor) {
    return null;
  }

  const filteredQuery = buildFilteredEntriesQuery(householdId, query, target);
  const rows = await prisma.$queryRaw<EntryCursorRow[]>(Prisma.sql`
    WITH filtered AS (${filteredQuery})
    SELECT id, "pinnedRank", "entryDate", "createdAt", "sortTitle"
    FROM filtered
    WHERE id = ${query.cursor}
    LIMIT 1
  `);

  return rows[0] ?? null;
};

const listEntryIds = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  householdId: string,
  query: EntryListQuery,
  target?: TargetFilter
): Promise<{ ids: string[]; nextCursor: string | null }> => {
  const filteredQuery = buildFilteredEntriesQuery(householdId, query, target);
  const cursorRow = await getCursorRow(prisma, householdId, query, target);

  if (query.cursor && !cursorRow) {
    throw new Error("INVALID_CURSOR");
  }

  const cursorClause = cursorRow ? buildCursorClause(query.sortBy, cursorRow) : Prisma.empty;
  const orderByClause = buildOrderByClause(query.sortBy);
  const rows = await prisma.$queryRaw<EntryIdRow[]>(Prisma.sql`
    WITH filtered AS (${filteredQuery})
    SELECT id
    FROM filtered
    WHERE 1 = 1
    ${cursorClause}
    ${orderByClause}
    LIMIT ${query.limit + 1}
  `);

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    ids: items.map((row) => row.id),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null
  };
};

const serializeEntries = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  entries: EntryResponseRecord[]
) => {
  const resolvedEntities = await resolveEntryEntityContexts(
    prisma,
    entries[0]?.householdId ?? "",
    entries.map((entry) => ({ entityType: entry.entityType, entityId: entry.entityId }))
  );

  return entries.flatMap((entry) => {
    const resolved = resolvedEntities.get(createEntryEntityKey(entry.entityType, entry.entityId));
    return resolved ? [toEntryResponse(entry, resolved)] : [];
  });
};

const fetchOrderedEntries = async (
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  householdId: string,
  ids: string[]
) => {
  if (ids.length === 0) {
    return [] as EntryResponseRecord[];
  }

  const entries = await prisma.entry.findMany({
    where: {
      householdId,
      id: { in: ids }
    },
    include: entryResponseInclude
  });

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
};

const resolveAliasTarget = async (
  app: Parameters<FastifyPluginAsync>[0],
  householdId: string,
  target: TargetFilter,
  parentId?: string
): Promise<EntryEntityContext | null> => {
  switch (target.entityType) {
    case "hobby": {
      const hobby = await app.prisma.hobby.findFirst({
        where: { id: target.entityId, householdId },
        select: { id: true }
      });
      if (!hobby) return null;
      break;
    }
    case "hobby_session": {
      const session = await app.prisma.hobbySession.findFirst({
        where: {
          id: target.entityId,
          ...(parentId ? { hobbyId: parentId } : {}),
          hobby: { householdId }
        },
        select: { id: true }
      });
      if (!session) return null;
      break;
    }
    case "project": {
      const project = await app.prisma.project.findFirst({
        where: { id: target.entityId, householdId, deletedAt: null },
        select: { id: true }
      });
      if (!project) return null;
      break;
    }
    case "asset": {
      const asset = await app.prisma.asset.findFirst({
        where: { id: target.entityId, householdId, deletedAt: null },
        select: { id: true }
      });
      if (!asset) return null;
      break;
    }
    case "inventory_item": {
      const item = await app.prisma.inventoryItem.findFirst({
        where: { id: target.entityId, householdId, deletedAt: null },
        select: { id: true }
      });
      if (!item) return null;
      break;
    }
    default:
      return null;
  }

  const resolved = await validateEntryTarget(app.prisma, householdId, target.entityType, target.entityId);
  return resolved.status === "ok" ? resolved.context : null;
};

const buildEntryCreateData = (
  householdId: string,
  userId: string,
  input: ScopedCreateEntryInput,
  target: TargetFilter
): Prisma.EntryCreateInput => ({
  household: { connect: { id: householdId } },
  createdBy: { connect: { id: userId } },
  title: input.title ?? null,
  body: (input.bodyFormat ?? "plain_text") === "rich_text" ? sanitizeRichTextBody(input.body) : input.body,
  bodyFormat: input.bodyFormat ?? "plain_text",
  entryDate: new Date(input.entryDate),
  entityType: target.entityType,
  entityId: target.entityId,
  entryType: input.entryType,
  measurements: toInputJsonValue(input.measurements),
  tags: toInputJsonValue(input.tags),
  attachmentUrl: input.attachmentUrl ?? null,
  attachmentName: input.attachmentName ?? null,
  sourceType: input.sourceType ?? null,
  sourceId: input.sourceId ?? null,
  ...(input.folderId ? { folder: { connect: { id: input.folderId } } } : {}),
  ...(input.flags.length > 0
    ? {
        flags: {
          create: input.flags.map((flag) => ({ flag }))
        }
      }
    : {})
});

const buildEntryUpdateData = (input: z.infer<typeof updateEntrySchema>, existingBodyFormat: string): Prisma.EntryUpdateInput => {
  const data: Prisma.EntryUpdateInput = {};

  if (input.title !== undefined) data.title = input.title ?? null;
  const effectiveFormat = input.bodyFormat ?? existingBodyFormat;
  if (input.body !== undefined) {
    data.body = effectiveFormat === "rich_text" ? sanitizeRichTextBody(input.body) : input.body;
  }
  if (input.bodyFormat !== undefined) data.bodyFormat = input.bodyFormat;
  if (input.entryDate !== undefined) data.entryDate = new Date(input.entryDate);
  if (input.entryType !== undefined) data.entryType = input.entryType;
  if (input.measurements !== undefined) data.measurements = toInputJsonValue(input.measurements);
  if (input.tags !== undefined) data.tags = toInputJsonValue(input.tags);
  if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl ?? null;
  if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName ?? null;
  if (input.folderId !== undefined) {
    data.folder = input.folderId ? { connect: { id: input.folderId } } : { disconnect: true };
  }

  return data;
};

const createEntry = async (
  app: Parameters<FastifyPluginAsync>[0],
  householdId: string,
  userId: string,
  input: ScopedCreateEntryInput,
  targetOverride?: TargetFilter
) => {
  const target: TargetFilter = targetOverride ?? (() => {
    if (!input.entityType || !input.entityId) {
      throw new Error("MISSING_ENTRY_TARGET");
    }

    return {
      entityType: input.entityType,
      entityId: input.entityId
    };
  })();

  const validation = await validateEntryTarget(app.prisma, householdId, target.entityType, target.entityId);

  if (validation.status === "unsupported") {
    return { error: { code: 400, message: validation.message } } as const;
  }

  if (validation.status === "missing") {
    return { error: { code: 404, message: "Target entity not found." } } as const;
  }

  const entry = await app.prisma.entry.create({
    data: buildEntryCreateData(householdId, userId, input, target),
    include: entryResponseInclude
  });

    await logAndEmit(app.prisma, userId, {
    householdId: householdId,
    entityType: "entry",
    entityId: entry.id,
    action: "entry.created",
    metadata: {
        entryType: entry.entryType,
        entityType: target.entityType,
        entityId: target.entityId,
        entityLabel: validation.context.label
      },
    payload: {
        entryType: entry.entryType,
        entityType: target.entityType,
        entityId: target.entityId,
        entityLabel: validation.context.label,
        flags: entry.flags.map((flag) => flag.flag)
      },
  });

  return { entry: toEntryResponse(entry, validation.context) } as const;
};

const isParentSurfaceEntity = (entityType: EntryEntityType) => (
  entityType === "hobby_session" || entityType === "project_phase"
);

export const entryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/entries", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query);
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/entries", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const input = createEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const result = await createEntry(app, householdId, userId, input);
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/entries/surface", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const query = entrySurfaceQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await validateEntryTarget(app.prisma, householdId, query.entityType, query.entityId);
    if (target.status === "unsupported") {
      return reply.code(400).send({ message: target.message });
    }
    if (target.status === "missing") {
      return notFound(reply, "Target entity");
    }

    const scopedTargets: Prisma.EntryWhereInput[] = [{
      entityType: query.entityType,
      entityId: query.entityId
    }];

    if (
      isParentSurfaceEntity(query.entityType)
      && target.context.parentEntityType
      && target.context.parentEntityId
    ) {
      scopedTargets.push({
        entityType: target.context.parentEntityType,
        entityId: target.context.parentEntityId
      });
    }

    const entries = await app.prisma.entry.findMany({
      where: {
        householdId,
        OR: scopedTargets,
        flags: {
          some: {
            flag: { in: ["tip", "warning"] }
          }
        },
        NOT: {
          flags: {
            some: { flag: "archived" }
          }
        }
      },
      include: entryResponseInclude,
      take: 50
    });

    const items = await serializeEntries(app.prisma, entries);
    const ranked = items
      .sort((left, right) => {
        const leftWarning = left.flags.includes("warning") ? 1 : 0;
        const rightWarning = right.flags.includes("warning") ? 1 : 0;
        if (leftWarning !== rightWarning) {
          return rightWarning - leftWarning;
        }

        const leftTip = left.flags.includes("tip") ? 1 : 0;
        const rightTip = right.flags.includes("tip") ? 1 : 0;
        if (leftTip !== rightTip) {
          return rightTip - leftTip;
        }

        return right.entryDate.localeCompare(left.entryDate);
      })
      .slice(0, 20);

    return ranked.map((entry) => entrySchema.parse(entry));
  });

  app.get("/v1/households/:householdId/entries/actionable", async (request, reply) => {
    const { householdId } = householdParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const entries = await app.prisma.entry.findMany({
      where: {
        householdId,
        flags: {
          some: { flag: "actionable" }
        },
        AND: [
          {
            NOT: {
              flags: {
                some: { flag: "resolved" }
              }
            }
          },
          {
            NOT: {
              flags: {
                some: { flag: "archived" }
              }
            }
          }
        ]
      },
      include: entryResponseInclude,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }]
    });

    const items = await serializeEntries(app.prisma, entries);
    const grouped = items.reduce((map, entry) => {
      const existing = map.get(entry.entityType) ?? [];
      existing.push(entry);
      map.set(entry.entityType, existing);
      return map;
    }, new Map<EntryEntityType, ReturnType<typeof toEntryResponse>[]>());

    return actionableEntryGroupListSchema.parse(
      Array.from(grouped.entries())
        .map(([entityType, groupItems]) => toActionableEntryGroupResponse({ entityType, items: groupItems }))
        .sort((left, right) => left.entityType.localeCompare(right.entityType))
    );
  });

  app.get("/v1/households/:householdId/entries/:entryId", async (request, reply) => {
    const { householdId, entryId } = entryParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const entry = await app.prisma.entry.findFirst({
      where: { id: entryId, householdId },
      include: entryResponseInclude
    });

    if (!entry) {
      return notFound(reply, "Entry");
    }

    const resolved = await validateEntryTarget(app.prisma, householdId, entry.entityType, entry.entityId);
    if (resolved.status !== "ok") {
      return notFound(reply, "Entry target");
    }

    return toEntryResponse(entry, resolved.context);
  });

  app.patch("/v1/households/:householdId/entries/:entryId", async (request, reply) => {
    const { householdId, entryId } = entryParamsSchema.parse(request.params);
    const input = updateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.entry.findFirst({
      where: { id: entryId, householdId },
      include: {
        flags: {
          select: { flag: true }
        }
      }
    });

    if (!existing) {
      return notFound(reply, "Entry");
    }

    const resolved = await validateEntryTarget(app.prisma, householdId, existing.entityType, existing.entityId);
    if (resolved.status !== "ok") {
      return notFound(reply, "Entry target");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const currentFlags = new Set(existing.flags.map((flag) => flag.flag));
      const nextFlags = new Set(input.flags ?? Array.from(currentFlags));
      const removedFlags = Array.from(currentFlags).filter((flag) => !nextFlags.has(flag));
      const addedFlags = Array.from(nextFlags).filter((flag) => !currentFlags.has(flag));

      const entry = await tx.entry.update({
        where: { id: existing.id },
        data: buildEntryUpdateData(input, existing.bodyFormat),
        include: entryResponseInclude
      });

      if (removedFlags.length > 0) {
        await tx.entryFlagEntry.deleteMany({
          where: {
            entryId: existing.id,
            flag: { in: removedFlags }
          }
        });
      }

      if (addedFlags.length > 0) {
        await tx.entryFlagEntry.createMany({
          data: addedFlags.map((flag) => ({
            entryId: existing.id,
            flag
          }))
        });
      }

      return tx.entry.findUniqueOrThrow({
        where: { id: existing.id },
        include: entryResponseInclude
      });
    });

        await logAndEmit(app.prisma, userId, {
      householdId: householdId,
      entityType: "entry",
      entityId: updated.id,
      action: "entry.updated",
      metadata: {
          entryType: updated.entryType,
          targetEntityType: updated.entityType,
          targetEntityId: updated.entityId,
          entityLabel: resolved.context.label
        },
      payload: {
          entryType: updated.entryType,
          targetEntityType: updated.entityType,
          targetEntityId: updated.entityId,
          entityLabel: resolved.context.label,
          flags: updated.flags.map((flag) => flag.flag)
        },
    });

    return toEntryResponse(updated, resolved.context);
  });

  app.delete("/v1/households/:householdId/entries/:entryId", async (request, reply) => {
    const { householdId, entryId } = entryParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const existing = await app.prisma.entry.findFirst({
      where: { id: entryId, householdId },
      include: entryResponseInclude
    });

    if (!existing) {
      return notFound(reply, "Entry");
    }

    const resolved = await validateEntryTarget(app.prisma, householdId, existing.entityType, existing.entityId);

    await app.prisma.entry.delete({
      where: { id: existing.id }
    });

        await logAndEmit(app.prisma, userId, {
      householdId: householdId,
      entityType: "entry",
      entityId: existing.id,
      action: "entry.deleted",
      metadata: {
          entryType: existing.entryType,
          targetEntityType: existing.entityType,
          targetEntityId: existing.entityId,
          entityLabel: resolved.status === "ok" ? resolved.context.label : null
        },
    });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/hobbies/:hobbyId/entries", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby", entityId: hobbyId });
    if (!target) {
      return notFound(reply, "Hobby");
    }

    if ((query.entityType && query.entityType !== "hobby") || (query.entityId && query.entityId !== hobbyId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "hobby", entityId: hobbyId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/hobbies/:hobbyId/entries", async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "hobby") || (input.entityId && input.entityId !== hobbyId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby", entityId: hobbyId });
    if (!target) {
      return notFound(reply, "Hobby");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "hobby", entityId: hobbyId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/hobbies/:hobbyId/sessions/:sessionId/entries", async (request, reply) => {
    const { householdId, hobbyId, sessionId } = hobbySessionParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby_session", entityId: sessionId }, hobbyId);
    if (!target) {
      return notFound(reply, "Hobby session");
    }

    if ((query.entityType && query.entityType !== "hobby_session") || (query.entityId && query.entityId !== sessionId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "hobby_session", entityId: sessionId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/hobbies/:hobbyId/sessions/:sessionId/entries", async (request, reply) => {
    const { householdId, hobbyId, sessionId } = hobbySessionParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "hobby_session") || (input.entityId && input.entityId !== sessionId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby_session", entityId: sessionId }, hobbyId);
    if (!target) {
      return notFound(reply, "Hobby session");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "hobby_session", entityId: sessionId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/hobbies/:hobbyId/collection/:collectionItemId/entries", async (request, reply) => {
    const { householdId, hobbyId, collectionItemId } = hobbyCollectionItemParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby_collection_item", entityId: collectionItemId }, hobbyId);
    if (!target) {
      return notFound(reply, "Hobby collection item");
    }

    if ((query.entityType && query.entityType !== "hobby_collection_item") || (query.entityId && query.entityId !== collectionItemId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "hobby_collection_item", entityId: collectionItemId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/hobbies/:hobbyId/collection/:collectionItemId/entries", async (request, reply) => {
    const { householdId, hobbyId, collectionItemId } = hobbyCollectionItemParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "hobby_collection_item") || (input.entityId && input.entityId !== collectionItemId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "hobby_collection_item", entityId: collectionItemId }, hobbyId);
    if (!target) {
      return notFound(reply, "Hobby collection item");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "hobby_collection_item", entityId: collectionItemId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/projects/:projectId/entries", async (request, reply) => {
    const { householdId, projectId } = projectParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "project", entityId: projectId });
    if (!target) {
      return notFound(reply, "Project");
    }

    if ((query.entityType && query.entityType !== "project") || (query.entityId && query.entityId !== projectId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "project", entityId: projectId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/projects/:projectId/entries", async (request, reply) => {
    const { householdId, projectId } = projectParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "project") || (input.entityId && input.entityId !== projectId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "project", entityId: projectId });
    if (!target) {
      return notFound(reply, "Project");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "project", entityId: projectId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/assets/:assetId/entries", async (request, reply) => {
    const { householdId, assetId } = assetParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "asset", entityId: assetId });
    if (!target) {
      return notFound(reply, "Asset");
    }

    if ((query.entityType && query.entityType !== "asset") || (query.entityId && query.entityId !== assetId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "asset", entityId: assetId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/assets/:assetId/entries", async (request, reply) => {
    const { householdId, assetId } = assetParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "asset") || (input.entityId && input.entityId !== assetId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "asset", entityId: assetId });
    if (!target) {
      return notFound(reply, "Asset");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "asset", entityId: assetId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });

  app.get("/v1/households/:householdId/inventory/:itemId/entries", async (request, reply) => {
    const { householdId, itemId } = inventoryParamsSchema.parse(request.params);
    const query = entryListQuerySchema.parse(request.query);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "inventory_item", entityId: itemId });
    if (!target) {
      return notFound(reply, "Inventory item");
    }

    if ((query.entityType && query.entityType !== "inventory_item") || (query.entityId && query.entityId !== itemId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    try {
      const { ids, nextCursor } = await listEntryIds(app.prisma, householdId, query, { entityType: "inventory_item", entityId: itemId });
      const records = await fetchOrderedEntries(app.prisma, householdId, ids);
      const items = await serializeEntries(app.prisma, records);
      return entryListResponseSchema.parse({ items, nextCursor });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_CURSOR") {
        return badRequest(reply, "Invalid entry cursor.");
      }

      throw error;
    }
  });

  app.post("/v1/households/:householdId/inventory/:itemId/entries", async (request, reply) => {
    const { householdId, itemId } = inventoryParamsSchema.parse(request.params);
    const input = scopedCreateEntrySchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await requireHouseholdMembership(app.prisma, householdId, userId, reply)) {
      return;
    }

    if ((input.entityType && input.entityType !== "inventory_item") || (input.entityId && input.entityId !== itemId)) {
      return badRequest(reply, "entityType/entityId cannot conflict with the route target.");
    }

    const target = await resolveAliasTarget(app, householdId, { entityType: "inventory_item", entityId: itemId });
    if (!target) {
      return notFound(reply, "Inventory item");
    }

    const result = await createEntry(app, householdId, userId, input, { entityType: "inventory_item", entityId: itemId });
    if ("error" in result) {
      return reply.code(result.error.code).send({ message: result.error.message });
    }

    return reply.code(201).send(result.entry);
  });
};