ALTER TABLE "HobbyProject" RENAME TO "HobbyProjectLink";

ALTER TABLE "HobbyProjectLink" RENAME CONSTRAINT "HobbyProject_pkey" TO "HobbyProjectLink_pkey";
ALTER TABLE "HobbyProjectLink" RENAME CONSTRAINT "HobbyProject_hobbyId_projectId_key" TO "HobbyProjectLink_hobbyId_projectId_key";
ALTER INDEX "HobbyProject_hobbyId_idx" RENAME TO "HobbyProjectLink_hobbyId_idx";
ALTER INDEX "HobbyProject_projectId_idx" RENAME TO "HobbyProjectLink_projectId_idx";

CREATE TYPE "HobbyProjectStatus" AS ENUM ('planned', 'active', 'paused', 'completed', 'abandoned');
CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

CREATE TABLE "HobbyProject" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(5000),
    "status" "HobbyProjectStatus" NOT NULL DEFAULT 'planned',
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "difficulty" TEXT,
    "notes" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "seriesId" TEXT,
    "batchNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HobbyProjectMilestone" (
    "id" TEXT NOT NULL,
    "hobbyProjectId" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'pending',
    "sortOrder" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HobbyProjectWorkLog" (
    "id" TEXT NOT NULL,
    "hobbyProjectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "description" VARCHAR(5000) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyProjectWorkLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HobbyProjectInventoryItem" (
    "id" TEXT NOT NULL,
    "hobbyProjectId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityNeeded" DOUBLE PRECISION NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyProjectInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HobbyProject_hobbyId_status_idx" ON "HobbyProject"("hobbyId", "status");
CREATE INDEX "HobbyProject_hobbyId_updatedAt_idx" ON "HobbyProject"("hobbyId", "updatedAt");
CREATE INDEX "HobbyProject_householdId_status_idx" ON "HobbyProject"("householdId", "status");
CREATE INDEX "HobbyProject_seriesId_batchNumber_idx" ON "HobbyProject"("seriesId", "batchNumber");
CREATE INDEX "HobbyProject_createdById_idx" ON "HobbyProject"("createdById");

CREATE INDEX "HobbyProjectMilestone_hobbyProjectId_sortOrder_idx" ON "HobbyProjectMilestone"("hobbyProjectId", "sortOrder");
CREATE INDEX "HobbyProjectMilestone_hobbyProjectId_status_idx" ON "HobbyProjectMilestone"("hobbyProjectId", "status");

CREATE INDEX "HobbyProjectWorkLog_hobbyProjectId_date_idx" ON "HobbyProjectWorkLog"("hobbyProjectId", "date");
CREATE INDEX "HobbyProjectWorkLog_milestoneId_idx" ON "HobbyProjectWorkLog"("milestoneId");

CREATE UNIQUE INDEX "HobbyProjectInventoryItem_hobbyProjectId_inventoryItemId_key" ON "HobbyProjectInventoryItem"("hobbyProjectId", "inventoryItemId");
CREATE INDEX "HobbyProjectInventoryItem_hobbyProjectId_idx" ON "HobbyProjectInventoryItem"("hobbyProjectId");
CREATE INDEX "HobbyProjectInventoryItem_inventoryItemId_idx" ON "HobbyProjectInventoryItem"("inventoryItemId");

ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "HobbySeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HobbyProjectMilestone" ADD CONSTRAINT "HobbyProjectMilestone_hobbyProjectId_fkey" FOREIGN KEY ("hobbyProjectId") REFERENCES "HobbyProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbyProjectWorkLog" ADD CONSTRAINT "HobbyProjectWorkLog_hobbyProjectId_fkey" FOREIGN KEY ("hobbyProjectId") REFERENCES "HobbyProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HobbyProjectWorkLog" ADD CONSTRAINT "HobbyProjectWorkLog_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "HobbyProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HobbyProjectInventoryItem" ADD CONSTRAINT "HobbyProjectInventoryItem_hobbyProjectId_fkey" FOREIGN KEY ("hobbyProjectId") REFERENCES "HobbyProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HobbyProjectInventoryItem" ADD CONSTRAINT "HobbyProjectInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;