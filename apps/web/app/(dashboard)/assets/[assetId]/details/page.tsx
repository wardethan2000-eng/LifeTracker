import type { JSX } from "react";
import { Suspense } from "react";
import { AssetDetailsTab } from "../../../../../components/asset-details-tab";
import { getAssetDetail } from "../../../../../lib/api";

type AssetDetailsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetDetailsPage({ params }: AssetDetailsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <DetailsContent assetId={assetId} />
    </Suspense>
  );
}

async function DetailsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  const detail = await getAssetDetail(assetId);

  return (
    <AssetDetailsTab
      detail={detail}
      assetId={assetId}
    />
  );
}