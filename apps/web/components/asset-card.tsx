import type { AssetOverview } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import {
  formatAssetStateLabel,
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel,
  getAssetTone
} from "../lib/formatters";

type AssetCardProps = {
  asset: AssetOverview;
};

export function AssetCard({ asset }: AssetCardProps): JSX.Element {
  const tone = getAssetTone(asset);
  const subtitle = [asset.asset.manufacturer, asset.asset.model].filter(Boolean).join(" ") || asset.asset.description || "No extra details yet.";
  const activitySummary = asset.overdueScheduleCount > 0
    ? `${asset.overdueScheduleCount} overdue ${asset.overdueScheduleCount === 1 ? "schedule needs" : "schedules need"} recovery.`
    : asset.dueScheduleCount > 0
      ? `${asset.dueScheduleCount} ${asset.dueScheduleCount === 1 ? "schedule is" : "schedules are"} due now.`
      : asset.nextDueAt
        ? `Next scheduled maintenance is ${formatDate(asset.nextDueAt)}.`
        : "No upcoming due date is recorded yet.";

  return (
    <tr className={`ops-registry-row ops-registry-row--${tone}`}>
      <td>
        <div className="ops-registry-row__asset">
          <p className="eyebrow">{formatCategoryLabel(asset.asset.category)}</p>
          <Link href={`/assets/${asset.asset.id}`} className="ops-table__primary-link">{asset.asset.name}</Link>
          <p className="ops-registry-row__meta">{subtitle}</p>
        </div>
      </td>

      <td>
        <div className="ops-registry-row__state">
        <span className={`status-chip status-chip--${tone}`}>{formatAssetStateLabel(asset)}</span>
        <span className="pill">{formatVisibilityLabel(asset.asset.visibility)}</span>
        </div>
      </td>

      <td className="ops-registry-row__metric">
        <strong>{asset.overdueScheduleCount}</strong>
      </td>

      <td className="ops-registry-row__metric">
        <strong>{asset.dueScheduleCount}</strong>
      </td>

      <td>
        <strong>{formatDate(asset.nextDueAt, "No date")}</strong>
      </td>

      <td>
        <strong>{formatDate(asset.lastCompletedAt, "No history")}</strong>
      </td>

      <td>
        <p className="ops-registry-row__meta">{activitySummary}</p>
      </td>

      <td>
        <Link href={`/assets/${asset.asset.id}`} className="text-link">
          Open asset
        </Link>
      </td>
    </tr>
  );
}