import type { JSX } from "react";
import { AssetCommentsTab } from "../../../../../components/asset-comments-tab";
import {
  getAssetComments,
  getAssetDetail
} from "../../../../../lib/api";

type AssetCommentsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetCommentsPage({ params }: AssetCommentsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const [detail, comments] = await Promise.all([
    getAssetDetail(assetId),
    getAssetComments(assetId)
  ]);

  return <AssetCommentsTab detail={detail} assetId={assetId} comments={comments} />;
}