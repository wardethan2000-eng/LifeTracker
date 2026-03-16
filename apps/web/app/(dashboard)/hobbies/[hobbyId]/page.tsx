import type { JSX } from "react";
import Link from "next/link";
import {
  archiveHobbyAction,
  createSessionFromRecipeAction,
  deleteHobbyAction,
  restoreHobbyAction,
} from "../../../actions";
import { HobbyDangerActions } from "../../../../components/hobby-danger-actions";
import { HobbyJournalManager } from "../../../../components/hobby-journal-manager";
import { HobbyLinksManager } from "../../../../components/hobby-links-manager";
import { HobbyMetricsManager } from "../../../../components/hobby-metrics-manager";
import { HobbyRecipeList } from "../../../../components/hobby-recipe-list";
import { HobbySessionList } from "../../../../components/hobby-session-list";
import { HobbySessionAdvanceButton } from "../../../../components/hobby-session-advance-button";
import { HobbyShoppingListButton } from "../../../../components/hobby-shopping-list-button";
import {
  ApiError,
  getHobbyDetail,
  getHouseholdAssets,
  getHouseholdInventory,
  getHouseholdProjects,
  getHobbyRecipes,
  getHobbySessions,
  getHobbyMetrics,
  getHobbyMetricReadings,
  getHobbyLogs,
  getMe,
} from "../../../../lib/api";
import type {
  HobbyMetricReading,
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
        <>
          <header className="page-header"><h1>Hobby</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </>
      );
    }

    const hobby = await getHobbyDetail(household.id, hobbyId);

    const [recipes, sessions, metrics, logs, assets, inventoryCatalog, projects] = await Promise.all([
      getHobbyRecipes(household.id, hobbyId),
      getHobbySessions(household.id, hobbyId),
      getHobbyMetrics(household.id, hobbyId),
      getHobbyLogs(household.id, hobbyId),
      getHouseholdAssets(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdProjects(household.id),
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
    const suggestedSession = activeSessions[0] ?? sessions[0] ?? null;
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
                  <Link href={`/hobbies/${hobbyId}/sessions/new`} className="button button--primary button--sm">Start New Session</Link>
                  <Link href={`/hobbies/${hobbyId}/recipes/new`} className="button button--secondary button--sm">Add Recipe</Link>
                  <Link href={`/hobbies/${hobbyId}/edit`} className="button button--ghost button--sm">Edit Hobby</Link>
                  {suggestedSession ? (
                    <Link href={`/hobbies/${hobbyId}/sessions/${suggestedSession.id}`} className="button button--ghost button--sm">
                      Open Session Workspace
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );

    const renderRecipesTab = (): JSX.Element => (
      <HobbyRecipeList householdId={household.id} hobbyId={hobbyId} recipes={recipes} />
    );

    const renderSessionsTab = (): JSX.Element => (
      <HobbySessionList hobbyId={hobbyId} sessions={sessions} />
    );

    const renderInventoryTab = (): JSX.Element => {
      return (
        <HobbyLinksManager
          householdId={household.id}
          hobbyId={hobbyId}
          initialAssetLinks={hobby.assetLinks}
          initialInventoryLinks={hobby.inventoryLinks}
          initialProjectLinks={hobby.projectLinks}
          initialCategories={hobby.inventoryCategories}
          availableAssets={assets.map((asset) => ({ id: asset.id, name: asset.name, category: asset.category }))}
          availableInventoryItems={inventoryCatalog.items.map((item) => ({ id: item.id, name: item.name, category: item.category, unit: item.unit, quantityOnHand: item.quantityOnHand }))}
          availableProjects={projects.map((project) => ({ id: project.id, name: project.name, status: project.status }))}
        />
      );
    };

    const renderMetricsTab = (): JSX.Element => (
      <HobbyMetricsManager
        householdId={household.id}
        hobbyId={hobbyId}
        initialMetrics={metrics}
        initialReadingsMap={metricReadingsMap}
      />
    );

    const renderJournalTab = (): JSX.Element => (
      <HobbyJournalManager
        householdId={household.id}
        hobbyId={hobbyId}
        initialLogs={logs}
      />
    );

    const renderSettingsTab = (): JSX.Element => (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Hobby Details</h2>
            <Link href={`/hobbies/${hobbyId}/edit`} className="button button--secondary button--sm">
              Edit Hobby
            </Link>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              <div><dt>Name</dt><dd>{hobby.name}</dd></div>
              <div><dt>Description</dt><dd>{hobby.description ?? "Not set"}</dd></div>
              <div><dt>Status</dt><dd><span className={statusBadgeClass(hobby.status)}>{hobby.status}</span></dd></div>
              {hobby.hobbyType ? <div><dt>Hobby Type</dt><dd>{hobby.hobbyType}</dd></div> : null}
              <div><dt>Lifecycle Mode</dt><dd>{isPipeline ? "Pipeline" : "Binary"}</dd></div>
              <div><dt>Notes</dt><dd>{hobby.notes ?? "Not set"}</dd></div>
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
            <HobbyDangerActions
              householdId={household.id}
              hobbyId={hobbyId}
              isArchived={hobby.status === "archived"}
              archiveAction={archiveHobbyAction}
              restoreAction={restoreHobbyAction}
              deleteAction={deleteHobbyAction}
            />
          </div>
        </section>
      </div>
    );

    return (
      <>
        <header className="page-header">
          <div>
            <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
            <h1 style={{ marginTop: "4px" }}>{hobby.name}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
              {hobby.description ?? "No description."}
            </p>
          </div>
          <div className="page-header__actions">
            <Link href={`/hobbies/${hobbyId}/sessions/new`} className="button button--primary button--sm">
              New Session
            </Link>
            <Link href={`/hobbies/${hobbyId}/edit`} className="button button--secondary button--sm">
              Edit Hobby
            </Link>
            <span className={statusBadgeClass(hobby.status)}>{hobby.status}</span>
            {hobby.hobbyType ? <span className="pill">{hobby.hobbyType}</span> : null}
          </div>
        </header>

        <div className="page-body">
        <nav aria-label="Hobby sections">
          <ul className="hobby-tab-bar">
            {tabs.map((item) => (
              <li key={item.id} className={tab === item.id ? "hobby-tab-bar__item hobby-tab-bar__item--active" : "hobby-tab-bar__item"}>
                <Link href={`/hobbies/${hobbyId}?tab=${item.id}`}>
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
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Hobby</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }
    throw error;
  }
}
