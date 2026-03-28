import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getDisplayPreferences, getHouseholdDueWork, getMe } from "../../../lib/api";
import { formatCategoryLabel } from "../../../lib/formatters";
import { MaintenanceCalendar } from "../../../components/maintenance-calendar";
import { MaintenanceListWorkspace } from "../../../components/maintenance-list-workspace";
import { OffsetPaginationControls } from "../../../components/pagination-controls";

type MaintenancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const sortOptions = ["priority", "asset", "category", "schedule"] as const;
const statusOptions = ["all", "overdue", "due"] as const;
const viewOptions = ["list", "calendar"] as const;
const limitOptions = [25, 50, 100] as const;

const getSortRank = (status: string): number => {
  if (status === "overdue") return 0;
  if (status === "due") return 1;
  return 2;
};

// â”€â”€ Deferred body â€” fetches dueWork, renders filters + stats + list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type MaintenanceListContentProps = {
  householdId: string;
  statusFilter: (typeof statusOptions)[number];
  categoryFilter: string;
  sort: (typeof sortOptions)[number];
  view: (typeof viewOptions)[number];
  limit: number;
  offset: number;
};

async function MaintenanceListContent({
  householdId, statusFilter, categoryFilter, sort, view, limit, offset
}: MaintenanceListContentProps): Promise<JSX.Element> {
  const [t, tCommon] = await Promise.all([
    getTranslations("maintenance"),
    getTranslations("common"),
  ]);

  const buildMaintenanceHref = (updates: Record<string, string | number | undefined>): string => {
    const merged = {
      status: statusFilter !== "all" ? statusFilter : undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      sort: sort !== "priority" ? sort : undefined,
      view: view !== "list" ? view : undefined,
      limit: limit !== 25 ? limit : undefined,
      offset: offset !== 0 ? offset : undefined,
      ...updates
    };
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") qs.set(key, String(value));
    }
    const queryString = qs.toString();
    return queryString ? `/maintenance?${queryString}` : "/maintenance";
  };

  try {
    const dueWork = await getHouseholdDueWork(householdId, { limit: 500 });

    const overdueScheduleCount = dueWork.filter((item) => item.status === "overdue").length;
    const dueScheduleCount = dueWork.filter((item) => item.status === "due").length;
    const categoryOptions = Array.from(new Set(dueWork.map((item) => item.assetCategory))).sort();
    const filteredDueWork = dueWork
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => categoryFilter === "all" || item.assetCategory === categoryFilter)
      .sort((left, right) => {
        if (sort === "asset") return left.assetName.localeCompare(right.assetName) || left.scheduleName.localeCompare(right.scheduleName);
        if (sort === "category") return left.assetCategory.localeCompare(right.assetCategory) || getSortRank(left.status) - getSortRank(right.status) || left.assetName.localeCompare(right.assetName);
        if (sort === "schedule") return left.scheduleName.localeCompare(right.scheduleName) || left.assetName.localeCompare(right.assetName);
        return getSortRank(left.status) - getSortRank(right.status) || left.assetName.localeCompare(right.assetName) || left.scheduleName.localeCompare(right.scheduleName);
      });

    const pagedDueWork = filteredDueWork.slice(offset, offset + limit);

    return (
      <>
        <section className="panel">
          <div className="panel__header">
            <h2>{t("queueControls")}</h2>
          </div>
          <div className="panel__body--padded">
            <form method="GET" className="form-grid">
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={statusFilter}>
                  <option value="all">All due work</option>
                  <option value="overdue">Overdue only</option>
                  <option value="due">Due now only</option>
                </select>
              </label>
              <label className="field">
                <span>Category</span>
                <select name="category" defaultValue={categoryFilter}>
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{formatCategoryLabel(category)}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sort By</span>
                <select name="sort" defaultValue={sort}>
                  <option value="priority">Priority</option>
                  <option value="asset">Asset</option>
                  <option value="category">Category</option>
                  <option value="schedule">Schedule</option>
                </select>
              </label>
              <div className="inline-actions field field--full">
                <button type="submit" className="button button--ghost">{tCommon("actions.apply")}</button>
                <Link href="/maintenance" className="button button--ghost">{tCommon("actions.reset")}</Link>
              </div>
            </form>
          </div>
        </section>

        <section className="stats-row">
          <div className="stat-card stat-card--danger">
            <span className="stat-card__label">Overdue</span>
            <strong className="stat-card__value">{overdueScheduleCount}</strong>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Due Now</span>
            <strong className="stat-card__value">{dueScheduleCount}</strong>
          </div>
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Work Items</span>
            <strong className="stat-card__value">{dueWork.length}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>{t("allWorkTitle")}</h2>
            <span className="pill">{filteredDueWork.length} visible</span>
            <div className="view-toggle" role="group" aria-label="View mode">
              <Link
                href={buildMaintenanceHref({ view: undefined, offset: 0 })}
                className={`view-toggle__btn${view === "list" ? " view-toggle__btn--active" : ""}`}
                aria-current={view === "list" ? "page" : undefined}
              >List</Link>
              <Link
                href={buildMaintenanceHref({ view: "calendar", offset: 0 })}
                className={`view-toggle__btn${view === "calendar" ? " view-toggle__btn--active" : ""}`}
                aria-current={view === "calendar" ? "page" : undefined}
              >Calendar</Link>
            </div>
          </div>
          <div className="panel__body">
            {view === "calendar" ? (
              <MaintenanceCalendar items={filteredDueWork} />
            ) : (
              <MaintenanceListWorkspace householdId={householdId} items={pagedDueWork} />
            )}
          </div>
        </section>

        {view === "list" && (
          <OffsetPaginationControls
            total={filteredDueWork.length}
            limit={limit}
            offset={offset}
            hasMore={offset + limit < filteredDueWork.length}
            entityLabel="work items"
            buildHref={(updates) => buildMaintenanceHref(updates)}
          />
        )}
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load maintenance queue: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default async function MaintenancePage({ searchParams }: MaintenancePageProps): Promise<JSX.Element> {
  // Fire getMe() immediately so it runs in parallel with i18n/prefs setup.
  const mePromise = getMe();
  const [t, tCommon, params, prefs] = await Promise.all([
    getTranslations("maintenance"),
    getTranslations("common"),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
  ]);
  const statusFilter = typeof params.status === "string" && statusOptions.includes(params.status as (typeof statusOptions)[number])
    ? params.status as (typeof statusOptions)[number]
    : "all";
  const categoryFilter = typeof params.category === "string" ? params.category : "all";
  const sort = typeof params.sort === "string" && sortOptions.includes(params.sort as (typeof sortOptions)[number])
    ? params.sort as (typeof sortOptions)[number]
    : "priority";
  const view = typeof params.view === "string" && viewOptions.includes(params.view as (typeof viewOptions)[number])
    ? params.view as (typeof viewOptions)[number]
    : "list";
  const rawLimit = typeof params.limit === "string" ? parseInt(params.limit, 10) : prefs.pageSize;
  const limit = (limitOptions as readonly number[]).includes(rawLimit) ? rawLimit : prefs.pageSize;
  const offset = typeof params.offset === "string" ? Math.max(0, parseInt(params.offset, 10)) : 0;

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

  const bodySkeleton = (
    <>
      <section className="panel">
        <div className="panel__body--padded">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-bar" style={{ width: "100%", height: 36, marginBottom: 12, borderRadius: 6 }} />
          ))}
        </div>
      </section>
      <section className="stats-row">
        {[1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton-bar" style={{ width: 80, height: 14 }} />
            <div className="skeleton-bar" style={{ width: 48, height: 36, marginTop: 8 }} />
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel__body">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, marginBottom: 8, borderRadius: 6 }} />
          ))}
        </div>
      </section>
    </>
  );

  return (
    <>
      <header className="page-header">
        <h1>{t("pageTitle")}</h1>
      </header>
      <div className="page-body">
        <Suspense fallback={bodySkeleton}>
          <MaintenanceListContent
            householdId={household.id}
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
            sort={sort}
            view={view}
            limit={limit}
            offset={offset}
          />
        </Suspense>
      </div>
    </>
  );
}
