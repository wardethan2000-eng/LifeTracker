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
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading costs…</div></div>}>
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