-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_expiresAt_idx" ON "InventoryItem"("householdId", "expiresAt");
