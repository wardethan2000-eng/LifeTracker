ALTER TABLE "ProjectTask"
  ADD COLUMN "estimatedHours" DOUBLE PRECISION,
  ADD COLUMN "actualHours" DOUBLE PRECISION;

CREATE TABLE "ProjectTaskDependency" (
  "predecessorTaskId" TEXT NOT NULL,
  "successorTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectTaskDependency_pkey" PRIMARY KEY ("predecessorTaskId", "successorTaskId")
);

CREATE TABLE "ProjectTemplate" (
  "id" TEXT NOT NULL,
  "householdId" TEXT NOT NULL,
  "sourceProjectId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectTaskDependency_successorTaskId_idx"
  ON "ProjectTaskDependency"("successorTaskId");

CREATE INDEX "ProjectTemplate_householdId_createdAt_idx"
  ON "ProjectTemplate"("householdId", "createdAt");

CREATE INDEX "ProjectTemplate_sourceProjectId_idx"
  ON "ProjectTemplate"("sourceProjectId");

ALTER TABLE "ProjectTaskDependency"
  ADD CONSTRAINT "ProjectTaskDependency_predecessorTaskId_fkey"
  FOREIGN KEY ("predecessorTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTaskDependency"
  ADD CONSTRAINT "ProjectTaskDependency_successorTaskId_fkey"
  FOREIGN KEY ("successorTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTemplate"
  ADD CONSTRAINT "ProjectTemplate_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTemplate"
  ADD CONSTRAINT "ProjectTemplate_sourceProjectId_fkey"
  FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;