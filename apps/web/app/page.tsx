import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { createHouseholdAction, enqueueNotificationScanAction } from "./actions";
import { AppShell } from "../components/app-shell";
import { DashboardDueWork } from "../components/dashboard-due-work";
import { DashboardNotificationsAside } from "../components/dashboard-notifications-aside";
import { ApiError, getApiBaseUrl, getDevUserId, getHouseholdDashboard, getMe } from "../lib/api";
import { formatCategoryLabel, formatDateTime } from "../lib/formatters";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

const DashboardError = ({ message }: { message: string }): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">Connection error</p>
      <h1>Dashboard could not load</h1>
      <p>{message}</p>
      <dl className="meta-list">
        <div>
          <dt>API base URL</dt>
          <dd>{getApiBaseUrl()}</dd>
        </div>
        <div>
          <dt>Dev user header</dt>
          <dd>{getDevUserId()}</dd>
        </div>
      </dl>
      <p className="note">Start the API, seed the database, and keep dev auth bypass enabled for the seeded demo user.</p>
    </section>
  </main>
);

const EmptyHouseholds = (): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">First-run setup</p>
      <h1>Create your first household</h1>
      <p>The dashboard is household-scoped. Create a household to start tracking assets.</p>
      <form action={createHouseholdAction} className="form-grid form-grid--single" style={{ gap: 12 }}>
        <label className="field">
          <span>Household name</span>
          <input type="text" name="name" placeholder="Main household" required />
        </label>
        <button type="submit" className="button button--primary">Create household</button>
      </form>
    </section>
  </main>
);

const DueWorkSkeleton = (): JSX.Element => (
  <section className="panel">
    <div className="panel__header">
      <h2>Upcoming Maintenance</h2>
    </div>
    <div className="panel__body">
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Asset</th>
            <th>Task</th>
            <th>Next Due</th>
            <th>Priority</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((row) => (
            <tr key={row}>
              <td><div className="skeleton-bar" style={{ width: 56, height: 22 }} /></td>
              <td>
                <div className="skeleton-bar" style={{ width: 120, height: 14, marginBottom: 6 }} />
                <div className="skeleton-bar" style={{ width: 90, height: 12 }} />
              </td>
              <td>
                <div className="skeleton-bar" style={{ width: 180, height: 14, marginBottom: 6 }} />
                <div className="skeleton-bar" style={{ width: 140, height: 12 }} />
              </td>
              <td><div className="skeleton-bar" style={{ width: 110, height: 14 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 64, height: 22 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 34, height: 14 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default async function HomePage({ searchParams }: HomePageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
    const me = await getMe();
    const fallbackHousehold = me.households[0];

    if (!fallbackHousehold) return <EmptyHouseholds />;

    const requestedHouseholdId = getParam(params.householdId);
    const selectedHousehold = me.households.find((h) => h.id === requestedHouseholdId) ?? fallbackHousehold;
    const dashboard = await getHouseholdDashboard(selectedHousehold.id);

    const sortedAssets = [...dashboard.assets].sort(
      (a, b) => (b.overdueScheduleCount - a.overdueScheduleCount) || (b.dueScheduleCount - a.dueScheduleCount)
    );
    const overdueAssets = sortedAssets.filter((a) => a.overdueScheduleCount > 0).length;
    const dueAssets = sortedAssets.filter((a) => a.overdueScheduleCount === 0 && a.dueScheduleCount > 0).length;

    return (
      <AppShell activePath="/">
        <header className="page-header">
          <h1>Dashboard</h1>
          <div className="page-header__actions">
            {me.households.length > 1 && (
              <div className="household-switcher">
                {me.households.map((h) => (
                  <Link
                    key={h.id}
                    href={`/?householdId=${h.id}`}
                    className={`household-chip${h.id === selectedHousehold.id ? " household-chip--active" : ""}`}
                  >
                    {h.name}
                  </Link>
                ))}
              </div>
            )}
            <form action={enqueueNotificationScanAction}>
              <input type="hidden" name="householdId" value={selectedHousehold.id} />
              <button type="submit" className="button button--ghost button--sm">Scan notifications</button>
            </form>
          </div>
        </header>

        <div className="page-body">
          {/* ── System Overview ── */}
          <section className="stats-row">
            <div className="stat-card">
              <span className="stat-card__label">Total Assets</span>
              <strong className="stat-card__value">{dashboard.stats.assetCount}</strong>
              <span className="stat-card__sub">{pluralize(dashboard.assets.length, "tracked system")}</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Overdue</span>
              <strong className="stat-card__value">{dashboard.stats.overdueScheduleCount}</strong>
              <span className="stat-card__sub">{pluralize(overdueAssets, "asset")} affected</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Due Now</span>
              <strong className="stat-card__value">{dashboard.stats.dueScheduleCount}</strong>
              <span className="stat-card__sub">{pluralize(dueAssets, "asset")} need attention</span>
            </div>
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Unread Alerts</span>
              <strong className="stat-card__value">{dashboard.stats.unreadNotificationCount}</strong>
              <span className="stat-card__sub">{dashboard.notifications.length > 0 ? "Latest: " + formatDateTime(dashboard.notifications[0]?.scheduledFor) : "No pending alerts"}</span>
            </div>
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              {/* ── Upcoming Maintenance ── */}
              <Suspense fallback={<DueWorkSkeleton />}>
                <DashboardDueWork householdId={selectedHousehold.id} dashboard={dashboard} />
              </Suspense>

              {/* ── Asset Registry ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Asset Registry</h2>
                  <div className="panel__header-actions">
                    <Link href="/assets/new" className="button button--primary button--sm">+ Add Asset</Link>
                    <Link href="/assets" className="button button--ghost button--sm">View All</Link>
                  </div>
                </div>
                <div className="panel__body">
                  {sortedAssets.length === 0 ? (
                    <p className="panel__empty">No assets tracked yet. <Link href="/assets/new" className="text-link">Add your first asset</Link> to get started.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Overdue</th>
                          <th>Due</th>
                          <th>Next Due</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAssets.slice(0, 10).map((item) => {
                          const tone = item.overdueScheduleCount > 0
                            ? "overdue"
                            : item.dueScheduleCount > 0
                              ? "due"
                              : item.nextDueAt
                                ? "upcoming"
                                : "clear";
                          const subtitle = [item.asset.manufacturer, item.asset.model].filter(Boolean).join(" ");

                          return (
                            <tr key={item.asset.id} className={`row--${tone}`}>
                              <td>
                                <div className="data-table__primary">
                                  <Link href={`/assets/${item.asset.id}`} className="data-table__link">{item.asset.name}</Link>
                                </div>
                                {subtitle && <div className="data-table__secondary">{subtitle}</div>}
                              </td>
                              <td>{formatCategoryLabel(item.asset.category)}</td>
                              <td><span className={`status-chip status-chip--${tone}`}>{tone}</span></td>
                              <td><strong>{item.overdueScheduleCount}</strong></td>
                              <td><strong>{item.dueScheduleCount}</strong></td>
                              <td>{item.nextDueAt ? formatDateTime(item.nextDueAt) : "—"}</td>
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

            <div className="dashboard-aside">
              {/* ── Quick Actions ── */}
              <section className="panel">
                <div className="panel__header">
                  <h2>Quick Actions</h2>
                </div>
                <div className="quick-actions">
                  <Link href="/assets/new" className="quick-action">+ Add New Asset</Link>
                  <Link href="/projects" className="quick-action">View Project Tracker</Link>
                  <Link href="/maintenance" className="quick-action">View Maintenance Queue</Link>
                  <Link href="/assets" className="quick-action">Browse Asset Registry</Link>
                  <Link href="/notifications" className="quick-action">View Notifications</Link>
                  {dashboard.dueWork[0] && (
                    <Link href={`/assets/${dashboard.dueWork[0].assetId}`} className="quick-action">
                      Open Next Due: {dashboard.dueWork[0].assetName}
                    </Link>
                  )}
                </div>
              </section>

              {/* ── Notifications ── */}
              <DashboardNotificationsAside notifications={dashboard.notifications} />
            </div>
          </div>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) return <DashboardError message={error.message} />;
    throw error;
  }
}