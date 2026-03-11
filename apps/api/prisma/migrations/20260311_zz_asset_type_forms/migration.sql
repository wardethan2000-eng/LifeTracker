-- AlterTable
ALTER TABLE "Asset"
ADD COLUMN "assetTypeKey" TEXT,
ADD COLUMN "assetTypeLabel" TEXT,
ADD COLUMN "assetTypeDescription" TEXT,
ADD COLUMN "assetTypeSource" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "assetTypeVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "fieldDefinitions" JSONB NOT NULL DEFAULT '[]';
