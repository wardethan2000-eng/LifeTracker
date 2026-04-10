import type { JSX } from "react";
import { Suspense } from "react";
import { AssetMaintenanceTab } from "../../../../../components/asset-maintenance-tab";
import {
  getAssetDetail,
  getHouseholdMembers,
  getHouseholdProcedures
} from "../../../../../lib/api";

type AssetMaintenancePageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetMaintenancePage({ params }: AssetMaintenancePageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <MaintenanceContent assetId={assetId} />
    </Suspense>
  );
}

async function MaintenanceContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const detail = await getAssetDetail(assetId);
  const [householdMembers, procedures] = await Promise.all([
    getHouseholdMembers(detail.asset.householdId),
    getHouseholdProcedures(detail.asset.householdId)
  ]);

  return <AssetMaintenanceTab detail={detail} householdMembers={householdMembers} procedures={procedures.map((p) => ({ id: p.id, title: p.title }))} />;
}