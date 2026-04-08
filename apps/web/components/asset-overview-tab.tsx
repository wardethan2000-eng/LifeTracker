import type { AssetDetailResponse, AssetTransferList, Entry, OverviewPin } from "@lifekeeper/types";
import type { JSX } from "react";
import { AssetOverviewGrid } from "./asset-overview-grid";
import type { NccNoteSummary, NccCanvasSummary } from "./notes-canvas-card";
import { formatCurrency } from "../lib/formatters";
import { getDisplayPreferences, getLayoutPreference } from "../lib/api";
import type { AssetTimelineFeed } from "../app/(dashboard)/assets/[assetId]/shared";

type AssetOverviewTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  transferHistory: AssetTransferList;
  overviewTimeline: AssetTimelineFeed;
  householdId: string;
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
  pinnedEntries?: Entry[];
  overviewPins?: OverviewPin[];
};

export async function AssetOverviewTab({ detail, assetId, transferHistory, overviewTimeline, householdId, recentNote, canvases, pinnedEntries, overviewPins }: AssetOverviewTabProps): Promise<JSX.Element> {
  const [prefs, assetLayout] = await Promise.all([
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
    getLayoutPreference("asset", assetId).catch(() => null),
  ]);
  const dueNow = detail.schedules.filter((schedule) => schedule.status === "due" || schedule.status === "overdue");

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="stats-row">
        <div className="stat-card stat-card--accent">
          <span className="stat-card__label">Condition</span>
          <strong className="stat-card__value">{detail.asset.conditionScore ?? "-"}</strong>
          <span className="stat-card__sub">Latest assessment score</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Hierarchy</span>
          <strong className="stat-card__value">{detail.asset.childAssets.length}</strong>
          <span className="stat-card__sub">Child assets linked</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__label">Due Now</span>
          <strong className="stat-card__value">{dueNow.length}</strong>
          <span className="stat-card__sub">Schedules requiring action</span>
        </div>
        <div className="stat-card stat-card--danger">
          <span className="stat-card__label">Last Service Cost</span>
          <strong className="stat-card__value">
            {detail.recentLogs[0]?.cost ? formatCurrency(detail.recentLogs[0].cost, "—", prefs.currencyCode) : "—"}
          </strong>
          <span className="stat-card__sub">Most recent maintenance log</span>
        </div>
      </section>

      <AssetOverviewGrid
        detail={detail}
        assetId={assetId}
        transferHistory={transferHistory}
        overviewTimeline={overviewTimeline}
        householdId={householdId}
        recentNote={recentNote}
        canvases={canvases}
        serverLayout={assetLayout?.layoutJson}
        pinnedEntries={pinnedEntries}
        overviewPins={overviewPins}
      />
    </div>
  );
}