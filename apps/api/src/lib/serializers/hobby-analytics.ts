import {
  hobbyAnalyticsOverviewPayloadSchema,
  hobbyGoalProgressPayloadSchema,
  hobbyPracticeStreaksPayloadSchema,
  hobbySessionFrequencyPayloadSchema
} from "@aegis/types";

export const toHobbySessionFrequencyPayloadResponse = (value: unknown) => hobbySessionFrequencyPayloadSchema.parse(value);

export const toHobbyPracticeStreaksPayloadResponse = (value: unknown) => hobbyPracticeStreaksPayloadSchema.parse(value);

export const toHobbyGoalProgressPayloadResponse = (value: unknown) => hobbyGoalProgressPayloadSchema.parse(value);

export const toHobbyAnalyticsOverviewPayloadResponse = (value: unknown) => hobbyAnalyticsOverviewPayloadSchema.parse(value);