import type { AssetTimelineQuery } from "@lifekeeper/types";
import type { JSX } from "react";
import { AssetHistoryTab } from "../../../../components/asset-history-tab";
import {
  getAssetDetail,
  getAssetTimeline
} from "../../../../lib/api";
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
  const { assetId } = await params;
  const detail = await getAssetDetail(assetId);
  const resolvedSearchParams = await searchParams;
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
  const historyTimeline = await getAssetTimeline(assetId, timelineQuery);

  return (
    <AssetHistoryTab
      detail={detail}
      assetId={assetId}
      searchParams={resolvedSearchParams}
      historyTimeline={historyTimeline}
    />
  );
}