ALTER TABLE "MaintenanceSchedule"
ADD COLUMN IF NOT EXISTS "isRegulatory" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_assetId_isActive_nextDueAt_idx"
ON "MaintenanceSchedule"("assetId", "isActive", "nextDueAt");

CREATE INDEX IF NOT EXISTS "ActivityLog_householdId_entityType_idx"
ON "ActivityLog"("householdId", "entityType");