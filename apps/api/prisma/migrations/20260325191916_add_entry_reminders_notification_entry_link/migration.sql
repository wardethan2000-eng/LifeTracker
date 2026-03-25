-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'note_reminder';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderRepeatDays" INTEGER,
ADD COLUMN     "reminderUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "entryId" TEXT;

-- AlterTable
ALTER TABLE "ProjectTaskDependency" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Entry_reminderAt_idx" ON "Entry"("reminderAt");

-- CreateIndex
CREATE INDEX "Notification_entryId_idx" ON "Notification"("entryId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
