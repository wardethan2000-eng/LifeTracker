-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "spaceId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_spaceId_idx" ON "Asset"("spaceId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
