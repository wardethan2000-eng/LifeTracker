-- CreateTable
CREATE TABLE "AssetTimelineEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'note',
    "cost" DOUBLE PRECISION,
    "vendor" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetTimelineEntry_assetId_entryDate_idx" ON "AssetTimelineEntry"("assetId", "entryDate");

-- CreateIndex
CREATE INDEX "AssetTimelineEntry_createdById_idx" ON "AssetTimelineEntry"("createdById");

-- CreateIndex
CREATE INDEX "AssetTimelineEntry_category_idx" ON "AssetTimelineEntry"("category");

-- AddForeignKey
ALTER TABLE "AssetTimelineEntry" ADD CONSTRAINT "AssetTimelineEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTimelineEntry" ADD CONSTRAINT "AssetTimelineEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
