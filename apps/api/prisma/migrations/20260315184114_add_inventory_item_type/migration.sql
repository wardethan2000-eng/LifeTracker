-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('consumable', 'equipment');

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "conditionStatus" TEXT,
ADD COLUMN     "itemType" "InventoryItemType" NOT NULL DEFAULT 'consumable';

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_itemType_idx" ON "InventoryItem"("householdId", "itemType");
