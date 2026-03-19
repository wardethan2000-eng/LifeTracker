-- CreateTable
CREATE TABLE "UserLayoutPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50),
    "layoutJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLayoutPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLayoutPreference_userId_idx" ON "UserLayoutPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLayoutPreference_userId_entityType_entityId_key" ON "UserLayoutPreference"("userId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "UserLayoutPreference" ADD CONSTRAINT "UserLayoutPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
