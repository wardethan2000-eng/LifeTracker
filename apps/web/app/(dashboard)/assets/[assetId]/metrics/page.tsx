import type { JSX } from "react";
import { Suspense } from "react";
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

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading metrics…</div></div>}>
      <MetricsContent assetId={assetId} />
    </Suspense>
  );
}

async function MetricsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
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