"use client";

import type { DueWorkItem } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useMemo } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import { formatCategoryLabel, formatDueLabel } from "../lib/formatters";
import { BulkActionBar } from "./bulk-action-bar";
import { MaintenanceBulkActions } from "./maintenance-bulk-actions";
import { useCompletionSlideOver } from "./completion-slide-over-context";
import { EmptyState } from "./empty-state";

const SCHEDULE_STATUS_PILL: Record<string, string> = {
  overdue: "pill--danger",
  due: "pill--warning",
  upcoming: "pill--info",
};

type MaintenanceListWorkspaceProps = {
  householdId: string;
  items: DueWorkItem[];
};

export function MaintenanceListWorkspace({ householdId, items }: MaintenanceListWorkspaceProps): JSX.Element {
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();
  const { openSlideOver } = useCompletionSlideOver();

  const selectedItems = useMemo(
    () => items.filter((item) => isSelected(item.scheduleId)),
    [items, isSelected]
  );

  const allSelected = items.length > 0 && selectedCount === items.length;

  if (items.length === 0) {
    return (
      <div style={{ padding: "32px 24px" }}>
        <EmptyState
          icon="wrench"
          title="All caught up"
          message="No maintenance work is currently due. Keep up the good work!"
        />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <MaintenanceBulkActions
          householdId={householdId}
          selectedItems={selectedItems}
          onBulkComplete={clearSelection}
        />
      </div>

      <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection} />

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input
                type="checkbox"
                aria-label="Select all schedules"
                checked={allSelected}
                onChange={(e) => toggleGroup(items.map((item) => item.scheduleId), e.target.checked)}
              />
            </th>
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
          {items.map((item) => (
            <tr key={item.scheduleId} className={`row--${item.status}`}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.scheduleName}`}
                  checked={isSelected(item.scheduleId)}
                  onChange={() => toggleItem(item.scheduleId)}
                />
              </td>
              <td>
                <span className={`pill ${SCHEDULE_STATUS_PILL[item.status] ?? ""}`}>{item.status}</span>
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
                <div className="data-table__row-actions">
                  <button
                    type="button"
                    className="button button--sm button--primary"
                    onClick={() => openSlideOver({
                      assetId: item.assetId,
                      assetName: item.assetName,
                      scheduleId: item.scheduleId,
                      scheduleName: item.scheduleName,
                      householdId,
                    })}
                  >
                    Log
                  </button>
                  <Link href={`/assets/${item.assetId}`} className="button button--sm button--ghost">Open</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
