-- AlterEnum
ALTER TYPE "EntryEntityType" ADD VALUE 'notebook';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "NoteFolder" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "name" VARCHAR(200) NOT NULL,
    "color" VARCHAR(30),
    "icon" VARCHAR(30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteFolder_householdId_idx" ON "NoteFolder"("householdId");

-- CreateIndex
CREATE INDEX "NoteFolder_parentFolderId_idx" ON "NoteFolder"("parentFolderId");

-- CreateIndex
CREATE INDEX "Entry_folderId_idx" ON "Entry"("folderId");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "NoteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteFolder" ADD CONSTRAINT "NoteFolder_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteFolder" ADD CONSTRAINT "NoteFolder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "NoteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteFolder" ADD CONSTRAINT "NoteFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
