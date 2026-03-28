import type { JSX } from "react";
import { Suspense } from "react";
import { AssetMaintenanceTab } from "../../../../../components/asset-maintenance-tab";
import {
  getAssetDetail,
  getHouseholdMembers
} from "../../../../../lib/api";

type AssetMaintenancePageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetMaintenancePage({ params }: AssetMaintenancePageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading maintenance…</div></div>}>
      <MaintenanceContent assetId={assetId} />
    </Suspense>
  );
}

async function MaintenanceContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const detail = await getAssetDetail(assetId);
  const householdMembers = await getHouseholdMembers(detail.asset.householdId);

  return <AssetMaintenanceTab detail={detail} householdMembers={householdMembers} />;
}