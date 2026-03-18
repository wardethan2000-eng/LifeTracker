-- CreateEnum
CREATE TYPE "SpaceScanMethod" AS ENUM ('qr_scan', 'manual_lookup', 'direct_navigation');

-- DropIndex
DROP INDEX "idx_inventory_item_description_trgm";

-- DropIndex
DROP INDEX "idx_inventory_item_name_trgm";

-- DropIndex
DROP INDEX "idx_space_name_trgm";

-- DropIndex
DROP INDEX "idx_space_general_item_name_trgm";

-- CreateTable
CREATE TABLE "SpaceScanLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "SpaceScanMethod" NOT NULL,

    CONSTRAINT "SpaceScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpaceScanLog_householdId_scannedAt_idx" ON "SpaceScanLog"("householdId", "scannedAt");

-- CreateIndex
CREATE INDEX "SpaceScanLog_spaceId_scannedAt_idx" ON "SpaceScanLog"("spaceId", "scannedAt");

-- CreateIndex
CREATE INDEX "SpaceScanLog_userId_scannedAt_idx" ON "SpaceScanLog"("userId", "scannedAt");

-- AddForeignKey
ALTER TABLE "SpaceScanLog" ADD CONSTRAINT "SpaceScanLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceScanLog" ADD CONSTRAINT "SpaceScanLog_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceScanLog" ADD CONSTRAINT "SpaceScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
