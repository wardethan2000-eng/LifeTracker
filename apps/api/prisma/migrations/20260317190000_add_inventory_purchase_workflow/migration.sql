CREATE TYPE "InventoryPurchaseStatus" AS ENUM ('draft', 'ordered', 'received');

CREATE TYPE "InventoryPurchaseSource" AS ENUM ('reorder', 'quick_restock', 'manual');

CREATE TYPE "InventoryPurchaseLineStatus" AS ENUM ('draft', 'ordered', 'received');

CREATE TABLE "InventoryPurchase" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierUrl" TEXT,
    "source" "InventoryPurchaseSource" NOT NULL DEFAULT 'manual',
    "status" "InventoryPurchaseStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryPurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "status" "InventoryPurchaseLineStatus" NOT NULL DEFAULT 'draft',
    "plannedQuantity" DOUBLE PRECISION NOT NULL,
    "orderedQuantity" DOUBLE PRECISION,
    "receivedQuantity" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPurchaseLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryPurchaseLine_purchaseId_inventoryItemId_key" ON "InventoryPurchaseLine"("purchaseId", "inventoryItemId");

CREATE INDEX "InventoryPurchase_householdId_status_idx" ON "InventoryPurchase"("householdId", "status");
CREATE INDEX "InventoryPurchase_createdById_idx" ON "InventoryPurchase"("createdById");
CREATE INDEX "InventoryPurchaseLine_purchaseId_status_idx" ON "InventoryPurchaseLine"("purchaseId", "status");
CREATE INDEX "InventoryPurchaseLine_inventoryItemId_status_idx" ON "InventoryPurchaseLine"("inventoryItemId", "status");

ALTER TABLE "InventoryPurchase"
ADD CONSTRAINT "InventoryPurchase_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryPurchase"
ADD CONSTRAINT "InventoryPurchase_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryPurchaseLine"
ADD CONSTRAINT "InventoryPurchaseLine_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "InventoryPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryPurchaseLine"
ADD CONSTRAINT "InventoryPurchaseLine_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
