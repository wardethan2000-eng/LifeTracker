-- AlterTable: Add floorNumber to IdeaCanvasLayer
ALTER TABLE "IdeaCanvasLayer" ADD COLUMN "floorNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add fromFloor/toFloor to IdeaCanvasNode for stair linking
ALTER TABLE "IdeaCanvasNode" ADD COLUMN "fromFloor" INTEGER;
ALTER TABLE "IdeaCanvasNode" ADD COLUMN "toFloor" INTEGER;
