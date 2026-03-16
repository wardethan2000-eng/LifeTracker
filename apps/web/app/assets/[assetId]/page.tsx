import type { JSX } from "react";
import { AssetOverviewTab } from "../../../components/asset-overview-tab";
import {
  getAssetDetail,
  getAssetTimeline,
  getAssetTransferHistory
} from "../../../lib/api";

type AssetOverviewPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetOverviewPage({ params }: AssetOverviewPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const [detail, transferHistory, overviewTimeline] = await Promise.all([
    getAssetDetail(assetId),
    getAssetTransferHistory(assetId),
    getAssetTimeline(assetId, { limit: 5 })
  ]);

  return (
    <AssetOverviewTab
      detail={detail}
      assetId={assetId}
      transferHistory={transferHistory}
      overviewTimeline={overviewTimeline}
    />
  );
}
