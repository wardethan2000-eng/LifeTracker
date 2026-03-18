-- CreateEnum
CREATE TYPE "HobbyPracticeGoalType" AS ENUM ('metric_target', 'session_count', 'duration_total', 'custom');

-- CreateEnum
CREATE TYPE "HobbyPracticeGoalStatus" AS ENUM ('active', 'achieved', 'abandoned', 'paused');

-- CreateEnum
CREATE TYPE "HobbyPracticeRoutineFrequency" AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "HobbyCollectionItemStatus" AS ENUM ('active', 'dormant', 'retired', 'lost', 'deceased');

-- AlterTable
ALTER TABLE "HobbySession" ADD COLUMN     "collectionItemId" TEXT,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "routineId" TEXT;

-- CreateTable
CREATE TABLE "HobbyPracticeGoal" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "goalType" "HobbyPracticeGoalType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "metricDefinitionId" TEXT,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "status" "HobbyPracticeGoalStatus" NOT NULL DEFAULT 'active',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyPracticeGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyPracticeRoutine" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "targetDurationMinutes" INTEGER,
    "targetFrequency" "HobbyPracticeRoutineFrequency" NOT NULL,
    "targetSessionsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyPracticeRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyCollectionItem" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" VARCHAR(2000),
    "status" "HobbyCollectionItemStatus" NOT NULL DEFAULT 'active',
    "acquiredDate" TIMESTAMP(3),
    "retiredDate" TIMESTAMP(3),
    "coverImageUrl" TEXT,
    "location" VARCHAR(200),
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "parentItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HobbyPracticeGoal_hobbyId_status_idx" ON "HobbyPracticeGoal"("hobbyId", "status");

-- CreateIndex
CREATE INDEX "HobbyPracticeGoal_householdId_status_idx" ON "HobbyPracticeGoal"("householdId", "status");

-- CreateIndex
CREATE INDEX "HobbyPracticeGoal_metricDefinitionId_idx" ON "HobbyPracticeGoal"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "HobbyPracticeGoal_createdById_idx" ON "HobbyPracticeGoal"("createdById");

-- CreateIndex
CREATE INDEX "HobbyPracticeRoutine_hobbyId_isActive_idx" ON "HobbyPracticeRoutine"("hobbyId", "isActive");

-- CreateIndex
CREATE INDEX "HobbyPracticeRoutine_householdId_isActive_idx" ON "HobbyPracticeRoutine"("householdId", "isActive");

-- CreateIndex
CREATE INDEX "HobbyPracticeRoutine_createdById_idx" ON "HobbyPracticeRoutine"("createdById");

-- CreateIndex
CREATE INDEX "HobbyCollectionItem_hobbyId_status_idx" ON "HobbyCollectionItem"("hobbyId", "status");

-- CreateIndex
CREATE INDEX "HobbyCollectionItem_hobbyId_location_idx" ON "HobbyCollectionItem"("hobbyId", "location");

-- CreateIndex
CREATE INDEX "HobbyCollectionItem_householdId_status_idx" ON "HobbyCollectionItem"("householdId", "status");

-- CreateIndex
CREATE INDEX "HobbyCollectionItem_parentItemId_idx" ON "HobbyCollectionItem"("parentItemId");

-- CreateIndex
CREATE INDEX "HobbyCollectionItem_createdById_idx" ON "HobbyCollectionItem"("createdById");

-- CreateIndex
CREATE INDEX "HobbySession_routineId_idx" ON "HobbySession"("routineId");

-- CreateIndex
CREATE INDEX "HobbySession_collectionItemId_idx" ON "HobbySession"("collectionItemId");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'HobbyProject_hobbyId_fkey'
    ) THEN
        ALTER TABLE "HobbyProject" RENAME CONSTRAINT "HobbyProject_hobbyId_fkey" TO "HobbyProjectLink_hobbyId_fkey";
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'HobbyProject_projectId_fkey'
    ) THEN
        ALTER TABLE "HobbyProject" RENAME CONSTRAINT "HobbyProject_projectId_fkey" TO "HobbyProjectLink_projectId_fkey";
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "HobbyPracticeGoal" ADD CONSTRAINT "HobbyPracticeGoal_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeGoal" ADD CONSTRAINT "HobbyPracticeGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeGoal" ADD CONSTRAINT "HobbyPracticeGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeGoal" ADD CONSTRAINT "HobbyPracticeGoal_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "HobbyMetricDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeRoutine" ADD CONSTRAINT "HobbyPracticeRoutine_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeRoutine" ADD CONSTRAINT "HobbyPracticeRoutine_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyPracticeRoutine" ADD CONSTRAINT "HobbyPracticeRoutine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyCollectionItem" ADD CONSTRAINT "HobbyCollectionItem_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyCollectionItem" ADD CONSTRAINT "HobbyCollectionItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyCollectionItem" ADD CONSTRAINT "HobbyCollectionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyCollectionItem" ADD CONSTRAINT "HobbyCollectionItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "HobbyCollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySession" ADD CONSTRAINT "HobbySession_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "HobbyPracticeRoutine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySession" ADD CONSTRAINT "HobbySession_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "HobbyCollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
