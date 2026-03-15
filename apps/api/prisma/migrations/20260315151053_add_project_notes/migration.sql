-- CreateEnum
CREATE TYPE "NoteCategory" AS ENUM ('research', 'reference', 'decision', 'measurement', 'general');

-- CreateTable
CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "category" "NoteCategory" NOT NULL DEFAULT 'general',
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_category_idx" ON "ProjectNote"("projectId", "category");

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_isPinned_idx" ON "ProjectNote"("projectId", "isPinned");

-- CreateIndex
CREATE INDEX "ProjectNote_phaseId_idx" ON "ProjectNote"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectNote_createdById_idx" ON "ProjectNote"("createdById");

-- AddForeignKey
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
