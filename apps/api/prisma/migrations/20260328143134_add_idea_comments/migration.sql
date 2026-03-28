-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "ideaId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_ideaId_createdAt_idx" ON "Comment"("ideaId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
