CREATE TYPE "HobbyActivityMode" AS ENUM ('session', 'project', 'practice', 'collection');

CREATE TYPE "SeriesStatus" AS ENUM ('active', 'completed', 'archived');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'EntryEntityType'
  ) THEN
    ALTER TYPE "EntryEntityType" ADD VALUE IF NOT EXISTS 'hobby_series';
  END IF;
END $$;

ALTER TABLE "Hobby"
  ADD COLUMN "activityMode" "HobbyActivityMode" NOT NULL DEFAULT 'session';

CREATE TABLE "HobbySeries" (
  "id" TEXT NOT NULL,
  "hobbyId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SeriesStatus" NOT NULL DEFAULT 'active',
  "batchCount" INTEGER NOT NULL DEFAULT 0,
  "bestBatchSessionId" TEXT,
  "tags" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "coverImageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HobbySeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HobbySession"
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "batchNumber" INTEGER;

CREATE INDEX "Hobby_householdId_activityMode_idx"
  ON "Hobby"("householdId", "activityMode");

CREATE INDEX "HobbySeries_hobbyId_status_idx"
  ON "HobbySeries"("hobbyId", "status");

CREATE INDEX "HobbySeries_householdId_status_idx"
  ON "HobbySeries"("householdId", "status");

CREATE INDEX "HobbySession_seriesId_batchNumber_idx"
  ON "HobbySession"("seriesId", "batchNumber");

ALTER TABLE "HobbySeries"
  ADD CONSTRAINT "HobbySeries_hobbyId_fkey"
  FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbySeries"
  ADD CONSTRAINT "HobbySeries_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbySeries"
  ADD CONSTRAINT "HobbySeries_bestBatchSessionId_fkey"
  FOREIGN KEY ("bestBatchSessionId") REFERENCES "HobbySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HobbySession"
  ADD CONSTRAINT "HobbySession_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "HobbySeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;