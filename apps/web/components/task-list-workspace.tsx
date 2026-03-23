"use client";

import type { ProjectTask } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import { formatDate } from "../lib/formatters";
import { TaskBulkActions } from "./project-bulk-actions";
import { BulkActionBar } from "./bulk-action-bar";

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped"
};

const TASK_STATUS_TONES: Record<string, string> = {
  pending: "default",
  in_progress: "accent",
  completed: "success",
  skipped: "neutral"
};

type TaskListWorkspaceProps = {
  householdId: string;
  projectId: string;
  tasks: ProjectTask[];
  phases: { id: string; name: string }[];
};

export function TaskListWorkspace({
  householdId,
  projectId,
  tasks,
  phases,
}: TaskListWorkspaceProps): JSX.Element {
  const fullTasks = useMemo(
    () => tasks.filter((t) => t.taskType !== "quick"),
    [tasks]
  );

  const phaseNameById = useMemo(
    () => new Map(phases.map((p) => [p.id, p.name])),
    [phases]
  );

  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();

  const selectedItems = useMemo(
    () => fullTasks.filter((t) => isSelected(t.id)),
    [fullTasks, isSelected]
  );

  const allSelected = fullTasks.length > 0 && selectedCount === fullTasks.length;

  if (fullTasks.length === 0) {
    return (
      <p className="panel__empty">No full tasks yet. Add tasks above to track detailed progress.</p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <TaskBulkActions
          householdId={householdId}
          projectId={projectId}
          selectedItems={selectedItems}
          phases={phases}
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
                aria-label="Select all tasks"
                checked={allSelected}
                onChange={(e) => toggleGroup(fullTasks.map((t) => t.id), e.target.checked)}
              />
            </th>
            <th>Task</th>
            <th>Status</th>
            <th>Phase</th>
            <th>Assignee</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          {fullTasks.map((task) => {
            const tone = TASK_STATUS_TONES[task.status] ?? "default";
            const phaseName = task.phaseId ? (phaseNameById.get(task.phaseId) ?? "Unknown phase") : "Unphased";

            return (
              <tr key={task.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${task.title}`}
                    checked={isSelected(task.id)}
                    onChange={() => toggleItem(task.id)}
                  />
                </td>
                <td>
                  <div className="data-table__primary">{task.title}</div>
                  {task.description && (
                    <div className="data-table__secondary">
                      {task.description.length > 60
                        ? `${task.description.slice(0, 60)}...`
                        : task.description}
                    </div>
                  )}
                  {(task.isBlocked || task.isCriticalPath) && (
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {task.isBlocked && <span className="pill pill--warning">Blocked</span>}
                      {task.isCriticalPath && <span className="pill pill--danger">Critical</span>}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`status-chip status-chip--${tone}`}>
                    {TASK_STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td>{phaseName}</td>
                <td>
                  {task.assignee
                    ? (task.assignee.displayName ?? task.assignee.id)
                    : "Unassigned"}
                </td>
                <td>{task.dueDate ? formatDate(task.dueDate, "—") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
