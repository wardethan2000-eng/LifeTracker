import { z } from "zod";

const comparativeAssetCategorySchema = z.enum([
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

export const comparativeMonthlyCostPointSchema = z.object({
  month: yearMonthSchema,
  cost: z.number()
});

export const comparativeTopPartSchema = z.object({
  itemName: z.string(),
  totalQuantityConsumed: z.number(),
  totalCost: z.number()
});

export const assetComparisonSummarySchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  assetCategory: comparativeAssetCategorySchema,
  totalMaintenanceCost: z.number(),
  totalMaintenanceLogCount: z.number().int().nonnegative(),
  onTimeCompletionCount: z.number().int().nonnegative(),
  lateCompletionCount: z.number().int().nonnegative(),
  onTimeCompletionRate: z.number().nullable(),
  totalPartsConsumed: z.number().int().nonnegative(),
  totalPartsCost: z.number(),
  monthlyCostBreakdown: z.array(comparativeMonthlyCostPointSchema),
  topParts: z.array(comparativeTopPartSchema)
});

export const assetComparisonPayloadSchema = z.object({
  assets: z.array(assetComparisonSummarySchema)
});

export const yearOverYearMonthlyCostPointSchema = z.object({
  month: z.number().int().min(1).max(12),
  cost: z.number()
});

export const yearOverYearSummarySchema = z.object({
  year: z.number().int(),
  totalCost: z.number(),
  totalLogCount: z.number().int().nonnegative(),
  averageCostPerLog: z.number(),
  distinctScheduleCount: z.number().int().nonnegative(),
  monthlyCostBreakdown: z.array(yearOverYearMonthlyCostPointSchema).length(12)
});

export const yearOverYearDeltaSchema = z.object({
  previousYear: z.number().int(),
  currentYear: z.number().int(),
  costChangeAbsolute: z.number(),
  costChangePercentage: z.number().nullable(),
  logCountChangeAbsolute: z.number().int(),
  logCountChangePercentage: z.number().nullable()
}).nullable();

export const yearOverYearPayloadSchema = z.object({
  entityId: z.string(),
  years: z.array(yearOverYearSummarySchema),
  yearOverYearDelta: yearOverYearDeltaSchema
});

export const memberContributionMonthlyPointSchema = z.object({
  month: yearMonthSchema,
  logCount: z.number().int().nonnegative()
});

export const memberMostActiveAssetSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string()
}).nullable();

export const memberContributionSummarySchema = z.object({
  userId: z.string().cuid(),
  userDisplayName: z.string().nullable(),
  userAvatarUrl: z.string().nullable(),
  totalMaintenanceLogsCompleted: z.number().int().nonnegative(),
  totalCostOfWorkLogged: z.number(),
  totalLaborHoursLogged: z.number(),
  distinctAssetCount: z.number().int().nonnegative(),
  monthlyActivityBreakdown: z.array(memberContributionMonthlyPointSchema),
  mostActiveAsset: memberMostActiveAssetSchema
});

export const memberContributionHouseholdTotalsSchema = z.object({
  totalLogs: z.number().int().nonnegative(),
  totalCost: z.number(),
  totalLaborHours: z.number()
});

export const memberContributionPayloadSchema = z.object({
  members: z.array(memberContributionSummarySchema),
  householdTotals: memberContributionHouseholdTotalsSchema
});

export type ComparativeMonthlyCostPoint = z.infer<typeof comparativeMonthlyCostPointSchema>;
export type ComparativeTopPart = z.infer<typeof comparativeTopPartSchema>;
export type AssetComparisonSummary = z.infer<typeof assetComparisonSummarySchema>;
export type AssetComparisonPayload = z.infer<typeof assetComparisonPayloadSchema>;
export type YearOverYearMonthlyCostPoint = z.infer<typeof yearOverYearMonthlyCostPointSchema>;
export type YearOverYearSummary = z.infer<typeof yearOverYearSummarySchema>;
export type YearOverYearDelta = z.infer<typeof yearOverYearDeltaSchema>;
export type YearOverYearPayload = z.infer<typeof yearOverYearPayloadSchema>;
export type MemberContributionMonthlyPoint = z.infer<typeof memberContributionMonthlyPointSchema>;
export type MemberMostActiveAsset = z.infer<typeof memberMostActiveAssetSchema>;
export type MemberContributionSummary = z.infer<typeof memberContributionSummarySchema>;
export type MemberContributionHouseholdTotals = z.infer<typeof memberContributionHouseholdTotalsSchema>;
export type MemberContributionPayload = z.infer<typeof memberContributionPayloadSchema>;