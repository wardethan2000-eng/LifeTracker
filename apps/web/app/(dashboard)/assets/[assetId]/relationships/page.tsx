import type { JSX } from "react";
import { Suspense } from "react";
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

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <RelationshipsContent assetId={assetId} />
    </Suspense>
  );
}

async function RelationshipsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
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
