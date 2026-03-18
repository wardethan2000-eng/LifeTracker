import { Prisma, PrismaClient } from "@prisma/client";
import type { SearchEntityType, SearchResponse, SearchResult, SearchResultGroup } from "@lifekeeper/types";
import { validateEntryTarget } from "./entries.js";
import { getSpaceBreadcrumb } from "./spaces.js";

type SearchPrisma = PrismaClient | Prisma.TransactionClient;

type SearchPayload = {
  householdId: string;
  entityType: SearchEntityType;
  entityId: string;
  parentEntityId?: string | null;
  parentEntityName?: string | null;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  entityUrl: string;
  entityMeta?: Record<string, unknown> | null;
};

type SearchQueryOptions = {
  householdId: string;
  q: string;
  limit: number;
  include?: SearchEntityType[];
  fuzzy?: boolean;
  includeHistory?: boolean;
};

type SearchIndexRow = {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  entityUrl: string;
  parentEntityName: string | null;
  entityMeta: Record<string, unknown> | null;
};

type SearchScoredRow = SearchIndexRow & {
  exactMatch: number;
  fullTextRank: number;
  trigramScore: number;
  updatedAt: Date;
};

const SEARCH_GROUP_LABELS: Record<SearchEntityType, string> = {
  asset: "Assets",
  schedule: "Schedules",
  log: "Maintenance Logs",
  timeline_entry: "Timeline Entries",
  asset_transfer: "Transfers",
  project: "Projects",
  hobby_project: "Hobby Projects",
  service_provider: "Service Providers",
  inventory_item: "Inventory Items",
  space: "Spaces",
  comment: "Comments",
  entry: "Entries",
  invitation: "Invitations",
  hobby: "Hobbies",
  hobby_series: "Hobby Series",
  hobby_collection_item: "Hobby Collection Items",
  historical_inventory_item: "Historical"
};

const SEARCH_GROUP_ORDER: SearchEntityType[] = [
  "asset",
  "schedule",
  "log",
  "timeline_entry",
  "asset_transfer",
  "project",
  "hobby_project",
  "service_provider",
  "inventory_item",
  "space",
  "comment",
  "entry",
  "invitation",
  "hobby",
  "hobby_series",
  "hobby_collection_item",
  "historical_inventory_item"
];

const normalizeText = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

const createSearchIndexId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `csearch${timestamp}${random}`.slice(0, 30);
};

const flattenSearchValues = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized ? [normalized] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenSearchValues);
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(flattenSearchValues);
  }

  return [];
};

const joinText = (...values: Array<string | null | undefined>): string | null => {
  const joined = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => value !== null)
    .join(" ");

  return joined.length > 0 ? joined : null;
};

const excerptComment = (body: string): string => {
  const normalized = normalizeText(body) ?? "Comment";
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trimEnd()}...`;
};

const excerptEntryTitle = (title: string | null, body: string): string => {
  const normalizedTitle = normalizeText(title);

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const normalizedBody = normalizeText(body) ?? "Entry";
  return normalizedBody.length <= 100 ? normalizedBody : `${normalizedBody.slice(0, 97).trimEnd()}...`;
};

const formatTransferTitle = (assetName: string, transferType: "reassignment" | "household_transfer"): string => (
  transferType === "reassignment"
    ? `${assetName} reassigned`
    : `${assetName} transferred households`
);

const formatTransferSubtitle = (
  fromUser: string | null,
  toUser: string | null,
  toHousehold: string | null
): string | null => {
  const normalizedFromUser = normalizeText(fromUser);
  const normalizedToUser = normalizeText(toUser);
  const normalizedToHousehold = normalizeText(toHousehold);

  if (normalizedFromUser && normalizedToUser) {
    return `${normalizedFromUser} -> ${normalizedToUser}`;
  }

  return normalizedToHousehold;
};

const deleteSearchIndexEntry = async (
  prisma: SearchPrisma,
  entityType: SearchEntityType,
  entityId: string
): Promise<void> => {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndex"
    WHERE "entityType" = ${entityType}
      AND "entityId" = ${entityId}
  `;
};

const deleteAssetSearchFamily = async (prisma: SearchPrisma, assetId: string): Promise<void> => {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndex"
    WHERE ("entityType" = 'asset' AND "entityId" = ${assetId})
       OR ("parentEntityId" = ${assetId} AND "entityType" IN ('schedule', 'log', 'comment', 'timeline_entry'))
  `;
};

const upsertSearchIndexEntry = async (prisma: SearchPrisma, payload: SearchPayload): Promise<void> => {
  const title = normalizeText(payload.title);

  if (!title) {
    await deleteSearchIndexEntry(prisma, payload.entityType, payload.entityId);
    return;
  }

  const subtitle = normalizeText(payload.subtitle);
  const body = normalizeText(payload.body);
  const parentEntityName = normalizeText(payload.parentEntityName);
  const entityMeta = payload.entityMeta ? Prisma.sql`${JSON.stringify(payload.entityMeta)}::jsonb` : Prisma.sql`NULL`;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "SearchIndex" (
      "id",
      "householdId",
      "entityType",
      "entityId",
      "parentEntityId",
      "parentEntityName",
      "title",
      "subtitle",
      "body",
      "searchVector",
      "entityUrl",
      "entityMeta",
      "updatedAt"
    )
    VALUES (
      ${createSearchIndexId()},
      ${payload.householdId},
      ${payload.entityType},
      ${payload.entityId},
      ${payload.parentEntityId ?? null},
      ${parentEntityName},
      ${title},
      ${subtitle},
      ${body},
      to_tsvector('english', concat_ws(' ', ${title}, coalesce(${subtitle}, ''), coalesce(${body}, ''))),
      ${payload.entityUrl},
      ${entityMeta},
      NOW()
    )
    ON CONFLICT ("householdId", "entityType", "entityId")
    DO UPDATE SET
      "householdId" = EXCLUDED."householdId",
      "parentEntityId" = EXCLUDED."parentEntityId",
      "parentEntityName" = EXCLUDED."parentEntityName",
      "title" = EXCLUDED."title",
      "subtitle" = EXCLUDED."subtitle",
      "body" = EXCLUDED."body",
      "searchVector" = EXCLUDED."searchVector",
      "entityUrl" = EXCLUDED."entityUrl",
      "entityMeta" = EXCLUDED."entityMeta",
      "updatedAt" = NOW()
  `);
};

const syncSearchIndexPayloads = async (
  prisma: SearchPrisma,
  entityType: SearchEntityType,
  entityId: string,
  payloads: SearchPayload[]
): Promise<void> => {
  const validPayloads = payloads.filter((payload) => normalizeText(payload.title) !== null);

  if (validPayloads.length === 0) {
    await deleteSearchIndexEntry(prisma, entityType, entityId);
    return;
  }

  const householdIds = Array.from(new Set(validPayloads.map((payload) => payload.householdId)));

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "SearchIndex"
    WHERE "entityType" = ${entityType}
      AND "entityId" = ${entityId}
      AND "householdId" NOT IN (${Prisma.join(householdIds)})
  `);

  await Promise.all(validPayloads.map((payload) => upsertSearchIndexEntry(prisma, payload)));
};

const buildTsQuery = (query: string): string | null => {
  const terms = Array.from(query.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0]).filter(Boolean);

  if (terms.length === 0) {
    return null;
  }

  return terms
    .map((term, index) => index === terms.length - 1 ? `${term}:*` : term)
    .join(" & ");
};

const sortSearchRows = (rows: SearchScoredRow[]): SearchScoredRow[] => rows.sort((left, right) => {
  if (left.exactMatch !== right.exactMatch) {
    return right.exactMatch - left.exactMatch;
  }

  if (left.fullTextRank !== right.fullTextRank) {
    return right.fullTextRank - left.fullTextRank;
  }

  if (left.trigramScore !== right.trigramScore) {
    return right.trigramScore - left.trigramScore;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
});

const dedupeSearchRows = (rows: SearchScoredRow[]): SearchScoredRow[] => {
  const deduped = new Map<string, SearchScoredRow>();

  for (const row of rows) {
    const key = `${row.entityType}:${row.entityId}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, row);
      continue;
    }

    deduped.set(key, {
      ...existing,
      subtitle: existing.subtitle ?? row.subtitle,
      parentEntityName: existing.parentEntityName ?? row.parentEntityName,
      entityMeta: existing.entityMeta ?? row.entityMeta,
      exactMatch: Math.max(existing.exactMatch, row.exactMatch),
      fullTextRank: Math.max(existing.fullTextRank, row.fullTextRank),
      trigramScore: Math.max(existing.trigramScore, row.trigramScore),
      updatedAt: existing.updatedAt > row.updatedAt ? existing.updatedAt : row.updatedAt
    });
  }

  return sortSearchRows([...deduped.values()]);
};

const enrichHistoricalRows = async (
  prisma: SearchPrisma,
  rows: SearchScoredRow[]
): Promise<SearchScoredRow[]> => {
  const uniqueSpaceIds = Array.from(new Set(rows.flatMap((row) => {
    const spaceId = typeof row.entityMeta?.spaceId === "string" ? row.entityMeta.spaceId : null;
    return spaceId ? [spaceId] : [];
  })));

  const breadcrumbEntries = await Promise.all(uniqueSpaceIds.map(async (spaceId) => [spaceId, await getSpaceBreadcrumb(prisma, spaceId)] as const));
  const breadcrumbsBySpaceId = new Map(breadcrumbEntries);

  return rows.map((row) => {
    const spaceId = typeof row.entityMeta?.spaceId === "string" ? row.entityMeta.spaceId : null;
    const breadcrumb = spaceId ? breadcrumbsBySpaceId.get(spaceId) ?? [] : [];
    const breadcrumbText = breadcrumb.map((segment) => segment.name).join(" > ");

    return {
      ...row,
      subtitle: breadcrumbText ? `Was in ${breadcrumbText}` : row.subtitle,
      entityMeta: {
        ...(row.entityMeta ?? {}),
        lastSpaceBreadcrumb: breadcrumbText,
        historical: true
      }
    };
  });
};

const mapRowsToGroups = (query: string, rows: SearchIndexRow[]): SearchResponse => {
  const grouped = rows.reduce((groups, row) => {
    const existing = groups.get(row.entityType);
    const result: SearchResult = {
      entityType: row.entityType,
      entityId: row.entityId,
      title: row.title,
      subtitle: row.subtitle,
      entityUrl: row.entityUrl,
      parentEntityName: row.parentEntityName,
      entityMeta: row.entityMeta
    };

    if (existing) {
      existing.results.push(result);
    } else {
      groups.set(row.entityType, {
        entityType: row.entityType,
        label: SEARCH_GROUP_LABELS[row.entityType],
        results: [result]
      });
    }

    return groups;
  }, new Map<SearchEntityType, SearchResultGroup>());

  return {
    query,
    groups: SEARCH_GROUP_ORDER
      .map((entityType) => grouped.get(entityType))
      .filter((group): group is SearchResultGroup => group !== undefined)
  };
};

export const querySearchIndex = async (
  prisma: SearchPrisma,
  options: SearchQueryOptions
): Promise<SearchResponse> => {
  const normalizedQuery = options.q.trim();

  if (!normalizedQuery) {
    return { query: options.q, groups: [] };
  }

  const currentTypes = options.include?.filter((type) => type !== "historical_inventory_item") ?? [];
  const typeFilter = currentTypes.length > 0
    ? Prisma.sql` AND "entityType" IN (${Prisma.join(currentTypes)})`
    : Prisma.empty;
  const fuzzy = options.fuzzy ?? true;
  const includeHistorical = (options.includeHistory ?? false)
    && (options.include === undefined
      || options.include.includes("inventory_item")
      || options.include.includes("historical_inventory_item"));

  let currentRows: SearchScoredRow[] = [];

  if (normalizedQuery.length <= 2) {
    const likeQuery = `%${normalizedQuery}%`;
    const prefixQuery = `${normalizedQuery}%`;
    currentRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
      SELECT
        "entityType",
        "entityId",
        "title",
        "subtitle",
        "entityUrl",
        "parentEntityName",
        "entityMeta",
        CASE
          WHEN lower("title") = lower(${normalizedQuery})
            OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
          THEN 1
          ELSE 0
        END AS "exactMatch",
        0::double precision AS "fullTextRank",
        0::double precision AS "trigramScore",
        "updatedAt"
      FROM "SearchIndex"
      WHERE "householdId" = ${options.householdId}
        AND (
          "title" ILIKE ${likeQuery}
          OR coalesce("entityMeta"->>'shortCode', '') ILIKE ${likeQuery}
        )
        ${typeFilter}
      ORDER BY
        CASE
          WHEN lower("title") = lower(${normalizedQuery})
            OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
          THEN 0
          WHEN "title" ILIKE ${prefixQuery}
            OR coalesce("entityMeta"->>'shortCode', '') ILIKE ${prefixQuery}
          THEN 1
          ELSE 2
        END,
        "updatedAt" DESC,
        "title" ASC
      LIMIT ${options.limit}
    `);
  } else {
    const tsQuery = buildTsQuery(normalizedQuery);

    if (tsQuery) {
      const fullTextRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
        SELECT
          "entityType",
          "entityId",
          "title",
          "subtitle",
          "entityUrl",
          "parentEntityName",
          "entityMeta",
          CASE
            WHEN lower("title") = lower(${normalizedQuery})
              OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
            THEN 1
            ELSE 0
          END AS "exactMatch",
          ts_rank("searchVector", to_tsquery('english', ${tsQuery})) AS "fullTextRank",
          0::double precision AS "trigramScore",
          "updatedAt"
        FROM "SearchIndex"
        WHERE "householdId" = ${options.householdId}
          AND "searchVector" @@ to_tsquery('english', ${tsQuery})
          ${typeFilter}
        ORDER BY
          CASE
            WHEN lower("title") = lower(${normalizedQuery})
              OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
            THEN 0
            ELSE 1
          END,
          ts_rank("searchVector", to_tsquery('english', ${tsQuery})) DESC,
          "updatedAt" DESC
        LIMIT ${options.limit}
      `);

      currentRows = fullTextRows;

      if (fuzzy && fullTextRows.length < options.limit) {
        const fuzzyRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
          SELECT
            "entityType",
            "entityId",
            "title",
            "subtitle",
            "entityUrl",
            "parentEntityName",
            "entityMeta",
            CASE
              WHEN lower("title") = lower(${normalizedQuery})
                OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
              THEN 1
              ELSE 0
            END AS "exactMatch",
            0::double precision AS "fullTextRank",
            similarity("title", ${normalizedQuery}) AS "trigramScore",
            "updatedAt"
          FROM "SearchIndex"
          WHERE "householdId" = ${options.householdId}
            AND similarity("title", ${normalizedQuery}) > 0.3
            ${typeFilter}
          ORDER BY
            CASE
              WHEN lower("title") = lower(${normalizedQuery})
                OR lower(coalesce("entityMeta"->>'shortCode', '')) = lower(${normalizedQuery})
              THEN 0
              ELSE 1
            END,
            similarity("title", ${normalizedQuery}) DESC,
            "updatedAt" DESC
          LIMIT ${Math.max(options.limit * 2, options.limit)}
        `);

        currentRows = dedupeSearchRows([...fullTextRows, ...fuzzyRows]).slice(0, options.limit);
      }
    }
  }

  let historicalRows: SearchScoredRow[] = [];

  if (includeHistorical) {
    const historyTsQuery = buildTsQuery(normalizedQuery);

    if (normalizedQuery.length <= 2) {
      const likeQuery = `%${normalizedQuery}%`;
      historicalRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
        WITH latest_action AS (
          SELECT DISTINCT ON (history."inventoryItemId")
            history."inventoryItemId",
            history."action" AS "latestAction"
          FROM "SpaceItemHistory" history
          WHERE history."householdId" = ${options.householdId}
            AND history."inventoryItemId" IS NOT NULL
          ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
        ),
        latest_removal AS (
          SELECT DISTINCT ON (history."inventoryItemId")
            history."inventoryItemId",
            history."spaceId",
            history."createdAt" AS "removedAt"
          FROM "SpaceItemHistory" history
          WHERE history."householdId" = ${options.householdId}
            AND history."inventoryItemId" IS NOT NULL
            AND history."action" IN ('removed', 'moved_out')
          ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
        )
        SELECT
          'historical_inventory_item'::text AS "entityType",
          item."id" AS "entityId",
          item."name" AS "title",
          NULL::text AS "subtitle",
          CASE
            WHEN removal."spaceId" IS NOT NULL
            THEN '/inventory/spaces/' || removal."spaceId" || '?householdId=' || item."householdId" || '&tab=history'
            ELSE '/inventory?householdId=' || item."householdId"
          END AS "entityUrl",
          NULL::text AS "parentEntityName",
          jsonb_build_object(
            'historical', true,
            'inventoryItemId', item."id",
            'spaceId', removal."spaceId",
            'removedAt', removal."removedAt",
            'itemDeleted', item."deletedAt" IS NOT NULL
          ) AS "entityMeta",
          CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 1 ELSE 0 END AS "exactMatch",
          0::double precision AS "fullTextRank",
          0::double precision AS "trigramScore",
          removal."removedAt" AS "updatedAt"
        FROM latest_action action
        INNER JOIN latest_removal removal ON removal."inventoryItemId" = action."inventoryItemId"
        INNER JOIN "InventoryItem" item ON item."id" = removal."inventoryItemId"
        WHERE item."householdId" = ${options.householdId}
          AND (action."latestAction" IN ('removed', 'moved_out') OR item."deletedAt" IS NOT NULL)
          AND item."name" ILIKE ${likeQuery}
        ORDER BY
          CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 0 ELSE 1 END,
          removal."removedAt" DESC,
          item."name" ASC
        LIMIT ${options.limit}
      `);
    } else if (historyTsQuery) {
      const fullTextHistoricalRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
        WITH latest_action AS (
          SELECT DISTINCT ON (history."inventoryItemId")
            history."inventoryItemId",
            history."action" AS "latestAction"
          FROM "SpaceItemHistory" history
          WHERE history."householdId" = ${options.householdId}
            AND history."inventoryItemId" IS NOT NULL
          ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
        ),
        latest_removal AS (
          SELECT DISTINCT ON (history."inventoryItemId")
            history."inventoryItemId",
            history."spaceId",
            history."createdAt" AS "removedAt"
          FROM "SpaceItemHistory" history
          WHERE history."householdId" = ${options.householdId}
            AND history."inventoryItemId" IS NOT NULL
            AND history."action" IN ('removed', 'moved_out')
          ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
        )
        SELECT
          'historical_inventory_item'::text AS "entityType",
          item."id" AS "entityId",
          item."name" AS "title",
          NULL::text AS "subtitle",
          CASE
            WHEN removal."spaceId" IS NOT NULL
            THEN '/inventory/spaces/' || removal."spaceId" || '?householdId=' || item."householdId" || '&tab=history'
            ELSE '/inventory?householdId=' || item."householdId"
          END AS "entityUrl",
          NULL::text AS "parentEntityName",
          jsonb_build_object(
            'historical', true,
            'inventoryItemId', item."id",
            'spaceId', removal."spaceId",
            'removedAt', removal."removedAt",
            'itemDeleted', item."deletedAt" IS NOT NULL
          ) AS "entityMeta",
          CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 1 ELSE 0 END AS "exactMatch",
          ts_rank(to_tsvector('english', item."name"), to_tsquery('english', ${historyTsQuery})) AS "fullTextRank",
          0::double precision AS "trigramScore",
          removal."removedAt" AS "updatedAt"
        FROM latest_action action
        INNER JOIN latest_removal removal ON removal."inventoryItemId" = action."inventoryItemId"
        INNER JOIN "InventoryItem" item ON item."id" = removal."inventoryItemId"
        WHERE item."householdId" = ${options.householdId}
          AND (action."latestAction" IN ('removed', 'moved_out') OR item."deletedAt" IS NOT NULL)
          AND to_tsvector('english', item."name") @@ to_tsquery('english', ${historyTsQuery})
        ORDER BY
          CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 0 ELSE 1 END,
          ts_rank(to_tsvector('english', item."name"), to_tsquery('english', ${historyTsQuery})) DESC,
          removal."removedAt" DESC
        LIMIT ${options.limit}
      `);

      historicalRows = fullTextHistoricalRows;

      if (fuzzy && fullTextHistoricalRows.length < options.limit) {
        const fuzzyHistoricalRows = await prisma.$queryRaw<SearchScoredRow[]>(Prisma.sql`
          WITH latest_action AS (
            SELECT DISTINCT ON (history."inventoryItemId")
              history."inventoryItemId",
              history."action" AS "latestAction"
            FROM "SpaceItemHistory" history
            WHERE history."householdId" = ${options.householdId}
              AND history."inventoryItemId" IS NOT NULL
            ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
          ),
          latest_removal AS (
            SELECT DISTINCT ON (history."inventoryItemId")
              history."inventoryItemId",
              history."spaceId",
              history."createdAt" AS "removedAt"
            FROM "SpaceItemHistory" history
            WHERE history."householdId" = ${options.householdId}
              AND history."inventoryItemId" IS NOT NULL
              AND history."action" IN ('removed', 'moved_out')
            ORDER BY history."inventoryItemId", history."createdAt" DESC, history."id" DESC
          )
          SELECT
            'historical_inventory_item'::text AS "entityType",
            item."id" AS "entityId",
            item."name" AS "title",
            NULL::text AS "subtitle",
            CASE
              WHEN removal."spaceId" IS NOT NULL
              THEN '/inventory/spaces/' || removal."spaceId" || '?householdId=' || item."householdId" || '&tab=history'
              ELSE '/inventory?householdId=' || item."householdId"
            END AS "entityUrl",
            NULL::text AS "parentEntityName",
            jsonb_build_object(
              'historical', true,
              'inventoryItemId', item."id",
              'spaceId', removal."spaceId",
              'removedAt', removal."removedAt",
              'itemDeleted', item."deletedAt" IS NOT NULL
            ) AS "entityMeta",
            CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 1 ELSE 0 END AS "exactMatch",
            0::double precision AS "fullTextRank",
            similarity(item."name", ${normalizedQuery}) AS "trigramScore",
            removal."removedAt" AS "updatedAt"
          FROM latest_action action
          INNER JOIN latest_removal removal ON removal."inventoryItemId" = action."inventoryItemId"
          INNER JOIN "InventoryItem" item ON item."id" = removal."inventoryItemId"
          WHERE item."householdId" = ${options.householdId}
            AND (action."latestAction" IN ('removed', 'moved_out') OR item."deletedAt" IS NOT NULL)
            AND similarity(item."name", ${normalizedQuery}) > 0.3
          ORDER BY
            CASE WHEN lower(item."name") = lower(${normalizedQuery}) THEN 0 ELSE 1 END,
            similarity(item."name", ${normalizedQuery}) DESC,
            removal."removedAt" DESC
          LIMIT ${Math.max(options.limit * 2, options.limit)}
        `);

        historicalRows = dedupeSearchRows([...fullTextHistoricalRows, ...fuzzyHistoricalRows]).slice(0, options.limit);
      }
    }

    historicalRows = await enrichHistoricalRows(prisma, historicalRows);
  }

  return mapRowsToGroups(options.q, [...currentRows, ...historicalRows]);
};

export const syncSpaceToSearchIndex = async (prisma: SearchPrisma, spaceId: string): Promise<void> => {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      householdId: true,
      name: true,
      shortCode: true,
      type: true,
      description: true,
      notes: true,
      deletedAt: true,
      parent: {
        select: {
          name: true
        }
      }
    }
  });

  if (!space || space.deletedAt) {
    await deleteSearchIndexEntry(prisma, "space", spaceId);
    return;
  }

  const breadcrumb = await getSpaceBreadcrumb(prisma, space.id);
  const breadcrumbText = breadcrumb.map((segment) => segment.name).join(" > ");

  await syncSearchIndexPayloads(prisma, "space", space.id, [{
    householdId: space.householdId,
    entityType: "space",
    entityId: space.id,
    title: space.name,
    subtitle: space.shortCode,
    body: joinText(space.description, space.notes, space.type, breadcrumbText),
    entityUrl: `/inventory/spaces/${space.id}?householdId=${space.householdId}`,
    entityMeta: {
      type: space.type,
      shortCode: space.shortCode,
      parentSpaceName: space.parent?.name ?? null,
      breadcrumb: breadcrumbText
    }
  }]);
};

export const syncAssetToSearchIndex = async (prisma: SearchPrisma, assetId: string): Promise<void> => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      householdId: true,
      name: true,
      manufacturer: true,
      model: true,
      serialNumber: true,
      assetTag: true,
      description: true,
      customFields: true,
      deletedAt: true,
      isArchived: true,
      category: true,
      hobbyLinks: {
        select: {
          hobby: {
            select: {
              name: true,
              hobbyType: true
            }
          },
          role: true,
          notes: true
        }
      }
    }
  });

  if (!asset || asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "asset", assetId);
    return;
  }

  const customFieldText = flattenSearchValues(asset.customFields).join(" ");
  const hobbyText = asset.hobbyLinks.flatMap((link) => [
    link.hobby.name,
    link.hobby.hobbyType,
    link.role,
    link.notes
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "asset", asset.id, [{
    householdId: asset.householdId,
    entityType: "asset",
    entityId: asset.id,
    title: asset.name,
    subtitle: joinText(asset.manufacturer, asset.model),
    body: joinText(asset.description, asset.serialNumber, asset.assetTag, customFieldText, hobbyText),
    entityUrl: `/assets/${asset.id}`,
    entityMeta: {
      category: asset.category,
      isArchived: asset.isArchived
    }
  }]);
};

export const syncScheduleToSearchIndex = async (prisma: SearchPrisma, scheduleId: string): Promise<void> => {
  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      name: true,
      description: true,
      nextDueAt: true,
      isActive: true,
      deletedAt: true,
      asset: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      }
    }
  });

  if (!schedule || schedule.deletedAt || schedule.asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "schedule", scheduleId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "schedule", schedule.id, [{
    householdId: schedule.asset.householdId,
    entityType: "schedule",
    entityId: schedule.id,
    parentEntityId: schedule.asset.id,
    parentEntityName: schedule.asset.name,
    title: schedule.name,
    body: schedule.description,
    entityUrl: `/assets/${schedule.asset.id}?tab=maintenance`,
    entityMeta: {
      nextDueAt: schedule.nextDueAt?.toISOString() ?? null,
      isActive: schedule.isActive
    }
  }]);
};

export const syncLogToSearchIndex = async (prisma: SearchPrisma, logId: string): Promise<void> => {
  const log = await prisma.maintenanceLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      title: true,
      notes: true,
      completedAt: true,
      deletedAt: true,
      asset: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      }
    }
  });

  if (!log || log.deletedAt || log.asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "log", logId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "log", log.id, [{
    householdId: log.asset.householdId,
    entityType: "log",
    entityId: log.id,
    parentEntityId: log.asset.id,
    parentEntityName: log.asset.name,
    title: log.title,
    subtitle: log.completedAt.toISOString(),
    body: log.notes,
    entityUrl: `/assets/${log.asset.id}?tab=maintenance`,
    entityMeta: {
      completedAt: log.completedAt.toISOString()
    }
  }]);
};

export const syncProjectToSearchIndex = async (prisma: SearchPrisma, projectId: string): Promise<void> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      householdId: true,
      name: true,
      description: true,
      status: true,
      deletedAt: true,
      parentProjectId: true,
      parentProject: {
        select: { name: true }
      },
      phases: {
        where: { deletedAt: null },
        select: {
          name: true,
          description: true,
          status: true,
          supplies: {
            where: { deletedAt: null },
            select: {
              name: true,
              description: true,
              supplier: true,
              notes: true
            }
          }
        }
      },
      tasks: {
        where: { deletedAt: null },
        select: {
          title: true,
          description: true,
          status: true,
          taskType: true
        }
      },
      noteEntries: {
        where: { deletedAt: null },
        select: {
          title: true,
          body: true,
          category: true,
          attachmentName: true,
          url: true
        }
      },
      expenses: {
        where: { deletedAt: null },
        select: {
          description: true,
          category: true,
          notes: true
        }
      },
      hobbyLinks: {
        select: {
          hobby: {
            select: {
              name: true,
              hobbyType: true,
              status: true
            }
          },
          notes: true
        }
      }
    }
  });

  if (!project || project.deletedAt) {
    await deleteSearchIndexEntry(prisma, "project", projectId);
    return;
  }

  const phaseText = project.phases.flatMap((phase) => [
    phase.name,
    phase.description,
    phase.status,
    ...phase.supplies.flatMap((supply) => [supply.name, supply.description, supply.supplier, supply.notes])
  ]).filter(Boolean).join(" ");
  const taskText = project.tasks.flatMap((task) => [task.title, task.description, task.status, task.taskType]).filter(Boolean).join(" ");
  const noteText = project.noteEntries.flatMap((note) => [note.title, note.body, note.category, note.attachmentName, note.url]).filter(Boolean).join(" ");
  const expenseText = project.expenses.flatMap((expense) => [expense.description, expense.category, expense.notes]).filter(Boolean).join(" ");
  const hobbyText = project.hobbyLinks.flatMap((link) => [
    link.hobby.name,
    link.hobby.hobbyType,
    link.hobby.status,
    link.notes
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "project", project.id, [{
    householdId: project.householdId,
    entityType: "project",
    entityId: project.id,
    parentEntityId: project.parentProjectId ?? null,
    parentEntityName: project.parentProject?.name ?? null,
    title: project.name,
    subtitle: project.status,
    body: joinText(project.description, phaseText, taskText, noteText, expenseText, hobbyText),
    entityUrl: `/projects/${project.id}?householdId=${project.householdId}`,
    entityMeta: {
      status: project.status
    }
  }]);
};

export const syncServiceProviderToSearchIndex = async (prisma: SearchPrisma, providerId: string): Promise<void> => {
  const provider = await prisma.serviceProvider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      householdId: true,
      name: true,
      specialty: true,
      email: true,
      phone: true,
      address: true,
      notes: true
    }
  });

  if (!provider) {
    await deleteSearchIndexEntry(prisma, "service_provider", providerId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "service_provider", provider.id, [{
    householdId: provider.householdId,
    entityType: "service_provider",
    entityId: provider.id,
    title: provider.name,
    subtitle: provider.specialty,
    body: joinText(provider.email, provider.phone, provider.address, provider.notes),
    entityUrl: `/service-providers?householdId=${provider.householdId}&highlight=${provider.id}`,
    entityMeta: {
      specialty: provider.specialty,
      email: provider.email,
      phone: provider.phone
    }
  }]);
};

export const syncInventoryItemToSearchIndex = async (prisma: SearchPrisma, itemId: string): Promise<void> => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      householdId: true,
      name: true,
      partNumber: true,
      description: true,
      manufacturer: true,
      category: true,
      quantityOnHand: true,
      unit: true,
      deletedAt: true,
      hobbyLinks: {
        select: {
          hobby: {
            select: {
              name: true,
              hobbyType: true
            }
          },
          notes: true
        }
      }
    }
  });

  if (!item || item.deletedAt) {
    await deleteSearchIndexEntry(prisma, "inventory_item", itemId);
    return;
  }

  const hobbyText = item.hobbyLinks.flatMap((link) => [
    link.hobby.name,
    link.hobby.hobbyType,
    link.notes
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "inventory_item", item.id, [{
    householdId: item.householdId,
    entityType: "inventory_item",
    entityId: item.id,
    title: item.name,
    subtitle: joinText(item.manufacturer, item.partNumber),
    body: joinText(item.description, item.partNumber, item.manufacturer, item.category, hobbyText),
    entityUrl: `/inventory?householdId=${item.householdId}&highlight=${item.id}`,
    entityMeta: {
      category: item.category,
      quantityOnHand: item.quantityOnHand,
      unit: item.unit
    }
  }]);
};

export const syncCommentToSearchIndex = async (prisma: SearchPrisma, commentId: string): Promise<void> => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      householdId: true,
      entityType: true,
      entityId: true,
      body: true,
      deletedAt: true,
      updatedAt: true,
      asset: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      },
      project: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      },
      hobby: {
        select: {
          id: true,
          name: true,
          householdId: true
        }
      },
      inventoryItem: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      }
    }
  });

  if (!comment || comment.deletedAt) {
    await deleteSearchIndexEntry(prisma, "comment", commentId);
    return;
  }

  const target = (() => {
    switch (comment.entityType) {
      case "asset":
        if (!comment.asset || comment.asset.deletedAt) {
          return null;
        }

        const asset = comment.asset;

        return {
          householdId: asset.householdId,
          parentEntityId: asset.id,
          parentEntityName: asset.name,
          entityUrl: `/assets/${asset.id}?tab=comments`
        };
      case "project":
        if (!comment.project || comment.project.deletedAt) {
          return null;
        }

        const project = comment.project;

        return {
          householdId: project.householdId,
          parentEntityId: project.id,
          parentEntityName: project.name,
          entityUrl: `/projects/${project.id}?householdId=${project.householdId}`
        };
      case "hobby":
        if (!comment.hobby) {
          return null;
        }

        const hobby = comment.hobby;

        return {
          householdId: hobby.householdId,
          parentEntityId: hobby.id,
          parentEntityName: hobby.name,
          entityUrl: `/hobbies/${hobby.id}?householdId=${hobby.householdId}`
        };
      case "inventory_item":
        if (!comment.inventoryItem || comment.inventoryItem.deletedAt) {
          return null;
        }

        const inventoryItem = comment.inventoryItem;

        return {
          householdId: inventoryItem.householdId,
          parentEntityId: inventoryItem.id,
          parentEntityName: inventoryItem.name,
          entityUrl: `/inventory?householdId=${inventoryItem.householdId}&highlight=${inventoryItem.id}`
        };
      default:
        return null;
    }
  })();

  if (!target) {
    await deleteSearchIndexEntry(prisma, "comment", commentId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "comment", comment.id, [{
    householdId: target.householdId,
    entityType: "comment",
    entityId: comment.id,
    parentEntityId: target.parentEntityId,
    parentEntityName: target.parentEntityName,
    title: excerptComment(comment.body),
    body: comment.body,
    entityUrl: target.entityUrl,
    entityMeta: {
      entityType: comment.entityType,
      updatedAt: comment.updatedAt.toISOString()
    }
  }]);
};

export const syncEntryToSearchIndex = async (prisma: SearchPrisma, entryId: string): Promise<void> => {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      householdId: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      entryType: true,
      tags: true,
      measurements: true,
      flags: {
        select: { flag: true },
        orderBy: [{ createdAt: "asc" }, { flag: "asc" }]
      }
    }
  });

  if (!entry) {
    await deleteSearchIndexEntry(prisma, "entry", entryId);
    return;
  }

  const target = await validateEntryTarget(prisma, entry.householdId, entry.entityType, entry.entityId);

  if (target.status !== "ok") {
    await deleteSearchIndexEntry(prisma, "entry", entryId);
    return;
  }

  const measurements = Array.isArray(entry.measurements)
    ? entry.measurements
    : [];
  const measurementText = measurements
    .flatMap((measurement) => {
      if (!measurement || typeof measurement !== "object" || Array.isArray(measurement)) {
        return [];
      }

      const value = measurement as Record<string, unknown>;
      return [value.name, value.value, value.unit].flatMap(flattenSearchValues);
    })
    .join(" ");
  const flags = entry.flags.map((flag) => flag.flag);
  const tags = Array.isArray(entry.tags) ? entry.tags.flatMap(flattenSearchValues) : [];

  await syncSearchIndexPayloads(prisma, "entry", entry.id, [{
    householdId: entry.householdId,
    entityType: "entry",
    entityId: entry.id,
    parentEntityId: target.context.entityId,
    parentEntityName: target.context.label,
    title: excerptEntryTitle(entry.title, entry.body),
    subtitle: entry.entryType,
    body: joinText(entry.body, measurementText, tags.join(" ")),
    entityUrl: target.context.entityUrl,
    entityMeta: {
      entryType: entry.entryType,
      flags,
      tags,
      parentEntityType: target.context.entityType,
      parentEntityId: target.context.entityId
    }
  }]);
};

export const syncInvitationToSearchIndex = async (prisma: SearchPrisma, invitationId: string): Promise<void> => {
  const invitation = await prisma.householdInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      householdId: true,
      email: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      household: {
        select: {
          name: true
        }
      },
      invitedBy: {
        select: {
          displayName: true
        }
      },
      acceptedBy: {
        select: {
          displayName: true
        }
      }
    }
  });

  if (!invitation) {
    await deleteSearchIndexEntry(prisma, "invitation", invitationId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "invitation", invitation.id, [{
    householdId: invitation.householdId,
    entityType: "invitation",
    entityId: invitation.id,
    title: invitation.email,
    subtitle: invitation.status,
    body: joinText(
      invitation.household.name,
      invitation.invitedBy.displayName ? `Invited by ${invitation.invitedBy.displayName}` : null,
      invitation.acceptedBy?.displayName ? `Accepted by ${invitation.acceptedBy.displayName}` : null,
      `Expires ${invitation.expiresAt.toISOString()}`,
      invitation.acceptedAt ? `Accepted ${invitation.acceptedAt.toISOString()}` : null
    ),
    entityUrl: `/invitations?householdId=${invitation.householdId}`,
    entityMeta: {
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null
    }
  }]);
};

export const syncTimelineEntryToSearchIndex = async (prisma: SearchPrisma, entryId: string): Promise<void> => {
  const entry = await prisma.assetTimelineEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      title: true,
      description: true,
      entryDate: true,
      category: true,
      cost: true,
      asset: {
        select: {
          id: true,
          name: true,
          householdId: true,
          deletedAt: true
        }
      }
    }
  });

  if (!entry || entry.asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "timeline_entry", entryId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "timeline_entry", entry.id, [{
    householdId: entry.asset.householdId,
    entityType: "timeline_entry",
    entityId: entry.id,
    parentEntityId: entry.asset.id,
    parentEntityName: entry.asset.name,
    title: entry.title,
    subtitle: entry.entryDate.toISOString(),
    body: entry.description,
    entityUrl: `/assets/${entry.asset.id}?tab=history`,
    entityMeta: {
      category: entry.category,
      entryDate: entry.entryDate.toISOString(),
      cost: entry.cost ?? null
    }
  }]);
};

export const syncAssetTransferToSearchIndex = async (prisma: SearchPrisma, transferId: string): Promise<void> => {
  const transfer = await prisma.assetTransfer.findUnique({
    where: { id: transferId },
    select: {
      id: true,
      transferType: true,
      reason: true,
      notes: true,
      transferredAt: true,
      fromHouseholdId: true,
      toHouseholdId: true,
      fromUserId: true,
      toUserId: true,
      initiatedById: true,
      asset: {
        select: {
          id: true,
          name: true
        }
      },
      fromHousehold: {
        select: {
          id: true,
          name: true
        }
      },
      toHousehold: {
        select: {
          id: true,
          name: true
        }
      },
      fromUser: {
        select: {
          id: true,
          displayName: true
        }
      },
      toUser: {
        select: {
          id: true,
          displayName: true
        }
      },
      initiatedBy: {
        select: {
          id: true,
          displayName: true
        }
      }
    }
  });

  if (!transfer) {
    await deleteSearchIndexEntry(prisma, "asset_transfer", transferId);
    return;
  }

  const body = joinText(
    transfer.reason,
    transfer.notes,
    transfer.fromUser.displayName ? `From user ${transfer.fromUser.displayName}` : null,
    transfer.toUser.displayName ? `To user ${transfer.toUser.displayName}` : null,
    `From household ${transfer.fromHousehold.name}`,
    transfer.toHousehold?.name ? `To household ${transfer.toHousehold.name}` : null,
    transfer.initiatedBy.displayName ? `Initiated by ${transfer.initiatedBy.displayName}` : null
  );

  const payloads: SearchPayload[] = [
    {
      householdId: transfer.fromHouseholdId,
      entityType: "asset_transfer",
      entityId: transfer.id,
      parentEntityId: transfer.asset.id,
      parentEntityName: transfer.asset.name,
      title: formatTransferTitle(transfer.asset.name, transfer.transferType),
      subtitle: formatTransferSubtitle(
        transfer.fromUser.displayName,
        transfer.toUser.displayName,
        transfer.toHousehold?.name ?? null
      ),
      body,
      entityUrl: `/activity?householdId=${transfer.fromHouseholdId}`,
      entityMeta: {
        transferType: transfer.transferType,
        transferredAt: transfer.transferredAt.toISOString(),
        fromHouseholdId: transfer.fromHouseholdId,
        toHouseholdId: transfer.toHouseholdId,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        initiatedById: transfer.initiatedById
      }
    }
  ];

  if (transfer.toHouseholdId && transfer.toHouseholdId !== transfer.fromHouseholdId) {
    payloads.push({
      householdId: transfer.toHouseholdId,
      entityType: "asset_transfer",
      entityId: transfer.id,
      parentEntityId: transfer.asset.id,
      parentEntityName: transfer.asset.name,
      title: formatTransferTitle(transfer.asset.name, transfer.transferType),
      subtitle: formatTransferSubtitle(
        transfer.fromUser.displayName,
        transfer.toUser.displayName,
        transfer.toHousehold?.name ?? null
      ),
      body,
      entityUrl: `/activity?householdId=${transfer.toHouseholdId}`,
      entityMeta: {
        transferType: transfer.transferType,
        transferredAt: transfer.transferredAt.toISOString(),
        fromHouseholdId: transfer.fromHouseholdId,
        toHouseholdId: transfer.toHouseholdId,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        initiatedById: transfer.initiatedById
      }
    });
  }

  await syncSearchIndexPayloads(prisma, "asset_transfer", transfer.id, payloads);
};

export const syncAssetFamilyToSearchIndex = async (prisma: SearchPrisma, assetId: string): Promise<void> => {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      deletedAt: true,
      schedules: { select: { id: true } },
      logs: { select: { id: true } },
      comments: { select: { id: true } },
      timelineEntries: { select: { id: true } }
    }
  });

  if (!asset || asset.deletedAt) {
    await deleteAssetSearchFamily(prisma, assetId);
    return;
  }

  await syncAssetToSearchIndex(prisma, assetId);

  await Promise.all([
    ...asset.schedules.map((schedule) => syncScheduleToSearchIndex(prisma, schedule.id)),
    ...asset.logs.map((log) => syncLogToSearchIndex(prisma, log.id)),
    ...asset.comments.map((comment) => syncCommentToSearchIndex(prisma, comment.id)),
    ...asset.timelineEntries.map((entry) => syncTimelineEntryToSearchIndex(prisma, entry.id))
  ]);
};

export const syncHobbyToSearchIndex = async (prisma: SearchPrisma, hobbyId: string): Promise<void> => {
  const hobby = await prisma.hobby.findUnique({
    where: { id: hobbyId },
    select: {
      id: true,
      householdId: true,
      name: true,
      description: true,
      activityMode: true,
      hobbyType: true,
      status: true,
      notes: true,
      customFields: true,
      assetLinks: {
        select: {
          asset: {
            select: {
              name: true,
              category: true
            }
          },
          role: true,
          notes: true
        }
      },
      inventoryLinks: {
        select: {
          inventoryItem: {
            select: {
              name: true,
              category: true,
              manufacturer: true
            }
          },
          notes: true
        }
      },
      projectLinks: {
        select: {
          project: {
            select: {
              name: true,
              status: true
            }
          },
          notes: true
        }
      }
    }
  });

  if (!hobby) {
    await deleteSearchIndexEntry(prisma, "hobby", hobbyId);
    return;
  }

  const customFieldText = flattenSearchValues(hobby.customFields).join(" ");
  const assetText = hobby.assetLinks.flatMap((link) => [
    link.asset.name,
    link.asset.category,
    link.role,
    link.notes
  ]).filter(Boolean).join(" ");
  const inventoryText = hobby.inventoryLinks.flatMap((link) => [
    link.inventoryItem.name,
    link.inventoryItem.category,
    link.inventoryItem.manufacturer,
    link.notes
  ]).filter(Boolean).join(" ");
  const projectText = hobby.projectLinks.flatMap((link) => [
    link.project.name,
    link.project.status,
    link.notes
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "hobby", hobby.id, [{
    householdId: hobby.householdId,
    entityType: "hobby",
    entityId: hobby.id,
    title: hobby.name,
    subtitle: hobby.hobbyType ?? hobby.activityMode,
    body: joinText(hobby.description, hobby.hobbyType, hobby.activityMode, hobby.notes, customFieldText, assetText, inventoryText, projectText),
    entityUrl: `/hobbies/${hobby.id}?householdId=${hobby.householdId}`,
    entityMeta: {
      status: hobby.status,
      hobbyType: hobby.hobbyType,
      activityMode: hobby.activityMode
    }
  }]);
};

export const syncHobbyProjectToSearchIndex = async (prisma: SearchPrisma, hobbyProjectId: string): Promise<void> => {
  const project = await prisma.hobbyProject.findUnique({
    where: { id: hobbyProjectId },
    select: {
      id: true,
      householdId: true,
      hobbyId: true,
      name: true,
      description: true,
      status: true,
      difficulty: true,
      notes: true,
      tags: true,
      hobby: {
        select: {
          name: true,
          hobbyType: true,
        }
      },
      milestones: {
        select: {
          name: true,
          description: true,
          notes: true,
          status: true,
        }
      },
      workLogs: {
        select: {
          description: true,
          notes: true,
        }
      },
      inventoryItems: {
        select: {
          notes: true,
          inventoryItem: {
            select: {
              name: true,
              category: true,
              manufacturer: true,
            }
          }
        }
      }
    }
  });

  if (!project) {
    await deleteSearchIndexEntry(prisma, "hobby_project", hobbyProjectId);
    return;
  }

  const tagText = Array.isArray(project.tags) ? project.tags.flatMap(flattenSearchValues).join(" ") : "";
  const milestoneText = project.milestones.flatMap((milestone) => [
    milestone.name,
    milestone.description,
    milestone.notes,
    milestone.status,
  ]).filter(Boolean).join(" ");
  const workLogText = project.workLogs.flatMap((workLog) => [workLog.description, workLog.notes]).filter(Boolean).join(" ");
  const inventoryText = project.inventoryItems.flatMap((link) => [
    link.inventoryItem.name,
    link.inventoryItem.category,
    link.inventoryItem.manufacturer,
    link.notes,
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "hobby_project", project.id, [{
    householdId: project.householdId,
    entityType: "hobby_project",
    entityId: project.id,
    parentEntityId: project.hobbyId,
    parentEntityName: project.hobby.name,
    title: project.name,
    subtitle: joinText(project.hobby.name, project.status),
    body: joinText(
      project.description,
      project.notes,
      project.difficulty,
      project.hobby.hobbyType,
      tagText,
      milestoneText,
      workLogText,
      inventoryText
    ),
    entityUrl: `/hobbies/${project.hobbyId}?householdId=${project.householdId}&projectId=${project.id}`,
    entityMeta: {
      status: project.status,
      hobbyId: project.hobbyId,
      difficulty: project.difficulty,
    }
  }]);
};

export const syncHobbySeriesToSearchIndex = async (prisma: SearchPrisma, seriesId: string): Promise<void> => {
  const series = await prisma.hobbySeries.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      hobbyId: true,
      householdId: true,
      name: true,
      description: true,
      status: true,
      batchCount: true,
      tags: true,
      notes: true,
      coverImageUrl: true,
      hobby: {
        select: {
          name: true,
          activityMode: true,
          hobbyType: true
        }
      },
      bestBatchSession: {
        select: { name: true }
      },
      sessions: {
        select: {
          name: true,
          recipe: { select: { name: true } }
        }
      }
    }
  });

  if (!series) {
    await deleteSearchIndexEntry(prisma, "hobby_series", seriesId);
    return;
  }

  const tagText = Array.isArray(series.tags) ? series.tags.flatMap(flattenSearchValues).join(" ") : "";
  const sessionText = series.sessions.flatMap((session) => [session.name, session.recipe?.name]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "hobby_series", series.id, [{
    householdId: series.householdId,
    entityType: "hobby_series",
    entityId: series.id,
    parentEntityId: series.hobbyId,
    parentEntityName: series.hobby.name,
    title: series.name,
    subtitle: series.bestBatchSession?.name ?? series.status,
    body: joinText(
      series.description,
      series.notes,
      series.hobby.name,
      series.hobby.activityMode,
      series.hobby.hobbyType,
      tagText,
      sessionText
    ),
    entityUrl: `/hobbies/${series.hobbyId}?householdId=${series.householdId}&seriesId=${series.id}`,
    entityMeta: {
      status: series.status,
      batchCount: series.batchCount,
      hobbyId: series.hobbyId,
      hobbyName: series.hobby.name,
      coverImageUrl: series.coverImageUrl
    }
  }]);
};

export const syncHobbyCollectionItemToSearchIndex = async (prisma: SearchPrisma, itemId: string): Promise<void> => {
  const item = await prisma.hobbyCollectionItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      hobbyId: true,
      householdId: true,
      name: true,
      description: true,
      status: true,
      location: true,
      customFields: true,
      quantity: true,
      tags: true,
      notes: true,
      parentItemId: true,
      hobby: {
        select: {
          name: true,
          hobbyType: true,
        },
      },
      parentItem: {
        select: {
          name: true,
        },
      },
      childItems: {
        select: {
          name: true,
        },
      },
      sessions: {
        select: {
          name: true,
          notes: true,
        },
      },
    },
  });

  if (!item) {
    await deleteSearchIndexEntry(prisma, "hobby_collection_item", itemId);
    return;
  }

  const tagText = Array.isArray(item.tags) ? item.tags.flatMap(flattenSearchValues).join(" ") : "";
  const customFieldText = flattenSearchValues(item.customFields).join(" ");
  const childText = item.childItems.map((child) => child.name).join(" ");
  const sessionText = item.sessions.flatMap((session) => [session.name, session.notes]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "hobby_collection_item", item.id, [{
    householdId: item.householdId,
    entityType: "hobby_collection_item",
    entityId: item.id,
    parentEntityId: item.hobbyId,
    parentEntityName: item.hobby.name,
    title: item.name,
    subtitle: joinText(item.hobby.name, item.location, item.status),
    body: joinText(
      item.description,
      item.notes,
      item.hobby.hobbyType,
      item.location,
      item.parentItem?.name,
      tagText,
      customFieldText,
      childText,
      sessionText,
      String(item.quantity)
    ),
    entityUrl: `/hobbies/${item.hobbyId}?householdId=${item.householdId}&collectionItemId=${item.id}`,
    entityMeta: {
      status: item.status,
      hobbyId: item.hobbyId,
      location: item.location,
      quantity: item.quantity,
      parentItemId: item.parentItemId,
    },
  }]);
};

export const rebuildSearchIndex = async (prisma: SearchPrisma, householdId: string): Promise<void> => {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndex"
    WHERE "householdId" = ${householdId}
  `;

  const [assets, schedules, logs, timelineEntries, assetTransfers, projects, providers, inventoryItems, spaces, comments, invitations, entries, hobbySeries, hobbyCollectionItems] = await Promise.all([
    prisma.asset.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.maintenanceSchedule.findMany({
      where: { asset: { householdId } },
      select: { id: true }
    }),
    prisma.maintenanceLog.findMany({
      where: { asset: { householdId } },
      select: { id: true }
    }),
    prisma.assetTimelineEntry.findMany({
      where: { asset: { householdId } },
      select: { id: true }
    }),
    prisma.assetTransfer.findMany({
      where: {
        OR: [
          { fromHouseholdId: householdId },
          { toHouseholdId: householdId }
        ]
      },
      select: { id: true }
    }),
    prisma.project.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.serviceProvider.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.inventoryItem.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.space.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.comment.findMany({
      where: {
        asset: { householdId },
        deletedAt: null
      },
      select: { id: true }
    }),
    prisma.householdInvitation.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.entry.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.hobbySeries.findMany({
      where: { householdId },
      select: { id: true }
    }),
    prisma.hobbyCollectionItem.findMany({
      where: { householdId },
      select: { id: true }
    })
  ]);

  for (const asset of assets) {
    await syncAssetToSearchIndex(prisma, asset.id);
  }

  for (const schedule of schedules) {
    await syncScheduleToSearchIndex(prisma, schedule.id);
  }

  for (const log of logs) {
    await syncLogToSearchIndex(prisma, log.id);
  }

  for (const entry of timelineEntries) {
    await syncTimelineEntryToSearchIndex(prisma, entry.id);
  }

  for (const transfer of assetTransfers) {
    await syncAssetTransferToSearchIndex(prisma, transfer.id);
  }

  for (const project of projects) {
    await syncProjectToSearchIndex(prisma, project.id);
  }

  for (const provider of providers) {
    await syncServiceProviderToSearchIndex(prisma, provider.id);
  }

  for (const item of inventoryItems) {
    await syncInventoryItemToSearchIndex(prisma, item.id);
  }

  for (const space of spaces) {
    await syncSpaceToSearchIndex(prisma, space.id);
  }

  for (const comment of comments) {
    await syncCommentToSearchIndex(prisma, comment.id);
  }

  for (const entry of entries) {
    await syncEntryToSearchIndex(prisma, entry.id);
  }

  for (const invitation of invitations) {
    await syncInvitationToSearchIndex(prisma, invitation.id);
  }

  const hobbies = await prisma.hobby.findMany({
    where: { householdId },
    select: { id: true }
  });

  for (const hobby of hobbies) {
    await syncHobbyToSearchIndex(prisma, hobby.id);
  }

  for (const series of hobbySeries) {
    await syncHobbySeriesToSearchIndex(prisma, series.id);
  }

  for (const item of hobbyCollectionItems) {
    await syncHobbyCollectionItemToSearchIndex(prisma, item.id);
  }
};

export const removeSearchIndexEntry = deleteSearchIndexEntry;