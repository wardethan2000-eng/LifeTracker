import type { JSX } from "react";
import {
  getAssetDetail,
  getAssetTimeline,
  getAssetTransferHistory,
  getCanvasesByEntity,
  getEntries,
  getMe,
  getOverviewPins,
  getSourceIdea,
} from "../../../../lib/api";
import { AssetOverviewTab } from "../../../../components/asset-overview-tab";
import { IdeaProvenanceBar } from "../../../../components/idea-provenance-bar";
import { PinnedOverviewSection } from "../../../../components/pinned-overview-section";

type AssetOverviewPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetOverviewPage({ params }: AssetOverviewPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  // getMe() is cached for 5 min, so this is effectively free. We use it to
  // get householdId up-front so all 7 data calls can run in a single parallel batch.
  const me = await getMe();
  const householdId = me.households[0]?.id ?? "";

  const [detail, transferHistory, overviewTimeline, sourceIdea, entriesResult, canvases, pinnedResult, overviewPins] = await Promise.all([
    getAssetDetail(assetId),
    getAssetTransferHistory(assetId),
    getAssetTimeline(assetId, { limit: 5 }),
    getSourceIdea(householdId, "asset", assetId).catch(() => null),
    getEntries(householdId, { entityType: "asset", entityId: assetId, limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    getCanvasesByEntity(householdId, "asset", assetId).catch(() => []),
    getEntries(householdId, { entityType: "asset", entityId: assetId, flags: ["pinned"], limit: 10 }).catch(() => ({ items: [], nextCursor: null })),
    getOverviewPins("asset", assetId).catch(() => []),
  ]);

  // householdId validated against the actual asset after the parallel fetch
  const resolvedHouseholdId = detail.asset.householdId;

  const recentNote = entriesResult.items[0] ?? null;

  return (
    <>
      {sourceIdea && (
        <IdeaProvenanceBar ideaId={sourceIdea.id} ideaTitle={sourceIdea.title} />
      )}
      <PinnedOverviewSection
        householdId={resolvedHouseholdId}
        entityType="asset"
        entityId={assetId}
        entries={pinnedResult.items}
        overviewPins={overviewPins}
      />
      <AssetOverviewTab
        detail={detail}
        assetId={assetId}
        transferHistory={transferHistory}
        overviewTimeline={overviewTimeline}
        householdId={resolvedHouseholdId}
        recentNote={recentNote ? { id: recentNote.id, title: recentNote.title ?? null, body: recentNote.body, bodyFormat: recentNote.bodyFormat, entryDate: recentNote.entryDate } : null}
        canvases={canvases.map((c) => ({ id: c.id, name: c.name, canvasMode: c.canvasMode, nodeCount: c.nodeCount, edgeCount: c.edgeCount, updatedAt: c.updatedAt }))}
        pinnedEntries={pinnedResult.items}
        overviewPins={overviewPins}
      />
    </>
  );
}
