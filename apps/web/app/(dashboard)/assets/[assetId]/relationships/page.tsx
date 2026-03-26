import type { JSX } from "react";
import {
  getAssetDetail,
  getHouseholdProjects,
  getHouseholdInventory
} from "../../../../../lib/api";
import { AssetRelationshipsTab } from "../../../../../components/asset-relationships-tab";

type AssetRelationshipsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetRelationshipsPage({ params }: AssetRelationshipsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const detail = await getAssetDetail(assetId);
  const householdId = detail.asset.householdId;

  const [projects, inventoryResult] = await Promise.all([
    getHouseholdProjects(householdId).catch(() => []),
    getHouseholdInventory(householdId, { limit: 200 }).catch(() => ({ items: [], nextCursor: null }))
  ]);

  return (
    <AssetRelationshipsTab
      detail={detail}
      assetId={assetId}
      householdId={householdId}
      allProjects={projects}
      allInventoryItems={inventoryResult.items}
    />
  );
}
