-- Add soft-delete support to Asset
ALTER TABLE "Asset" ADD COLUMN "deletedAt" TIMESTAMP(3);
