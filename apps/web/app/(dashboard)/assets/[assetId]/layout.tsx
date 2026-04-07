import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetDangerActions } from "../../../../components/asset-danger-actions";
import { WorkspaceLayout } from "../../../../components/workspace-layout";
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

const assetTabs = (assetId: string) => [
  { id: "overview", label: "Overview", href: `/assets/${assetId}` },
  { id: "maintenance", label: "Maintenance", href: `/assets/${assetId}/maintenance` },
  { id: "details", label: "Details", href: `/assets/${assetId}/details` },
  { id: "relationships", label: "Relationships", href: `/assets/${assetId}/relationships` },
  { id: "metrics", label: "Metrics", href: `/assets/${assetId}/metrics` },
  { id: "costs", label: "Costs", href: `/assets/${assetId}/costs` },
  { id: "inventory", label: "Inventory", href: `/assets/${assetId}/inventory` },
  { id: "notes", label: "Notes", href: `/assets/${assetId}/notes` },
  { id: "canvas", label: "Canvas", href: `/assets/${assetId}/canvas` },
  { id: "comments", label: "Comments", href: `/assets/${assetId}/comments` },
  { id: "history", label: "History", href: `/assets/${assetId}/history` },
  { id: "settings", label: "Advanced", href: `/assets/${assetId}/settings` },
];

export default async function AssetDetailLayout({ params, children }: AssetDetailLayoutProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const detail = await getAssetDetail(assetId);

    const headerMeta = (
      <dl className="asset-header-meta">
        <div className="asset-header-meta__item">
          <dt>Purchased</dt>
          <dd>{formatDate(detail.asset.purchaseDate, "—")}</dd>
        </div>
        {detail.asset.parentAsset ? (
          <div className="asset-header-meta__item">
            <dt>Part of</dt>
            <dd>
              <Link href={`/assets/${detail.asset.parentAsset.id}`} className="text-link">
                {detail.asset.parentAsset.name}
              </Link>
            </dd>
          </div>
        ) : null}
        {detail.asset.childAssets.length > 0 ? (
          <div className="asset-header-meta__item">
            <dt>Components</dt>
            <dd>{detail.asset.childAssets.length}</dd>
          </div>
        ) : null}
        {detail.overdueScheduleCount > 0 ? (
          <div className="asset-header-meta__item asset-header-meta__item--danger">
            <dt>Overdue</dt>
            <dd>{detail.overdueScheduleCount}</dd>
          </div>
        ) : detail.dueScheduleCount > 0 ? (
          <div className="asset-header-meta__item asset-header-meta__item--warning">
            <dt>Due Now</dt>
            <dd>{detail.dueScheduleCount}</dd>
          </div>
        ) : null}
        <div className="asset-header-meta__item">
          <dt>Visibility</dt>
          <dd>{formatVisibilityLabel(detail.asset.visibility)}</dd>
        </div>
      </dl>
    );

    const headerActions = (
      <>
        <Link href={`/assets/${detail.asset.id}/maintenance`} className="button button--primary button--sm">
          Log Maintenance
        </Link>
        <Link href={`/assets/new?parentAssetId=${detail.asset.id}`} className="button button--ghost button--sm">
          Add Component
        </Link>
        <Link href={`/assets/${detail.asset.id}/settings`} className="button button--ghost button--sm">
          Edit Asset
        </Link>
        <AssetDangerActions
          householdId={detail.asset.householdId}
          assetId={detail.asset.id}
          isArchived={detail.asset.isArchived}
        />
      </>
    );

    return (
      <WorkspaceLayout
        entityType="asset"
        title={detail.asset.name}
        status={formatCategoryLabel(detail.asset.category)}
        backHref="/assets"
        backLabel="All Assets"
        tabs={assetTabs(detail.asset.id)}
        headerMeta={headerMeta}
        headerActions={headerActions}
      >
        {children}
      </WorkspaceLayout>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
