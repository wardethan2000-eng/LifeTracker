import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  LEGACY_ENTRY_SOURCE_TYPES,
  buildAssetEntryPayload,
  buildHobbyLogEntryTags,
  buildProjectEntryPayload,
  mapHobbyLogTypeToEntryType
} from "@lifekeeper/utils";
import { syncEntryToSearchIndex } from "../lib/search-index.js";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

type Summary = {
  scanned: number;
  created: number;
  skipped: number;
};

const householdId = process.argv[2];

const findExistingSourceIds = async (sourceType: string, sourceIds: string[]): Promise<Set<string>> => {
  if (sourceIds.length === 0) {
    return new Set();
  }

  const existing = await prisma.entry.findMany({
    where: {
      sourceType,
      sourceId: { in: sourceIds }
    },
    select: { sourceId: true }
  });

  return new Set(existing.flatMap((entry) => entry.sourceId ? [entry.sourceId] : []));
};

const logProgress = (label: string, summary: Summary, total: number): void => {
  console.log(`[${label}] scanned ${summary.scanned}/${total} · created ${summary.created} · skipped ${summary.skipped}`);
};

const migrateAssetTimelineEntries = async (): Promise<Summary> => {
  const where = householdId
    ? { asset: { householdId } }
    : {};
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

    if (batch.length === 0) {
      break;
    }

    const existingIds = await findExistingSourceIds(
      LEGACY_ENTRY_SOURCE_TYPES.assetTimelineEntry,
      batch.map((entry) => entry.id)
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
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === "string") : []
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
    logProgress("asset_timeline_entry", summary, total);
  }

  return summary;
};

const migrateProjectNotes = async (): Promise<Summary> => {
  const where = {
    deletedAt: null,
    ...(householdId ? { project: { householdId } } : {})
  };
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

    if (batch.length === 0) {
      break;
    }

    const existingIds = await findExistingSourceIds(
      LEGACY_ENTRY_SOURCE_TYPES.projectNote,
      batch.map((note) => note.id)
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
            ? {
                flags: {
                  create: details.flags.map((flag) => ({ flag }))
                }
              }
            : {})
        }
      });

      await syncEntryToSearchIndex(prisma, created.id);
      summary.created += 1;
    }

    cursor = batch[batch.length - 1]?.id;
    logProgress("project_note", summary, total);
  }

  return summary;
};

const migrateHobbyLogs = async (): Promise<Summary> => {
  const where = householdId
    ? { hobby: { householdId } }
    : {};
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

    if (batch.length === 0) {
      break;
    }

    const existingIds = await findExistingSourceIds(
      LEGACY_ENTRY_SOURCE_TYPES.hobbyLog,
      batch.map((log) => log.id)
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
    logProgress("hobby_log", summary, total);
  }

  return summary;
};

async function main(): Promise<void> {
  console.log("Starting legacy entry migration", householdId ? `for household ${householdId}` : "for all households");

  const [assetSummary, projectSummary, hobbySummary] = await Promise.all([
    migrateAssetTimelineEntries(),
    migrateProjectNotes(),
    migrateHobbyLogs()
  ]);

  console.log("Migration complete.");
  console.log(JSON.stringify({ assetSummary, projectSummary, hobbySummary }, null, 2));
}

main()
  .catch((error) => {
    console.error("Legacy entry migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });