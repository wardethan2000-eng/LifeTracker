ALTER TYPE "AttachmentEntityType" ADD VALUE IF NOT EXISTS 'project';

ALTER TABLE "InventoryPurchaseLine"
ADD COLUMN "projectPhaseSupplyId" TEXT;

DROP INDEX IF EXISTS "InventoryPurchaseLine_purchaseId_inventoryItemId_key";

CREATE INDEX "InventoryPurchaseLine_projectPhaseSupplyId_idx" ON "InventoryPurchaseLine"("projectPhaseSupplyId");

ALTER TABLE "InventoryPurchaseLine"
ADD CONSTRAINT "InventoryPurchaseLine_projectPhaseSupplyId_fkey"
FOREIGN KEY ("projectPhaseSupplyId") REFERENCES "ProjectPhaseSupply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
