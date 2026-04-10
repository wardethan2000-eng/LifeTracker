import type { UsageMetric, UsageMetricEntry } from "@prisma/client";
import {
  usageMetricEntrySchema,
  usageMetricResponseSchema
} from "@aegis/types";

export const toUsageMetricResponse = (
  metric: Pick<UsageMetric, "id" | "assetId" | "name" | "unit" | "currentValue" | "lastRecordedAt" | "createdAt" | "updatedAt">
) => usageMetricResponseSchema.parse({
  ...metric,
  lastRecordedAt: metric.lastRecordedAt?.toISOString() ?? null,
  createdAt: metric.createdAt.toISOString(),
  updatedAt: metric.updatedAt.toISOString()
});

export const toUsageMetricEntryResponse = (
  entry: Pick<UsageMetricEntry, "id" | "metricId" | "value" | "recordedAt" | "source" | "notes" | "costPerUnit" | "totalCost" | "createdAt" | "updatedAt">
) => usageMetricEntrySchema.parse({
  ...entry,
  costPerUnit: entry.costPerUnit ?? null,
  totalCost: entry.totalCost ?? null,
  recordedAt: entry.recordedAt.toISOString(),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
});