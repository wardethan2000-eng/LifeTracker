import type { HobbyStatus } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import { ApiError, getHouseholdHobbies, getMe } from "../../lib/api";

type HobbiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const hobbyStatusLabels: Record<HobbyStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

export default async function HobbiesPage({ searchParams }: HobbiesPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const statusParam = getParam(params.status);
  const selectedStatus = (statusParam === "active" || statusParam === "paused" || statusParam === "archived")
    ? statusParam as HobbyStatus
    : undefined;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Hobbies</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const hobbies = await getHouseholdHobbies(household.id, {
      ...(selectedStatus ? { status: selectedStatus } : {}),
    });

    const totalActive = hobbies.filter((h) => h.status === "active").length;
    const totalSessions = hobbies.reduce((sum, h) => sum + h.sessionCount, 0);
    const activeSessions = hobbies.reduce((sum, h) => sum + h.activeSessionCount, 0);
    const totalRecipes = hobbies.reduce((sum, h) => sum + h.recipeCount, 0);

    return (
      <AppShell activePath="/hobbies">
        <header className="page-header">
          <div>
            <h1>Hobbies</h1>
            <p>Track recipes, sessions, inventory, and metrics for your creative pursuits.</p>
          </div>
          <div className="page-header__actions">
            <Link href="/hobbies/new" className="button">New Hobby</Link>
          </div>
        </header>

        <div className="page-body">
          {/* Stats row */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-card__value">{totalActive}</span>
              <span className="stat-card__label">Active Hobbies</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{totalSessions}</span>
              <span className="stat-card__label">Total Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{activeSessions}</span>
              <span className="stat-card__label">Active Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{totalRecipes}</span>
              <span className="stat-card__label">Recipes</span>
            </div>
          </div>

          {/* Status filter */}
          <div className="hobby-status-strip">
            <Link
              href="/hobbies"
              className={`project-status-chip${selectedStatus === undefined ? " project-status-chip--active" : ""}`}
            >
              <span>All</span>
              <strong>{hobbies.length}</strong>
            </Link>
            {(Object.keys(hobbyStatusLabels) as HobbyStatus[]).map((status) => {
              const count = hobbies.filter((h) => h.status === status).length;
              return (
                <Link
                  key={status}
                  href={`/hobbies?status=${status}`}
                  className={`project-status-chip${selectedStatus === status ? " project-status-chip--active" : ""}`}
                >
                  <span>{hobbyStatusLabels[status]}</span>
                  <strong>{count}</strong>
                </Link>
              );
            })}
          </div>

          {/* Hobby cards */}
          {hobbies.length === 0 ? (
            <section className="panel">
              <div className="panel__body--padded panel__empty">
                <p>No hobbies yet. Create your first hobby to start tracking sessions, recipes, and inventory.</p>
                <Link href="/hobbies/new" className="button button--primary">Create Your First Hobby</Link>
              </div>
            </section>
          ) : (
            <div className="hobby-card-grid">
              {hobbies.map((hobby) => (
                <Link key={hobby.id} href={`/hobbies/${hobby.id}`} className="panel hobby-card">
                  <div className="panel__body--padded">
                    <div className="hobby-card__header">
                      <h3 className="hobby-card__name">{hobby.name}</h3>
                      <span className={`status-badge status-badge--${hobby.status}`}>
                        {hobbyStatusLabels[hobby.status]}
                      </span>
                    </div>
                    {hobby.description && (
                      <p className="hobby-card__description">{hobby.description}</p>
                    )}
                    {hobby.hobbyType && (
                      <span className="hobby-card__type-badge">{hobby.hobbyType}</span>
                    )}
                    <div className="hobby-card__stats">
                      <span>{hobby.sessionCount} sessions</span>
                      {hobby.activeSessionCount > 0 && (
                        <span className="hobby-card__active-badge">{hobby.activeSessionCount} active</span>
                      )}
                      <span>{hobby.recipeCount} recipes</span>
                      {hobby.linkedAssetCount > 0 && (
                        <span>{hobby.linkedAssetCount} equipment</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Hobbies</h1></header>
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
