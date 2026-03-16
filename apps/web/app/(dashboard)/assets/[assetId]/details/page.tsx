import type { JSX } from "react";
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