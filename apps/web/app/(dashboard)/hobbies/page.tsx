import type { HobbyActivityMode, HobbyStatus } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getDisplayPreferences, getHouseholdHobbies, getMe } from "../../../lib/api";
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

const hobbyActivityModeLabels: Record<HobbyActivityMode, string> = {
  session: "Session",
  project: "Project",
  practice: "Practice",
  collection: "Collection",
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

// ── Deferred list content ──────────────────────────────────
type HobbiesListContentProps = {
  householdId: string;
  selectedStatus: HobbyStatus | undefined;
  selectedMode: HobbyActivityMode | undefined;
  cursor: string | undefined;
  history: string[];
  limit: number;
};

async function HobbiesListContent({
  householdId,
  selectedStatus,
  selectedMode,
  cursor,
  history,
  limit,
}: HobbiesListContentProps): Promise<JSX.Element> {
  const [t, tCommon] = await Promise.all([
    getTranslations("hobbies"),
    getTranslations("common"),
  ]);

  const buildHref = (p: { cursor?: string; history?: string[]; limit: number }): string => {
    const q = new URLSearchParams();
    if (selectedStatus) q.set("status", selectedStatus);
    if (selectedMode) q.set("mode", selectedMode);
    q.set("limit", String(p.limit));
    if (p.cursor) q.set("cursor", p.cursor);
    if (p.history && p.history.length > 0) q.set("history", p.history.join(","));
    return `/hobbies?${q.toString()}`;
  };

  try {
    const hobbyPage = await getHouseholdHobbies(householdId, {
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedMode ? { activityMode: selectedMode } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    });
    const visibleHobbies = hobbyPage.items;

    const totalActive = visibleHobbies.filter((h) => h.status === "active").length;
    const totalSessions = visibleHobbies.reduce((sum, h) => sum + h.sessionCount, 0);
    const activeSessions = visibleHobbies.reduce((sum, h) => sum + h.activeSessionCount, 0);
    const totalRecipes = visibleHobbies.reduce((sum, h) => sum + h.recipeCount, 0);

    return (
      <>
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span className="data-table__secondary">
            {selectedStatus ? hobbyStatusLabels[selectedStatus] : "All hobbies"}
          </span>
          {visibleHobbies.length > 0 && (
            <span className="pill">Showing {visibleHobbies.length}</span>
          )}
        </div>
        {visibleHobbies.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__icon">🎯</p>
            <p className="empty-state__title">
              {selectedStatus ? `No ${hobbyStatusLabels[selectedStatus].toLowerCase()} hobbies` : t("empty")}
            </p>
            <p className="empty-state__body">
              {selectedStatus
                ? t("emptyFiltered", { status: hobbyStatusLabels[selectedStatus].toLowerCase() })
                : "Track the things you love doing — sports, crafts, music, and more."}
            </p>
            <Link href="/hobbies/new" className="button button--primary">{t("createFirst")}</Link>
          </div>
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
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load hobbies: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

// ── Page ──────────────────────────────────────────────────
export default async function HobbiesPage({ searchParams }: HobbiesPageProps): Promise<JSX.Element> {
  // Fire getMe() immediately so it runs in parallel with i18n/prefs setup.
  const mePromise = getMe();
  const [t, tCommon, params, prefs] = await Promise.all([
    getTranslations("hobbies"),
    getTranslations("common"),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
  ]);
  const statusParam = getParam(params.status);
  const selectedStatus = (statusParam === "active" || statusParam === "paused" || statusParam === "archived")
    ? statusParam as HobbyStatus
    : undefined;
  const modeParam = getParam(params.mode);
  const selectedMode = (modeParam === "session" || modeParam === "project" || modeParam === "practice" || modeParam === "collection")
    ? modeParam as HobbyActivityMode
    : undefined;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const history = typeof params.history === "string"
    ? params.history.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const limit = typeof params.limit === "string" && [25, 50, 100].includes(Number(params.limit))
    ? Number(params.limit)
    : prefs.pageSize;

  const buildFilterHref = (status: HobbyStatus | undefined, mode: HobbyActivityMode | undefined): string => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (mode) q.set("mode", mode);
    q.set("limit", String(limit));
    return `/hobbies?${q.toString()}`;
  };

  const me = await mePromise;
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

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t("pageTitle")}</h1>
          <p>{t("pageSubtitle")}</p>
        </div>
        <div className="page-header__actions">
          <Link href="/hobbies/new" className="button button--primary">{tCommon("actions.newHobby")}</Link>
        </div>
      </header>

      <div className="page-body">
        {/* Filter chips — rendered immediately from URL params */}
        <div className="filter-strip">
          <Link
            href={buildFilterHref(undefined, selectedMode)}
            className={`filter-chip${selectedStatus === undefined ? " filter-chip--active" : ""}`}
          >
            <span>All</span>
          </Link>
          {(Object.keys(hobbyStatusLabels) as HobbyStatus[]).map((status) => (
            <Link
              key={status}
              href={buildFilterHref(status, selectedMode)}
              className={`filter-chip${selectedStatus === status ? " filter-chip--active" : ""}`}
            >
              <span>{hobbyStatusLabels[status]}</span>
            </Link>
          ))}
        </div>
        <div className="filter-strip">
          <Link
            href={buildFilterHref(selectedStatus, undefined)}
            className={`filter-chip${selectedMode === undefined ? " filter-chip--active" : ""}`}
          >
            <span>All Modes</span>
          </Link>
          {(Object.keys(hobbyActivityModeLabels) as HobbyActivityMode[]).map((mode) => (
            <Link
              key={mode}
              href={buildFilterHref(selectedStatus, mode)}
              className={`filter-chip${selectedMode === mode ? " filter-chip--active" : ""}`}
            >
              <span>{hobbyActivityModeLabels[mode]}</span>
            </Link>
          ))}
        </div>

        {/* List deferred behind Suspense */}
        <Suspense fallback={<div className="panel"><div className="panel__empty">Loading hobbies…</div></div>}>
          <HobbiesListContent
            householdId={household.id}
            selectedStatus={selectedStatus}
            selectedMode={selectedMode}
            cursor={cursor}
            history={history}
            limit={limit}
          />
        </Suspense>
      </div>
    </>
  );
}
