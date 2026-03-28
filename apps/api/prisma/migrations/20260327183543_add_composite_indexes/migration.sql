-- CreateIndex
CREATE INDEX "Asset_householdId_deletedAt_idx" ON "Asset"("householdId", "deletedAt");

-- CreateIndex
CREATE INDEX "Entry_householdId_reminderAt_idx" ON "Entry"("householdId", "reminderAt");
