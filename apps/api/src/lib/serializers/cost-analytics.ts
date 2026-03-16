import {
  assetCostPerUnitSchema,
  assetCostSummarySchema,
  costForecastSchema,
  householdCostDashboardSchema,
  householdCostOverviewSchema,
  projectBudgetAnalysisSchema,
  serviceProviderSpendSchema
} from "@lifekeeper/types";

export const toAssetCostSummaryResponse = (value: unknown) => assetCostSummarySchema.parse(value);

export const toAssetCostPerUnitResponse = (value: unknown) => assetCostPerUnitSchema.parse(value);

export const toHouseholdCostDashboardResponse = (value: unknown) => householdCostDashboardSchema.parse(value);

export const toServiceProviderSpendResponse = (value: unknown) => serviceProviderSpendSchema.parse(value);

export const toCostForecastResponse = (value: unknown) => costForecastSchema.parse(value);

export const toHouseholdCostOverviewResponse = (value: unknown) => householdCostOverviewSchema.parse(value);

export const toProjectBudgetAnalysisResponse = (value: unknown) => projectBudgetAnalysisSchema.parse(value);