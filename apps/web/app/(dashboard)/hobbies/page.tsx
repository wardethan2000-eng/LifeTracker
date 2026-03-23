import type { HobbyStatus } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getHouseholdHobbies, getMe } from "../../../lib/api";
import { CursorPaginationControls } from "../../../components/pagination-controls";

type HobbiesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const hobbyStatusLabels: Record<HobbyStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

const hobbyStatusPillClasses: Record<HobbyStatus, string> = {
  active: "pill pill--success",
  paused: "pill pill--warning",
  archived: "pill pill--muted",
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

export default async function HobbiesPage({ searchParams }: HobbiesPageProps): Promise<JSX.Element> {
  const t = await getTranslations("hobbies");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const statusParam = getParam(params.status);
  const selectedStatus = (statusParam === "active" || statusParam === "paused" || statusParam === "archived")
    ? statusParam as HobbyStatus
    : undefined;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const history = typeof params.history === "string"
    ? params.history.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const limit = typeof params.limit === "string" && [25, 50, 100].includes(Number(params.limit))
    ? Number(params.limit)
    : 25;

  const buildHref = (p: { cursor?: string; history?: string[]; limit: number }): string => {
    const q = new URLSearchParams();
    if (selectedStatus) q.set("status", selectedStatus);
    q.set("limit", String(p.limit));
    if (p.cursor) q.set("cursor", p.cursor);
    if (p.history && p.history.length > 0) q.set("history", p.history.join(","));
    return `/hobbies?${q.toString()}`;
  };

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>{t("pageTitle")}</h1></header>
          <div className="page-body">
            <p>{tCommon("empty.noHousehold")} <Link href="/" className="text-link">{tCommon("actions.goToDashboard")}</Link> to create one.</p>
          </div>
        </>
      );
    }

    const hobbyPage = await getHouseholdHobbies(household.id, {
      ...(selectedStatus ? { status: selectedStatus } : {}),
      limit,
      ...(cursor ? { cursor } : {})
    });
    const visibleHobbies = hobbyPage.items;

    const totalActive = visibleHobbies.filter((h) => h.status === "active").length;
    const totalSessions = visibleHobbies.reduce((sum, h) => sum + h.sessionCount, 0);
    const activeSessions = visibleHobbies.reduce((sum, h) => sum + h.activeSessionCount, 0);
    const totalRecipes = visibleHobbies.reduce((sum, h) => sum + h.recipeCount, 0);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("pageTitle")}</h1>
            <p>{t("pageSubtitle")}</p>
          </div>
          <div className="page-header__actions">
            <Link href="/hobbies/new" className="button">{tCommon("actions.newHobby")}</Link>
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
            </Link>
            {(Object.keys(hobbyStatusLabels) as HobbyStatus[]).map((status) => {
              return (
                <Link
                  key={status}
                  href={`/hobbies?status=${status}`}
                  className={`project-status-chip${selectedStatus === status ? " project-status-chip--active" : ""}`}
                >
                  <span>{hobbyStatusLabels[status]}</span>
                </Link>
              );
            })}
          </div>

          {/* Hobby cards */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span className="data-table__secondary">
              {selectedStatus ? hobbyStatusLabels[selectedStatus] : "All hobbies"}
            </span>
            {visibleHobbies.length > 0 && (
              <span className="pill">Showing {visibleHobbies.length}</span>
            )}
          </div>
          {visibleHobbies.length === 0 ? (
            <section className="panel">
              <div className="panel__body--padded panel__empty">
                <p>
                  {selectedStatus
                    ? t("emptyFiltered", { status: hobbyStatusLabels[selectedStatus].toLowerCase() })
                    : t("empty")}
                </p>
                <Link href="/hobbies/new" className="button button--primary">{t("createFirst")}</Link>
              </div>
            </section>
          ) : (
            <div className="hobby-card-grid">
              {visibleHobbies.map((hobby) => (
                <Link key={hobby.id} href={`/hobbies/${hobby.id}`} className="panel hobby-card">
                  <div className="panel__body--padded">
                    <div className="hobby-card__header">
                      <h3 className="hobby-card__name">{hobby.name}</h3>
                      <span className={hobbyStatusPillClasses[hobby.status]}>
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

          <CursorPaginationControls
            nextCursor={hobbyPage.nextCursor}
            currentCursor={cursor}
            cursorHistory={history}
            limit={limit}
            resultCount={visibleHobbies.length}
            entityLabel="hobbies"
            buildHref={buildHref}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Hobbies</h1></header>
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
