-- Drop legacy models that have been superseded by the Entry system.
-- All data was migrated to Entry records via ensureLegacyEntriesMigrated.

-- RemoveIndex
DROP INDEX IF EXISTS "AssetTimelineEntry_assetId_entryDate_idx";
DROP INDEX IF EXISTS "AssetTimelineEntry_createdById_idx";
DROP INDEX IF EXISTS "AssetTimelineEntry_category_idx";
DROP INDEX IF EXISTS "ProjectNote_projectId_category_idx";
DROP INDEX IF EXISTS "ProjectNote_projectId_isPinned_idx";
DROP INDEX IF EXISTS "ProjectNote_projectId_deletedAt_idx";
DROP INDEX IF EXISTS "ProjectNote_phaseId_idx";
DROP INDEX IF EXISTS "ProjectNote_phaseId_deletedAt_idx";
DROP INDEX IF EXISTS "ProjectNote_createdById_idx";
DROP INDEX IF EXISTS "HobbyLog_hobbyId_logDate_idx";
DROP INDEX IF EXISTS "HobbyLog_sessionId_idx";

-- DropTable
DROP TABLE IF EXISTS "AssetTimelineEntry";
DROP TABLE IF EXISTS "ProjectNote";
DROP TABLE IF EXISTS "HobbyLog";

-- DropEnum
DROP TYPE IF EXISTS "HobbyLogType";
