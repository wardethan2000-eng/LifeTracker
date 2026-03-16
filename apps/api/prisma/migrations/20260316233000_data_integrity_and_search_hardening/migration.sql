ALTER TABLE "Asset" DROP CONSTRAINT "Asset_ownerId_fkey";

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Comment"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Attachment"
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Attachment"
SET "deletedAt" = COALESCE("updatedAt", NOW())
WHERE "status" = 'deleted'
  AND "deletedAt" IS NULL;

DROP INDEX IF EXISTS "SearchIndex_entityType_entityId_key";

CREATE UNIQUE INDEX "SearchIndex_householdId_entityType_entityId_key"
ON "SearchIndex"("householdId", "entityType", "entityId");