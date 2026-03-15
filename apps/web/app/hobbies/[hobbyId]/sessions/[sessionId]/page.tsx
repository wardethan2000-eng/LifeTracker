import type { JSX } from "react";
import Link from "next/link";
import { AppShell } from "../../../../../components/app-shell";
import {
  ApiError,
  getHobbyDetail,
  getHobbySessionDetail,
  getMe,
} from "../../../../../lib/api";

type SessionDetailPageProps = {
  params: Promise<{ hobbyId: string; sessionId: string }>;
};

function formatDate(iso: string | null | undefined, fallback = "-"): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "pill pill--success";
    case "completed": return "pill pill--success";
    case "paused": return "pill pill--warning";
    case "planned": return "pill pill--muted";
    default: return "pill";
  }
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, sessionId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Session</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </AppShell>
      );
    }

    const [hobby, session] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbySessionDetail(household.id, hobbyId, sessionId),
    ]);

    const isPipeline = hobby.lifecycleMode === "pipeline";
    const pipelineSteps = hobby.statusPipeline.sort((a, b) => a.sortOrder - b.sortOrder);
    const currentStepIndex = pipelineSteps.findIndex((s) => s.id === session.pipelineStepId);
    const completedSteps = session.steps.filter((s) => s.isCompleted).length;

    return (
      <AppShell activePath="/hobbies">
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=sessions`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {hobby.name} Sessions
            </Link>
            <h1 style={{ marginTop: "4px" }}>{session.name}</h1>
            {session.recipeName ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                From recipe: {session.recipeName}
              </p>
            ) : null}
          </div>
          <span className={statusBadgeClass(session.status)}>{session.status}</span>
        </header>

        {isPipeline && pipelineSteps.length > 0 ? (
          <div className="hobby-pipeline-indicator" style={{ margin: "0 0 24px 0" }}>
            <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
              {pipelineSteps.map((step, i) => (
                <div
                  key={step.id}
                  style={{
                    flex: 1,
                    height: "8px",
                    borderRadius: "4px",
                    background: i < currentStepIndex
                      ? "var(--success)"
                      : i === currentStepIndex
                      ? "var(--accent)"
                      : "var(--border)",
                  }}
                  title={step.label}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--ink-muted)" }}>
              {pipelineSteps.map((step, i) => (
                <span
                  key={step.id}
                  style={{
                    fontWeight: i === currentStepIndex ? "600" : "normal",
                    color: i === currentStepIndex ? "var(--accent)" : undefined,
                  }}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="resource-layout">
          <div className="resource-layout__primary">
            {/* Steps section */}
            <section className="panel">
              <div className="panel__header">
                <h2>Steps</h2>
                <span className="pill">{completedSteps}/{session.steps.length} done</span>
              </div>
              <div className="panel__body--padded">
                {session.steps.length === 0 ? (
                  <p className="panel__empty">No steps in this session.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {session.steps.map((step) => (
                      <div
                        key={step.id}
                        className="hobby-step-item"
                        style={{
                          display: "flex",
                          gap: "12px",
                          padding: "10px",
                          borderRadius: "6px",
                          background: step.isCompleted ? "var(--surface)" : "transparent",
                          border: "1px solid var(--border)",
                          opacity: step.isCompleted ? 0.7 : 1,
                        }}
                      >
                        <span style={{ fontSize: "1.1rem" }}>{step.isCompleted ? "✓" : "○"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <strong style={{ textDecoration: step.isCompleted ? "line-through" : "none" }}>
                              {step.title}
                            </strong>
                            {step.durationMinutes != null ? (
                              <span className="pill" style={{ fontSize: "0.7rem" }}>{step.durationMinutes} min</span>
                            ) : null}
                          </div>
                          {step.description ? (
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                              {step.description}
                            </p>
                          ) : null}
                          {step.completedAt ? (
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.75rem", marginTop: "4px" }}>
                              Completed {formatDate(step.completedAt)}
                            </p>
                          ) : null}
                          {step.notes ? (
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "4px", fontStyle: "italic" }}>
                              {step.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Ingredients section */}
            <section className="panel">
              <div className="panel__header">
                <h2>Ingredients</h2>
                <span className="pill">{session.ingredients.length} items</span>
              </div>
              <div className="panel__body--padded">
                {session.ingredients.length === 0 ? (
                  <p className="panel__empty">No ingredients in this session.</p>
                ) : (
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Unit Cost</th>
                        <th>Linked Item</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.ingredients.map((ing) => (
                        <tr key={ing.id}>
                          <td>{ing.name}</td>
                          <td>{ing.quantityUsed}</td>
                          <td>{ing.unit}</td>
                          <td>{ing.unitCost != null ? `$${ing.unitCost.toFixed(2)}` : "-"}</td>
                          <td>
                            {ing.inventoryItem ? (
                              <span title={`${ing.inventoryItem.quantityOnHand} ${ing.inventoryItem.unit} on hand`}>
                                {ing.inventoryItem.name} ({ing.inventoryItem.quantityOnHand} on hand)
                              </span>
                            ) : "-"}
                          </td>
                          <td>{ing.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Metric Readings section */}
            {session.metricReadings.length > 0 ? (
              <section className="panel">
                <div className="panel__header">
                  <h2>Metric Readings</h2>
                  <span className="pill">{session.metricReadings.length} readings</span>
                </div>
                <div className="panel__body--padded">
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Date</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.metricReadings.map((reading) => (
                        <tr key={reading.id}>
                          <td>{reading.metricName}</td>
                          <td><strong>{reading.value}</strong> {reading.metricUnit}</td>
                          <td>{formatDate(reading.readingDate)}</td>
                          <td>{reading.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="resource-layout__aside">
            <section className="panel">
              <div className="panel__header"><h2>Session Info</h2></div>
              <div className="panel__body--padded">
                <dl className="data-list">
                  <div><dt>Status</dt><dd><span className={statusBadgeClass(session.status)}>{session.status}</span></dd></div>
                  <div><dt>Started</dt><dd>{formatDate(session.startDate)}</dd></div>
                  {session.completedDate ? <div><dt>Completed</dt><dd>{formatDate(session.completedDate)}</dd></div> : null}
                  {session.totalCost != null ? <div><dt>Total Cost</dt><dd>${session.totalCost.toFixed(2)}</dd></div> : null}
                  {session.rating != null ? <div><dt>Rating</dt><dd>{"★".repeat(session.rating)}{"☆".repeat(5 - session.rating)}</dd></div> : null}
                  {session.recipeName ? (
                    <div><dt>Recipe</dt><dd>{session.recipeName}</dd></div>
                  ) : null}
                </dl>
              </div>
            </section>

            {session.notes ? (
              <section className="panel">
                <div className="panel__header"><h2>Notes</h2></div>
                <div className="panel__body--padded">
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", color: "var(--ink-muted)" }}>{session.notes}</p>
                </div>
              </section>
            ) : null}

            {session.logs.length > 0 ? (
              <section className="panel">
                <div className="panel__header"><h2>Journal Entries</h2></div>
                <div className="panel__body--padded">
                  <div style={{ display: "grid", gap: "12px" }}>
                    {session.logs.map((log) => {
                      const borderColor =
                        log.logType === "tasting" ? "var(--accent)"
                        : log.logType === "progress" ? "var(--success)"
                        : log.logType === "issue" ? "var(--warning)"
                        : "var(--ink-muted)";
                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: "10px",
                            borderLeft: `3px solid ${borderColor}`,
                            borderRadius: "4px",
                            background: "var(--surface)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {log.title ? <strong style={{ fontSize: "0.85rem" }}>{log.title}</strong> : null}
                            <span className="pill" style={{ fontSize: "0.7rem" }}>{log.logType}</span>
                          </div>
                          {log.content ? (
                            <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: "4px" }}>
                              {log.content.length > 100 ? log.content.slice(0, 100) + "…" : log.content}
                            </p>
                          ) : null}
                          <p style={{ fontSize: "0.7rem", color: "var(--ink-muted)", marginTop: "4px" }}>
                            {formatDate(log.logDate)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Session</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }
    throw error;
  }
}
