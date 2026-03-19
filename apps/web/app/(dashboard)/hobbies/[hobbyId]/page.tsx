import type { JSX } from "react";
import Link from "next/link";
import { EntryTipsSurface } from "../../../../components/entry-system";
import { HobbySessionAdvanceButton } from "../../../../components/hobby-session-advance-button";
import {
  ApiError,
  getHobbyDetail,
  getHobbySessions,
  getHobbySeries,
  getMe,
} from "../../../../lib/api";
import {
  getBrewDayHighlights,
  getBrewDayMissingItems,
  getBrewDayReadinessLabel,
  isBeerBrewingHobby,
  resolveBrewDayData,
} from "../../../../lib/hobby-brewing";

type HobbyDetailPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(iso: string | null | undefined, fallback = "-"): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "pill pill--success";
    case "paused": return "pill pill--warning";
    case "archived": return "pill pill--muted";
    case "completed": return "pill pill--success";
    case "planned": return "pill pill--muted";
    default: return "pill";
  }
}

export default async function HobbyDetailPage({ params }: HobbyDetailPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return <p>No household found.</p>;
    }

    const hobby = await getHobbyDetail(household.id, hobbyId);
    const [sessions, series] = await Promise.all([
      getHobbySessions(household.id, hobbyId),
      getHobbySeries(household.id, hobbyId),
    ]);

    const activeSessions = sessions.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const isPipeline = hobby.lifecycleMode === "pipeline";
    const isBrewingHobby = isBeerBrewingHobby(hobby);
    const pipelineSteps = hobby.statusPipeline.sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <>
        <EntryTipsSurface
          householdId={household.id}
          queries={[{ entityType: "hobby", entityId: hobbyId }]}
          entryHrefTemplate={`/hobbies/${hobbyId}/entries#entry-{entryId}`}
        />

        <div style={{ display: "grid", gap: "24px" }}>
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Sessions</span>
              <strong className="stat-card__value">{hobby.sessionCount}</strong>
              <span className="stat-card__sub">Total sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Active</span>
              <strong className="stat-card__value">{activeSessions.length}</strong>
              <span className="stat-card__sub">In progress</span>
            </div>
            <div className="stat-card stat-card--success">
              <span className="stat-card__label">Completed</span>
              <strong className="stat-card__value">{completedSessions.length}</strong>
              <span className="stat-card__sub">Finished sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Recipes</span>
              <strong className="stat-card__value">{hobby.recipeCount}</strong>
              <span className="stat-card__sub">In library</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Equipment</span>
              <strong className="stat-card__value">{hobby.assetLinks.length}</strong>
              <span className="stat-card__sub">Linked assets</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Series</span>
              <strong className="stat-card__value">{series.length}</strong>
              <span className="stat-card__sub">Tracked batch lines</span>
            </div>
          </section>

          <div className="resource-layout">
            <div className="resource-layout__primary">
              {activeSessions.length > 0 ? (
                <section className="panel">
                  <div className="panel__header"><h2>Active Sessions</h2></div>
                  <div className="panel__body--padded">
                    <div style={{ display: "grid", gap: "12px" }}>
                      {activeSessions.map((session) => (
                        <div key={session.id} className="hobby-session-card">
                          {isBrewingHobby ? (() => {
                            const brewDay = resolveBrewDayData(session.customFields, hobby);
                            const highlights = getBrewDayHighlights(brewDay);
                            const missingItems = getBrewDayMissingItems(brewDay);
                            const readinessLabel = getBrewDayReadinessLabel(brewDay);

                            return (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <Link href={`/hobbies/${hobbyId}/sessions/${session.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                    <strong>{session.name}</strong>
                                  </Link>
                                  <span className={statusBadgeClass(session.status)}>{session.status}</span>
                                </div>
                                {session.recipeName ? (
                                  <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                                    From: {session.recipeName}
                                  </p>
                                ) : null}
                                <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <span className="pill pill--success">{readinessLabel}</span>
                                    {missingItems.length > 0 ? (
                                      <span className="pill pill--warning">Missing {missingItems.length}</span>
                                    ) : null}
                                  </div>
                                  {highlights.length > 0 ? (
                                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                      {highlights.map((item) => (
                                        <span key={item} className="pill pill--muted">{item}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "0.82rem" }}>
                                      Brew-day execution details have not been captured yet.
                                    </p>
                                  )}
                                  {missingItems.length > 0 ? (
                                    <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "0.8rem" }}>
                                      Missing: {missingItems.slice(0, 3).join(", ")}{missingItems.length > 3 ? ", ..." : ""}
                                    </p>
                                  ) : null}
                                </div>
                                <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                                  <Link href={`/hobbies/${hobbyId}/sessions/${session.id}`} className="button button--secondary button--sm">
                                    Open Session
                                  </Link>
                                  <Link href={`/hobbies/${hobbyId}/sessions/${session.id}#brew-day-workspace`} className="button button--ghost button--sm">
                                    Edit Brew Day
                                  </Link>
                                </div>
                                <div style={{ display: "flex", gap: "8px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                                  <span>{session.completedStepCount}/{session.stepCount} steps</span>
                                  <span>·</span>
                                  <span>Started {formatDate(session.startDate)}</span>
                                </div>
                              </>
                            );
                          })() : (
                            <>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <Link href={`/hobbies/${hobbyId}/sessions/${session.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                  <strong>{session.name}</strong>
                                </Link>
                                <span className={statusBadgeClass(session.status)}>{session.status}</span>
                              </div>
                              {session.recipeName ? (
                                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                                  From: {session.recipeName}
                                </p>
                              ) : null}
                              {isPipeline ? (
                                <HobbySessionAdvanceButton
                                  householdId={household.id}
                                  hobbyId={hobbyId}
                                  sessionId={session.id}
                                  sessionName={session.name}
                                  currentStatus={session.status}
                                  currentPipelineStepId={session.pipelineStepId}
                                  pipelineSteps={pipelineSteps.map((step) => ({
                                    id: step.id,
                                    label: step.label,
                                    sortOrder: step.sortOrder,
                                    isFinal: step.isFinal,
                                    color: step.color,
                                  }))}
                                />
                              ) : null}
                              <div style={{ display: "flex", gap: "8px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                                <span>{session.completedStepCount}/{session.stepCount} steps</span>
                                <span>·</span>
                                <span>Started {formatDate(session.startDate)}</span>
                              </div>
                              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                                <Link href={`/hobbies/${hobbyId}/sessions/${session.id}`} className="button button--secondary button--sm">
                                  Open Session
                                </Link>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="panel">
                <div className="panel__header"><h2>Recent Sessions</h2></div>
                <div className="panel__body--padded">
                  {completedSessions.length === 0 ? (
                    <p className="panel__empty">No completed sessions yet.</p>
                  ) : (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {completedSessions.slice(0, 5).map((session) => (
                        <Link
                          key={session.id}
                          href={`/hobbies/${hobbyId}/sessions/${session.id}`}
                          style={{ textDecoration: "none", display: "block", padding: "12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong>{session.name}</strong>
                            {session.rating != null ? (
                              <span className="pill" title="Rating">{"★".repeat(session.rating)}</span>
                            ) : null}
                          </div>
                          {session.recipeName ? (
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                              {session.recipeName}
                            </p>
                          ) : null}
                          <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "4px" }}>
                            Completed {formatDate(session.completedDate)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="resource-layout__aside">
              <section className="panel">
                <div className="panel__header"><h2>Hobby Info</h2></div>
                <div className="panel__body--padded">
                  <dl className="data-list">
                    <div><dt>Status</dt><dd><span className={statusBadgeClass(hobby.status)}>{hobby.status}</span></dd></div>
                    {hobby.hobbyType ? <div><dt>Type</dt><dd><span className="pill">{hobby.hobbyType}</span></dd></div> : null}
                    <div><dt>Lifecycle</dt><dd>{isPipeline ? "Pipeline" : "Binary"}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(hobby.createdAt)}</dd></div>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header"><h2>Equipment</h2></div>
                <div className="panel__body--padded">
                  {hobby.assetLinks.length === 0 ? (
                    <p className="panel__empty">No equipment linked.</p>
                  ) : (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {hobby.assetLinks.map((link) => (
                        <Link key={link.id} href={`/assets/${link.assetId}`} className="text-link">
                          {link.asset.name}
                          {link.role ? ` (${link.role})` : ""}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header"><h2>Quick Actions</h2></div>
                <div className="panel__body--padded">
                  <div style={{ display: "grid", gap: "8px" }}>
                    <Link href={`/hobbies/${hobbyId}/sessions/new`} className="button button--primary button--sm">Start New Session</Link>
                    <Link href={`/hobbies/${hobbyId}/series/new`} className="button button--secondary button--sm">New Series</Link>
                    <Link href={`/hobbies/${hobbyId}/recipes/new`} className="button button--secondary button--sm">Add Recipe</Link>
                    <Link href={`/hobbies/${hobbyId}/edit`} className="button button--ghost button--sm">Edit Hobby</Link>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
