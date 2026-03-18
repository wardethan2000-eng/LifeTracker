CREATE TYPE "EntryEntityType" AS ENUM (
  'hobby',
  'hobby_session',
  'hobby_project',
  'hobby_project_milestone',
  'hobby_collection_item',
  'project',
  'project_phase',
  'asset',
  'schedule',
  'maintenance_log',
  'inventory_item'
);

CREATE TYPE "EntryType" AS ENUM (
  'note',
  'observation',
  'measurement',
  'lesson',
  'decision',
  'issue',
  'milestone',
  'reference',
  'comparison'
);

CREATE TYPE "EntryFlag" AS ENUM (
  'important',
  'actionable',
  'resolved',
  'pinned',
  'tip',
  'warning',
  'archived'
);

CREATE TABLE "Entry" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" VARCHAR(500),
  "body" VARCHAR(20000) NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "entityType" "EntryEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "entryType" "EntryType" NOT NULL DEFAULT 'note',
  "measurements" JSONB NOT NULL DEFAULT '[]',
  "tags" JSONB NOT NULL DEFAULT '[]',
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_measurements_is_array_check"
  CHECK (jsonb_typeof("measurements") = 'array');

ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_tags_is_array_check"
  CHECK (jsonb_typeof("tags") = 'array');

ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_tags_max_20_check"
  CHECK (jsonb_array_length("tags") <= 20);

CREATE TABLE "EntryFlagEntry" (
  "entryId" TEXT NOT NULL,
  "flag" "EntryFlag" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EntryFlagEntry_pkey" PRIMARY KEY ("entryId", "flag")
);

ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Entry"
  ADD CONSTRAINT "Entry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EntryFlagEntry"
  ADD CONSTRAINT "EntryFlagEntry_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Entry_householdId_entityType_entityId_idx"
  ON "Entry"("householdId", "entityType", "entityId");

CREATE INDEX "Entry_householdId_entryType_idx"
  ON "Entry"("householdId", "entryType");

CREATE INDEX "Entry_householdId_entryDate_idx"
  ON "Entry"("householdId", "entryDate");

CREATE INDEX "Entry_householdId_createdById_idx"
  ON "Entry"("householdId", "createdById");

CREATE INDEX "EntryFlagEntry_flag_idx"
  ON "EntryFlagEntry"("flag");