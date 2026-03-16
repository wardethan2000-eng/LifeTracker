import {
  categoryAdherencePayloadSchema,
  complianceReportPayloadSchema,
  onTimeRatePayloadSchema,
  overdueTrendPayloadSchema,
  regulatoryAssetOptionSchema
} from "@lifekeeper/types";

export const toOnTimeRatePayloadResponse = (value: unknown) => onTimeRatePayloadSchema.parse(value);

export const toOverdueTrendPayloadResponse = (value: unknown) => overdueTrendPayloadSchema.parse(value);

export const toCategoryAdherencePayloadResponse = (value: unknown) => categoryAdherencePayloadSchema.parse(value);

export const toComplianceReportPayloadResponse = (value: unknown) => complianceReportPayloadSchema.parse(value);

export const toRegulatoryAssetOptionsResponse = (value: unknown) => regulatoryAssetOptionSchema.array().parse(value);