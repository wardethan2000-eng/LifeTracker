import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getHouseholdDueWork, getMe } from "../../../lib/api";
import { formatCategoryLabel, formatDueLabel } from "../../../lib/formatters";

type MaintenancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const sortOptions = ["priority", "asset", "category", "schedule"] as const;
const statusOptions = ["all", "overdue", "due"] as const;

const getSortRank = (status: string): number => {
  if (status === "overdue") {
    return 0;
  }

  if (status === "due") {
    return 1;
  }

  return 2;
};

export default async function MaintenancePage({ searchParams }: MaintenancePageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const statusFilter = typeof params.status === "string" && statusOptions.includes(params.status as (typeof statusOptions)[number])
    ? params.status as (typeof statusOptions)[number]
    : "all";
  const categoryFilter = typeof params.category === "string" ? params.category : "all";
  const sort = typeof params.sort === "string" && sortOptions.includes(params.sort as (typeof sortOptions)[number])
    ? params.sort as (typeof sortOptions)[number]
    : "priority";

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Maintenance</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const dueWork = await getHouseholdDueWork(household.id);
    const overdueScheduleCount = dueWork.filter((item) => item.status === "overdue").length;
    const dueScheduleCount = dueWork.filter((item) => item.status === "due").length;
    const categoryOptions = Array.from(new Set(dueWork.map((item) => item.assetCategory))).sort();
    const filteredDueWork = dueWork
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => categoryFilter === "all" || item.assetCategory === categoryFilter)
      .sort((left, right) => {
        if (sort === "asset") {
          return left.assetName.localeCompare(right.assetName) || left.scheduleName.localeCompare(right.scheduleName);
        }

        if (sort === "category") {
          return left.assetCategory.localeCompare(right.assetCategory)
            || getSortRank(left.status) - getSortRank(right.status)
            || left.assetName.localeCompare(right.assetName);
        }

        if (sort === "schedule") {
          return left.scheduleName.localeCompare(right.scheduleName) || left.assetName.localeCompare(right.assetName);
        }

        return getSortRank(left.status) - getSortRank(right.status)
          || left.assetName.localeCompare(right.assetName)
          || left.scheduleName.localeCompare(right.scheduleName);
      });

    return (
      <>
        <header className="page-header">
          <h1>Maintenance Queue</h1>
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>Queue Controls</h2>
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
                  <button type="submit" className="button button--ghost">Apply</button>
                  <Link href="/maintenance" className="button button--ghost">Reset</Link>
                </div>
              </form>
            </div>
          </section>

          {/* ── Stats Summary ── */}
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

          {/* ── Full Maintenance Queue ── */}
          <section className="panel">
            <div className="panel__header">
              <h2>All Due & Overdue Work</h2>
              <span className="pill">{filteredDueWork.length} visible</span>
            </div>
            <div className="panel__body">
              {filteredDueWork.length === 0 ? (
                <p className="panel__empty">No maintenance is currently due or overdue. Everything is on track.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Schedule</th>
                      <th>Description</th>
                      <th>Due Trigger</th>
                      <th>Current Reading</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDueWork.map((item) => (
                      <tr key={item.scheduleId} className={`row--${item.status}`}>
                        <td>
                          <span className={`status-chip status-chip--${item.status}`}>{item.status}</span>
                        </td>
                        <td>
                          <div className="data-table__primary">
                            <Link href={`/assets/${item.assetId}`} className="data-table__link">{item.assetName}</Link>
                          </div>
                        </td>
                        <td><span className="pill">{formatCategoryLabel(item.assetCategory)}</span></td>
                        <td>
                          <div className="data-table__primary">{item.scheduleName}</div>
                        </td>
                        <td>
                          <div className="data-table__secondary">{item.summary}</div>
                        </td>
                        <td>
                          <strong>{formatDueLabel(item.nextDueAt, item.nextDueMetricValue, item.metricUnit)}</strong>
                          <div className="data-table__secondary">{item.nextDueAt ? "Date-based" : "Usage-based"}</div>
                        </td>
                        <td>
                          {item.currentMetricValue !== null
                            ? <strong>{item.currentMetricValue} {item.metricUnit ?? "units"}</strong>
                            : <span style={{ color: "var(--ink-muted)" }}>N/A</span>
                          }
                        </td>
                        <td>
                          <Link href={`/assets/${item.assetId}`} className="data-table__link">Open Asset</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Maintenance</h1></header>
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
