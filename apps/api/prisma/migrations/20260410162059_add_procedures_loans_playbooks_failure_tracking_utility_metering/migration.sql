-- CreateEnum
CREATE TYPE "FailureSeverity" AS ENUM ('minor', 'moderate', 'major', 'critical');

-- CreateEnum
CREATE TYPE "LoanEntityType" AS ENUM ('asset', 'inventory_item');

-- AlterEnum
ALTER TYPE "AssetCategory" ADD VALUE 'utility';

-- AlterTable
ALTER TABLE "MaintenanceLog" ADD COLUMN     "failureMode" TEXT,
ADD COLUMN     "isRepeatFailure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relatedLogId" TEXT,
ADD COLUMN     "rootCause" TEXT,
ADD COLUMN     "severity" "FailureSeverity",
ADD COLUMN     "symptom" TEXT;

-- AlterTable
ALTER TABLE "MaintenanceSchedule" ADD COLUMN     "procedureId" TEXT;

-- AlterTable
ALTER TABLE "UsageMetricEntry" ADD COLUMN     "costPerUnit" DOUBLE PRECISION,
ADD COLUMN     "totalCost" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedMinutes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureStep" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "notes" TEXT,
    "estimatedMinutes" INTEGER,
    "warningText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureAsset" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcedureAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureTool" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "entityType" "LoanEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "borrowerContact" TEXT,
    "quantity" DOUBLE PRECISION,
    "notes" TEXT,
    "lentAt" TIMESTAMP(3) NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "triggerMonth" INTEGER,
    "triggerDay" INTEGER,
    "leadDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookItem" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "assetId" TEXT,
    "inventoryItemId" TEXT,
    "procedureId" TEXT,
    "spaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookRun" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "playbookItemId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Procedure_householdId_idx" ON "Procedure"("householdId");

-- CreateIndex
CREATE INDEX "Procedure_householdId_deletedAt_idx" ON "Procedure"("householdId", "deletedAt");

-- CreateIndex
CREATE INDEX "ProcedureStep_procedureId_sortOrder_idx" ON "ProcedureStep"("procedureId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureAsset_procedureId_assetId_key" ON "ProcedureAsset"("procedureId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureTool_procedureId_inventoryItemId_key" ON "ProcedureTool"("procedureId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "Loan_householdId_idx" ON "Loan"("householdId");

-- CreateIndex
CREATE INDEX "Loan_householdId_returnedAt_idx" ON "Loan"("householdId", "returnedAt");

-- CreateIndex
CREATE INDEX "Loan_householdId_entityType_entityId_idx" ON "Loan"("householdId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Playbook_householdId_idx" ON "Playbook"("householdId");

-- CreateIndex
CREATE INDEX "Playbook_householdId_deletedAt_idx" ON "Playbook"("householdId", "deletedAt");

-- CreateIndex
CREATE INDEX "PlaybookItem_playbookId_sortOrder_idx" ON "PlaybookItem"("playbookId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlaybookRun_playbookId_idx" ON "PlaybookRun"("playbookId");

-- CreateIndex
CREATE INDEX "PlaybookRunItem_runId_idx" ON "PlaybookRunItem"("runId");

-- CreateIndex
CREATE INDEX "PlaybookRunItem_playbookItemId_idx" ON "PlaybookRunItem"("playbookItemId");

-- CreateIndex
CREATE INDEX "MaintenanceLog_relatedLogId_idx" ON "MaintenanceLog"("relatedLogId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_procedureId_idx" ON "MaintenanceSchedule"("procedureId");

-- AddForeignKey
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_relatedLogId_fkey" FOREIGN KEY ("relatedLogId") REFERENCES "MaintenanceLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureStep" ADD CONSTRAINT "ProcedureStep_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureAsset" ADD CONSTRAINT "ProcedureAsset_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureAsset" ADD CONSTRAINT "ProcedureAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureTool" ADD CONSTRAINT "ProcedureTool_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureTool" ADD CONSTRAINT "ProcedureTool_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookItem" ADD CONSTRAINT "PlaybookItem_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookItem" ADD CONSTRAINT "PlaybookItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookItem" ADD CONSTRAINT "PlaybookItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookItem" ADD CONSTRAINT "PlaybookItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookItem" ADD CONSTRAINT "PlaybookItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRun" ADD CONSTRAINT "PlaybookRun_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRunItem" ADD CONSTRAINT "PlaybookRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PlaybookRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookRunItem" ADD CONSTRAINT "PlaybookRunItem_playbookItemId_fkey" FOREIGN KEY ("playbookItemId") REFERENCES "PlaybookItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
