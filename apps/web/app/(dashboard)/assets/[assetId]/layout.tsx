import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetDangerActions } from "../../../../components/asset-danger-actions";
import { RealtimeRefreshBoundary } from "../../../../components/realtime-refresh-boundary";
import { AssetTabNav } from "../../../../components/asset-tab-nav";
import {
  ApiError,
  getAssetDetail
} from "../../../../lib/api";
import {
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel
} from "../../../../lib/formatters";

type AssetDetailLayoutProps = {
  params: Promise<{ assetId: string }>;
  children: ReactNode;
};

export default async function AssetDetailLayout({ params, children }: AssetDetailLayoutProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const detail = await getAssetDetail(assetId);

    return (
      <>
        <RealtimeRefreshBoundary householdId={detail.asset.householdId} eventTypes={["asset.updated", "maintenance.completed"]} />
        <div className="detail-topbar">
          <Link href="/assets" className="text-link">&larr; Back to Assets</Link>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link href={`/assets/${detail.asset.id}/maintenance`} className="button button--primary button--sm">
              Log Maintenance
            </Link>
            <Link href={`/assets/${detail.asset.id}/settings`} className="button button--ghost button--sm">
              Transfer Asset
            </Link>
            <AssetDangerActions
              householdId={detail.asset.householdId}
              assetId={detail.asset.id}
              isArchived={detail.asset.isArchived}
            />
          </div>
        </div>

        <div className="detail-body">
          <section className="detail-hero">
            <div className="detail-hero__info">
              <p className="eyebrow">{formatCategoryLabel(detail.asset.category)}</p>
              <h1>{detail.asset.name}</h1>
              <p>
                {[detail.asset.manufacturer, detail.asset.model].filter(Boolean).join(" ")
                  || detail.asset.description
                  || "No description."}
              </p>
            </div>
            <dl className="detail-hero__meta">
              <div className="detail-hero__meta-item"><dt>Visibility</dt><dd>{formatVisibilityLabel(detail.asset.visibility)}</dd></div>
              <div className="detail-hero__meta-item"><dt>Purchased</dt><dd>{formatDate(detail.asset.purchaseDate, "-")}</dd></div>
              <div className="detail-hero__meta-item"><dt>Parent</dt><dd>{detail.asset.parentAsset?.name ?? "None"}</dd></div>
              <div className="detail-hero__meta-item"><dt>Children</dt><dd>{detail.asset.childAssets.length}</dd></div>
              <div className="detail-hero__meta-item"><dt>Due</dt><dd>{detail.dueScheduleCount}</dd></div>
              <div className="detail-hero__meta-item"><dt>Overdue</dt><dd>{detail.overdueScheduleCount}</dd></div>
              {detail.asset.serialNumber ? (
                <div className="detail-hero__meta-item"><dt>Serial</dt><dd>{detail.asset.serialNumber}</dd></div>
              ) : null}
            </dl>
          </section>

          <AssetTabNav assetId={detail.asset.id} />

          <main>{children}</main>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}