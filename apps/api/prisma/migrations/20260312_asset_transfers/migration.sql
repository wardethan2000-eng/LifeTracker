-- CreateEnum
CREATE TYPE "AssetTransferType" AS ENUM ('reassignment', 'household_transfer');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "ownerId" TEXT;

-- Backfill ownerId from immutable creator for existing assets
UPDATE "Asset"
SET "ownerId" = "createdById"
WHERE "ownerId" IS NULL;

-- CreateTable
CREATE TABLE "AssetTransfer" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transferType" "AssetTransferType" NOT NULL,
    "fromHouseholdId" TEXT NOT NULL,
    "toHouseholdId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");

-- CreateIndex
CREATE INDEX "AssetTransfer_assetId_transferredAt_idx" ON "AssetTransfer"("assetId", "transferredAt");

-- CreateIndex
CREATE INDEX "AssetTransfer_fromHouseholdId_transferredAt_idx" ON "AssetTransfer"("fromHouseholdId", "transferredAt");

-- CreateIndex
CREATE INDEX "AssetTransfer_toHouseholdId_transferredAt_idx" ON "AssetTransfer"("toHouseholdId", "transferredAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_fromHouseholdId_fkey" FOREIGN KEY ("fromHouseholdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_toHouseholdId_fkey" FOREIGN KEY ("toHouseholdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;