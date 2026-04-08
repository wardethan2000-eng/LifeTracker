import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import type { ActivityLog } from "@aegis/types";
import { getDisplayPreferences, getHouseholdActivity, getMe } from "../../../../../lib/api";
import { formatDateTime } from "../../../../../lib/formatters";
import { getEntityLabel, getEntityUrl, getEntityDisplayName } from "../../../../../lib/entity-url";
import { CursorPaginationControls } from "../../../../../components/pagination-controls";

type ProviderActivityPageProps = {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const formatActionLabel = (value: string): string =>
  value
    .split(/[._]/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

const formatMetadataLabel = (value: string): string =>
  formatActionLabel(value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, "_"));

const isIsoDateTime = (v: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);

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
      {deleted && <span style={{ fontSize: "0.78rem" }}>(deleted)</span>}
    </p>
  );
};

export default async function ProviderActivityPage({ params, searchParams }: ProviderActivityPageProps): Promise<JSX.Element> {
  const [{ providerId }, sp] = await Promise.all([params, searchParams]);
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const history = typeof sp.history === "string" ? sp.history.split(",").filter(Boolean) : [];

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading activity…</div></div>}>
      <ProviderActivityContent householdId={household.id} providerId={providerId} cursor={cursor} history={history} />
    </Suspense>
  );
}

async function ProviderActivityContent({ householdId, providerId, cursor, history }: { householdId: string; providerId: string; cursor: string | undefined; history: string[] }): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({
    pageSize: 25,
    dateFormat: "US" as const,
    currencyCode: "USD",
  }));

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return isIsoDateTime(value) ? formatDateTime(value, "Not set", undefined, prefs.dateFormat) : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(formatValue).join(", ");
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return "—";
      return entries.map(([k, v]) => `${formatMetadataLabel(k)}: ${formatValue(v)}`).join("; ");
    }
    return String(value);
  };

  const limit = 50;

  const activity = await getHouseholdActivity(householdId, {
    entityType: "service_provider",
    entityId: providerId,
    ...(cursor ? { cursor } : {}),
    limit,
  });

  const buildHref = (p: { cursor?: string; history?: string[]; limit: number }): string => {
    const q = new URLSearchParams();
    if (p.cursor) q.set("cursor", p.cursor);
    if (p.history && p.history.length > 0) q.set("history", p.history.join(","));
    return `/service-providers/${providerId}/activity?${q.toString()}`;
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Activity ({activity.entries.length})</h2>
        <span className="pill">Newest first</span>
      </div>
      <div className="panel__body">
        {activity.entries.length === 0 ? (
          <p className="panel__empty">No activity recorded for this provider yet.</p>
        ) : (
          <div className="schedule-stack">
            {activity.entries.map((entry) => (
              <article key={entry.id} className="schedule-card">
                <div className="schedule-card__summary">
                  <div>
                    <h3>{formatActionLabel(entry.action)}</h3>
                    {renderEntityRef(entry)}
                  </div>
                  <span className="pill">{formatDateTime(entry.createdAt, undefined, undefined, prefs.dateFormat)}</span>
                </div>
                {entry.metadata ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {Object.entries(entry.metadata).map(([key, value]) => (
                      <div key={key}>
                        <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {formatMetadataLabel(key)}
                        </div>
                        <div style={{ fontSize: "0.88rem" }}>{formatValue(value)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
      <CursorPaginationControls
        nextCursor={activity.nextCursor ?? null}
        currentCursor={cursor}
        cursorHistory={history}
        limit={limit}
        resultCount={activity.entries.length}
        entityLabel="entries"
        buildHref={buildHref}
      />
    </section>
  );
}
