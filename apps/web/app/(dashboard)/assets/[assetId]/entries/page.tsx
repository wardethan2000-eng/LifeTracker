import type { JSX } from "react";
import { EntryTimeline } from "../../../../../components/entry-system";
import { getAssetDetail } from "../../../../../lib/api";

type AssetEntriesPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetEntriesPage({ params }: AssetEntriesPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const detail = await getAssetDetail(assetId);

  return (
    <EntryTimeline
      householdId={detail.asset.householdId}
      entityType="asset"
      entityId={assetId}
      title="Asset Entries"
      quickAddLabel="Entry"
      entryHrefBuilder={(entry) => `/assets/${assetId}/entries#entry-${entry.id}`}
    />
  );
}