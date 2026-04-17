import type { JSX } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { AssetDetailsTab } from "../../../../../components/asset-details-tab";
import { AssetHistoryTab } from "../../../../../components/asset-history-tab";
import { AssetMetricsTab } from "../../../../../components/asset-metrics-tab";
import { AssetRelationshipsTab } from "../../../../../components/asset-relationships-tab";
import {
  getAssetDetail,
  getAssetMetricCorrelations,
  getAssetTimeline,
  getHouseholdInventory,
  getHouseholdProjects,
} from "../../../../../lib/api";

type AssetDetailsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetDetailsPage({ params }: AssetDetailsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <DetailsContent assetId={assetId} />
    </Suspense>
  );
}

async function DetailsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const [detail, metricCorrelations, historyTimeline] = await Promise.all([
    getAssetDetail(assetId),
    getAssetMetricCorrelations(assetId).catch(() => null),
    getAssetTimeline(assetId, { limit: 25 }).catch(() => ({ items: [], nextCursor: null, totalSources: 0 })),
  ]);
  const householdId = detail.asset.householdId;
  const [projects, inventoryResult] = await Promise.all([
    getHouseholdProjects(householdId).catch(() => []),
    getHouseholdInventory(householdId, { limit: 200 }).catch(() => ({ items: [], nextCursor: null })),
  ]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="panel">
        <div className="panel__body--padded" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="#asset-profile" className="button button--ghost button--sm">Profile</a>
          <a href="#asset-relationships" className="button button--ghost button--sm">Relationships</a>
          <a href="#asset-metrics" className="button button--ghost button--sm">Metrics</a>
          <a href="#asset-history" className="button button--ghost button--sm">History</a>
          <Link href={`/assets/${assetId}/history`} className="button button--sm">Open full history</Link>
        </div>
      </section>

      <section id="asset-profile">
        <AssetDetailsTab
          detail={detail}
          assetId={assetId}
        />
      </section>

      <section id="asset-relationships">
        <AssetRelationshipsTab
          detail={detail}
          assetId={assetId}
          householdId={householdId}
          allProjects={projects}
          allInventoryItems={inventoryResult.items}
        />
      </section>

      <section id="asset-metrics">
        <AssetMetricsTab
          detail={detail}
          assetId={assetId}
          metricCorrelations={metricCorrelations}
        />
      </section>

      <section id="asset-history">
        <AssetHistoryTab
          detail={detail}
          assetId={assetId}
          searchParams={{}}
          historyTimeline={historyTimeline}
        />
      </section>
    </div>
  );
}
