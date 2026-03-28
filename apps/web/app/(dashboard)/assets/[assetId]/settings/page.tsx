import type { JSX } from "react";
import { Suspense } from "react";
import { AssetSettingsTab } from "../../../../../components/asset-settings-tab";
import {
  getAssetDetail,
  getAssetTransferHistory,
  getHouseholdAssets,
  getHouseholdMembers,
  getHouseholdPresets,
  getHouseholdSpacesTree,
  getLibraryPresets
} from "../../../../../lib/api";

type AssetSettingsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetSettingsPage({ params }: AssetSettingsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading settings…</div></div>}>
      <SettingsContent assetId={assetId} />
    </Suspense>
  );
}

async function SettingsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const [detail, libraryPresets, transferHistory] = await Promise.all([
    getAssetDetail(assetId),
    getLibraryPresets(),
    getAssetTransferHistory(assetId)
  ]);
  const [customPresets, householdAssets, householdMembers, spaces] = await Promise.all([
    getHouseholdPresets(detail.asset.householdId),
    getHouseholdAssets(detail.asset.householdId),
    getHouseholdMembers(detail.asset.householdId),
    getHouseholdSpacesTree(detail.asset.householdId).catch(() => [])
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
      spaces={spaces}
    />
  );
}