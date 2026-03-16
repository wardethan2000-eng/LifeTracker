import type { JSX } from "react";
import { AssetSettingsTab } from "../../../../components/asset-settings-tab";
import {
  getAssetDetail,
  getAssetTransferHistory,
  getHouseholdAssets,
  getHouseholdMembers,
  getHouseholdPresets,
  getLibraryPresets
} from "../../../../lib/api";

type AssetSettingsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetSettingsPage({ params }: AssetSettingsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const detail = await getAssetDetail(assetId);
  const [libraryPresets, customPresets, householdAssets, householdMembers, transferHistory] = await Promise.all([
    getLibraryPresets(),
    getHouseholdPresets(detail.asset.householdId),
    getHouseholdAssets(detail.asset.householdId),
    getHouseholdMembers(detail.asset.householdId),
    getAssetTransferHistory(assetId)
  ]);

  return (
    <AssetSettingsTab
      detail={detail}
      assetId={assetId}
      libraryPresets={libraryPresets}
      customPresets={customPresets}
      householdAssets={householdAssets}
      householdMembers={householdMembers}
      transferHistory={transferHistory}
    />
  );
}