import type {
  AssetDetailResponse,
  AssetTimelineQuery
} from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import {
  createTimelineEntryAction,
  deleteTimelineEntryAction,
  updateTimelineEntryAction
} from "../app/actions";
import { AssetExportActions } from "./asset-export-actions";
import { TimelineEntryForm } from "./timeline-entry-form";
import { TimelineFilters } from "./timeline-filters";
import { TimelineItem } from "./timeline-item";
import { getAssetTimeline } from "../lib/api";
import { buildAssetDetailHref, getSearchParamValue, toDateBoundaryIso, type AssetDetailPageSearchParams } from "../lib/asset-detail-helpers";
import { formatCurrency } from "../lib/formatters";

type AssetHistoryTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  searchParams: AssetDetailPageSearchParams;
};

export async function AssetHistoryTab({ detail, assetId, searchParams }: AssetHistoryTabProps): Promise<JSX.Element> {
  const sourceType = getSearchParamValue(searchParams.sourceType);
  const category = getSearchParamValue(searchParams.category);
  const search = getSearchParamValue(searchParams.search);
  const since = getSearchParamValue(searchParams.since);
  const until = getSearchParamValue(searchParams.until);
  const cursor = getSearchParamValue(searchParams.cursor);
  const showAddForm = getSearchParamValue(searchParams.showAddForm) === "true";
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
  const items = historyTimeline.items;
  const maintenanceLogCount = items.filter((item) => item.sourceType === "maintenance_log").length;
  const manualEntryCount = items.filter((item) => item.sourceType === "timeline_entry").length;
  const totalCost = items.reduce((sum, item) => sum + (item.cost ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="stats-row">
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">Total Events</span>
          <strong className="stat-card__value">{items.length}</strong>
          <span className="stat-card__sub">Events in the current result set</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Maintenance Logs</span>
          <strong className="stat-card__value">{maintenanceLogCount}</strong>
          <span className="stat-card__sub">Logged service history entries</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__label">Manual Entries</span>
          <strong className="stat-card__value">{manualEntryCount}</strong>
          <span className="stat-card__sub">User-authored asset notes</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__label">Total Cost</span>
          <strong className="stat-card__value">{formatCurrency(totalCost, "$0.00")}</strong>
          <span className="stat-card__sub">Visible spend across these events</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel__body--padded" style={{ display: "grid", gap: "16px" }}>
          <AssetExportActions
            assetId={detail.asset.id}
            assetTag={detail.asset.assetTag}
            assetName={detail.asset.name}
            householdId={detail.asset.householdId}
          />

          <TimelineFilters
            assetId={detail.asset.id}
            currentFilters={{
              ...(sourceType ? { sourceType } : {}),
              ...(category ? { category } : {}),
              ...(search ? { search } : {}),
              ...(since ? { since } : {}),
              ...(until ? { until } : {})
            }}
          />

          {showAddForm ? (
            <TimelineEntryForm
              assetId={detail.asset.id}
              householdId={detail.asset.householdId}
              createAction={createTimelineEntryAction}
            />
          ) : null}

          {items.length === 0 ? (
            <div className="timeline-empty">
              No history recorded yet. Use the + Add Entry button to start building this asset&apos;s timeline, or log maintenance on the Maintenance tab.
            </div>
          ) : (
            <div className="timeline-feed">
              {items.map((item) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  assetId={detail.asset.id}
                  householdId={detail.asset.householdId}
                  updateAction={updateTimelineEntryAction}
                  deleteAction={deleteTimelineEntryAction}
                />
              ))}
            </div>
          )}

          {historyTimeline.nextCursor ? (
            <div className="timeline-load-more">
              <Link
                href={buildAssetDetailHref(detail.asset.id, searchParams, { tab: "history", cursor: historyTimeline.nextCursor })}
                className="button button--ghost"
              >
                Load older events
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}