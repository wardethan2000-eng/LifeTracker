-- CreateTable
CREATE TABLE "OverviewPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "itemType" VARCHAR(20) NOT NULL,
    "itemId" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverviewPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OverviewPin_userId_entityType_entityId_idx" ON "OverviewPin"("userId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "OverviewPin_userId_entityType_entityId_itemType_itemId_key" ON "OverviewPin"("userId", "entityType", "entityId", "itemType", "itemId");

-- AddForeignKey
ALTER TABLE "OverviewPin" ADD CONSTRAINT "OverviewPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
