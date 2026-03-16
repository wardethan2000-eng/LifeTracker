import type { AssetDetailResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import { AssetMetricsTab } from "../../../../components/asset-metrics-tab";
import {
  getAssetDetail,
  getAssetMetricCorrelations,
  getEnhancedProjections,
  getMetricCostNormalization,
  getMetricEntries,
  getMetricProjection,
  getMetricRateAnalytics
} from "../../../../lib/api";
import { type MetricInsight } from "../shared";

type AssetMetricsPageProps = {
  params: Promise<{ assetId: string }>;
};

async function loadMetricInsights(assetId: string, detail: AssetDetailResponse): Promise<Record<string, MetricInsight>> {
  const metricPayloads = await Promise.all(
    detail.metrics.map(async (metric) => {
      const [entries, projection, rateAnalytics, costNormalization, enhancedProjection] = await Promise.all([
        getMetricEntries(assetId, metric.id),
        getMetricProjection(assetId, metric.id).catch(() => null),
        getMetricRateAnalytics(assetId, metric.id).catch(() => null),
        getMetricCostNormalization(assetId, metric.id).catch(() => null),
        getEnhancedProjections(assetId, metric.id).catch(() => null)
      ]);

      return {
        metricId: metric.id,
        entries,
        projection,
        rateAnalytics,
        costNormalization,
        enhancedProjection
      } satisfies MetricInsight;
    })
  );

  return Object.fromEntries(metricPayloads.map((item) => [item.metricId, item]));
}

export default async function AssetMetricsPage({ params }: AssetMetricsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const detail = await getAssetDetail(assetId);
  const [metricInsights, metricCorrelations] = await Promise.all([
    loadMetricInsights(assetId, detail),
    getAssetMetricCorrelations(assetId).catch(() => null)
  ]);

  return (
    <AssetMetricsTab
      detail={detail}
      assetId={assetId}
      metricInsights={metricInsights}
      metricCorrelations={metricCorrelations}
    />
  );
}