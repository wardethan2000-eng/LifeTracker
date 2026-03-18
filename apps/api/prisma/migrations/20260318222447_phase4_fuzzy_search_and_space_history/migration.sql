CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "SpaceItemAction" AS ENUM ('placed', 'removed', 'moved_in', 'moved_out', 'quantity_changed');

-- CreateTable
CREATE TABLE "SpaceItemHistory" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "generalItemName" TEXT,
    "householdId" TEXT NOT NULL,
    "action" "SpaceItemAction" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "previousQuantity" DOUBLE PRECISION,
    "performedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpaceItemHistory_householdId_inventoryItemId_idx" ON "SpaceItemHistory"("householdId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "SpaceItemHistory_householdId_spaceId_idx" ON "SpaceItemHistory"("householdId", "spaceId");

-- CreateIndex
CREATE INDEX "SpaceItemHistory_spaceId_createdAt_idx" ON "SpaceItemHistory"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SpaceItemHistory_inventoryItemId_createdAt_idx" ON "SpaceItemHistory"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "SpaceItemHistory_performedBy_idx" ON "SpaceItemHistory"("performedBy");

-- CreateIndex
CREATE INDEX idx_space_name_trgm ON "Space" USING gin (name gin_trgm_ops);

-- CreateIndex
CREATE INDEX idx_inventory_item_name_trgm ON "InventoryItem" USING gin (name gin_trgm_ops);

-- CreateIndex
CREATE INDEX idx_space_general_item_name_trgm ON "SpaceGeneralItem" USING gin (name gin_trgm_ops);

-- CreateIndex
CREATE INDEX idx_inventory_item_description_trgm ON "InventoryItem" USING gin (description gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "SpaceItemHistory" ADD CONSTRAINT "SpaceItemHistory_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceItemHistory" ADD CONSTRAINT "SpaceItemHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceItemHistory" ADD CONSTRAINT "SpaceItemHistory_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceItemHistory" ADD CONSTRAINT "SpaceItemHistory_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
