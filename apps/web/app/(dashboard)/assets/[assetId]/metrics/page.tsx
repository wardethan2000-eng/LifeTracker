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
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
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