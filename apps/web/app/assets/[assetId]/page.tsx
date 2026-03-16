import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveAssetAction,
  softDeleteAssetAction,
  unarchiveAssetAction
} from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { AssetCommentsTab } from "../../../components/asset-comments-tab";
import { AssetCostsTab } from "../../../components/asset-costs-tab";
import { AssetDangerActions } from "../../../components/asset-danger-actions";
import { AssetDetailsTab } from "../../../components/asset-details-tab";
import { AssetHistoryTab } from "../../../components/asset-history-tab";
import { AssetMaintenanceTab } from "../../../components/asset-maintenance-tab";
import { AssetMetricsTab } from "../../../components/asset-metrics-tab";
import { AssetOverviewTab } from "../../../components/asset-overview-tab";
import { AssetSettingsTab } from "../../../components/asset-settings-tab";
import {
  ApiError,
  getAssetDetail
} from "../../../lib/api";
import {
  assetDetailTabs,
  getSearchParamValue,
  type AssetDetailPageSearchParams
} from "../../../lib/asset-detail-helpers";
import {
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel
} from "../../../lib/formatters";

type AssetDetailPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<AssetDetailPageSearchParams>;
};

export default async function AssetDetailPage({ params, searchParams }: AssetDetailPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedTab = getSearchParamValue(resolvedSearchParams.tab);
  const tab = assetDetailTabs.some((item) => item.id === requestedTab) ? requestedTab : "overview";

  try {
    const detail = await getAssetDetail(assetId);

    return (
      <AppShell activePath="/assets">
        <div className="detail-topbar">
          <Link href="/assets" className="text-link">&larr; Back to Assets</Link>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link href={`/assets/${detail.asset.id}?tab=maintenance`} className="button button--primary button--sm">
              Log Maintenance
            </Link>
            <Link href={`/assets/${detail.asset.id}?tab=settings`} className="button button--ghost button--sm">
              Transfer Asset
            </Link>
            <AssetDangerActions
              assetId={detail.asset.id}
              isArchived={detail.asset.isArchived}
              archiveAction={archiveAssetAction}
              unarchiveAction={unarchiveAssetAction}
              deleteAction={softDeleteAssetAction}
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

          <nav className="tab-navigation" aria-label="Asset sections">
            <ul style={{ display: "flex", gap: "24px", listStyle: "none", padding: "0 0 12px 0", margin: "16px 0 24px 0", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
              {assetDetailTabs.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/assets/${detail.asset.id}?tab=${item.id}`}
                    style={{
                      textDecoration: "none",
                      color: tab === item.id ? "var(--ink-base)" : "var(--ink-muted)",
                      fontWeight: tab === item.id ? "600" : "normal",
                      paddingBottom: "12px",
                      borderBottom: tab === item.id ? "2px solid var(--ink-base)" : "none",
                      display: "block"
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <main>
            {tab === "overview" ? <AssetOverviewTab detail={detail} assetId={assetId} /> : null}
            {tab === "details" ? <AssetDetailsTab detail={detail} assetId={assetId} householdId={detail.asset.householdId} /> : null}
            {tab === "metrics" ? <AssetMetricsTab detail={detail} assetId={assetId} /> : null}
            {tab === "costs" ? <AssetCostsTab assetId={assetId} /> : null}
            {tab === "maintenance" ? <AssetMaintenanceTab detail={detail} householdId={detail.asset.householdId} /> : null}
            {tab === "history" ? <AssetHistoryTab detail={detail} assetId={assetId} searchParams={resolvedSearchParams} /> : null}
            {tab === "comments" ? <AssetCommentsTab detail={detail} assetId={assetId} /> : null}
            {tab === "settings" ? <AssetSettingsTab detail={detail} assetId={assetId} householdId={detail.asset.householdId} /> : null}
          </main>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
