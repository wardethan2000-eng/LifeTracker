CREATE TYPE "CommentEntityType" AS ENUM ('asset', 'project', 'hobby', 'inventory_item');

CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

ALTER TABLE "MaintenanceSchedule"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "MaintenanceLog"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Project"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "InventoryItem"
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Comment"
ADD COLUMN "householdId" TEXT,
ADD COLUMN "entityType" "CommentEntityType",
ADD COLUMN "entityId" TEXT,
ADD COLUMN "projectId" TEXT,
ADD COLUMN "hobbyId" TEXT,
ADD COLUMN "inventoryItemId" TEXT;

UPDATE "Comment" AS c
SET
    "householdId" = a."householdId",
    "entityType" = 'asset'::"CommentEntityType",
    "entityId" = c."assetId"
FROM "Asset" AS a
WHERE a."id" = c."assetId";

ALTER TABLE "Comment"
ALTER COLUMN "householdId" SET NOT NULL,
ALTER COLUMN "entityType" SET NOT NULL,
ALTER COLUMN "entityId" SET NOT NULL,
ALTER COLUMN "assetId" DROP NOT NULL;

CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "subscribedEventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "domainEventId" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookDelivery_webhookEndpointId_domainEventId_key" ON "WebhookDelivery"("webhookEndpointId", "domainEventId");

CREATE INDEX "MaintenanceSchedule_assetId_deletedAt_idx" ON "MaintenanceSchedule"("assetId", "deletedAt");

CREATE INDEX "MaintenanceLog_assetId_deletedAt_idx" ON "MaintenanceLog"("assetId", "deletedAt");

CREATE INDEX "Project_householdId_deletedAt_idx" ON "Project"("householdId", "deletedAt");

CREATE INDEX "InventoryItem_householdId_deletedAt_idx" ON "InventoryItem"("householdId", "deletedAt");

CREATE INDEX "Comment_householdId_entityType_entityId_createdAt_idx" ON "Comment"("householdId", "entityType", "entityId", "createdAt");

CREATE INDEX "Comment_projectId_createdAt_idx" ON "Comment"("projectId", "createdAt");

CREATE INDEX "Comment_hobbyId_createdAt_idx" ON "Comment"("hobbyId", "createdAt");

CREATE INDEX "Comment_inventoryItemId_createdAt_idx" ON "Comment"("inventoryItemId", "createdAt");

CREATE INDEX "DomainEvent_householdId_createdAt_idx" ON "DomainEvent"("householdId", "createdAt");

CREATE INDEX "DomainEvent_householdId_eventType_idx" ON "DomainEvent"("householdId", "eventType");

CREATE INDEX "DomainEvent_entityType_entityId_idx" ON "DomainEvent"("entityType", "entityId");

CREATE INDEX "WebhookEndpoint_householdId_idx" ON "WebhookEndpoint"("householdId");

CREATE INDEX "WebhookEndpoint_householdId_deletedAt_idx" ON "WebhookEndpoint"("householdId", "deletedAt");

CREATE INDEX "WebhookEndpoint_householdId_isActive_idx" ON "WebhookEndpoint"("householdId", "isActive");

CREATE INDEX "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");

CREATE INDEX "WebhookDelivery_webhookEndpointId_idx" ON "WebhookDelivery"("webhookEndpointId");

CREATE INDEX "WebhookDelivery_domainEventId_idx" ON "WebhookDelivery"("domainEventId");

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_hobbyId_fkey"
FOREIGN KEY ("hobbyId") REFERENCES "Hobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DomainEvent"
ADD CONSTRAINT "DomainEvent_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEndpoint"
ADD CONSTRAINT "WebhookEndpoint_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_webhookEndpointId_fkey"
FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_domainEventId_fkey"
FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
