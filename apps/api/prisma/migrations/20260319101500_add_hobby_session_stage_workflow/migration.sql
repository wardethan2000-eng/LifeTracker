ALTER TABLE "HobbySessionStatusStep"
ADD COLUMN "description" VARCHAR(2000),
ADD COLUMN "instructions" VARCHAR(5000),
ADD COLUMN "futureNotes" VARCHAR(5000),
ADD COLUMN "fieldDefinitions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "checklistTemplates" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "supplyTemplates" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "HobbySessionStage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stageTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "description" VARCHAR(2000),
    "instructions" VARCHAR(5000),
    "futureNotes" VARCHAR(5000),
    "fieldDefinitions" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "customFieldValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HobbySessionStageChecklistItem" (
    "id" TEXT NOT NULL,
    "sessionStageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionStageChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HobbySessionStageSupply" (
    "id" TEXT NOT NULL,
    "sessionStageId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantityNeeded" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HobbySessionStageSupply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HobbySessionStage_sessionId_sortOrder_idx" ON "HobbySessionStage"("sessionId", "sortOrder");
CREATE INDEX "HobbySessionStage_stageTemplateId_idx" ON "HobbySessionStage"("stageTemplateId");

CREATE INDEX "HobbySessionStageChecklistItem_sessionStageId_sortOrder_idx" ON "HobbySessionStageChecklistItem"("sessionStageId", "sortOrder");

CREATE INDEX "HobbySessionStageSupply_sessionStageId_sortOrder_idx" ON "HobbySessionStageSupply"("sessionStageId", "sortOrder");
CREATE INDEX "HobbySessionStageSupply_inventoryItemId_idx" ON "HobbySessionStageSupply"("inventoryItemId");

ALTER TABLE "HobbySessionStage"
ADD CONSTRAINT "HobbySessionStage_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "HobbySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbySessionStage"
ADD CONSTRAINT "HobbySessionStage_stageTemplateId_fkey"
FOREIGN KEY ("stageTemplateId") REFERENCES "HobbySessionStatusStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HobbySessionStageChecklistItem"
ADD CONSTRAINT "HobbySessionStageChecklistItem_sessionStageId_fkey"
FOREIGN KEY ("sessionStageId") REFERENCES "HobbySessionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbySessionStageSupply"
ADD CONSTRAINT "HobbySessionStageSupply_sessionStageId_fkey"
FOREIGN KEY ("sessionStageId") REFERENCES "HobbySessionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HobbySessionStageSupply"
ADD CONSTRAINT "HobbySessionStageSupply_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;