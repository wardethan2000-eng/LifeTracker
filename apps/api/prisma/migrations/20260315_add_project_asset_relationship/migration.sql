-- CreateEnum
CREATE TYPE "ProjectAssetRelationship" AS ENUM ('target', 'produces', 'consumes', 'supports');

-- AlterTable
ALTER TABLE "ProjectAsset" ADD COLUMN "relationship" "ProjectAssetRelationship" NOT NULL DEFAULT 'target';

-- DataMigration: map obvious role strings to relationship types
UPDATE "ProjectAsset"
SET "relationship" = 'produces'
WHERE LOWER("role") SIMILAR TO '%(produce|creat|build|install)%';

UPDATE "ProjectAsset"
SET "relationship" = 'supports'
WHERE LOWER("role") SIMILAR TO '%(support|tool|transport|haul)%'
  AND "relationship" = 'target';

UPDATE "ProjectAsset"
SET "relationship" = 'consumes'
WHERE LOWER("role") SIMILAR TO '%(remov|consum|demolish|dispos)%'
  AND "relationship" = 'target';
