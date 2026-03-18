ALTER TABLE "InventoryPurchaseLine"
  DROP CONSTRAINT IF EXISTS "InventoryPurchaseLine_inventoryItemId_fkey";

ALTER TABLE "InventoryPurchaseLine"
  ADD CONSTRAINT "InventoryPurchaseLine_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;