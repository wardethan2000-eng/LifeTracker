-- CreateEnum
CREATE TYPE "CanvasNodeShape" AS ENUM ('rectangle', 'rounded', 'pill', 'diamond');

-- CreateEnum
CREATE TYPE "CanvasEdgeStyle" AS ENUM ('solid', 'dashed', 'dotted');

-- CreateTable
CREATE TABLE "IdeaCanvas" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "entityType" VARCHAR(50),
    "entityId" TEXT,
    "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "panX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "panY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaCanvasNode" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "entryId" TEXT,
    "label" VARCHAR(500) NOT NULL,
    "body" VARCHAR(5000),
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "color" VARCHAR(30),
    "shape" "CanvasNodeShape" NOT NULL DEFAULT 'rectangle',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaCanvasNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaCanvasEdge" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "label" VARCHAR(200),
    "style" "CanvasEdgeStyle" NOT NULL DEFAULT 'solid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaCanvasEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaCanvas_householdId_idx" ON "IdeaCanvas"("householdId");

-- CreateIndex
CREATE INDEX "IdeaCanvas_householdId_entityType_entityId_idx" ON "IdeaCanvas"("householdId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "IdeaCanvasNode_canvasId_idx" ON "IdeaCanvasNode"("canvasId");

-- CreateIndex
CREATE INDEX "IdeaCanvasNode_entryId_idx" ON "IdeaCanvasNode"("entryId");

-- CreateIndex
CREATE INDEX "IdeaCanvasEdge_canvasId_idx" ON "IdeaCanvasEdge"("canvasId");

-- CreateIndex
CREATE INDEX "IdeaCanvasEdge_sourceNodeId_idx" ON "IdeaCanvasEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "IdeaCanvasEdge_targetNodeId_idx" ON "IdeaCanvasEdge"("targetNodeId");

-- AddForeignKey
ALTER TABLE "IdeaCanvas" ADD CONSTRAINT "IdeaCanvas_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvas" ADD CONSTRAINT "IdeaCanvas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasNode" ADD CONSTRAINT "IdeaCanvasNode_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "IdeaCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasNode" ADD CONSTRAINT "IdeaCanvasNode_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasEdge" ADD CONSTRAINT "IdeaCanvasEdge_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "IdeaCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasEdge" ADD CONSTRAINT "IdeaCanvasEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "IdeaCanvasNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaCanvasEdge" ADD CONSTRAINT "IdeaCanvasEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "IdeaCanvasNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
