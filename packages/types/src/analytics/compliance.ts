import { z } from "zod";

const complianceAssetCategorySchema = z.enum([
  "vehicle",
  "home",
  "marine",
  "aircraft",
  "yard",
  "workshop",
  "appliance",
  "hvac",
  "technology",
  "other"
]);

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const complianceStatusSchema = z.enum(["compliant", "non-compliant", "current"]);

export const completionCycleRecordSchema = z.object({
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  assetId: z.string().cuid(),
  assetName: z.string(),
  assetCategory: complianceAssetCategorySchema,
  dueDate: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  deltaInDays: z.number().int().nullable(),
  completedById: z.string().cuid().nullable(),
  completedByName: z.string().nullable()
});

export const complianceBreakdownEntrySchema = z.object({
  totalCycles: z.number().int().nonnegative(),
  onTimeCount: z.number().int().nonnegative(),
  lateCount: z.number().int().nonnegative(),
  onTimeRate: z.number().min(0),
  averageDaysLate: z.number().nullable()
});

export const onTimeRateSummarySchema = complianceBreakdownEntrySchema;

export const onTimeRateByAssetSchema = complianceBreakdownEntrySchema.extend({
  assetId: z.string().cuid(),
  assetName: z.string()
});

export const onTimeRateByCategorySchema = complianceBreakdownEntrySchema.extend({
  category: complianceAssetCategorySchema
});

export const onTimeRateByMemberSchema = complianceBreakdownEntrySchema.extend({
  userId: z.string().cuid(),
  userName: z.string().nullable()
});

export const onTimeRatePayloadSchema = z.object({
  summary: onTimeRateSummarySchema,
  breakdowns: z.object({
    byAsset: z.array(onTimeRateByAssetSchema),
    byCategory: z.array(onTimeRateByCategorySchema),
    byMember: z.array(onTimeRateByMemberSchema)
  })
});

export const overdueTrendPointSchema = z.object({
  month: yearMonthSchema,
  overdueCount: z.number().int().nonnegative(),
  averageDaysLate: z.number().nullable(),
  totalCompletions: z.number().int().nonnegative()
});

export const overdueTrendPayloadSchema = z.object({
  months: z.array(overdueTrendPointSchema),
  trendDirection: z.enum(["improving", "worsening", "stable"])
});

export const categoryWorstScheduleSchema = z.object({
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  assetName: z.string(),
  onTimeRate: z.number().min(0)
});

export const categoryAdherenceSummarySchema = z.object({
  category: complianceAssetCategorySchema,
  activeScheduleCount: z.number().int().nonnegative(),
  totalCyclesInPeriod: z.number().int().nonnegative(),
  onTimeRate: z.number().min(0),
  averageDaysLate: z.number().nullable(),
  worstSchedule: categoryWorstScheduleSchema.nullable()
});

export const categoryAdherencePayloadSchema = z.object({
  categories: z.array(categoryAdherenceSummarySchema)
});

export const complianceReportScheduleSchema = z.object({
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  description: z.string().nullable(),
  triggerType: z.enum(["interval", "usage", "seasonal", "compound", "one_time"]),
  cycles: z.array(completionCycleRecordSchema),
  complianceStatus: complianceStatusSchema
});

export const complianceReportPayloadSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  assetCategory: complianceAssetCategorySchema,
  reportGeneratedAt: z.string().datetime(),
  regulatorySchedules: z.array(complianceReportScheduleSchema),
  overallComplianceStatus: complianceStatusSchema,
  summary: z.object({
    totalRegulatorySchedules: z.number().int().nonnegative(),
    compliantCount: z.number().int().nonnegative(),
    nonCompliantCount: z.number().int().nonnegative(),
    currentCount: z.number().int().nonnegative()
  })
});

export const regulatoryAssetOptionSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  assetCategory: complianceAssetCategorySchema,
  regulatoryScheduleCount: z.number().int().nonnegative()
});

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;
export type CompletionCycleRecord = z.infer<typeof completionCycleRecordSchema>;
export type ComplianceBreakdownEntry = z.infer<typeof complianceBreakdownEntrySchema>;
export type OnTimeRateSummary = z.infer<typeof onTimeRateSummarySchema>;
export type OnTimeRateByAsset = z.infer<typeof onTimeRateByAssetSchema>;
export type OnTimeRateByCategory = z.infer<typeof onTimeRateByCategorySchema>;
export type OnTimeRateByMember = z.infer<typeof onTimeRateByMemberSchema>;
export type OnTimeRatePayload = z.infer<typeof onTimeRatePayloadSchema>;
export type OverdueTrendPoint = z.infer<typeof overdueTrendPointSchema>;
export type OverdueTrendPayload = z.infer<typeof overdueTrendPayloadSchema>;
export type CategoryWorstSchedule = z.infer<typeof categoryWorstScheduleSchema>;
export type CategoryAdherenceSummary = z.infer<typeof categoryAdherenceSummarySchema>;
export type CategoryAdherencePayload = z.infer<typeof categoryAdherencePayloadSchema>;
export type ComplianceReportSchedule = z.infer<typeof complianceReportScheduleSchema>;
export type ComplianceReportPayload = z.infer<typeof complianceReportPayloadSchema>;
export type RegulatoryAssetOption = z.infer<typeof regulatoryAssetOptionSchema>;