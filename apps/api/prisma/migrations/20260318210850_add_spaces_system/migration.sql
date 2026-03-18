-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('building', 'room', 'area', 'shelf', 'cabinet', 'drawer', 'tub', 'bin', 'other');

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "scanTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SpaceType" NOT NULL,
    "parentSpaceId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceInventoryItem" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "notes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpaceInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceGeneralItem" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpaceGeneralItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Space_scanTag_key" ON "Space"("scanTag");

-- CreateIndex
CREATE INDEX "Space_householdId_parentSpaceId_idx" ON "Space"("householdId", "parentSpaceId");

-- CreateIndex
CREATE INDEX "Space_householdId_deletedAt_idx" ON "Space"("householdId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Space_householdId_shortCode_key" ON "Space"("householdId", "shortCode");

-- CreateIndex
CREATE INDEX "SpaceInventoryItem_inventoryItemId_idx" ON "SpaceInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceInventoryItem_spaceId_inventoryItemId_key" ON "SpaceInventoryItem"("spaceId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "SpaceGeneralItem_spaceId_deletedAt_idx" ON "SpaceGeneralItem"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "SpaceGeneralItem_householdId_deletedAt_idx" ON "SpaceGeneralItem"("householdId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_parentSpaceId_fkey" FOREIGN KEY ("parentSpaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInventoryItem" ADD CONSTRAINT "SpaceInventoryItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInventoryItem" ADD CONSTRAINT "SpaceInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceGeneralItem" ADD CONSTRAINT "SpaceGeneralItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceGeneralItem" ADD CONSTRAINT "SpaceGeneralItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
