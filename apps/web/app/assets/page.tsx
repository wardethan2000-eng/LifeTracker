import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import { ApiError, getHouseholdDashboard, getMe } from "../../lib/api";
import {
  formatAssetStateLabel,
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel,
  getAssetTone
} from "../../lib/formatters";

type AssetsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((h) => h.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/assets">
          <header className="page-header"><h1>Assets</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const dashboard = await getHouseholdDashboard(household.id);
    const sortedAssets = [...dashboard.assets].sort(
      (a, b) => (b.overdueScheduleCount - a.overdueScheduleCount) || (b.dueScheduleCount - a.dueScheduleCount)
    );

    return (
      <AppShell activePath="/assets">
        <header className="page-header">
          <h1>Assets</h1>
          <div className="page-header__actions">
            <Link href="/assets/new" className="button button--primary">+ Add Asset</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>All Tracked Assets ({sortedAssets.length})</h2>
            </div>
            <div className="panel__body">
              {sortedAssets.length === 0 ? (
                <p className="panel__empty">
                  No assets yet. <Link href="/assets/new" className="text-link">Create your first asset</Link> to start tracking maintenance.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Visibility</th>
                      <th>Status</th>
                      <th>Overdue</th>
                      <th>Due Now</th>
                      <th>Next Due</th>
                      <th>Last Completed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((item) => {
                      const tone = getAssetTone(item);
                      const subtitle = [item.asset.manufacturer, item.asset.model].filter(Boolean).join(" ");

                      return (
                        <tr key={item.asset.id} className={`row--${tone}`}>
                          <td>
                            <div className="data-table__primary">
                              <Link href={`/assets/${item.asset.id}`} className="data-table__link">{item.asset.name}</Link>
                            </div>
                            {subtitle && <div className="data-table__secondary">{subtitle}</div>}
                          </td>
                          <td><span className="pill">{formatCategoryLabel(item.asset.category)}</span></td>
                          <td><span className="pill">{formatVisibilityLabel(item.asset.visibility)}</span></td>
                          <td><span className={`status-chip status-chip--${tone}`}>{formatAssetStateLabel(item)}</span></td>
                          <td><strong>{item.overdueScheduleCount}</strong></td>
                          <td><strong>{item.dueScheduleCount}</strong></td>
                          <td>{formatDate(item.nextDueAt, "—")}</td>
                          <td>{formatDate(item.lastCompletedAt, "No history")}</td>
                          <td>
                            <Link href={`/assets/${item.asset.id}`} className="data-table__link">Open</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/assets">
          <header className="page-header"><h1>Assets</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load assets: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }
    throw error;
  }
}
