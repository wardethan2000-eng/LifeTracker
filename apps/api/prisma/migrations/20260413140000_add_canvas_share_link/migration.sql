-- CreateTable
CREATE TABLE "CanvasShareLink" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "permission" VARCHAR(10) NOT NULL DEFAULT 'view',
    "label" VARCHAR(100),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanvasShareLink_token_key" ON "CanvasShareLink"("token");

-- CreateIndex
CREATE INDEX "CanvasShareLink_canvasId_idx" ON "CanvasShareLink"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasShareLink_token_idx" ON "CanvasShareLink"("token");

-- AddForeignKey
ALTER TABLE "CanvasShareLink" ADD CONSTRAINT "CanvasShareLink_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "IdeaCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasShareLink" ADD CONSTRAINT "CanvasShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
