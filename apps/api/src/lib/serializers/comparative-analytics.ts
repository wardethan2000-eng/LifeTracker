import {
  assetComparisonPayloadSchema,
  memberContributionPayloadSchema,
  yearOverYearPayloadSchema
} from "@lifekeeper/types";

export const toAssetComparisonPayloadResponse = (value: unknown) => assetComparisonPayloadSchema.parse(value);

export const toYearOverYearPayloadResponse = (value: unknown) => yearOverYearPayloadSchema.parse(value);

export const toMemberContributionPayloadResponse = (value: unknown) => memberContributionPayloadSchema.parse(value);