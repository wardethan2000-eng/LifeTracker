-- CreateEnum
CREATE TYPE "CanvasMode" AS ENUM ('diagram', 'floorplan', 'freehand');

-- AlterTable
ALTER TABLE "IdeaCanvas" ADD COLUMN     "canvasMode" "CanvasMode" NOT NULL DEFAULT 'diagram',
ADD COLUMN     "showDimensions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "IdeaCanvasNode" ADD COLUMN     "parentNodeId" TEXT,
ADD COLUMN     "physicalLength" DOUBLE PRECISION,
ADD COLUMN     "pointAx" DOUBLE PRECISION,
ADD COLUMN     "pointAy" DOUBLE PRECISION,
ADD COLUMN     "pointBx" DOUBLE PRECISION,
ADD COLUMN     "pointBy" DOUBLE PRECISION,
ADD COLUMN     "wallAngle" DOUBLE PRECISION,
ADD COLUMN     "wallThickness" DOUBLE PRECISION NOT NULL DEFAULT 6;
