-- DropIndex
DROP INDEX "SearchIndex_searchVector_idx";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentProjectId" TEXT;

-- CreateIndex
CREATE INDEX "Project_parentProjectId_idx" ON "Project"("parentProjectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
