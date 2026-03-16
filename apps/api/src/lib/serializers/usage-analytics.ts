import {
  assetMetricCorrelationMatrixSchema,
  enhancedUsageProjectionSchema,
  metricCorrelationSchema,
  usageCostNormalizationSchema,
  usageRateAnalyticsSchema
} from "@lifekeeper/types";

export const toUsageRateAnalyticsResponse = (payload: {
  metricId: string;
  bucketSize: string;
  mean: number;
  stddev: number;
  buckets: Array<{
    bucketStart: string;
    bucketEnd: string;
    deltaValue: number;
    rate: number;
    entryCount: number;
    insufficientData: boolean;
    isAnomaly: boolean;
    deviationFactor: number;
  }>;
}) => usageRateAnalyticsSchema.parse(payload);

export const toUsageCostNormalizationResponse = (payload: {
  metricId: string;
  metricName: string;
  metricUnit: string;
  totalCost: number;
  totalUsage: number;
  averageCostPerUnit: number;
  entries: Array<{
    cost: number;
    incrementalUsage: number;
    costPerUnit: number;
    completedAt: Date;
    logTitle: string;
  }>;
}) => usageCostNormalizationSchema.parse({
  ...payload,
  entries: payload.entries.map((entry) => ({
    ...entry,
    completedAt: entry.completedAt.toISOString()
  }))
});

export const toEnhancedUsageProjectionResponse = (payload: {
  metricId: string;
  currentValue: number;
  currentRate: number;
  rateUnit: string;
  scheduleProjections: Array<{
    scheduleId: string;
    scheduleName: string;
    nextDueMetricValue: number;
    projectedDate: string | null;
    daysUntil: number | null;
    humanLabel: string;
  }>;
}) => enhancedUsageProjectionSchema.parse(payload);

export const toMetricCorrelationResponse = (payload: {
  metricA: { id: string; name: string };
  metricB: { id: string; name: string };
  correlation: number;
  meanRatio: number;
  divergenceTrend: string;
  ratioSeries: Array<{ date: string; ratio: number }>;
}) => metricCorrelationSchema.parse(payload);

export const toAssetMetricCorrelationMatrixResponse = (payload: {
  assetId: string;
  pairs: Array<{
    metricA: { id: string; name: string };
    metricB: { id: string; name: string };
    correlation: number;
    meanRatio: number;
    divergenceTrend: string;
    ratioSeries: Array<{ date: string; ratio: number }>;
  }>;
}) => assetMetricCorrelationMatrixSchema.parse({
  ...payload,
  pairs: payload.pairs.map(toMetricCorrelationResponse)
});