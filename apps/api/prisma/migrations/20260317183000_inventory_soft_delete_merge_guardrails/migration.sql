-- Preserve inventory history and associations by blocking hard-delete cascades.
ALTER TABLE IF EXISTS "InventoryPurchaseLine"
  DROP CONSTRAINT IF EXISTS "InventoryPurchaseLine_inventoryItemId_fkey";

ALTER TABLE IF EXISTS "InventoryPurchaseLine"
  ADD CONSTRAINT "InventoryPurchaseLine_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssetInventoryItem"
  DROP CONSTRAINT "AssetInventoryItem_inventoryItemId_fkey",
  ADD CONSTRAINT "AssetInventoryItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleInventoryItem"
  DROP CONSTRAINT "ScheduleInventoryItem_inventoryItemId_fkey",
  ADD CONSTRAINT "ScheduleInventoryItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectInventoryItem"
  DROP CONSTRAINT "ProjectInventoryItem_inventoryItemId_fkey",
  ADD CONSTRAINT "ProjectInventoryItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryTransaction"
  DROP CONSTRAINT "InventoryTransaction_inventoryItemId_fkey",
  ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Comment"
  DROP CONSTRAINT "Comment_inventoryItemId_fkey",
  ADD CONSTRAINT "Comment_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HobbyInventoryItem"
  DROP CONSTRAINT "HobbyInventoryItem_inventoryItemId_fkey",
  ADD CONSTRAINT "HobbyInventoryItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;