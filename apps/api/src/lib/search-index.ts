import { Prisma, PrismaClient } from "@prisma/client";
import type { SearchEntityType, SearchResponse, SearchResult, SearchResultGroup } from "@lifekeeper/types";

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
  types?: SearchEntityType[];
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

const SEARCH_GROUP_LABELS: Record<SearchEntityType, string> = {
  asset: "Assets",
  schedule: "Schedules",
  log: "Maintenance Logs",
  timeline_entry: "Timeline Entries",
  asset_transfer: "Transfers",
  project: "Projects",
  service_provider: "Service Providers",
  inventory_item: "Inventory Items",
  comment: "Comments",
  hobby: "Hobbies"
};

const SEARCH_GROUP_ORDER: SearchEntityType[] = [
  "asset",
  "schedule",
  "log",
  "timeline_entry",
  "asset_transfer",
  "project",
  "service_provider",
  "inventory_item",
  "comment",
  "hobby"
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

  const typeFilter = options.types && options.types.length > 0
    ? Prisma.sql` AND "entityType" IN (${Prisma.join(options.types)})`
    : Prisma.empty;

  if (normalizedQuery.length <= 2) {
    const likeQuery = `%${normalizedQuery}%`;
    const prefixQuery = `${normalizedQuery}%`;
    const rows = await prisma.$queryRaw<SearchIndexRow[]>(Prisma.sql`
      SELECT
        "entityType",
        "entityId",
        "title",
        "subtitle",
        "entityUrl",
        "parentEntityName",
        "entityMeta"
      FROM "SearchIndex"
      WHERE "householdId" = ${options.householdId}
        AND "title" ILIKE ${likeQuery}
        ${typeFilter}
      ORDER BY
        CASE WHEN "title" ILIKE ${prefixQuery} THEN 0 ELSE 1 END,
        "updatedAt" DESC,
        "title" ASC
      LIMIT ${options.limit}
    `);

    return mapRowsToGroups(options.q, rows);
  }

  const tsQuery = buildTsQuery(normalizedQuery);

  if (!tsQuery) {
    return { query: options.q, groups: [] };
  }

  const rows = await prisma.$queryRaw<SearchIndexRow[]>(Prisma.sql`
    SELECT
      "entityType",
      "entityId",
      "title",
      "subtitle",
      "entityUrl",
      "parentEntityName",
      "entityMeta"
    FROM "SearchIndex"
    WHERE "householdId" = ${options.householdId}
      AND "searchVector" @@ to_tsquery('english', ${tsQuery})
      ${typeFilter}
    ORDER BY ts_rank("searchVector", to_tsquery('english', ${tsQuery})) DESC, "updatedAt" DESC
    LIMIT ${options.limit}
  `);

  return mapRowsToGroups(options.q, rows);
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
      category: true
    }
  });

  if (!asset || asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "asset", assetId);
    return;
  }

  const customFieldText = flattenSearchValues(asset.customFields).join(" ");
  await syncSearchIndexPayloads(prisma, "asset", asset.id, [{
    householdId: asset.householdId,
    entityType: "asset",
    entityId: asset.id,
    title: asset.name,
    subtitle: joinText(asset.manufacturer, asset.model),
    body: joinText(asset.description, asset.serialNumber, asset.assetTag, customFieldText),
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

  if (!schedule || schedule.asset.deletedAt) {
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

  if (!log || log.asset.deletedAt) {
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
    where: { id: projectId },
    select: {
      id: true,
      householdId: true,
      name: true,
      description: true,
      status: true,
      parentProjectId: true,
      parentProject: {
        select: { name: true }
      },
      phases: {
        select: {
          name: true,
          description: true,
          supplies: {
            select: {
              name: true,
              description: true,
              supplier: true,
              notes: true
            }
          }
        }
      }
    }
  });

  if (!project) {
    await deleteSearchIndexEntry(prisma, "project", projectId);
    return;
  }

  const phaseText = project.phases.flatMap((phase) => [
    phase.name,
    phase.description,
    ...phase.supplies.flatMap((supply) => [supply.name, supply.description, supply.supplier, supply.notes])
  ]).filter(Boolean).join(" ");

  await syncSearchIndexPayloads(prisma, "project", project.id, [{
    householdId: project.householdId,
    entityType: "project",
    entityId: project.id,
    parentEntityId: project.parentProjectId ?? null,
    parentEntityName: project.parentProject?.name ?? null,
    title: project.name,
    subtitle: project.status,
    body: joinText(project.description, phaseText),
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
      unit: true
    }
  });

  if (!item) {
    await deleteSearchIndexEntry(prisma, "inventory_item", itemId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "inventory_item", item.id, [{
    householdId: item.householdId,
    entityType: "inventory_item",
    entityId: item.id,
    title: item.name,
    subtitle: joinText(item.manufacturer, item.partNumber),
    body: joinText(item.description, item.partNumber, item.manufacturer, item.category),
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
      }
    }
  });

  if (!comment || comment.deletedAt || comment.asset.deletedAt) {
    await deleteSearchIndexEntry(prisma, "comment", commentId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "comment", comment.id, [{
    householdId: comment.asset.householdId,
    entityType: "comment",
    entityId: comment.id,
    parentEntityId: comment.asset.id,
    parentEntityName: comment.asset.name,
    title: excerptComment(comment.body),
    body: comment.body,
    entityUrl: `/assets/${comment.asset.id}?tab=comments`,
    entityMeta: {
      updatedAt: comment.updatedAt.toISOString()
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
      hobbyType: true,
      status: true
    }
  });

  if (!hobby) {
    await deleteSearchIndexEntry(prisma, "hobby", hobbyId);
    return;
  }

  await syncSearchIndexPayloads(prisma, "hobby", hobby.id, [{
    householdId: hobby.householdId,
    entityType: "hobby",
    entityId: hobby.id,
    title: hobby.name,
    subtitle: hobby.hobbyType ?? hobby.status,
    body: joinText(hobby.description, hobby.hobbyType),
    entityUrl: `/hobbies/${hobby.id}?householdId=${hobby.householdId}`,
    entityMeta: {
      status: hobby.status,
      hobbyType: hobby.hobbyType
    }
  }]);
};

export const rebuildSearchIndex = async (prisma: SearchPrisma, householdId: string): Promise<void> => {
  await prisma.$executeRaw`
    DELETE FROM "SearchIndex"
    WHERE "householdId" = ${householdId}
  `;

  const [assets, schedules, logs, timelineEntries, assetTransfers, projects, providers, inventoryItems, comments] = await Promise.all([
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
    prisma.comment.findMany({
      where: {
        asset: { householdId },
        deletedAt: null
      },
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

  for (const comment of comments) {
    await syncCommentToSearchIndex(prisma, comment.id);
  }

  const hobbies = await prisma.hobby.findMany({
    where: { householdId },
    select: { id: true }
  });

  for (const hobby of hobbies) {
    await syncHobbyToSearchIndex(prisma, hobby.id);
  }
};

export const removeSearchIndexEntry = deleteSearchIndexEntry;