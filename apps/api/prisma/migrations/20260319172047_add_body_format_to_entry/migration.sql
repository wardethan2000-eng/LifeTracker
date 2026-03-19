-- CreateEnum
CREATE TYPE "BodyFormat" AS ENUM ('plain_text', 'rich_text');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "bodyFormat" "BodyFormat" NOT NULL DEFAULT 'plain_text';
