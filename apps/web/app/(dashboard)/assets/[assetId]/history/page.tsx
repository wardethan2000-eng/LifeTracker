import type { AssetTimelineQuery } from "@lifekeeper/types";
import type { JSX } from "react";
import { Suspense } from "react";
import { AssetHistoryTab } from "../../../../../components/asset-history-tab";
import {
  getAssetDetail,
  getAssetTimeline
} from "../../../../../lib/api";
import {
  getSearchParamValue,
  toDateBoundaryIso,
  type AssetHistoryPageSearchParams
} from "../shared";

type AssetHistoryPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<AssetHistoryPageSearchParams>;
};

export default async function AssetHistoryPage({ params, searchParams }: AssetHistoryPageProps): Promise<JSX.Element> {
  const [{ assetId }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <HistoryContent assetId={assetId} searchParams={resolvedSearchParams} />
    </Suspense>
  );
}

async function HistoryContent({ assetId, searchParams: resolvedSearchParams }: { assetId: string; searchParams: AssetHistoryPageSearchParams }): Promise<JSX.Element> {
  const sourceType = getSearchParamValue(resolvedSearchParams.sourceType);
  const category = getSearchParamValue(resolvedSearchParams.category);
  const search = getSearchParamValue(resolvedSearchParams.search);
  const since = getSearchParamValue(resolvedSearchParams.since);
  const until = getSearchParamValue(resolvedSearchParams.until);
  const cursor = getSearchParamValue(resolvedSearchParams.cursor);
  const sinceIso = toDateBoundaryIso(since, "start");
  const untilIso = toDateBoundaryIso(until, "end");
  const timelineQuery: Partial<AssetTimelineQuery> = {
    ...(sourceType ? { sourceType: sourceType as AssetTimelineQuery["sourceType"] } : {}),
    ...(category ? { category } : {}),
    ...(search ? { search } : {}),
    ...(sinceIso ? { since: sinceIso } : {}),
    ...(untilIso ? { until: untilIso } : {}),
    ...(cursor ? { cursor } : {})
  };
  const [detail, historyTimeline] = await Promise.all([
    getAssetDetail(assetId),
    getAssetTimeline(assetId, timelineQuery)
  ]);

  return (
    <AssetHistoryTab
      detail={detail}
      assetId={assetId}
      searchParams={resolvedSearchParams}
      historyTimeline={historyTimeline}
    />
  );
}