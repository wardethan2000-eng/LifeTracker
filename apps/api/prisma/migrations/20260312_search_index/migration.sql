CREATE TABLE "SearchIndex" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "parentEntityId" TEXT,
  "parentEntityName" TEXT,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "body" TEXT,
  "searchVector" tsvector NOT NULL,
  "entityUrl" TEXT NOT NULL,
  "entityMeta" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SearchIndex_entityType_entityId_key" ON "SearchIndex"("entityType", "entityId");
CREATE INDEX "SearchIndex_householdId_entityType_idx" ON "SearchIndex"("householdId", "entityType");
CREATE INDEX "SearchIndex_searchVector_idx" ON "SearchIndex" USING GIN ("searchVector");