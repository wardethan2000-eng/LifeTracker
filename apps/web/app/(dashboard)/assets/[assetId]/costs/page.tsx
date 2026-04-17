import type { JSX } from "react";
import { Suspense } from "react";
import { AssetCostsTab } from "../../../../../components/asset-costs-tab";
import { AssetTcoPanel } from "../../../../../components/asset-tco-panel";
import {
  getAssetCostForecast,
  getAssetCostPerUnit,
  getAssetCostSummary,
  getAssetTco,
} from "../../../../../lib/api";

type AssetCostsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetCostsPage({ params }: AssetCostsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <CostsContent assetId={assetId} />
    </Suspense>
  );
}

async function CostsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const [costSummary, costPerUnit, costForecast, tco] = await Promise.all([
    getAssetCostSummary(assetId).catch(() => null),
    getAssetCostPerUnit(assetId).catch(() => null),
    getAssetCostForecast(assetId).catch(() => null),
    getAssetTco(assetId).catch(() => null),
  ]);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="panel">
        <div className="panel__body--padded" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="#asset-costs" className="button button--ghost button--sm">Maintenance costs</a>
          {tco ? <a href="#asset-tco" className="button button--ghost button--sm">TCO</a> : null}
        </div>
      </section>

      <section id="asset-costs">
        <AssetCostsTab
          costSummary={costSummary}
          costPerUnit={costPerUnit}
          costForecast={costForecast}
        />
      </section>

      {tco ? (
        <AssetTcoPanel
          breakdown={tco.breakdown}
          timeline={tco.timeline}
          failureSummary={tco.failureSummary}
        />
      ) : null}
    </div>
  );
}
