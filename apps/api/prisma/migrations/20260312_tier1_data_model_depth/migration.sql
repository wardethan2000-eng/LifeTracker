-- 1. Asset Hierarchy: parentAssetId self-reference
ALTER TABLE "Asset" ADD COLUMN "parentAssetId" TEXT;
CREATE INDEX "Asset_parentAssetId_idx" ON "Asset"("parentAssetId");
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Structured JSONB fields on Asset
ALTER TABLE "Asset" ADD COLUMN "purchaseDetails" JSONB;
ALTER TABLE "Asset" ADD COLUMN "warrantyDetails" JSONB;
ALTER TABLE "Asset" ADD COLUMN "locationDetails" JSONB;
ALTER TABLE "Asset" ADD COLUMN "insuranceDetails" JSONB;
ALTER TABLE "Asset" ADD COLUMN "dispositionDetails" JSONB;
ALTER TABLE "Asset" ADD COLUMN "conditionScore" INTEGER;
ALTER TABLE "Asset" ADD COLUMN "conditionHistory" JSONB NOT NULL DEFAULT '[]';

-- 3. UsageMetricEntry time-series table
CREATE TABLE "UsageMetricEntry" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageMetricEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UsageMetricEntry_metricId_recordedAt_idx" ON "UsageMetricEntry"("metricId", "recordedAt");
ALTER TABLE "UsageMetricEntry" ADD CONSTRAINT "UsageMetricEntry_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "UsageMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. ServiceProvider model
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceProvider_householdId_idx" ON "ServiceProvider"("householdId");
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. serviceProviderId on MaintenanceLog
ALTER TABLE "MaintenanceLog" ADD COLUMN "serviceProviderId" TEXT;
CREATE INDEX "MaintenanceLog_serviceProviderId_idx" ON "MaintenanceLog"("serviceProviderId");
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. MaintenanceLogPart model
CREATE TABLE "MaintenanceLogPart" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION,
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLogPart_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceLogPart_logId_idx" ON "MaintenanceLogPart"("logId");
ALTER TABLE "MaintenanceLogPart" ADD CONSTRAINT "MaintenanceLogPart_logId_fkey" FOREIGN KEY ("logId") REFERENCES "MaintenanceLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
