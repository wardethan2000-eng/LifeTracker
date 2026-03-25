-- Extend ProjectTaskDependency: add id (cuid), dependencyType, lagDays, updatedAt
-- Drop old composite primary key, replace with id primary key + unique constraint

-- Step 1: Add new columns as nullable first
ALTER TABLE "ProjectTaskDependency" ADD COLUMN "id" TEXT;
ALTER TABLE "ProjectTaskDependency" ADD COLUMN "dependencyType" TEXT NOT NULL DEFAULT 'finish_to_start';
ALTER TABLE "ProjectTaskDependency" ADD COLUMN "lagDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProjectTaskDependency" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Populate id for all existing rows using gen_random_uuid()
UPDATE "ProjectTaskDependency" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Step 3: Make id NOT NULL
ALTER TABLE "ProjectTaskDependency" ALTER COLUMN "id" SET NOT NULL;

-- Step 4: Drop old composite primary key
ALTER TABLE "ProjectTaskDependency" DROP CONSTRAINT "ProjectTaskDependency_pkey";

-- Step 5: Add new single-column primary key
ALTER TABLE "ProjectTaskDependency" ADD PRIMARY KEY ("id");

-- Step 6: Add unique constraint for the pair
ALTER TABLE "ProjectTaskDependency" ADD CONSTRAINT "ProjectTaskDependency_predecessorTaskId_successorTaskId_key" UNIQUE ("predecessorTaskId", "successorTaskId");
