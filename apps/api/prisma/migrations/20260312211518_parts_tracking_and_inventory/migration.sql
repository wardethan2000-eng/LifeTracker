-- AlterTable
ALTER TABLE "MaintenanceLog" ADD COLUMN     "difficultyRating" INTEGER,
ADD COLUMN     "laborHours" DOUBLE PRECISION,
ADD COLUMN     "laborRate" DOUBLE PRECISION,
ADD COLUMN     "performedBy" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceLogPart" ADD COLUMN     "inventoryItemId" TEXT;

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "reorderThreshold" DOUBLE PRECISION,
    "reorderQuantity" DOUBLE PRECISION,
    "preferredSupplier" TEXT,
    "supplierUrl" TEXT,
    "unitCost" DOUBLE PRECISION,
    "storageLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetInventoryItem" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "notes" TEXT,
    "recommendedQuantity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInventoryItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityNeeded" DOUBLE PRECISION NOT NULL,
    "quantityAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetedUnitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_idx" ON "InventoryItem"("householdId");

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_category_idx" ON "InventoryItem"("householdId", "category");

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_partNumber_idx" ON "InventoryItem"("householdId", "partNumber");

-- CreateIndex
CREATE INDEX "AssetInventoryItem_assetId_idx" ON "AssetInventoryItem"("assetId");

-- CreateIndex
CREATE INDEX "AssetInventoryItem_inventoryItemId_idx" ON "AssetInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetInventoryItem_assetId_inventoryItemId_key" ON "AssetInventoryItem"("assetId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "ProjectInventoryItem_projectId_idx" ON "ProjectInventoryItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInventoryItem_inventoryItemId_idx" ON "ProjectInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInventoryItem_projectId_inventoryItemId_key" ON "ProjectInventoryItem"("projectId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryItemId_createdAt_idx" ON "InventoryTransaction"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_referenceType_referenceId_idx" ON "InventoryTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_userId_idx" ON "InventoryTransaction"("userId");

-- CreateIndex
CREATE INDEX "MaintenanceLogPart_inventoryItemId_idx" ON "MaintenanceLogPart"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "MaintenanceLogPart" ADD CONSTRAINT "MaintenanceLogPart_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInventoryItem" ADD CONSTRAINT "AssetInventoryItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInventoryItem" ADD CONSTRAINT "AssetInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryItem" ADD CONSTRAINT "ProjectInventoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryItem" ADD CONSTRAINT "ProjectInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
