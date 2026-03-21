-- CreateEnum
CREATE TYPE "IdeaStage" AS ENUM ('spark', 'developing', 'ready');

-- CreateEnum
CREATE TYPE "IdeaPromotionTarget" AS ENUM ('project', 'asset', 'hobby');

-- CreateEnum
CREATE TYPE "IdeaPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "IdeaCategory" AS ENUM ('home_improvement', 'vehicle', 'outdoor', 'technology', 'hobby_craft', 'financial', 'health', 'travel', 'learning', 'other');

-- AlterEnum
ALTER TYPE "AttachmentEntityType" ADD VALUE 'idea';

-- AlterEnum
ALTER TYPE "CommentEntityType" ADD VALUE 'idea';

-- AlterEnum
ALTER TYPE "EntryEntityType" ADD VALUE 'idea';

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" "IdeaStage" NOT NULL DEFAULT 'spark',
    "priority" "IdeaPriority" NOT NULL DEFAULT 'medium',
    "category" "IdeaCategory",
    "promotionTarget" "IdeaPromotionTarget",
    "notes" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "materials" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "promotedAt" TIMESTAMP(3),
    "promotedToType" "IdeaPromotionTarget",
    "promotedToId" TEXT,
    "demotedFromType" "IdeaPromotionTarget",
    "demotedFromId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Idea_householdId_stage_idx" ON "Idea"("householdId", "stage");

-- CreateIndex
CREATE INDEX "Idea_householdId_category_idx" ON "Idea"("householdId", "category");

-- CreateIndex
CREATE INDEX "Idea_householdId_priority_idx" ON "Idea"("householdId", "priority");

-- CreateIndex
CREATE INDEX "Idea_createdById_idx" ON "Idea"("createdById");

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
