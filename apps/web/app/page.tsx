import Link from "next/link";
import type { JSX } from "react";
import { createAssetAction, createHouseholdAction, enqueueNotificationScanAction, markNotificationReadAction } from "./actions";
import { AssetCard } from "../components/asset-card";
import { ApiError, getApiBaseUrl, getDevUserId, getHouseholdDashboard, getLibraryPresets, getMe } from "../lib/api";
import { formatCategoryLabel, formatDateTime, formatDueLabel, formatNotificationTone } from "../lib/formatters";

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

const pluralize = (count: number, singular: string, plural = `${singular}s`): string => `${count} ${count === 1 ? singular : plural}`;

const getSystemSummary = (assetCount: number, overdueAssets: number, dueAssets: number): string => {
  if (assetCount === 0) {
    return "No tracked assets. Create the first asset to start building maintenance coverage.";
  }

  if (overdueAssets > 0) {
    return `${pluralize(overdueAssets, "asset")} are in recovery mode with missed maintenance windows.`;
  }

  if (dueAssets > 0) {
    return `${pluralize(dueAssets, "asset")} currently have active service windows but nothing is overdue yet.`;
  }

  return "All tracked assets are clear of immediate maintenance risk.";
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
    const overdueAssets = prioritizedAssets.filter((asset) => asset.overdueScheduleCount > 0).length;
    const dueAssets = prioritizedAssets.filter((asset) => asset.overdueScheduleCount === 0 && asset.dueScheduleCount > 0).length;
    const attentionAssets = prioritizedAssets.filter((asset) => asset.overdueScheduleCount > 0 || asset.dueScheduleCount > 0).length;
    const clearAssets = Math.max(prioritizedAssets.length - attentionAssets, 0);
    const leadItem = dashboard.dueWork[0] ?? null;
    const latestNotification = dashboard.notifications[0] ?? null;
    const firstAsset = prioritizedAssets[0] ?? null;
    const systemSummary = getSystemSummary(dashboard.stats.assetCount, overdueAssets, dueAssets);

    return (
      <main className="ops-shell">
        <aside className="ops-sidebar">
          <div className="ops-brand">
            <p className="eyebrow">AssetKeeper // Operations Console</p>
            <h1>{dashboard.household.name}</h1>
            <p>{systemSummary}</p>
          </div>

          <nav className="ops-nav" aria-label="Dashboard sections">
            <a href="#queue" className="ops-nav__link">Priority queue</a>
            <a href="#registry" className="ops-nav__link">Asset registry</a>
            <a href="#alerts" className="ops-nav__link">Alert feed</a>
            <a href="#capture" className="ops-nav__link">Create asset</a>
          </nav>

          <section className="ops-sidebar__section">
            <div className="ops-sidebar__heading">
              <p className="eyebrow">Household context</p>
              <h2>Switch household</h2>
            </div>

            <div className="ops-switcher">
              {me.households.map((household) => (
                <Link
                  key={household.id}
                  href={`/?householdId=${household.id}`}
                  className={`ops-switcher__item${household.id === selectedHousehold.id ? " ops-switcher__item--active" : ""}`}
                >
                  <strong>{household.name}</strong>
                  <span>{pluralize(household.memberCount, "member")}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="ops-sidebar__section">
            <div className="ops-sidebar__heading">
              <p className="eyebrow">Session</p>
              <h2>Current operator</h2>
            </div>

            <dl className="ops-kv">
              <div>
                <dt>User</dt>
                <dd>{me.user.displayName ?? me.user.email ?? me.user.id}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{dashboard.household.myRole}</dd>
              </div>
              <div>
                <dt>Auth</dt>
                <dd>{me.auth.source}</dd>
              </div>
              <div>
                <dt>Next action</dt>
                <dd>{leadItem ? `${leadItem.assetName} / ${leadItem.scheduleName}` : "Queue clear"}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <section className="ops-main">
          <header className="ops-header">
            <div className="ops-header__meta">
              <span className="pill">Household {dashboard.household.name}</span>
              <span className="pill">Assets {dashboard.stats.assetCount}</span>
              <span className="pill">Attention {attentionAssets}</span>
              <span className="pill">Unread {dashboard.stats.unreadNotificationCount}</span>
            </div>

            <div className="ops-header__actions">
              <form action={enqueueNotificationScanAction}>
                <input type="hidden" name="householdId" value={selectedHousehold.id} />
                <button type="submit" className="button button--ghost">Run notification scan</button>
              </form>
            </div>
          </header>

          <div className="ops-workspace">
            <section className="ops-pane ops-pane--overview">
              <div className="ops-panel__header">
                <div>
                  <p className="eyebrow">System overview</p>
                  <h2>Maintenance posture</h2>
                </div>
                <p className="ops-panel__copy">Compact state panes for the current household. This stays informational and always visible.</p>
              </div>

              <div className="ops-overview-grid" aria-label="System status">
                <div className="ops-overview-cell ops-overview-cell--neutral">
                  <span className="ops-status__label">Tracked assets</span>
                  <strong>{dashboard.stats.assetCount}</strong>
                  <span>{pluralize(clearAssets, "asset")} currently clear</span>
                </div>
                <div className="ops-overview-cell ops-overview-cell--danger">
                  <span className="ops-status__label">Overdue schedules</span>
                  <strong>{dashboard.stats.overdueScheduleCount}</strong>
                  <span>{pluralize(overdueAssets, "asset")} affected</span>
                </div>
                <div className="ops-overview-cell ops-overview-cell--warning">
                  <span className="ops-status__label">Due now</span>
                  <strong>{dashboard.stats.dueScheduleCount}</strong>
                  <span>{pluralize(dueAssets, "asset")} active</span>
                </div>
                <div className="ops-overview-cell ops-overview-cell--accent">
                  <span className="ops-status__label">Unread alerts</span>
                  <strong>{dashboard.stats.unreadNotificationCount}</strong>
                  <span>{latestNotification ? formatDateTime(latestNotification.scheduledFor) : "No queued alerts"}</span>
                </div>
              </div>
            </section>

            <section id="queue" className="ops-pane ops-pane--queue">
                <div className="ops-panel__header">
                  <div>
                    <p className="eyebrow">Upcoming maintenance</p>
                    <h2>Priority queue</h2>
                  </div>
                  <p className="ops-panel__copy">Rows are ordered by urgency. Asset and schedule names are direct links into the detail surface.</p>
                </div>

                {dashboard.dueWork.length === 0 ? (
                  <p className="ops-empty">No due or overdue work right now.</p>
                ) : (
                  <div className="ops-table-wrap">
                    <table className="ops-table ops-table--queue">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Asset</th>
                          <th>Schedule</th>
                          <th>Due trigger</th>
                          <th>Current reading</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.dueWork.map((item) => (
                          <tr key={item.scheduleId} className={`ops-table__row ops-table__row--${item.status}`}>
                            <td><span className={`status-chip status-chip--${item.status}`}>{item.status}</span></td>
                            <td>
                              <Link href={`/assets/${item.assetId}`} className="ops-table__primary-link">{item.assetName}</Link>
                              <span className="ops-table__meta">{formatCategoryLabel(item.assetCategory)}</span>
                            </td>
                            <td>
                              <Link href={`/assets/${item.assetId}`} className="ops-table__primary-link">{item.scheduleName}</Link>
                              <span className="ops-table__meta">{item.summary}</span>
                            </td>
                            <td>
                              <strong>{formatDueLabel(item.nextDueAt, item.nextDueMetricValue, item.metricUnit)}</strong>
                              <span className="ops-table__meta">{item.nextDueAt ? "Date-based trigger" : "Usage-based trigger"}</span>
                            </td>
                            <td>
                              <strong>{item.currentMetricValue !== null ? `${item.currentMetricValue} ${item.metricUnit ?? "units"}` : "Not tracked"}</strong>
                              <span className="ops-table__meta">{item.metricUnit ? `Metric ${item.metricUnit}` : "No metric attached"}</span>
                            </td>
                            <td>
                              <Link href={`/assets/${item.assetId}`} className="text-link">Open asset</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>

            <section id="registry" className="ops-pane ops-pane--registry">
                <div className="ops-panel__header">
                  <div>
                    <p className="eyebrow">Equipment registry</p>
                    <h2>Tracked systems</h2>
                  </div>
                  <p className="ops-panel__copy">This is the main comparison view. Every asset name and open action is clickable.</p>
                </div>

                {prioritizedAssets.length === 0 ? (
                  <p className="ops-empty">Add your first asset from the capture panel to start tracking maintenance state.</p>
                ) : (
                  <div className="ops-table-wrap">
                    <table className="ops-table ops-table--registry">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>State</th>
                          <th>Overdue</th>
                          <th>Due now</th>
                          <th>Next due</th>
                          <th>Last log</th>
                          <th>Summary</th>
                          <th>Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prioritizedAssets.map((asset) => (
                          <AssetCard key={asset.asset.id} asset={asset} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>

            <aside className="ops-side-panes">
              <section id="alerts" className="ops-pane ops-pane--alerts ops-pane--compact">
                <div className="ops-panel__header">
                  <div>
                    <p className="eyebrow">Alert feed</p>
                    <h2>Notifications</h2>
                  </div>
                  <p className="ops-panel__copy">Notifications can be acknowledged here and deep-link into related assets when present.</p>
                </div>

                {dashboard.notifications.length === 0 ? (
                  <p className="ops-empty">No notifications yet.</p>
                ) : (
                  <div className="ops-feed">
                    {dashboard.notifications.map((notification) => {
                      const tone = formatNotificationTone(notification);

                      return (
                        <article key={notification.id} className={`ops-feed__item ops-feed__item--${tone}`}>
                          <div className="ops-feed__meta">
                            <span className="pill">{notification.channel}</span>
                            <span>{formatDateTime(notification.scheduledFor)}</span>
                          </div>
                          <div className="ops-feed__body">
                            <h3>{notification.title}</h3>
                            <p>{notification.body}</p>
                          </div>
                          <div className="ops-feed__actions">
                            {notification.assetId ? <Link href={`/assets/${notification.assetId}`} className="text-link">Open asset</Link> : null}
                            {!notification.readAt && notification.status !== "read" ? (
                              <form action={markNotificationReadAction}>
                                <input type="hidden" name="notificationId" value={notification.id} />
                                <button type="submit" className="button button--subtle">Mark read</button>
                              </form>
                            ) : (
                              <span className="pill">Read</span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="ops-pane ops-pane--actions ops-pane--compact">
                <div className="ops-panel__header">
                  <div>
                    <p className="eyebrow">Quick actions</p>
                    <h2>Shortcuts</h2>
                  </div>
                </div>

                <div className="ops-action-list">
                  <a href="#queue" className="ops-action-link">View priority queue</a>
                  <a href="#registry" className="ops-action-link">Open asset registry</a>
                  <a href="#capture" className="ops-action-link">Create new asset</a>
                  {leadItem ? <Link href={`/assets/${leadItem.assetId}`} className="ops-action-link">Open next due asset</Link> : null}
                  {firstAsset ? <Link href={`/assets/${firstAsset.asset.id}`} className="ops-action-link">Open latest registry entry</Link> : null}
                </div>
              </section>

              <section id="capture" className="ops-pane ops-pane--capture ops-pane--compact">
                <div className="ops-panel__header">
                  <div>
                    <p className="eyebrow">Capture panel</p>
                    <h2>Create asset</h2>
                  </div>
                  <p className="ops-panel__copy">This stays narrow and operational. The primary flow is compare first, capture second.</p>
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
          </div>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <DashboardError message={error.message} />;
    }

    throw error;
  }
}