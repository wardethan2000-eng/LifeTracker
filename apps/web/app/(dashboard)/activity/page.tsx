import Link from "next/link";
import type { JSX } from "react";
import { HouseholdCsvExportButton } from "../../../components/asset-export-actions";
import { ApiError, getHouseholdActivity, getMe } from "../../../lib/api";
import { formatDateTime } from "../../../lib/formatters";

type ActivityPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatActionLabel = (value: string): string => value
  .split(/[._]/g)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(" ");

export default async function ActivityPage({ searchParams }: ActivityPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Activity</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const activity = await getHouseholdActivity(household.id);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Activity Log</h1>
            <p style={{ marginTop: 6 }}>Household audit trail for assets, schedules, projects, invitations, and collaboration events.</p>
          </div>
          <HouseholdCsvExportButton householdId={household.id} dataset="activity-log" />
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>Recent Activity ({activity.length})</h2>
            </div>
            <div className="panel__body">
              {activity.length === 0 ? (
                <p className="panel__empty">No activity recorded yet.</p>
              ) : (
                <div className="schedule-stack">
                  {activity.map((entry) => (
                    <article key={entry.id} className="schedule-card">
                      <div className="schedule-card__summary">
                        <div>
                          <h3>{formatActionLabel(entry.action)}</h3>
                          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                            {entry.entityType} • {entry.entityId}
                          </p>
                        </div>
                        <span className="pill">{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.metadata ? (
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Activity</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load activity: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}