import type { ShareLink } from "@prisma/client";
import {
  publicAssetReportSchema,
  shareLinkSchema,
  type AssetTimelineItem
} from "@aegis/types";

export const toShareLinkResponse = (
  shareLink: Pick<ShareLink, "id" | "householdId" | "assetId" | "createdById" | "token" | "label" | "expiresAt" | "isRevoked" | "viewCount" | "lastViewedAt" | "dateRangeStart" | "dateRangeEnd" | "createdAt" | "updatedAt">
) => shareLinkSchema.parse({
  id: shareLink.id,
  householdId: shareLink.householdId,
  assetId: shareLink.assetId,
  createdById: shareLink.createdById,
  token: shareLink.token,
  label: shareLink.label ?? null,
  expiresAt: shareLink.expiresAt?.toISOString() ?? null,
  isRevoked: shareLink.isRevoked,
  viewCount: shareLink.viewCount,
  lastViewedAt: shareLink.lastViewedAt?.toISOString() ?? null,
  dateRangeStart: shareLink.dateRangeStart?.toISOString() ?? null,
  dateRangeEnd: shareLink.dateRangeEnd?.toISOString() ?? null,
  createdAt: shareLink.createdAt.toISOString(),
  updatedAt: shareLink.updatedAt.toISOString()
});

export const toPublicAssetReportResponse = (input: {
  asset: {
    name: string;
    category: string;
    manufacturer?: string | null;
    model?: string | null;
    year?: number | null;
  };
  timelineItems: AssetTimelineItem[];
  costSummary: {
    lifetimeCost: number;
    logCount: number;
  };
  generatedAt: Date;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
}) => publicAssetReportSchema.parse({
  assetName: input.asset.name,
  assetCategory: input.asset.category,
  assetMake: input.asset.manufacturer ?? null,
  assetModel: input.asset.model ?? null,
  assetYear: input.asset.year ?? null,
  timelineItems: input.timelineItems,
  costSummary: {
    lifetimeCost: input.costSummary.lifetimeCost,
    logCount: input.costSummary.logCount
  },
  generatedAt: input.generatedAt.toISOString(),
  dateRangeStart: input.dateRangeStart?.toISOString() ?? null,
  dateRangeEnd: input.dateRangeEnd?.toISOString() ?? null
});