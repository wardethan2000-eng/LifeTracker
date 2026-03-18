CREATE TABLE "InventoryItemRevision" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'updated',
  "changes" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryItemRevision_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryItemRevision"
  ADD CONSTRAINT "InventoryItemRevision_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItemRevision"
  ADD CONSTRAINT "InventoryItemRevision_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItemRevision"
  ADD CONSTRAINT "InventoryItemRevision_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "InventoryItemRevision_inventoryItemId_createdAt_idx"
  ON "InventoryItemRevision"("inventoryItemId", "createdAt");

CREATE INDEX "InventoryItemRevision_householdId_createdAt_idx"
  ON "InventoryItemRevision"("householdId", "createdAt");

CREATE INDEX "InventoryItemRevision_userId_idx"
  ON "InventoryItemRevision"("userId");