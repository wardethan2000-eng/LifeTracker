import Link from "next/link";
import type { HouseholdDashboard } from "@aegis/types";
import type { JSX } from "react";
import { getHouseholdPartsReadiness } from "../lib/api";
import { formatCategoryLabel, formatDueLabel } from "../lib/formatters";
import { EmptyState } from "./empty-state";

const DUE_WORK_STATUS_PILL: Record<string, string> = {
  overdue: "pill--danger",
  due: "pill--warning",
  upcoming: "pill--info",
};

type DashboardDueWorkProps = {
  dashboardPromise: Promise<HouseholdDashboard>;
  householdId: string;
};

export async function DashboardDueWork({ dashboardPromise, householdId }: DashboardDueWorkProps): Promise<JSX.Element> {
  const dashboard = await dashboardPromise;
  const readiness = dashboard.dueWork.length > 0
    ? await getHouseholdPartsReadiness(householdId, dashboard.dueWork.map((item) => item.scheduleId))
    : null;
  const readinessByScheduleId = new Map((readiness?.schedules ?? []).map((item) => [item.scheduleId, item]));

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Upcoming Maintenance</h2>
      </div>
      <div className="panel__body">
        {dashboard.dueWork.length === 0 ? (
          <EmptyState icon="wrench" title="All clear" message="No due or overdue maintenance right now. Check the Assets page to review schedules." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Asset</th>
                <th>Task</th>
                <th>Next Due</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dashboard.dueWork.map((item) => {
                const partsReadiness = readinessByScheduleId.get(item.scheduleId);
                const deficitItems = partsReadiness?.items.filter((entry) => entry.deficit > 0) ?? [];

                return (
                  <tr key={item.scheduleId} className={`row--${item.status}`}>
                    <td>
                      <span className={`pill ${DUE_WORK_STATUS_PILL[item.status] ?? ""}`}>{item.status}</span>
                    </td>
                    <td>
                      <div className="data-table__primary">{item.assetName}</div>
                      <div className="data-table__secondary">{formatCategoryLabel(item.assetCategory)}</div>
                    </td>
                    <td>
                      <div className="data-table__primary dashboard-schedule-name">
                        <span>{item.scheduleName}</span>
                        {partsReadiness && !partsReadiness.allReady && deficitItems.length > 0 ? (
                          <details className="parts-readiness-badge">
                            <summary>Missing parts</summary>
                            <div className="parts-readiness-badge__popover">
                              {deficitItems.map((entry) => (
                                <div key={entry.inventoryItemId} className="parts-readiness-badge__row">
                                  <strong>{entry.itemName}</strong>
                                  <span>Short {entry.deficit} {entry.unit}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                      <div className="data-table__secondary">{item.summary}</div>
                    </td>
                    <td>
                      <strong>{formatDueLabel(item.nextDueAt, item.nextDueMetricValue, item.metricUnit)}</strong>
                    </td>
                    <td>
                      <span className={`pill ${DUE_WORK_STATUS_PILL[item.status] ?? ""}`}>
                        {item.status === "overdue" ? "High" : item.status === "due" ? "Medium" : "Low"}
                      </span>
                    </td>
                    <td>
                      <div className="data-table__row-actions"><Link href={`/assets/${item.assetId}`} className="button button--sm button--ghost">View</Link></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}