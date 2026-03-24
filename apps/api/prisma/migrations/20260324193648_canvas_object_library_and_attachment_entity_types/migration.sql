-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttachmentEntityType" ADD VALUE 'canvas';
ALTER TYPE "AttachmentEntityType" ADD VALUE 'canvas_object';

-- AlterTable
ALTER TABLE "IdeaCanvasNode" ADD COLUMN     "maskJson" TEXT;

-- CreateTable
CREATE TABLE "CanvasObject" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "imageSource" VARCHAR(20) NOT NULL,
    "presetKey" VARCHAR(200),
    "attachmentId" VARCHAR(30),
    "maskData" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasObject_householdId_idx" ON "CanvasObject"("householdId");

-- CreateIndex
CREATE INDEX "CanvasObject_householdId_category_idx" ON "CanvasObject"("householdId", "category");

-- CreateIndex
CREATE INDEX "CanvasObject_householdId_deletedAt_idx" ON "CanvasObject"("householdId", "deletedAt");

-- AddForeignKey
ALTER TABLE "CanvasObject" ADD CONSTRAINT "CanvasObject_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
