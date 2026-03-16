-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'inventory_low_stock';

-- CreateTable
CREATE TABLE "ScheduleInventoryItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityPerService" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleInventoryItem_inventoryItemId_idx" ON "ScheduleInventoryItem"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleInventoryItem_scheduleId_inventoryItemId_key" ON "ScheduleInventoryItem"("scheduleId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "ScheduleInventoryItem" ADD CONSTRAINT "ScheduleInventoryItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleInventoryItem" ADD CONSTRAINT "ScheduleInventoryItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
