import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import type { ActivityLog } from "@lifekeeper/types";
import { HouseholdCsvExportButton } from "../../../components/asset-export-actions";
import { ApiError, getDisplayPreferences, getHouseholdActivity, getMe } from "../../../lib/api";
import { formatDateTime } from "../../../lib/formatters";
import { CursorPaginationControls } from "../../../components/pagination-controls";
import { getEntityLabel, getEntityUrl, getEntityDisplayName } from "../../../lib/entity-url";
import { PageHeader } from "../../../components/page-header";

type ActivityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const activityEntityOptions = ["all", "asset", "schedule", "log", "timeline_entry", "project", "comment", "inventory_item", "service_provider", "invitation", "hobby"] as const;
const activityWindowOptions = ["all", "7", "30", "90"] as const;
const activityLimitOptions = [25, 50, 100] as const;

const formatActionLabel = (value: string): string => value
  .split(/[._]/g)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(" ");

const formatMetadataLabel = (value: string): string => formatActionLabel(
  value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, "_")
);

const isIsoDateTime = (value: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);

const isDeleteAction = (action: string): boolean => /delete|purge/i.test(action);

const renderEntityRef = (entry: ActivityLog): JSX.Element => {
  const url = getEntityUrl(entry.entityType, entry.entityId, entry.metadata);
  const name = getEntityDisplayName(entry.entityType, entry.entityId, entry.metadata);
  const deleted = isDeleteAction(entry.action);
  return (
    <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
      <span className="pill pill--sm">{getEntityLabel(entry.entityType)}</span>
      {url ? (
        <Link
          href={url}
          className={`activity-entity-link${deleted ? " activity-entity-link--deleted" : ""}`}
        >
          {name}
        </Link>
      ) : (
        <span title={entry.entityId} style={deleted ? { textDecoration: "line-through" } : undefined}>
          {name}
        </span>
      )}
      {deleted && (
        <span style={{ fontSize: "0.78rem" }}>(deleted)</span>
      )}
    </p>
  );
};

const formatMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return isIsoDateTime(value) ? formatDateTime(value) : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join(", ");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return "—";
    }

    return entries
      .map(([key, nestedValue]) => `${formatMetadataLabel(key)}: ${formatMetadataValue(nestedValue)}`)
      .join("; ");
  }

  return String(value);
};

export default async function ActivityPage({ searchParams }: ActivityPageProps): Promise<JSX.Element> {
  // Fire getMe() immediately so it runs in parallel with params/prefs setup.
  const mePromise = getMe();
  const [params, prefs] = await Promise.all([
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
  ]);
  const formatMetadataValueWithPrefs = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return isIsoDateTime(value) ? formatDateTime(value, "Not set", undefined, prefs.dateFormat) : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((item) => formatMetadataValueWithPrefs(item)).join(", ");
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return "—";
      return entries.map(([key, nestedValue]) => `${formatMetadataLabel(key)}: ${formatMetadataValueWithPrefs(nestedValue)}`).join("; ");
    }
    return String(value);
  };
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const entityType = typeof params.entityType === "string" && activityEntityOptions.includes(params.entityType as (typeof activityEntityOptions)[number])
    ? params.entityType
    : "all";
  const windowDays = typeof params.windowDays === "string" && activityWindowOptions.includes(params.windowDays as (typeof activityWindowOptions)[number])
    ? params.windowDays
    : "30";
  const limit = typeof params.limit === "string" && activityLimitOptions.includes(Number(params.limit) as (typeof activityLimitOptions)[number])
    ? Number(params.limit)
    : 50;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const history = typeof params.history === "string"
    ? params.history.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  const me = await mePromise;
  const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

  if (!household) {
    return (
      <>
        <PageHeader title="Activity" />
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Activity Log"
        subtitle="Household audit trail for assets, schedules, projects, invitations, and collaboration events."
        actions={<HouseholdCsvExportButton householdId={household.id} dataset="activity-log" />}
      />

      <div className="page-body">
        {/* Filters form — rendered immediately */}
        <section className="panel">
          <div className="panel__header">
            <h2>Filters</h2>
          </div>
          <div className="panel__body--padded">
            <form method="GET" className="form-grid">
              <input type="hidden" name="householdId" value={household.id} />
              <label className="field">
                <span>Entity Type</span>
                <select name="entityType" defaultValue={entityType}>
                  <option value="all">All entities</option>
                  <option value="asset">Assets</option>
                  <option value="schedule">Schedules</option>
                  <option value="log">Maintenance Logs</option>
                  <option value="timeline_entry">Timeline Entries</option>
                  <option value="project">Projects</option>
                  <option value="comment">Comments</option>
                  <option value="inventory_item">Inventory</option>
                  <option value="service_provider">Service Providers</option>
                  <option value="invitation">Invitations</option>
                  <option value="hobby">Hobbies</option>
                </select>
              </label>
              <label className="field">
                <span>Time Window</span>
                <select name="windowDays" defaultValue={windowDays}>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </label>
              <label className="field">
                <span>Result Count</span>
                <select name="limit" defaultValue={String(limit)}>
                  <option value="25">25 entries</option>
                  <option value="50">50 entries</option>
                  <option value="100">100 entries</option>
                </select>
              </label>
              <div className="inline-actions field field--full">
                <button type="submit" className="button button--ghost">Apply Filters</button>
                <Link href={`/activity?householdId=${household.id}`} className="button button--ghost">Reset</Link>
              </div>
            </form>
          </div>
        </section>

        {/* Activity list — deferred */}
        <Suspense fallback={
          <section className="panel" aria-hidden="true">
            <div className="panel__body">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                  <div className="skeleton-bar" style={{ width: 90, height: 12, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "grid", gap: 6 }}>
                    <div className="skeleton-bar" style={{ width: "60%", height: 14 }} />
                    <div className="skeleton-bar" style={{ width: "40%", height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        }>
          <ActivityListContent
            householdId={household.id}
            entityType={entityType}
            windowDays={windowDays}
            cursor={cursor}
            history={history}
            limit={limit}
            dateFormat={prefs.dateFormat}
            formatMetadataValueWithPrefs={formatMetadataValueWithPrefs}
          />
        </Suspense>
      </div>
    </>
  );
}

// ── Deferred activity list ─────────────────────────────────
type ActivityListContentProps = {
  householdId: string;
  entityType: string;
  windowDays: string;
  cursor: string | undefined;
  history: string[];
  limit: number;
  dateFormat: string;
  formatMetadataValueWithPrefs: (value: unknown) => string;
};

async function ActivityListContent({
  householdId,
  entityType,
  windowDays,
  cursor,
  history,
  limit,
  dateFormat,
  formatMetadataValueWithPrefs,
}: ActivityListContentProps): Promise<JSX.Element> {
  const since = windowDays === "all"
    ? undefined
    : new Date(Date.now() - Number(windowDays) * 24 * 60 * 60 * 1000).toISOString();

  const buildHref = (p: { cursor?: string; history?: string[]; limit: number }): string => {
    const q = new URLSearchParams();
    q.set("householdId", householdId);
    q.set("entityType", entityType);
    q.set("windowDays", windowDays);
    q.set("limit", String(p.limit));
    if (p.cursor) q.set("cursor", p.cursor);
    if (p.history && p.history.length > 0) q.set("history", p.history.join(","));
    return `/activity?${q.toString()}`;
  };

  try {
    const activity = await getHouseholdActivity(householdId, {
      ...(entityType !== "all" ? { entityType } : {}),
      ...(since ? { since } : {}),
      ...(cursor ? { cursor } : {}),
      limit,
    });

    return (
      <>
        <section className="panel">
          <div className="panel__header">
            <h2>Recent Activity ({activity.entries.length})</h2>
            <span className="pill">Newest first</span>
          </div>
          <div className="panel__body">
            {activity.entries.length === 0 ? (
              <p className="panel__empty">No activity recorded yet.</p>
            ) : (
              <div className="schedule-stack">
                {activity.entries.map((entry) => (
                  <article key={entry.id} className="schedule-card">
                    <div className="schedule-card__summary">
                      <div>
                        <h3>{formatActionLabel(entry.action)}</h3>
                        {renderEntityRef(entry)}
                      </div>
                      <span className="pill">{formatDateTime(entry.createdAt, undefined, undefined, dateFormat)}</span>
                    </div>
                    {entry.metadata ? (
                      <div style={{ display: "grid", gap: "8px" }}>
                        {Object.entries(entry.metadata).map(([key, value]) => (
                          <div key={key}>
                            <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {formatMetadataLabel(key)}
                            </div>
                            <div style={{ fontSize: "0.88rem" }}>{formatMetadataValueWithPrefs(value)}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <CursorPaginationControls
          nextCursor={activity.nextCursor ?? null}
          currentCursor={cursor}
          cursorHistory={history}
          limit={limit}
          resultCount={activity.entries.length}
          entityLabel="entries"
          buildHref={buildHref}
        />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load activity: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}