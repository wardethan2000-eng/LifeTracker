import type { JSX } from "react";
import { Suspense } from "react";
import { AssetCostsTab } from "../../../../../components/asset-costs-tab";
import {
  getAssetCostForecast,
  getAssetCostPerUnit,
  getAssetCostSummary
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
  const [costSummary, costPerUnit, costForecast] = await Promise.all([
    getAssetCostSummary(assetId).catch(() => null),
    getAssetCostPerUnit(assetId).catch(() => null),
    getAssetCostForecast(assetId).catch(() => null)
  ]);

  return (
    <AssetCostsTab
      costSummary={costSummary}
      costPerUnit={costPerUnit}
      costForecast={costForecast}
    />
  );
}