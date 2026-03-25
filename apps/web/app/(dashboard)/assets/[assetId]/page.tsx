import type { JSX } from "react";
import {
  getAssetDetail,
  getAssetTimeline,
  getAssetTransferHistory,
  getCanvasesByEntity,
  getEntries,
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

  const householdId = detail.asset.householdId;

  const [sourceIdea, entriesResult, canvases] = await Promise.all([
    getSourceIdea(householdId, "asset", assetId).catch(() => null),
    getEntries(householdId, { entityType: "asset", entityId: assetId, limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    getCanvasesByEntity(householdId, "asset", assetId).catch(() => []),
  ]);

  const recentNote = entriesResult.items[0] ?? null;

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
        householdId={householdId}
        recentNote={recentNote ? { id: recentNote.id, title: recentNote.title ?? null, body: recentNote.body, bodyFormat: recentNote.bodyFormat, entryDate: recentNote.entryDate } : null}
        canvases={canvases.map((c) => ({ id: c.id, name: c.name, canvasMode: c.canvasMode, nodeCount: c.nodeCount, edgeCount: c.edgeCount, updatedAt: c.updatedAt }))}
      />
    </>
  );
}
