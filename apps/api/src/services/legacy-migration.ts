import type { PrismaClient } from "@prisma/client";
import {
  LEGACY_ENTRY_SOURCE_TYPES,
  buildAssetEntryPayload,
  buildHobbyLogEntryTags,
  buildProjectEntryPayload,
  mapHobbyLogTypeToEntryType
} from "@lifekeeper/utils";
import { syncEntryToSearchIndex } from "../lib/search-index.js";

const BATCH_SIZE = 100;

type Summary = {
  scanned: number;
  created: number;
  skipped: number;
};

const findExistingSourceIds = async (
  prisma: PrismaClient,
  sourceType: string,
  sourceIds: string[]
): Promise<Set<string>> => {
  if (sourceIds.length === 0) {
    return new Set();
  }

  const existing = await prisma.entry.findMany({
    where: { sourceType, sourceId: { in: sourceIds } },
    select: { sourceId: true }
  });

  return new Set(existing.flatMap((e) => (e.sourceId ? [e.sourceId] : [])));
};

const migrateAssetTimelineEntries = async (
  prisma: PrismaClient,
  householdId: string
): Promise<Summary> => {
  const where = { asset: { householdId } };
  const total = await prisma.assetTimelineEntry.count({ where });
  const summary: Summary = { scanned: 0, created: 0, skipped: 0 };
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.assetTimelineEntry.findMany({
      where,
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: {
        asset: { select: { householdId: true } },
        createdBy: { select: { id: true } }
      }
    });

    if (batch.length === 0) break;

    const existingIds = await findExistingSourceIds(
      prisma,
      LEGACY_ENTRY_SOURCE_TYPES.assetTimelineEntry,
      batch.map((e) => e.id)
    );

    for (const entry of batch) {
      summary.scanned += 1;

      if (existingIds.has(entry.id)) {
        summary.skipped += 1;
        continue;
      }

      const details = buildAssetEntryPayload({
        title: entry.title,
        description: entry.description,
        category: entry.category,
        cost: entry.cost,
        vendor: entry.vendor,
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter((t): t is string => typeof t === "string")
          : []
      });

      const created = await prisma.entry.create({
        data: {
          householdId: entry.asset.householdId,
          createdById: entry.createdBy.id,
          title: entry.title,
          body: details.body,
          entryDate: entry.entryDate,
          entityType: "asset",
          entityId: entry.assetId,
          entryType: details.entryType,
          measurements: details.measurements,
          tags: details.tags,
          attachmentName: details.attachmentName,
          sourceType: LEGACY_ENTRY_SOURCE_TYPES.assetTimelineEntry,
          sourceId: entry.id,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        }
      });

      await syncEntryToSearchIndex(prisma, created.id);
      summary.created += 1;
    }

    cursor = batch[batch.length - 1]?.id;
  }

  return summary;
};

const migrateProjectNotes = async (
  prisma: PrismaClient,
  householdId: string
): Promise<Summary> => {
  const where = { deletedAt: null, project: { householdId } };
  const total = await prisma.projectNote.count({ where });
  const summary: Summary = { scanned: 0, created: 0, skipped: 0 };
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.projectNote.findMany({
      where,
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: {
        project: { select: { householdId: true } }
      }
    });

    if (batch.length === 0) break;

    const existingIds = await findExistingSourceIds(
      prisma,
      LEGACY_ENTRY_SOURCE_TYPES.projectNote,
      batch.map((n) => n.id)
    );

    for (const note of batch) {
      summary.scanned += 1;

      if (existingIds.has(note.id)) {
        summary.skipped += 1;
        continue;
      }

      const details = buildProjectEntryPayload({
        title: note.title,
        body: note.body,
        category: note.category,
        url: note.url,
        isPinned: note.isPinned
      });

      const created = await prisma.entry.create({
        data: {
          householdId: note.project.householdId,
          createdById: note.createdById,
          title: note.title,
          body: details.body,
          entryDate: note.createdAt,
          entityType: note.phaseId ? "project_phase" : "project",
          entityId: note.phaseId ?? note.projectId,
          entryType: details.entryType,
          tags: details.tags,
          attachmentUrl: details.attachmentUrl,
          attachmentName: details.attachmentName,
          sourceType: LEGACY_ENTRY_SOURCE_TYPES.projectNote,
          sourceId: note.id,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          ...(details.flags.length > 0
            ? { flags: { create: details.flags.map((flag) => ({ flag })) } }
            : {})
        }
      });

      await syncEntryToSearchIndex(prisma, created.id);
      summary.created += 1;
    }

    cursor = batch[batch.length - 1]?.id;
  }

  return summary;
};

const migrateHobbyLogs = async (
  prisma: PrismaClient,
  householdId: string
): Promise<Summary> => {
  const where = { hobby: { householdId } };
  const total = await prisma.hobbyLog.count({ where });
  const summary: Summary = { scanned: 0, created: 0, skipped: 0 };
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.hobbyLog.findMany({
      where,
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: {
        hobby: { select: { householdId: true, createdById: true } },
        session: { select: { id: true } }
      }
    });

    if (batch.length === 0) break;

    const existingIds = await findExistingSourceIds(
      prisma,
      LEGACY_ENTRY_SOURCE_TYPES.hobbyLog,
      batch.map((l) => l.id)
    );

    for (const log of batch) {
      summary.scanned += 1;

      if (existingIds.has(log.id)) {
        summary.skipped += 1;
        continue;
      }

      const created = await prisma.entry.create({
        data: {
          householdId: log.hobby.householdId,
          createdById: log.hobby.createdById,
          title: log.title,
          body: log.content,
          entryDate: log.logDate,
          entityType: log.sessionId && log.session ? "hobby_session" : "hobby",
          entityId: log.sessionId && log.session ? log.session.id : log.hobbyId,
          entryType: mapHobbyLogTypeToEntryType(log.logType),
          tags: buildHobbyLogEntryTags(log.logType),
          sourceType: LEGACY_ENTRY_SOURCE_TYPES.hobbyLog,
          sourceId: log.id,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt
        }
      });

      await syncEntryToSearchIndex(prisma, created.id);
      summary.created += 1;
    }

    cursor = batch[batch.length - 1]?.id;
  }

  return summary;
};

/**
 * Idempotent per-household legacy migration.
 *
 * Checks `Household.legacyMigrationDoneAt`; if already set, returns immediately.
 * Otherwise migrates AssetTimelineEntry, ProjectNote, and HobbyLog records for
 * the given household into the Entry system, then stamps the household so
 * subsequent calls are no-ops.
 *
 * Errors are logged but never re-thrown so callers are not blocked.
 */
export const ensureLegacyEntriesMigrated = async (
  prisma: PrismaClient,
  householdId: string
): Promise<void> => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: householdId },
      select: { legacyMigrationDoneAt: true }
    });

    if (!household || household.legacyMigrationDoneAt !== null) {
      return;
    }

    const [assetSummary, projectSummary, hobbySummary] = await Promise.all([
      migrateAssetTimelineEntries(prisma, householdId),
      migrateProjectNotes(prisma, householdId),
      migrateHobbyLogs(prisma, householdId)
    ]);

    await prisma.household.update({
      where: { id: householdId },
      data: { legacyMigrationDoneAt: new Date() }
    });

    console.log(
      `[legacy-migration] household=${householdId} done —`,
      JSON.stringify({ assetSummary, projectSummary, hobbySummary })
    );
  } catch (err) {
    console.error(`[legacy-migration] household=${householdId} failed:`, err);
  }
};
