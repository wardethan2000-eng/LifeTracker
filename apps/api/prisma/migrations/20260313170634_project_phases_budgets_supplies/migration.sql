-- AlterTable
ALTER TABLE "ProjectExpense" ADD COLUMN     "budgetCategoryId" TEXT,
ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "SearchIndex" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sortOrder" INTEGER,
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "budgetAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhaseChecklistItem" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhaseChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTaskChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetAmount" DOUBLE PRECISION,
    "sortOrder" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhaseSupply" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantityNeeded" DOUBLE PRECISION NOT NULL,
    "quantityOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "estimatedUnitCost" DOUBLE PRECISION,
    "actualUnitCost" DOUBLE PRECISION,
    "supplier" TEXT,
    "supplierUrl" TEXT,
    "isProcured" BOOLEAN NOT NULL DEFAULT false,
    "procuredAt" TIMESTAMP(3),
    "isStaged" BOOLEAN NOT NULL DEFAULT false,
    "stagedAt" TIMESTAMP(3),
    "inventoryItemId" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhaseSupply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_sortOrder_idx" ON "ProjectPhase"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_status_idx" ON "ProjectPhase"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectPhaseChecklistItem_phaseId_sortOrder_idx" ON "ProjectPhaseChecklistItem"("phaseId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectTaskChecklistItem_taskId_sortOrder_idx" ON "ProjectTaskChecklistItem"("taskId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectBudgetCategory_projectId_sortOrder_idx" ON "ProjectBudgetCategory"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPhaseSupply_phaseId_sortOrder_idx" ON "ProjectPhaseSupply"("phaseId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPhaseSupply_phaseId_isProcured_idx" ON "ProjectPhaseSupply"("phaseId", "isProcured");

-- CreateIndex
CREATE INDEX "ProjectPhaseSupply_inventoryItemId_idx" ON "ProjectPhaseSupply"("inventoryItemId");

-- CreateIndex
CREATE INDEX "ProjectExpense_phaseId_idx" ON "ProjectExpense"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectExpense_budgetCategoryId_idx" ON "ProjectExpense"("budgetCategoryId");

-- CreateIndex
CREATE INDEX "ProjectTask_phaseId_sortOrder_idx" ON "ProjectTask"("phaseId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "ProjectBudgetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseChecklistItem" ADD CONSTRAINT "ProjectPhaseChecklistItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskChecklistItem" ADD CONSTRAINT "ProjectTaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetCategory" ADD CONSTRAINT "ProjectBudgetCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseSupply" ADD CONSTRAINT "ProjectPhaseSupply_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhaseSupply" ADD CONSTRAINT "ProjectPhaseSupply_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
