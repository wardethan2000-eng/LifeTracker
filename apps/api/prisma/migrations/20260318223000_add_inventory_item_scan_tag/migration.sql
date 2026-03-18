ALTER TABLE "InventoryItem"
ADD COLUMN IF NOT EXISTS "scanTag" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_scanTag_key"
ON "InventoryItem"("scanTag");

CREATE INDEX IF NOT EXISTS "InventoryItem_householdId_scanTag_idx"
ON "InventoryItem"("householdId", "scanTag");