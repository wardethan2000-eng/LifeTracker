import type { JSX } from "react";
import { AssetMetricsTab } from "../../../../../components/asset-metrics-tab";
import {
  getAssetDetail,
  getAssetMetricCorrelations,
} from "../../../../../lib/api";

type AssetMetricsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetMetricsPage({ params }: AssetMetricsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const [detail, metricCorrelations] = await Promise.all([
    getAssetDetail(assetId),
    getAssetMetricCorrelations(assetId).catch(() => null),
  ]);

  return (
    <AssetMetricsTab
      detail={detail}
      assetId={assetId}
      metricCorrelations={metricCorrelations}
    />
  );
}