-- CreateEnum
CREATE TYPE "HobbyStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "HobbySessionLifecycleMode" AS ENUM ('binary', 'pipeline');

-- CreateEnum
CREATE TYPE "HobbyRecipeSourceType" AS ENUM ('preset', 'user', 'imported');

-- CreateEnum
CREATE TYPE "HobbyLogType" AS ENUM ('note', 'tasting', 'progress', 'issue');

-- CreateTable
CREATE TABLE "Hobby" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "HobbyStatus" NOT NULL DEFAULT 'active',
    "hobbyType" TEXT,
    "lifecycleMode" "HobbySessionLifecycleMode" NOT NULL DEFAULT 'binary',
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "fieldDefinitions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyAsset" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyInventoryItem" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyProject" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyInventoryCategory" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyInventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbySessionStatusStep" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "color" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionStatusStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyRecipe" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "HobbyRecipeSourceType" NOT NULL DEFAULT 'user',
    "styleCategory" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "estimatedDuration" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "yield" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyRecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyRecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "stepType" TEXT NOT NULL DEFAULT 'generic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyRecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbySession" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "pipelineStepId" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "totalCost" DOUBLE PRECISION,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbySessionIngredient" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recipeIngredientId" TEXT,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbySessionStep" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recipeStepId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyMetricDefinition" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "metricType" TEXT NOT NULL DEFAULT 'numeric',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyMetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyMetricReading" (
    "id" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HobbyMetricReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HobbyLog" (
    "id" TEXT NOT NULL,
    "hobbyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "logType" "HobbyLogType" NOT NULL DEFAULT 'note',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hobby_householdId_status_idx" ON "Hobby"("householdId", "status");

-- CreateIndex
CREATE INDEX "Hobby_createdById_idx" ON "Hobby"("createdById");

-- CreateIndex
CREATE INDEX "HobbyAsset_hobbyId_idx" ON "HobbyAsset"("hobbyId");

-- CreateIndex
CREATE INDEX "HobbyAsset_assetId_idx" ON "HobbyAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "HobbyAsset_hobbyId_assetId_key" ON "HobbyAsset"("hobbyId", "assetId");

-- CreateIndex
CREATE INDEX "HobbyInventoryItem_hobbyId_idx" ON "HobbyInventoryItem"("hobbyId");

-- CreateIndex
CREATE INDEX "HobbyInventoryItem_inventoryItemId_idx" ON "HobbyInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "HobbyInventoryItem_hobbyId_inventoryItemId_key" ON "HobbyInventoryItem"("hobbyId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "HobbyProject_hobbyId_idx" ON "HobbyProject"("hobbyId");

-- CreateIndex
CREATE INDEX "HobbyProject_projectId_idx" ON "HobbyProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "HobbyProject_hobbyId_projectId_key" ON "HobbyProject"("hobbyId", "projectId");

-- CreateIndex
CREATE INDEX "HobbyInventoryCategory_hobbyId_idx" ON "HobbyInventoryCategory"("hobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "HobbyInventoryCategory_hobbyId_categoryName_key" ON "HobbyInventoryCategory"("hobbyId", "categoryName");

-- CreateIndex
CREATE INDEX "HobbySessionStatusStep_hobbyId_sortOrder_idx" ON "HobbySessionStatusStep"("hobbyId", "sortOrder");

-- CreateIndex
CREATE INDEX "HobbyRecipe_hobbyId_idx" ON "HobbyRecipe"("hobbyId");

-- CreateIndex
CREATE INDEX "HobbyRecipe_hobbyId_isArchived_idx" ON "HobbyRecipe"("hobbyId", "isArchived");

-- CreateIndex
CREATE INDEX "HobbyRecipeIngredient_recipeId_sortOrder_idx" ON "HobbyRecipeIngredient"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "HobbyRecipeIngredient_inventoryItemId_idx" ON "HobbyRecipeIngredient"("inventoryItemId");

-- CreateIndex
CREATE INDEX "HobbyRecipeStep_recipeId_sortOrder_idx" ON "HobbyRecipeStep"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "HobbySession_hobbyId_status_idx" ON "HobbySession"("hobbyId", "status");

-- CreateIndex
CREATE INDEX "HobbySession_hobbyId_createdAt_idx" ON "HobbySession"("hobbyId", "createdAt");

-- CreateIndex
CREATE INDEX "HobbySession_recipeId_idx" ON "HobbySession"("recipeId");

-- CreateIndex
CREATE INDEX "HobbySessionIngredient_sessionId_idx" ON "HobbySessionIngredient"("sessionId");

-- CreateIndex
CREATE INDEX "HobbySessionIngredient_inventoryItemId_idx" ON "HobbySessionIngredient"("inventoryItemId");

-- CreateIndex
CREATE INDEX "HobbySessionStep_sessionId_sortOrder_idx" ON "HobbySessionStep"("sessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HobbyMetricDefinition_hobbyId_idx" ON "HobbyMetricDefinition"("hobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "HobbyMetricDefinition_hobbyId_name_key" ON "HobbyMetricDefinition"("hobbyId", "name");

-- CreateIndex
CREATE INDEX "HobbyMetricReading_metricDefinitionId_readingDate_idx" ON "HobbyMetricReading"("metricDefinitionId", "readingDate");

-- CreateIndex
CREATE INDEX "HobbyMetricReading_sessionId_idx" ON "HobbyMetricReading"("sessionId");

-- CreateIndex
CREATE INDEX "HobbyLog_hobbyId_logDate_idx" ON "HobbyLog"("hobbyId", "logDate");

-- CreateIndex
CREATE INDEX "HobbyLog_sessionId_idx" ON "HobbyLog"("sessionId");

-- AddForeignKey
ALTER TABLE "Hobby" ADD CONSTRAINT "Hobby_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hobby" ADD CONSTRAINT "Hobby_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyAsset" ADD CONSTRAINT "HobbyAsset_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyAsset" ADD CONSTRAINT "HobbyAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyInventoryItem" ADD CONSTRAINT "HobbyInventoryItem_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyInventoryItem" ADD CONSTRAINT "HobbyInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyProject" ADD CONSTRAINT "HobbyProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyInventoryCategory" ADD CONSTRAINT "HobbyInventoryCategory_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionStatusStep" ADD CONSTRAINT "HobbySessionStatusStep_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyRecipe" ADD CONSTRAINT "HobbyRecipe_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyRecipeIngredient" ADD CONSTRAINT "HobbyRecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "HobbyRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyRecipeIngredient" ADD CONSTRAINT "HobbyRecipeIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyRecipeStep" ADD CONSTRAINT "HobbyRecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "HobbyRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySession" ADD CONSTRAINT "HobbySession_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySession" ADD CONSTRAINT "HobbySession_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "HobbyRecipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionIngredient" ADD CONSTRAINT "HobbySessionIngredient_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HobbySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionIngredient" ADD CONSTRAINT "HobbySessionIngredient_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "HobbyRecipeIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionIngredient" ADD CONSTRAINT "HobbySessionIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionStep" ADD CONSTRAINT "HobbySessionStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HobbySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbySessionStep" ADD CONSTRAINT "HobbySessionStep_recipeStepId_fkey" FOREIGN KEY ("recipeStepId") REFERENCES "HobbyRecipeStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyMetricDefinition" ADD CONSTRAINT "HobbyMetricDefinition_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyMetricReading" ADD CONSTRAINT "HobbyMetricReading_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "HobbyMetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyMetricReading" ADD CONSTRAINT "HobbyMetricReading_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HobbySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyLog" ADD CONSTRAINT "HobbyLog_hobbyId_fkey" FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HobbyLog" ADD CONSTRAINT "HobbyLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HobbySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
