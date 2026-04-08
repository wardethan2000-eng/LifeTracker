import {
  projectBudgetBurnPayloadSchema,
  projectPortfolioHealthPayloadSchema,
  projectTaskVelocityPayloadSchema,
  projectTimelinePayloadSchema
} from "@aegis/types";

export const toProjectTimelinePayloadResponse = (value: unknown) => projectTimelinePayloadSchema.parse(value);

export const toProjectBudgetBurnPayloadResponse = (value: unknown) => projectBudgetBurnPayloadSchema.parse(value);

export const toProjectTaskVelocityPayloadResponse = (value: unknown) => projectTaskVelocityPayloadSchema.parse(value);

export const toProjectPortfolioHealthPayloadResponse = (value: unknown) => projectPortfolioHealthPayloadSchema.parse(value);