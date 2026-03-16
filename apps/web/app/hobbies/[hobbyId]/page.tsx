import type { JSX } from "react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { HobbySessionAdvanceButton } from "../../../components/hobby-session-advance-button";
import { HobbyShoppingListButton } from "../../../components/hobby-shopping-list-button";
import {
  ApiError,
  getHobbyDetail,
  getHobbyRecipes,
  getHobbySessions,
  getHobbyMetrics,
  getHobbyMetricReadings,
  getHobbyLogs,
  getMe,
} from "../../../lib/api";
import type {
  HobbyLog,
  HobbyMetricDefinition,
  HobbyMetricReading,
  HobbyRecipe,
  HobbySessionSummary,
} from "@lifekeeper/types";

type HobbyDetailPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "recipes", label: "Recipes" },
  { id: "sessions", label: "Sessions" },
  { id: "inventory", label: "Inventory" },
  { id: "metrics", label: "Metrics" },
  { id: "journal", label: "Journal" },
  { id: "settings", label: "Settings" },
] as const;

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

export default async function HobbyDetailPage({ params, searchParams }: HobbyDetailPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const { tab = "overview" } = await searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Hobby</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </AppShell>
      );
    }

    const hobby = await getHobbyDetail(household.id, hobbyId);

    const [recipes, sessions, metrics, logs] = await Promise.all([
      getHobbyRecipes(household.id, hobbyId),
      getHobbySessions(household.id, hobbyId),
      getHobbyMetrics(household.id, hobbyId),
      getHobbyLogs(household.id, hobbyId),
    ]);

    // Load metric readings for all metrics
    const metricReadingsMap: Record<string, HobbyMetricReading[]> = {};
    await Promise.all(
      metrics.map(async (m) => {
        metricReadingsMap[m.id] = await getHobbyMetricReadings(household.id, hobbyId, m.id);
      })
    );

    const activeSessions = sessions.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const isPipeline = hobby.lifecycleMode === "pipeline";
    const pipelineSteps = hobby.statusPipeline.sort((a, b) => a.sortOrder - b.sortOrder);

    const renderOverviewTab = (): JSX.Element => (
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
        </section>

        <div className="resource-layout">
          <div className="resource-layout__primary">
            {activeSessions.length > 0 ? (
              <section className="panel">
                <div className="panel__header"><h2>Active Sessions</h2></div>
                <div className="panel__body--padded">
                  <div style={{ display: "grid", gap: "12px" }}>
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="hobby-session-card"
                      >
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
                  <Link href={`/hobbies/${hobbyId}?tab=sessions`} className="btn btn--sm">Start New Session</Link>
                  <Link href={`/hobbies/${hobbyId}?tab=recipes`} className="btn btn--sm btn--ghost">Add Recipe</Link>
                  <Link href={`/hobbies/${hobbyId}?tab=metrics`} className="btn btn--sm btn--ghost">Record Metric</Link>
                  <Link href={`/hobbies/${hobbyId}?tab=journal`} className="btn btn--sm btn--ghost">Write Journal Entry</Link>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );

    const renderRecipesTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/hobbies/${hobbyId}/recipes/new`} className="btn btn--primary btn--sm">New Recipe</Link>
        </div>
        {recipes.length === 0 ? (
          <div className="panel">
            <div className="panel__body--padded">
              <p className="panel__empty">No recipes yet. Create your first recipe to get started.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="hobby-recipe-card"
              >
                <Link href={`/hobbies/${hobbyId}/recipes/${recipe.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{recipe.name}</strong>
                      {recipe.styleCategory ? (
                        <span className="pill" style={{ marginLeft: "8px" }}>{recipe.styleCategory}</span>
                      ) : null}
                    </div>
                    <span className="pill">{recipe.sourceType}</span>
                  </div>
                  {recipe.description ? (
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "8px" }}>
                      {recipe.description.length > 120 ? recipe.description.slice(0, 120) + "..." : recipe.description}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                    {recipe.estimatedDuration != null ? <span>{recipe.estimatedDuration} min</span> : null}
                    {recipe.estimatedCost != null ? <span>${recipe.estimatedCost.toFixed(2)}</span> : null}
                  </div>
                </Link>
                <div className="recipe-card__actions">
                  <HobbyShoppingListButton
                    householdId={household.id}
                    hobbyId={hobbyId}
                    recipeId={recipe.id}
                    recipeName={recipe.name}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    const renderSessionsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/hobbies/${hobbyId}/sessions/new`} className="btn btn--primary btn--sm">New Session</Link>
        </div>
        {sessions.length === 0 ? (
          <div className="panel">
            <div className="panel__body--padded">
              <p className="panel__empty">No sessions yet. Start your first session to begin tracking.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/hobbies/${hobbyId}/sessions/${session.id}`}
                style={{ textDecoration: "none", display: "block", padding: "16px", border: "1px solid var(--border)", borderRadius: "8px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{session.name}</strong>
                    {session.recipeName ? (
                      <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginLeft: "8px" }}>
                        from {session.recipeName}
                      </span>
                    ) : null}
                  </div>
                  <span className={statusBadgeClass(session.status)}>{session.status}</span>
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                  <span>{session.completedStepCount}/{session.stepCount} steps</span>
                  <span>{session.ingredientCount} ingredients</span>
                  {session.rating != null ? <span>{"★".repeat(session.rating)}</span> : null}
                  <span>Started {formatDate(session.startDate)}</span>
                  {session.completedDate ? <span>Completed {formatDate(session.completedDate)}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );

    const renderInventoryTab = (): JSX.Element => {
      const equipmentLinks = hobby.assetLinks;
      const consumableLinks = hobby.inventoryLinks;
      const categories = hobby.inventoryCategories;

      return (
        <div style={{ display: "grid", gap: "24px" }}>
          <section className="panel">
            <div className="panel__header"><h2>Equipment</h2></div>
            <div className="panel__body--padded">
              {equipmentLinks.length === 0 ? (
                <p className="panel__empty">No equipment linked to this hobby.</p>
              ) : (
                <table className="data-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Role</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentLinks.map((link) => (
                      <tr key={link.id}>
                        <td>
                          <Link href={`/assets/${link.assetId}`} className="text-link">{link.asset.name}</Link>
                        </td>
                        <td>{link.asset.category}</td>
                        <td>{link.role ?? "-"}</td>
                        <td>{link.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header"><h2>Consumables &amp; Supplies</h2></div>
            <div className="panel__body--padded">
              {consumableLinks.length === 0 ? (
                <p className="panel__empty">No inventory items linked to this hobby.</p>
              ) : (
                <>
                  {categories.length > 0 ? (
                    categories.map((cat) => {
                      const catItems = consumableLinks.filter((link) =>
                        link.notes?.toLowerCase().includes(cat.categoryName.toLowerCase())
                      );
                      if (catItems.length === 0) return null;
                      return (
                        <div key={cat.id} style={{ marginBottom: "16px" }}>
                          <h3 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>{cat.categoryName}</h3>
                          <table className="data-table" style={{ width: "100%" }}>
                            <thead>
                              <tr><th>Name</th><th>On Hand</th><th>Unit</th></tr>
                            </thead>
                            <tbody>
                              {catItems.map((link) => (
                                <tr key={link.id}>
                                  <td>{link.inventoryItem.name}</td>
                                  <td>{link.inventoryItem.quantityOnHand}</td>
                                  <td>{link.inventoryItem.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })
                  ) : null}
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr><th>Name</th><th>On Hand</th><th>Unit</th><th>Notes</th></tr>
                    </thead>
                    <tbody>
                      {consumableLinks.map((link) => (
                        <tr key={link.id}>
                          <td>{link.inventoryItem.name}</td>
                          <td>{link.inventoryItem.quantityOnHand}</td>
                          <td>{link.inventoryItem.unit}</td>
                          <td>{link.notes ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </section>
        </div>
      );
    };

    const renderMetricsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "16px" }}>
        {metrics.length === 0 ? (
          <div className="panel">
            <div className="panel__body--padded">
              <p className="panel__empty">No metric definitions configured for this hobby.</p>
            </div>
          </div>
        ) : (
          metrics.map((metric) => {
            const readings = metricReadingsMap[metric.id] ?? [];
            return (
              <section key={metric.id} className="panel">
                <div className="panel__header">
                  <h2>{metric.name}</h2>
                  <span className="pill">{metric.unit}</span>
                </div>
                <div className="panel__body--padded">
                  {metric.description ? (
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "12px" }}>{metric.description}</p>
                  ) : null}
                  {readings.length === 0 ? (
                    <p className="panel__empty">No readings recorded yet.</p>
                  ) : (
                    <>
                      {readings.length >= 3 ? (
                        <div className="hobby-metric-sparkline" style={{ display: "flex", alignItems: "end", gap: "2px", height: "40px", marginBottom: "16px" }}>
                          {(() => {
                            const vals = readings.slice(0, 20).reverse().map((r) => r.value);
                            const min = Math.min(...vals);
                            const max = Math.max(...vals);
                            const range = max - min || 1;
                            return vals.map((v, i) => (
                              <div
                                key={i}
                                style={{
                                  flex: 1,
                                  height: `${((v - min) / range) * 100}%`,
                                  minHeight: "4px",
                                  background: "var(--accent)",
                                  borderRadius: "2px 2px 0 0",
                                }}
                                title={`${v} ${metric.unit}`}
                              />
                            ));
                          })()}
                        </div>
                      ) : null}
                      <table className="data-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Value</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {readings.slice(0, 10).map((reading) => (
                            <tr key={reading.id}>
                              <td>{formatDate(reading.readingDate)}</td>
                              <td><strong>{reading.value}</strong> {metric.unit}</td>
                              <td>{reading.notes ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    );

    const renderJournalTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "16px" }}>
        {logs.length === 0 ? (
          <div className="panel">
            <div className="panel__body--padded">
              <p className="panel__empty">No journal entries yet. Start documenting your hobby journey.</p>
            </div>
          </div>
        ) : (
          logs.map((log) => {
            const borderColor =
              log.logType === "tasting" ? "var(--accent)"
              : log.logType === "progress" ? "var(--success)"
              : log.logType === "issue" ? "var(--warning)"
              : "var(--ink-muted)";
            return (
              <article
                key={log.id}
                className="hobby-journal-card"
                style={{
                  padding: "16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${borderColor}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {log.title ? <strong>{log.title}</strong> : null}
                    <span className="pill" style={{ marginLeft: log.title ? "8px" : "0" }}>{log.logType}</span>
                  </div>
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{formatDate(log.logDate)}</span>
                </div>
                {log.content ? (
                  <p style={{ marginTop: "8px", color: "var(--ink-muted)", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                    {log.content}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    );

    const renderSettingsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header"><h2>Hobby Details</h2></div>
          <div className="panel__body--padded">
            <dl className="data-list">
              <div><dt>Name</dt><dd>{hobby.name}</dd></div>
              <div><dt>Description</dt><dd>{hobby.description ?? "Not set"}</dd></div>
              <div><dt>Status</dt><dd><span className={statusBadgeClass(hobby.status)}>{hobby.status}</span></dd></div>
              {hobby.hobbyType ? <div><dt>Hobby Type</dt><dd>{hobby.hobbyType}</dd></div> : null}
              <div><dt>Lifecycle Mode</dt><dd>{isPipeline ? "Pipeline" : "Binary"}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(hobby.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(hobby.updatedAt)}</dd></div>
            </dl>
          </div>
        </section>

        {isPipeline ? (
          <section className="panel">
            <div className="panel__header"><h2>Pipeline Steps</h2></div>
            <div className="panel__body--padded">
              {pipelineSteps.length === 0 ? (
                <p className="panel__empty">No pipeline steps defined.</p>
              ) : (
                <ol style={{ paddingLeft: "20px", display: "grid", gap: "8px" }}>
                  {pipelineSteps.map((step) => (
                    <li key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {step.color ? (
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: step.color, flexShrink: 0 }} />
                      ) : null}
                      <span>{step.label}</span>
                      {step.isFinal ? <span className="pill pill--muted" style={{ fontSize: "0.7rem" }}>Final</span> : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel__header"><h2>Inventory Categories</h2></div>
          <div className="panel__body--padded">
            {hobby.inventoryCategories.length === 0 ? (
              <p className="panel__empty">No inventory categories defined.</p>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {hobby.inventoryCategories.map((cat) => (
                  <span key={cat.id} className="pill">{cat.categoryName}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Linked Assets</h2></div>
          <div className="panel__body--padded">
            {hobby.assetLinks.length === 0 ? (
              <p className="panel__empty">No assets linked.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {hobby.assetLinks.map((link) => (
                  <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link href={`/assets/${link.assetId}`} className="text-link">{link.asset.name}</Link>
                    {link.role ? <span className="pill">{link.role}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Linked Projects</h2></div>
          <div className="panel__body--padded">
            {hobby.projectLinks.length === 0 ? (
              <p className="panel__empty">No projects linked.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {hobby.projectLinks.map((link) => (
                  <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link href={`/projects/${link.projectId}`} className="text-link">{link.project.name}</Link>
                    <span className={statusBadgeClass(link.project.status)}>{link.project.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="panel__header"><h2>Danger Zone</h2></div>
          <div className="panel__body--padded">
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "12px" }}>
              Archiving or deleting a hobby cannot be easily reversed. Proceed with caution.
            </p>
          </div>
        </section>
      </div>
    );

    return (
      <AppShell activePath="/hobbies">
        <header className="page-header">
          <div>
            <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
            <h1 style={{ marginTop: "4px" }}>{hobby.name}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
              {hobby.description ?? "No description."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={statusBadgeClass(hobby.status)}>{hobby.status}</span>
            {hobby.hobbyType ? <span className="pill">{hobby.hobbyType}</span> : null}
          </div>
        </header>

        <nav className="tab-navigation" aria-label="Hobby sections">
          <ul style={{ display: "flex", gap: "24px", listStyle: "none", padding: "0 0 12px 0", margin: "16px 0 24px 0", borderBottom: "1px solid var(--border-color)", overflowX: "auto" }}>
            {tabs.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/hobbies/${hobbyId}?tab=${item.id}`}
                  style={{
                    textDecoration: "none",
                    color: tab === item.id ? "var(--ink-base)" : "var(--ink-muted)",
                    fontWeight: tab === item.id ? "600" : "normal",
                    paddingBottom: "12px",
                    borderBottom: tab === item.id ? "2px solid var(--ink-base)" : "none",
                    display: "block",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main>
          {tab === "overview" ? renderOverviewTab() : null}
          {tab === "recipes" ? renderRecipesTab() : null}
          {tab === "sessions" ? renderSessionsTab() : null}
          {tab === "inventory" ? renderInventoryTab() : null}
          {tab === "metrics" ? renderMetricsTab() : null}
          {tab === "journal" ? renderJournalTab() : null}
          {tab === "settings" ? renderSettingsTab() : null}
        </main>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Hobby</h1></header>
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
