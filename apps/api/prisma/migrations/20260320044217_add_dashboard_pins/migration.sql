-- CreateTable
CREATE TABLE "DashboardPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardPin_userId_idx" ON "DashboardPin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardPin_userId_entityType_entityId_key" ON "DashboardPin"("userId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "DashboardPin" ADD CONSTRAINT "DashboardPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
