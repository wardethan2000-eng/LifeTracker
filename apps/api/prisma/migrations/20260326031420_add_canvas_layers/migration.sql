-- AlterTable
ALTER TABLE "IdeaCanvas" ADD COLUMN     "backgroundImageOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "IdeaCanvasNode" ADD COLUMN     "layerId" TEXT;

-- CreateTable
CREATE TABLE "IdeaCanvasLayer" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaCanvasLayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaCanvasLayer_canvasId_idx" ON "IdeaCanvasLayer"("canvasId");

-- AddForeignKey
ALTER TABLE "IdeaCanvasNode" ADD CONSTRAINT "IdeaCanvasNode_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "IdeaCanvasLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasLayer" ADD CONSTRAINT "IdeaCanvasLayer_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "IdeaCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
