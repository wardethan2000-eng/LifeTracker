ALTER TABLE "ProjectPhaseSupply"
ADD COLUMN "category" TEXT;

CREATE INDEX "ProjectPhaseSupply_phaseId_category_sortOrder_idx"
ON "ProjectPhaseSupply"("phaseId", "category", "sortOrder");