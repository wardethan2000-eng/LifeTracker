-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taskType" TEXT NOT NULL DEFAULT 'full';

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_taskType_idx" ON "ProjectTask"("projectId", "taskType");
