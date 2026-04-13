-- AlterTable
ALTER TABLE "IdeaCanvas" ADD COLUMN "backgroundImageLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "backgroundImageCropX" DOUBLE PRECISION,
ADD COLUMN "backgroundImageCropY" DOUBLE PRECISION,
ADD COLUMN "backgroundImageCropW" DOUBLE PRECISION,
ADD COLUMN "backgroundImageCropH" DOUBLE PRECISION;
