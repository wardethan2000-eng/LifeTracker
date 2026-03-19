import type { JSX } from "react";
import {
  getAssetDetail,
  getAssetTimeline,
  getAssetTransferHistory,
} from "../../../../lib/api";
import { AssetDashboard } from "../../../../components/asset-dashboard";

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

  const dueWork = detail.schedules
    .filter((s) => s.status === "due" || s.status === "overdue")
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      nextDueAt: s.nextDueAt ?? null,
    }));

  const recentLogs = detail.recentLogs.slice(0, 5).map((log) => ({
    id: log.id,
    title: log.scheduleName ?? "Maintenance",
    performedAt: log.performedDate,
    cost: log.cost ?? null,
  }));

  const recentTimeline = overviewTimeline.items.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    sourceType: item.sourceType,
    eventDate: item.eventDate,
  }));

  const hobbyLinks = detail.hobbyLinks.map((l) => ({
    id: l.id,
    hobbyId: l.hobbyId,
    hobbyName: l.hobbyName,
    hobbyStatus: l.hobbyStatus,
  }));

  return (
    <AssetDashboard
      householdId={detail.asset.householdId}
      assetId={assetId}
      conditionScore={detail.asset.conditionScore ?? null}
      childAssetCount={detail.asset.childAssets.length}
      dueScheduleCount={detail.dueScheduleCount}
      overdueScheduleCount={detail.overdueScheduleCount}
      totalSchedules={detail.schedules.length}
      recentLogCount={detail.recentLogs.length}
      dueWork={dueWork}
      recentLogs={recentLogs}
      recentTimeline={recentTimeline}
      hobbyLinks={hobbyLinks}
      transferCount={transferHistory.items.length}
    />
  );
}
