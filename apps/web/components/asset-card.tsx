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

  return (
    <article className={`asset-card asset-card--${tone}`}>
      <div className="asset-card__header">
        <div>
          <p className="eyebrow">{formatCategoryLabel(asset.asset.category)}</p>
          <h3>{asset.asset.name}</h3>
          <p className="asset-card__subtitle">{subtitle}</p>
        </div>
        <span className={`status-chip status-chip--${tone}`}>{formatAssetStateLabel(asset)}</span>
      </div>

      <dl className="asset-card__stats">
        <div>
          <dt>Overdue</dt>
          <dd>{asset.overdueScheduleCount}</dd>
        </div>
        <div>
          <dt>Due now</dt>
          <dd>{asset.dueScheduleCount}</dd>
        </div>
        <div>
          <dt>Next due</dt>
          <dd>{formatDate(asset.nextDueAt, "No date")}</dd>
        </div>
        <div>
          <dt>Last logged</dt>
          <dd>{formatDate(asset.lastCompletedAt, "No history")}</dd>
        </div>
      </dl>

      <div className="asset-card__footer">
        <span className="pill">{formatVisibilityLabel(asset.asset.visibility)}</span>
        <Link href={`/assets/${asset.asset.id}`} className="text-link">
          Open asset
        </Link>
      </div>
    </article>
  );
}