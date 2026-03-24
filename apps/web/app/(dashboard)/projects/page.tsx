import type { ProjectStatus } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ProjectPortfolioAside } from "../../../components/project-portfolio-aside";
import { ProjectPortfolioStats } from "../../../components/project-portfolio-stats";
import { ProjectPortfolioWorkspace } from "../../../components/project-portfolio-workspace";
import { ApiError, getDisplayPreferences, getHouseholdProjectPortfolioPaginated, getHouseholdProjectStatusCounts, getMe } from "../../../lib/api";
import { OffsetPaginationControls } from "../../../components/pagination-controls";

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const projectStatusValues: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];

const projectStatusLabels: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

const projectSortValues = ["risk", "target", "budget", "progress"] as const;
const limitOptions = [25, 50, 100] as const;

type ProjectSort = (typeof projectSortValues)[number];

type ProjectsPageHref = {
  householdId: string;
  status?: ProjectStatus | undefined;
  query?: string | undefined;
  sort?: ProjectSort | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

const projectSortLabels: Record<ProjectSort, string> = {
  risk: "Highest risk",
  target: "Nearest target",
  budget: "Budget pressure",
  progress: "Least complete"
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

const isProjectStatus = (value: string | undefined): value is ProjectStatus => (
  value !== undefined && projectStatusValues.includes(value as ProjectStatus)
);

const isProjectSort = (value: string | undefined): value is ProjectSort => (
  value !== undefined && projectSortValues.includes(value as ProjectSort)
);

const buildProjectsHref = ({ householdId, status, query, sort, limit, offset }: ProjectsPageHref): string => {
  const params = new URLSearchParams({ householdId });

  if (status) {
    params.set("status", status);
  }

  if (query && query.trim().length > 0) {
    params.set("q", query.trim());
  }

  if (sort && sort !== "risk") {
    params.set("sort", sort);
  }

  if (limit && limit !== 25) {
    params.set("limit", String(limit));
  }

  if (offset && offset > 0) {
    params.set("offset", String(offset));
  }

  return `/projects?${params.toString()}`;
};

const normalizeSearchValue = (value: string): string => value.trim();

const ProjectStatsSkeleton = (): JSX.Element => (
  <section className="stats-row">
    {[1, 2, 3, 4, 5].map((index) => (
      <div key={index} className="stat-card">
        <div className="skeleton-bar" style={{ width: 110, height: 12, marginBottom: 10 }} />
        <div className="skeleton-bar" style={{ width: 80, height: 28, marginBottom: 8 }} />
        <div className="skeleton-bar" style={{ width: 160, height: 12 }} />
      </div>
    ))}
  </section>
);

const ProjectTableSkeleton = (): JSX.Element => (
  <>
    <section className="panel">
      <div className="panel__header">
        <h2>Project Portfolio</h2>
      </div>
      <div className="panel__body">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Target</th>
              <th>Budget</th>
              <th>Material Plan</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                <td><div className="skeleton-bar" style={{ width: 180, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 72, height: 22 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 140, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 90, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 110, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 120, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 80, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 34, height: 14 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </>
);

const ProjectAsideSkeleton = (): JSX.Element => (
  <>
    {[1, 2, 3].map((panel) => (
      <section key={panel} className="panel">
        <div className="panel__header">
          <div className="skeleton-bar" style={{ width: 120, height: 20 }} />
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "12px" }}>
          {[1, 2, 3].map((row) => (
            <div key={row} className="skeleton-bar" style={{ width: "100%", height: 28, borderRadius: 8 }} />
          ))}
        </div>
      </section>
    ))}
  </>
);

export default async function ProjectsPage({ searchParams }: ProjectsPageProps): Promise<JSX.Element> {
  const t = await getTranslations("projects");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
  const householdId = getParam(params.householdId);
  const statusParam = getParam(params.status);
  const sortParam = getParam(params.sort);
  const rawSearchQuery = getParam(params.q) ?? "";
  const selectedStatus = isProjectStatus(statusParam) ? statusParam : undefined;
  const selectedSort = isProjectSort(sortParam) ? sortParam : "risk";
  const searchQuery = normalizeSearchValue(rawSearchQuery);
  const limit = typeof params.limit === "string" && limitOptions.includes(Number(params.limit) as (typeof limitOptions)[number])
    ? Number(params.limit)
    : prefs.pageSize;
  const offset = typeof params.offset === "string" && Number.isInteger(Number(params.offset)) && Number(params.offset) >= 0
    ? Number(params.offset)
    : 0;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

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

    const projectStatusCountsPromise = getHouseholdProjectStatusCounts(
      household.id,
      searchQuery.length > 0 ? { q: searchQuery } : undefined
    );
    // depth=0 shows only root projects by default; when searching, include all depths
    const visiblePortfolioProjectsPromise = getHouseholdProjectPortfolioPaginated(
      household.id,
      {
        ...(selectedStatus ? { status: selectedStatus } : {}),
        ...(searchQuery.length > 0 ? { q: searchQuery } : { depth: 0 }),
        limit,
        offset
      }
    );

    const [projectStatusCounts, projectPage] = await Promise.all([projectStatusCountsPromise, visiblePortfolioProjectsPromise]);
    const filteredProjects = projectPage.items;
    const projectCountByStatus = new Map(projectStatusCounts.map((entry) => [entry.status, entry.count]));
    const statusCounts = projectStatusValues.map((status) => ({
      status,
      count: projectCountByStatus.get(status) ?? 0
    }));
    const allProjectsCount = statusCounts.reduce((sum, entry) => sum + entry.count, 0);
    const selectedStatusLabel = selectedStatus
      ? `${projectStatusLabels[selectedStatus]} scope`
      : "Across the current portfolio view";

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("pageTitle")}</h1>
            <p>{t("pageSubtitle")}</p>
          </div>
          <div className="page-header__actions">
            {me.households.length > 1 && (
              <div className="household-switcher">
                {me.households.map((item) => (
                  <Link
                    key={item.id}
                    href={buildProjectsHref({
                      householdId: item.id,
                      status: selectedStatus,
                      query: rawSearchQuery,
                      sort: selectedSort
                    })}
                    className={`household-chip${item.id === household.id ? " household-chip--active" : ""}`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
            <Link href={`/projects/new?householdId=${household.id}`} className="button">{tCommon("actions.newProject")}</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="panel project-filter-panel">
            <div className="panel__header">
              <h2>{t("portfolioControls")}</h2>
            </div>
            <div className="panel__body--padded project-filter-bar">
              <form method="GET" className="project-filter-form inline-filter-form">
                <input type="hidden" name="householdId" value={household.id} />
                <div className="inline-filter-form__group">
                  <div className="search-input-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="search"
                      name="q"
                      defaultValue={rawSearchQuery}
                      placeholder={t("searchPlaceholder")}
                      className="input--ghost"
                    />
                  </div>
                  <select name="status" defaultValue={selectedStatus ?? ""} className="select--ghost">
                    <option value="">All statuses</option>
                    {projectStatusValues.map((status) => (
                      <option key={status} value={status}>{projectStatusLabels[status]}</option>
                    ))}
                  </select>
                  <select name="sort" defaultValue={selectedSort} className="select--ghost">
                    {projectSortValues.map((sort) => (
                      <option key={sort} value={sort}>{projectSortLabels[sort]}</option>
                    ))}
                  </select>
                  <button type="submit" className="button button--primary button--sm">{tCommon("actions.filter")}</button>
                  { (rawSearchQuery || selectedStatus || selectedSort !== "risk") && (
                    <Link href={buildProjectsHref({ householdId: household.id })} className="text-link text-link--muted" style={{ fontSize: '0.875rem' }}>
                      {t("clear")}
                    </Link>
                  )}
                </div>
              </form>

              <div className="project-status-strip" aria-label="Project status filters">
                <Link
                  href={buildProjectsHref({ householdId: household.id, query: rawSearchQuery, sort: selectedSort })}
                  className={`project-status-chip${selectedStatus === undefined ? " project-status-chip--active" : ""}`}
                >
                  <span>All</span>
                  <strong>{allProjectsCount}</strong>
                </Link>
                {statusCounts.map((item) => (
                  <Link
                    key={item.status}
                    href={buildProjectsHref({
                      householdId: household.id,
                      status: item.status,
                      query: rawSearchQuery,
                      sort: selectedSort
                    })}
                    className={`project-status-chip${selectedStatus === item.status ? " project-status-chip--active" : ""}`}
                  >
                    <span>{projectStatusLabels[item.status]}</span>
                    <strong>{item.count}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <Suspense fallback={<ProjectStatsSkeleton />}>
            <ProjectPortfolioStats
              householdId={household.id}
              projects={filteredProjects}
              selectedStatusLabel={selectedStatusLabel}
              selectedSort={selectedSort}
            />
          </Suspense>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              <Suspense fallback={<ProjectTableSkeleton />}>
                <ProjectPortfolioWorkspace
                  householdId={household.id}
                  projects={filteredProjects}
                  selectedSort={selectedSort}
                  total={projectPage.total}
                />
              </Suspense>
            </div>

            <div className="dashboard-aside">
              <Suspense fallback={<ProjectAsideSkeleton />}>
                <ProjectPortfolioAside
                  householdId={household.id}
                  projects={filteredProjects}
                  selectedSort={selectedSort}
                />
              </Suspense>
            </div>
          </div>

          <OffsetPaginationControls
            total={projectPage.total}
            limit={projectPage.limit}
            offset={projectPage.offset}
            hasMore={projectPage.hasMore}
            entityLabel="projects"
            buildHref={(p) => buildProjectsHref({
              householdId: household.id,
              status: selectedStatus,
              query: rawSearchQuery,
              sort: selectedSort,
              limit: p.limit,
              offset: p.offset
            })}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Projects</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load projects: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}