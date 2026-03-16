import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getHouseholdDueWork, getMe } from "../../../lib/api";
import { formatCategoryLabel, formatDueLabel } from "../../../lib/formatters";

export default async function MaintenancePage(): Promise<JSX.Element> {
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

    return (
      <>
        <header className="page-header">
          <h1>Maintenance Queue</h1>
        </header>

        <div className="page-body">
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
            </div>
            <div className="panel__body">
              {dueWork.length === 0 ? (
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
                    {dueWork.map((item) => (
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
