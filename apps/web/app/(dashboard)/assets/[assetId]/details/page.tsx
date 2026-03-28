import type { JSX } from "react";
import { Suspense } from "react";
import { AssetDetailsTab } from "../../../../../components/asset-details-tab";
import {
  getAssetDetail,
  getHouseholdPresets,
  getLibraryPresets
} from "../../../../../lib/api";

type AssetDetailsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetDetailsPage({ params }: AssetDetailsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading details…</div></div>}>
      <DetailsContent assetId={assetId} />
    </Suspense>
  );
}

async function DetailsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const [detail, libraryPresets] = await Promise.all([
    getAssetDetail(assetId),
    getLibraryPresets()
  ]);
  const customPresets = await getHouseholdPresets(detail.asset.householdId);

  return (
    <AssetDetailsTab
      detail={detail}
      assetId={assetId}
      libraryPresets={libraryPresets}
      customPresets={customPresets}
    />
  );
}