import Link from "next/link";
import type { JSX } from "react";
import { createAssetAction, createHouseholdAction, enqueueNotificationScanAction, markNotificationReadAction } from "./actions";
import { AssetCard } from "../components/asset-card";
import { ApiError, getApiBaseUrl, getDevUserId, getHouseholdDashboard, getLibraryPresets, getMe } from "../lib/api";
import { formatCategoryLabel, formatDate, formatDateTime, formatNotificationTone } from "../lib/formatters";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

const byAttention = (left: { overdueScheduleCount: number; dueScheduleCount: number }, right: { overdueScheduleCount: number; dueScheduleCount: number }): number => {
  if (left.overdueScheduleCount !== right.overdueScheduleCount) {
    return right.overdueScheduleCount - left.overdueScheduleCount;
  }

  return right.dueScheduleCount - left.dueScheduleCount;
};

const DashboardError = ({ message }: { message: string }): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">Web dashboard</p>
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
      <p>The dashboard is household-scoped. Start by creating one household, then add shared or personal assets into it.</p>

      <form action={createHouseholdAction} className="form-grid">
        <label className="field field--full">
          <span>Household name</span>
          <input type="text" name="name" placeholder="Main household" required />
        </label>
        <button type="submit" className="button button--primary">Create household</button>
      </form>
    </section>
  </main>
);

export default async function HomePage({ searchParams }: HomePageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
    const me = await getMe();

    const fallbackHousehold = me.households[0];

    if (!fallbackHousehold) {
      return <EmptyHouseholds />;
    }

    const requestedHouseholdId = getParam(params.householdId);
    const selectedHousehold = me.households.find((household) => household.id === requestedHouseholdId) ?? fallbackHousehold;
    const [dashboard, presets] = await Promise.all([
      getHouseholdDashboard(selectedHousehold.id),
      getLibraryPresets()
    ]);
    const prioritizedAssets = [...dashboard.assets].sort(byAttention);

    return (
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <section className="sidebar-card sidebar-card--brand">
            <p className="eyebrow">AssetKeeper</p>
            <h1>Maintenance stays visible enough to act on.</h1>
            <p>
              Shared household assets, configurable schedules, notifications, logs, and preset-powered setup are all live against the current API.
            </p>
          </section>

          <section className="sidebar-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Current user</p>
                <h2>{me.user.displayName ?? me.user.email ?? me.user.id}</h2>
              </div>
            </div>

            <dl className="meta-list">
              <div>
                <dt>Auth mode</dt>
                <dd>{me.auth.source}</dd>
              </div>
              <div>
                <dt>Households</dt>
                <dd>{me.households.length}</dd>
              </div>
            </dl>
          </section>

          <section className="sidebar-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Households</p>
                <h2>Switch context</h2>
              </div>
            </div>

            <div className="household-tabs">
              {me.households.map((household) => (
                <Link
                  key={household.id}
                  href={`/?householdId=${household.id}`}
                  className={`household-tab${household.id === selectedHousehold.id ? " household-tab--active" : ""}`}
                >
                  <strong>{household.name}</strong>
                  <span>{household.memberCount} members</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="sidebar-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Capture</p>
                <h2>Add an asset</h2>
              </div>
            </div>

            <form action={createAssetAction} className="form-grid">
              <input type="hidden" name="householdId" value={selectedHousehold.id} />

              <label className="field field--full">
                <span>Name</span>
                <input type="text" name="name" placeholder="Primary vehicle" required />
              </label>

              <label className="field">
                <span>Category</span>
                <select name="category" defaultValue="vehicle">
                  <option value="vehicle">Vehicle</option>
                  <option value="home">Home</option>
                  <option value="marine">Marine</option>
                  <option value="yard">Yard</option>
                  <option value="workshop">Workshop</option>
                  <option value="appliance">Appliance</option>
                  <option value="hvac">HVAC</option>
                  <option value="technology">Technology</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="field">
                <span>Visibility</span>
                <select name="visibility" defaultValue="shared">
                  <option value="shared">Shared</option>
                  <option value="personal">Personal</option>
                </select>
              </label>

              <label className="field">
                <span>Manufacturer</span>
                <input type="text" name="manufacturer" placeholder="Ford" />
              </label>

              <label className="field">
                <span>Model</span>
                <input type="text" name="model" placeholder="F-150" />
              </label>

              <label className="field">
                <span>Serial number</span>
                <input type="text" name="serialNumber" placeholder="Optional" />
              </label>

              <label className="field">
                <span>Purchase date</span>
                <input type="date" name="purchaseDate" />
              </label>

              <label className="field field--full">
                <span>Description</span>
                <textarea name="description" rows={3} placeholder="Notes, trim, location, or ownership context" />
              </label>

              <label className="field field--full">
                <span>Preset</span>
                <select name="presetKey" defaultValue="">
                  <option value="">Manual asset only</option>
                  {presets.map((preset) => (
                    <option key={preset.key} value={preset.key}>{preset.label}</option>
                  ))}
                </select>
              </label>

              <button type="submit" className="button button--primary">Create asset</button>
            </form>
          </section>
        </aside>

        <div className="dashboard-content">
          <section className="hero-card">
            <div>
              <p className="eyebrow">Household dashboard</p>
              <h2>{dashboard.household.name}</h2>
              <p>
                Owner-ready web surface for due work, shared visibility, and quick maintenance capture. Role: {dashboard.household.myRole}.
              </p>
            </div>

            <form action={enqueueNotificationScanAction}>
              <input type="hidden" name="householdId" value={selectedHousehold.id} />
              <button type="submit" className="button button--ghost">Enqueue notification scan</button>
            </form>
          </section>

          <section className="stats-row" aria-label="Dashboard stats">
            <article className="stat-tile stat-tile--neutral">
              <p>Assets</p>
              <strong>{dashboard.stats.assetCount}</strong>
              <span>Visible in this household</span>
            </article>
            <article className="stat-tile stat-tile--warning">
              <p>Due now</p>
              <strong>{dashboard.stats.dueScheduleCount}</strong>
              <span>Immediate work windows</span>
            </article>
            <article className="stat-tile stat-tile--danger">
              <p>Overdue</p>
              <strong>{dashboard.stats.overdueScheduleCount}</strong>
              <span>Already missed</span>
            </article>
            <article className="stat-tile stat-tile--accent">
              <p>Unread notifications</p>
              <strong>{dashboard.stats.unreadNotificationCount}</strong>
              <span>Latest alerts for this user</span>
            </article>
          </section>

          <section className="section-grid section-grid--two">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Due work</p>
                  <h2>What needs attention</h2>
                </div>
              </div>

              {dashboard.dueWork.length === 0 ? (
                <p className="empty-state">No due or overdue work right now.</p>
              ) : (
                <div className="list-stack">
                  {dashboard.dueWork.map((item) => (
                    <article key={item.scheduleId} className={`list-card list-card--${item.status}`}>
                      <div>
                        <p className="eyebrow">{formatCategoryLabel(item.assetCategory)}</p>
                        <h3>{item.scheduleName}</h3>
                        <p>{item.summary}</p>
                      </div>
                      <div className="list-card__meta">
                        <span className={`status-chip status-chip--${item.status}`}>{item.status}</span>
                        <span>{item.assetName}</span>
                        <span>{item.nextDueAt ? formatDate(item.nextDueAt) : "Usage-based"}</span>
                        <Link href={`/assets/${item.assetId}`} className="text-link">Open asset</Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Notifications</p>
                  <h2>Recent inbox</h2>
                </div>
              </div>

              {dashboard.notifications.length === 0 ? (
                <p className="empty-state">No notifications yet.</p>
              ) : (
                <div className="list-stack">
                  {dashboard.notifications.map((notification) => {
                    const tone = formatNotificationTone(notification);

                    return (
                      <article key={notification.id} className={`notification-card notification-card--${tone}`}>
                        <div>
                          <h3>{notification.title}</h3>
                          <p>{notification.body}</p>
                          <span>{formatDateTime(notification.scheduledFor)}</span>
                        </div>

                        {!notification.readAt && notification.status !== "read" ? (
                          <form action={markNotificationReadAction}>
                            <input type="hidden" name="notificationId" value={notification.id} />
                            <button type="submit" className="button button--subtle">Mark read</button>
                          </form>
                        ) : (
                          <span className="pill">Read</span>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Assets</p>
                <h2>Household asset library</h2>
              </div>
              <p>{prioritizedAssets.length} visible assets</p>
            </div>

            {prioritizedAssets.length === 0 ? (
              <p className="empty-state">Add your first asset from the form on the left.</p>
            ) : (
              <div className="asset-grid">
                {prioritizedAssets.map((asset) => (
                  <AssetCard key={asset.asset.id} asset={asset} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <DashboardError message={error.message} />;
    }

    throw error;
  }
}