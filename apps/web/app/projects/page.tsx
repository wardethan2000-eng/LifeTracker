import type { ProjectStatus, ProjectSummary } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import { ApiError, getHouseholdProjects, getMe, getProjectInventory } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/formatters";

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

type ProjectSort = (typeof projectSortValues)[number];

type ProjectsPageHref = {
  householdId: string;
  status?: ProjectStatus | undefined;
  query?: string | undefined;
  sort?: ProjectSort | undefined;
};

type PortfolioProject = ProjectSummary & {
  inventoryLineCount: number;
  totalInventoryNeeded: number;
  totalInventoryAllocated: number;
  totalInventoryRemaining: number;
  plannedInventoryCost: number;
  committedCost: number;
  budgetRatio: number | null;
  materialCoverage: number | null;
  daysToTarget: number | null;
  isLate: boolean;
  isAtRisk: boolean;
  riskScore: number;
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

const buildProjectsHref = ({ householdId, status, query, sort }: ProjectsPageHref): string => {
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

  return `/projects?${params.toString()}`;
};

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase();

const matchesProjectSearch = (project: ProjectSummary, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  const haystack = [
    project.name,
    project.description ?? "",
    project.notes ?? "",
    projectStatusLabels[project.status]
  ].join(" ").toLowerCase();

  return haystack.includes(query);
};

const getTargetDays = (targetEndDate: string | null, now: number): number | null => {
  if (!targetEndDate) {
    return null;
  }

  const distance = new Date(targetEndDate).getTime() - now;
  return Math.ceil(distance / 86_400_000);
};

const compareNullableNumbersAsc = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

const sortProjects = (projects: PortfolioProject[], sort: ProjectSort): PortfolioProject[] => {
  const ranked = [...projects];

  ranked.sort((left, right) => {
    if (sort === "target") {
      const targetComparison = compareNullableNumbersAsc(left.daysToTarget, right.daysToTarget);
      if (targetComparison !== 0) return targetComparison;
      return right.riskScore - left.riskScore;
    }

    if (sort === "budget") {
      const leftBudget = left.budgetRatio ?? -1;
      const rightBudget = right.budgetRatio ?? -1;
      if (rightBudget !== leftBudget) return rightBudget - leftBudget;
      return right.committedCost - left.committedCost;
    }

    if (sort === "progress") {
      if (left.percentComplete !== right.percentComplete) {
        return left.percentComplete - right.percentComplete;
      }
      return right.riskScore - left.riskScore;
    }

    if (left.riskScore !== right.riskScore) {
      return right.riskScore - left.riskScore;
    }

    const targetComparison = compareNullableNumbersAsc(left.daysToTarget, right.daysToTarget);
    if (targetComparison !== 0) return targetComparison;
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return ranked;
};

const getRiskTone = (project: PortfolioProject): "danger" | "warning" | "accent" | "neutral" => {
  if (project.riskScore >= 4) return "danger";
  if (project.riskScore >= 2) return "warning";
  if (project.status === "completed") return "accent";
  return "neutral";
};

const getRiskLabel = (project: PortfolioProject): string => {
  if (project.isLate) return "Late against target";
  if (project.budgetRatio !== null && project.budgetRatio >= 1) return "Over budget";
  if (project.budgetRatio !== null && project.budgetRatio >= 0.9) return "Budget pressure";
  if (project.materialCoverage !== null && project.materialCoverage < 0.5) return "Material gap";
  if (project.materialCoverage !== null && project.materialCoverage < 1) return "Awaiting stock";
  if (project.status === "completed") return "Closed out";
  return "On track";
};

const getTargetLabel = (project: PortfolioProject): string => {
  if (project.status === "completed") {
    return formatDate(project.actualEndDate, "Completed");
  }

  if (project.daysToTarget === null) {
    return "No target date";
  }

  if (project.daysToTarget < 0) {
    return `${Math.abs(project.daysToTarget)}d overdue`;
  }

  if (project.daysToTarget === 0) {
    return "Due today";
  }

  return `${project.daysToTarget}d remaining`;
};

const getCoverageLabel = (project: PortfolioProject): string => {
  if (project.inventoryLineCount === 0) {
    return "No material plan";
  }

  if (project.materialCoverage === null) {
    return "No allocation data";
  }

  return `${Math.round(project.materialCoverage * 100)}% allocated`;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = getParam(params.householdId);
  const statusParam = getParam(params.status);
  const sortParam = getParam(params.sort);
  const rawSearchQuery = getParam(params.q) ?? "";
  const selectedStatus = isProjectStatus(statusParam) ? statusParam : undefined;
  const selectedSort = isProjectSort(sortParam) ? sortParam : "risk";
  const searchQuery = normalizeSearchValue(rawSearchQuery);

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Projects</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const allProjectsPromise = getHouseholdProjects(household.id);
    const visibleProjectsPromise = selectedStatus
      ? getHouseholdProjects(household.id, { status: selectedStatus })
      : allProjectsPromise;

    const [allProjects, statusScopedProjects] = await Promise.all([allProjectsPromise, visibleProjectsPromise]);
    const filteredProjects = statusScopedProjects.filter((project) => matchesProjectSearch(project, searchQuery));
    const inventoryEntries = await Promise.all(
      filteredProjects.map(async (project) => ({
        projectId: project.id,
        inventory: await getProjectInventory(household.id, project.id)
      }))
    );

    const inventoryByProject = new Map(inventoryEntries.map((entry) => [entry.projectId, entry.inventory]));
    const now = Date.now();
    const portfolioProjects = sortProjects(filteredProjects.map((project) => {
      const inventoryItems = inventoryByProject.get(project.id) ?? [];
      const totalInventoryNeeded = inventoryItems.reduce((sum, item) => sum + item.quantityNeeded, 0);
      const totalInventoryAllocated = inventoryItems.reduce((sum, item) => sum + item.quantityAllocated, 0);
      const totalInventoryRemaining = inventoryItems.reduce((sum, item) => sum + item.quantityRemaining, 0);
      const plannedInventoryCost = inventoryItems.reduce((sum, item) => {
        const unitCost = item.budgetedUnitCost ?? item.inventoryItem.unitCost ?? 0;
        return sum + (unitCost * item.quantityNeeded);
      }, 0);
      const committedCost = project.totalSpent + plannedInventoryCost;
      const budgetRatio = project.totalBudgeted && project.totalBudgeted > 0
        ? committedCost / project.totalBudgeted
        : null;
      const materialCoverage = totalInventoryNeeded > 0
        ? totalInventoryAllocated / totalInventoryNeeded
        : null;
      const daysToTarget = getTargetDays(project.targetEndDate, now);
      const isLate = daysToTarget !== null
        && daysToTarget < 0
        && project.status !== "completed"
        && project.status !== "cancelled";
      const riskScore = (isLate ? 3 : 0)
        + (budgetRatio !== null && budgetRatio >= 1 ? 3 : budgetRatio !== null && budgetRatio >= 0.9 ? 2 : 0)
        + (materialCoverage !== null && materialCoverage < 0.5 ? 2 : materialCoverage !== null && materialCoverage < 1 ? 1 : 0)
        + (project.percentComplete < 50 && daysToTarget !== null && daysToTarget <= 14 ? 1 : 0);

      return {
        ...project,
        inventoryLineCount: inventoryItems.length,
        totalInventoryNeeded,
        totalInventoryAllocated,
        totalInventoryRemaining,
        plannedInventoryCost,
        committedCost,
        budgetRatio,
        materialCoverage,
        daysToTarget,
        isLate,
        isAtRisk: riskScore >= 2,
        riskScore
      };
    }), selectedSort);

    const statusCounts = projectStatusValues.map((status) => ({
      status,
      count: allProjects.filter((project) => project.status === status).length
    }));
    const visibleBudget = portfolioProjects.reduce((sum, project) => sum + (project.totalBudgeted ?? 0), 0);
    const visibleSpent = portfolioProjects.reduce((sum, project) => sum + project.totalSpent, 0);
    const visibleCommitted = portfolioProjects.reduce((sum, project) => sum + project.committedCost, 0);
    const visibleMaterialPlan = portfolioProjects.reduce((sum, project) => sum + project.plannedInventoryCost, 0);
    const totalInventoryNeeded = portfolioProjects.reduce((sum, project) => sum + project.totalInventoryNeeded, 0);
    const totalInventoryAllocated = portfolioProjects.reduce((sum, project) => sum + project.totalInventoryAllocated, 0);
    const portfolioCoverage = totalInventoryNeeded > 0 ? totalInventoryAllocated / totalInventoryNeeded : null;
    const atRiskProjects = portfolioProjects.filter((project) => project.isAtRisk);
    const lateProjects = atRiskProjects.filter((project) => project.isLate);
    const budgetPressureProjects = portfolioProjects.filter((project) => project.budgetRatio !== null && project.budgetRatio >= 0.9);
    const materialGapProjects = portfolioProjects
      .filter((project) => project.totalInventoryRemaining > 0)
      .sort((left, right) => right.totalInventoryRemaining - left.totalInventoryRemaining)
      .slice(0, 5);

    return (
      <AppShell activePath="/projects">
        <header className="page-header">
          <div>
            <h1>Projects</h1>
            <p>Portfolio view for schedule risk, funding pressure, and material readiness across the household.</p>
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
            <Link href={`/projects/new?householdId=${household.id}`} className="button">New Project</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="panel project-filter-panel">
            <div className="panel__header">
              <h2>Portfolio Controls</h2>
            </div>
            <div className="panel__body--padded project-filter-panel__body">
              <form method="GET" className="project-filter-form">
                <input type="hidden" name="householdId" value={household.id} />
                <div className="project-filter-form__grid">
                  <label className="field field--full">
                    <span>Search projects</span>
                    <input
                      type="search"
                      name="q"
                      defaultValue={rawSearchQuery}
                      placeholder="Name, description, notes, or status"
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select name="status" defaultValue={selectedStatus ?? ""}>
                      <option value="">All statuses</option>
                      {projectStatusValues.map((status) => (
                        <option key={status} value={status}>{projectStatusLabels[status]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Sort</span>
                    <select name="sort" defaultValue={selectedSort}>
                      {projectSortValues.map((sort) => (
                        <option key={sort} value={sort}>{projectSortLabels[sort]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="inline-actions">
                  <button type="submit" className="button button--primary button--sm">Apply</button>
                  <Link
                    href={buildProjectsHref({ householdId: household.id })}
                    className="button button--ghost button--sm"
                  >
                    Clear filters
                  </Link>
                </div>
              </form>

              <div className="project-status-strip" aria-label="Project status filters">
                <Link
                  href={buildProjectsHref({ householdId: household.id, query: rawSearchQuery, sort: selectedSort })}
                  className={`project-status-chip${selectedStatus === undefined ? " project-status-chip--active" : ""}`}
                >
                  <span>All</span>
                  <strong>{allProjects.length}</strong>
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

          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Visible Projects</span>
              <strong className="stat-card__value">{portfolioProjects.length}</strong>
              <span className="stat-card__sub">{selectedStatus ? `${projectStatusLabels[selectedStatus]} scope` : "Across the current portfolio view"}</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Delivery Risk</span>
              <strong className="stat-card__value">{atRiskProjects.length}</strong>
              <span className="stat-card__sub">{lateProjects.length} late, {budgetPressureProjects.length} under funding pressure</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Budget Exposure</span>
              <strong className="stat-card__value">{formatCurrency(visibleCommitted, "$0.00")}</strong>
              <span className="stat-card__sub">
                {visibleBudget > 0
                  ? `${Math.round((visibleCommitted / visibleBudget) * 100)}% of ${formatCurrency(visibleBudget, "$0.00")}`
                  : "No funded scope on visible projects"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Material Readiness</span>
              <strong className="stat-card__value">
                {portfolioCoverage === null ? "No plan" : `${Math.round(portfolioCoverage * 100)}%`}
              </strong>
              <span className="stat-card__sub">
                {formatCurrency(visibleMaterialPlan, "$0.00")} planned, {totalInventoryAllocated} of {totalInventoryNeeded} units allocated
              </span>
            </div>
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              <section className="panel">
                <div className="panel__header">
                  <h2>Project Portfolio ({portfolioProjects.length})</h2>
                </div>
                <div className="panel__body--padded">
                  {portfolioProjects.length === 0 ? (
                    <p className="panel__empty">No projects match the current filters. Adjust the scope or create a new project to populate the portfolio view.</p>
                  ) : (
                    <div className="project-portfolio-grid">
                      {portfolioProjects.map((project) => {
                        const tone = getRiskTone(project);

                        return (
                          <article key={project.id} className={`project-portfolio-card project-portfolio-card--${tone}`}>
                            <div className="project-portfolio-card__topline">
                              <span className="pill">{projectStatusLabels[project.status]}</span>
                              <span className={`project-risk-badge project-risk-badge--${tone}`}>{getRiskLabel(project)}</span>
                            </div>

                            <div className="project-portfolio-card__header">
                              <div>
                                <h3>{project.name}</h3>
                                <p>{project.description ?? "No description captured yet."}</p>
                              </div>
                              <Link href={`/projects/${project.id}?householdId=${household.id}`} className="button button--ghost button--sm">
                                Open
                              </Link>
                            </div>

                            <div className="project-portfolio-card__metrics">
                              <div className="project-metric">
                                <span>Progress</span>
                                <strong>{project.percentComplete}%</strong>
                                <small>{project.completedTaskCount} of {project.taskCount} tasks complete</small>
                              </div>
                              <div className="project-metric">
                                <span>Committed</span>
                                <strong>{formatCurrency(project.committedCost, "$0.00")}</strong>
                                <small>{formatCurrency(project.totalSpent, "$0.00")} actual spend</small>
                              </div>
                              <div className="project-metric">
                                <span>Materials</span>
                                <strong>{getCoverageLabel(project)}</strong>
                                <small>{project.inventoryLineCount} linked inventory lines</small>
                              </div>
                              <div className="project-metric">
                                <span>Target</span>
                                <strong>{getTargetLabel(project)}</strong>
                                <small>{formatDate(project.targetEndDate, "No target date")}</small>
                              </div>
                            </div>

                            <div className="project-meter-stack">
                              <div className="project-meter">
                                <div className="project-meter__labels">
                                  <span>Completion</span>
                                  <strong>{project.percentComplete}%</strong>
                                </div>
                                <div className="project-meter__track">
                                  <span className="project-meter__fill" style={{ width: `${Math.min(project.percentComplete, 100)}%` }} />
                                </div>
                              </div>

                              <div className="project-meter">
                                <div className="project-meter__labels">
                                  <span>Material allocation</span>
                                  <strong>{project.materialCoverage === null ? "No material plan" : `${Math.round(project.materialCoverage * 100)}%`}</strong>
                                </div>
                                <div className="project-meter__track">
                                  <span
                                    className="project-meter__fill project-meter__fill--secondary"
                                    style={{ width: `${Math.min(Math.round((project.materialCoverage ?? 0) * 100), 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <dl className="project-kpi-list">
                              <div>
                                <dt>Budget</dt>
                                <dd>{formatCurrency(project.totalBudgeted, "Unbudgeted")}</dd>
                              </div>
                              <div>
                                <dt>Material plan</dt>
                                <dd>{formatCurrency(project.plannedInventoryCost, "$0.00")}</dd>
                              </div>
                              <div>
                                <dt>Units remaining</dt>
                                <dd>{project.totalInventoryRemaining}</dd>
                              </div>
                              <div>
                                <dt>Updated</dt>
                                <dd>{formatDate(project.updatedAt, "Recently")}</dd>
                              </div>
                            </dl>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Material Rollups</h2>
                </div>
                <div className="panel__body">
                  {portfolioProjects.filter((project) => project.inventoryLineCount > 0).length === 0 ? (
                    <p className="panel__empty">No inventory-linked requirements on the visible projects yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Inventory Lines</th>
                          <th>Allocated</th>
                          <th>Gap</th>
                          <th>Planned Cost</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioProjects.filter((project) => project.inventoryLineCount > 0).map((project) => (
                          <tr key={project.id}>
                            <td>
                              <div className="data-table__primary">{project.name}</div>
                              <div className="data-table__secondary">{getCoverageLabel(project)}</div>
                            </td>
                            <td>{project.inventoryLineCount}</td>
                            <td>{project.totalInventoryAllocated} / {project.totalInventoryNeeded}</td>
                            <td>{project.totalInventoryRemaining}</td>
                            <td>{formatCurrency(project.plannedInventoryCost, "$0.00")}</td>
                            <td>
                              <Link href={`/projects/${project.id}?householdId=${household.id}`} className="data-table__link">Review</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>

            <div className="dashboard-aside">
              <section className="panel">
                <div className="panel__header">
                  <h2>Risk Watch</h2>
                </div>
                <div className="panel__body project-insight-list">
                  {atRiskProjects.length === 0 ? (
                    <p className="panel__empty">No visible projects are currently flagged as late, underfunded, or materially blocked.</p>
                  ) : (
                    atRiskProjects.slice(0, 5).map((project) => (
                      <div key={project.id} className="project-insight-item">
                        <div>
                          <strong>{project.name}</strong>
                          <p>{getRiskLabel(project)}</p>
                        </div>
                        <Link href={`/projects/${project.id}?householdId=${household.id}`} className="data-table__link">Open</Link>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Material Gaps</h2>
                </div>
                <div className="panel__body project-insight-list">
                  {materialGapProjects.length === 0 ? (
                    <p className="panel__empty">All visible inventory plans are fully allocated or not yet defined.</p>
                  ) : (
                    materialGapProjects.map((project) => (
                      <div key={project.id} className="project-insight-item">
                        <div>
                          <strong>{project.name}</strong>
                          <p>{project.totalInventoryRemaining} units still unallocated across {project.inventoryLineCount} line items</p>
                        </div>
                        <span className="pill">{project.totalInventoryAllocated}/{project.totalInventoryNeeded}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Funding Snapshot</h2>
                </div>
                <div className="panel__body--padded project-funding-stack">
                  <div className="project-funding-row">
                    <span>Actual spend</span>
                    <strong>{formatCurrency(visibleSpent, "$0.00")}</strong>
                  </div>
                  <div className="project-funding-row">
                    <span>Planned materials</span>
                    <strong>{formatCurrency(visibleMaterialPlan, "$0.00")}</strong>
                  </div>
                  <div className="project-funding-row">
                    <span>Budgeted scope</span>
                    <strong>{formatCurrency(visibleBudget, "$0.00")}</strong>
                  </div>
                  <div className="project-funding-row project-funding-row--emphasis">
                    <span>Total commitment</span>
                    <strong>{formatCurrency(visibleCommitted, "$0.00")}</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Projects</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load projects: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}