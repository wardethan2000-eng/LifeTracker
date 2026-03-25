import type { JSX } from "react";
import {
  getAssetDetail,
  getAssetTimeline,
  getAssetTransferHistory,
  getSourceIdea,
} from "../../../../lib/api";
import { AssetOverviewTab } from "../../../../components/asset-overview-tab";
import { IdeaProvenanceBar } from "../../../../components/idea-provenance-bar";

type AssetOverviewPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetOverviewPage({ params }: AssetOverviewPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const [detail, transferHistory, overviewTimeline] = await Promise.all([
    getAssetDetail(assetId),
    getAssetTransferHistory(assetId),
    getAssetTimeline(assetId, { limit: 5 }),
  ]);

  const sourceIdea = await getSourceIdea(detail.asset.householdId, "asset", assetId).catch(() => null);

  return (
    <>
      {sourceIdea && (
        <IdeaProvenanceBar ideaId={sourceIdea.id} ideaTitle={sourceIdea.title} />
      )}
      <AssetOverviewTab
        detail={detail}
        assetId={assetId}
        transferHistory={transferHistory}
        overviewTimeline={overviewTimeline}
      />
    </>
  );
}
