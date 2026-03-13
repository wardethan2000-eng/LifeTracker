-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "assetTag" TEXT;

-- Backfill existing assets using the last 8 characters of the cuid.
UPDATE "Asset"
SET "assetTag" = 'LK-' || UPPER(RIGHT("id", 8))
WHERE "assetTag" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");