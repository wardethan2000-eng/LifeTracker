ALTER TABLE "ProjectPhase"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ProjectTask"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ProjectNote"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ProjectExpense"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ProjectPhaseSupply"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "ProjectPhase_projectId_deletedAt_idx" ON "ProjectPhase"("projectId", "deletedAt");
CREATE INDEX "ProjectTask_projectId_deletedAt_idx" ON "ProjectTask"("projectId", "deletedAt");
CREATE INDEX "ProjectTask_phaseId_deletedAt_idx" ON "ProjectTask"("phaseId", "deletedAt");
CREATE INDEX "ProjectNote_projectId_deletedAt_idx" ON "ProjectNote"("projectId", "deletedAt");
CREATE INDEX "ProjectNote_phaseId_deletedAt_idx" ON "ProjectNote"("phaseId", "deletedAt");
CREATE INDEX "ProjectExpense_projectId_deletedAt_idx" ON "ProjectExpense"("projectId", "deletedAt");
CREATE INDEX "ProjectExpense_phaseId_deletedAt_idx" ON "ProjectExpense"("phaseId", "deletedAt");
CREATE INDEX "ProjectPhaseSupply_phaseId_deletedAt_idx" ON "ProjectPhaseSupply"("phaseId", "deletedAt");