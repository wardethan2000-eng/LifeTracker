"use client";

import type { JSX } from "react";
import type { ProjectTimelineData, ProjectTimelinePhase, ProjectTimelineTask } from "@lifekeeper/types";
import { useState, useMemo, useRef, useCallback } from "react";

type ZoomLevel = "day" | "week" | "month";

type GanttRow =
  | { kind: "phase-header"; phase: ProjectTimelinePhase }
  | { kind: "task"; task: ProjectTimelineTask; phaseId: string };

type TooltipState = {
  x: number;
  y: number;
  task: ProjectTimelineTask;
} | null;

type Props = {
  data: ProjectTimelineData;
  householdId: string;
  projectId: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
  skipped: "Skipped",
};

function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatHeaderLabel(d: Date, zoom: ZoomLevel): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (zoom === "month") {
    return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (zoom === "week") {
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
  return `${d.getUTCDate()}`;
}

// Build header columns for the chart
function buildHeaderCells(
  chartStart: Date,
  chartEnd: Date,
  zoom: ZoomLevel
): Array<{ label: string; startDay: number; widthDays: number }> {
  const cells: Array<{ label: string; startDay: number; widthDays: number }> = [];
  let cursor = new Date(chartStart);

  while (cursor < chartEnd) {
    const startDay = diffDays(chartStart, cursor);
    let next: Date;
    if (zoom === "day") {
      next = addDays(cursor, 1);
      cells.push({ label: `${cursor.getUTCDate()}`, startDay, widthDays: 1 });
    } else if (zoom === "week") {
      // advance to next Monday
      const dow = cursor.getUTCDay(); // 0=Sun
      const daysUntilMonday = dow === 0 ? 7 : (7 - dow + 1) % 7 || 7;
      next = addDays(cursor, daysUntilMonday);
      if (next > chartEnd) next = new Date(chartEnd);
      const width = diffDays(cursor, next);
      cells.push({ label: formatHeaderLabel(cursor, zoom), startDay, widthDays: width });
    } else {
      // month
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 1));
      next = lastDay > chartEnd ? new Date(chartEnd) : lastDay;
      const width = diffDays(cursor, next);
      cells.push({ label: formatHeaderLabel(cursor, zoom), startDay, widthDays: width });
    }
    cursor = next;
  }
  return cells;
}

const COLUMN_WIDTH_PX: Record<ZoomLevel, number> = { day: 36, week: 100, month: 120 };
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 260;

export function ProjectGanttTimeline({ data, householdId, projectId }: Props): JSX.Element {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  void householdId;
  void projectId;

  // Build flat row list for scheduled phases
  const rows = useMemo<GanttRow[]>(() => {
    const result: GanttRow[] = [];
    for (const phase of data.scheduledPhases) {
      result.push({ kind: "phase-header", phase });
      for (const task of phase.tasks) {
        result.push({ kind: "task", task, phaseId: phase.id });
      }
    }
    return result;
  }, [data.scheduledPhases]);

  // Find chart date range
  const { chartStart, chartEnd, totalDays } = useMemo(() => {
    const dates: Date[] = [];

    for (const phase of data.scheduledPhases) {
      const s = parseDate(phase.startDate);
      const e = parseDate(phase.targetEndDate);
      if (s) dates.push(s);
      if (e) dates.push(e);
      for (const task of phase.tasks) {
        const ds = parseDate(task.derivedStartDate);
        const de = parseDate(task.dueDate);
        if (ds) dates.push(ds);
        if (de) dates.push(de);
      }
    }

    const today = startOfDay(new Date());

    if (dates.length === 0) {
      // No dates: show a 3-month window centered on today
      return {
        chartStart: addDays(today, -14),
        chartEnd: addDays(today, 74),
        totalDays: 88,
      };
    }

    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const cs = addDays(minDate, -7);
    const ce = addDays(maxDate, 14);
    const total = diffDays(cs, ce);

    return { chartStart: cs, chartEnd: ce, totalDays: total };
  }, [data.scheduledPhases]);

  // Day-to-px helper
  const dayToPx = useCallback(
    (day: number) => day * COLUMN_WIDTH_PX[zoom],
    [zoom]
  );

  const chartWidthPx = totalDays * COLUMN_WIDTH_PX[zoom];
  const today = startOfDay(new Date());
  const todayOffset = diffDays(chartStart, today);

  const headerCells = useMemo(
    () => buildHeaderCells(chartStart, chartEnd, zoom),
    [chartStart, chartEnd, zoom]
  );

  // Build a taskId → row index map for SVG arrows
  const taskRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, idx) => {
      if (row.kind === "task") map.set(row.task.id, idx);
    });
    return map;
  }, [rows]);

  // Build dependency arrows
  const arrows = useMemo(() => {
    return data.dependencies
      .map((dep) => {
        const predRowIdx = taskRowIndex.get(dep.predecessorTaskId);
        const succRowIdx = taskRowIndex.get(dep.successorTaskId);
        if (predRowIdx == null || succRowIdx == null) return null;

        // Find predecessor task end date and successor task start date
        let predTask: ProjectTimelineTask | undefined;
        let succTask: ProjectTimelineTask | undefined;
        for (const phase of data.scheduledPhases) {
          for (const t of phase.tasks) {
            if (t.id === dep.predecessorTaskId) predTask = t;
            if (t.id === dep.successorTaskId) succTask = t;
          }
        }
        if (!predTask || !succTask) return null;

        const predEnd = parseDate(predTask.dueDate);
        const succStart = parseDate(succTask.derivedStartDate) ?? parseDate(succTask.dueDate);
        if (!predEnd || !succStart) return null;

        const x1 = dayToPx(diffDays(chartStart, predEnd));
        const y1 = HEADER_HEIGHT + predRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = dayToPx(diffDays(chartStart, succStart));
        const y2 = HEADER_HEIGHT + succRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        return { id: dep.id, x1, y1, x2, y2, dependencyType: dep.dependencyType };
      })
      .filter(Boolean);
  }, [data.dependencies, data.scheduledPhases, taskRowIndex, chartStart, dayToPx]);

  const totalChartHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT;

  function getBarProps(startStr: string | null | undefined, endStr: string | null | undefined) {
    const s = parseDate(startStr);
    const e = parseDate(endStr);
    if (!s || !e || e <= s) return null;
    const left = dayToPx(Math.max(0, diffDays(chartStart, s)));
    const right = dayToPx(Math.min(totalDays, diffDays(chartStart, e)));
    const width = right - left;
    if (width <= 0) return null;
    return { left, width };
  }

  function handleTaskHover(e: React.MouseEvent, task: ProjectTimelineTask) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, task });
  }

  const hasScheduled = data.scheduledPhases.length > 0;
  const hasUnscheduled = data.unscheduledPhases.length > 0;

  return (
    <div className="gantt-container">
      {/* Toolbar */}
      <div className="gantt-toolbar">
        <span className="gantt-toolbar__title">{data.projectName}</span>
        <div className="gantt-zoom-controls">
          <span className="gantt-zoom-controls__label">Zoom:</span>
          {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              className={`gantt-zoom-btn${zoom === z ? " gantt-zoom-btn--active" : ""}`}
              onClick={() => setZoom(z)}
            >
              {z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!hasScheduled && !hasUnscheduled && (
        <div className="gantt-empty">
          <p>No phases or tasks have been planned yet.</p>
          <p>Add phases and tasks with dates in the <a href={`/projects/${projectId}/phases`}>Plan tab</a> to see the timeline.</p>
        </div>
      )}

      {hasScheduled && (
        <div className="gantt-workspace">
          {/* Sidebar */}
          <div className="gantt-sidebar" style={{ width: SIDEBAR_WIDTH }}>
            {/* Header spacer */}
            <div className="gantt-sidebar__header" style={{ height: HEADER_HEIGHT }} />
            {/* Rows */}
            {rows.map((row, idx) => {
              if (row.kind === "phase-header") {
                return (
                  <div key={`ph-${row.phase.id}`} className="gantt-sidebar__row gantt-sidebar__row--phase" style={{ height: ROW_HEIGHT }}>
                    <span className="gantt-sidebar__phase-name">{row.phase.name}</span>
                  </div>
                );
              }
              return (
                <div key={`t-${row.task.id}-${idx}`} className={`gantt-sidebar__row gantt-sidebar__row--task${row.task.isCriticalPath ? " gantt-sidebar__row--critical" : ""}`} style={{ height: ROW_HEIGHT }}>
                  <span className="gantt-sidebar__task-name">{row.task.title}</span>
                  {row.task.assigneeName && (
                    <span className="gantt-sidebar__assignee">{row.task.assigneeName}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart area */}
          <div className="gantt-chart-scroll" ref={chartRef}>
            <div className="gantt-chart" style={{ width: chartWidthPx, height: totalChartHeight, position: "relative" }}>
              {/* Header */}
              <div className="gantt-header" style={{ height: HEADER_HEIGHT, width: chartWidthPx }}>
                {headerCells.map((cell, i) => (
                  <div
                    key={i}
                    className="gantt-header__cell"
                    style={{ left: dayToPx(cell.startDay), width: dayToPx(cell.widthDays) }}
                  >
                    {cell.label}
                  </div>
                ))}
              </div>

              {/* Background grid column stripes */}
              {headerCells.map((cell, i) => (
                <div
                  key={`grid-${i}`}
                  className={`gantt-grid-col${i % 2 === 1 ? " gantt-grid-col--alt" : ""}`}
                  style={{
                    left: dayToPx(cell.startDay),
                    top: HEADER_HEIGHT,
                    width: dayToPx(cell.widthDays),
                    height: totalChartHeight - HEADER_HEIGHT,
                  }}
                />
              ))}

              {/* Today marker */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="gantt-today-marker"
                  style={{ left: dayToPx(todayOffset), top: 0, height: totalChartHeight }}
                />
              )}

              {/* Rows with bars */}
              {rows.map((row, idx) => {
                const rowTop = HEADER_HEIGHT + idx * ROW_HEIGHT;

                if (row.kind === "phase-header") {
                  const bar = getBarProps(row.phase.startDate, row.phase.targetEndDate);
                  return (
                    <div key={`pr-${row.phase.id}`} className="gantt-row gantt-row--phase" style={{ top: rowTop, height: ROW_HEIGHT, width: chartWidthPx }}>
                      {bar && (
                        <div
                          className="gantt-bar gantt-bar--phase"
                          style={{ left: bar.left, width: bar.width }}
                          title={row.phase.name}
                        />
                      )}
                    </div>
                  );
                }

                // Task row
                const task = row.task;
                const bar = getBarProps(task.derivedStartDate ?? task.dueDate, task.dueDate);
                const isCritical = data.criticalPathTaskIds.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <div key={`tr-${task.id}-${idx}`} className="gantt-row gantt-row--task" style={{ top: rowTop, height: ROW_HEIGHT, width: chartWidthPx }}>
                    {bar && (
                      <div
                        className={`gantt-bar gantt-bar--task${isCritical ? " gantt-bar--critical" : ""}${isCompleted ? " gantt-bar--done" : ""}${task.isBlocked ? " gantt-bar--blocked" : ""}`}
                        style={{ left: bar.left, width: Math.max(bar.width, 8) }}
                        onMouseEnter={(e) => handleTaskHover(e, task)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {bar.width > 40 && <span className="gantt-bar__label">{task.title}</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dependency arrows SVG */}
              <svg
                className="gantt-dependency-svg"
                style={{ position: "absolute", top: 0, left: 0, width: chartWidthPx, height: totalChartHeight, pointerEvents: "none" }}
                aria-hidden="true"
              >
                <defs>
                  <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="var(--gantt-arrow-color, #94a3b8)" />
                  </marker>
                </defs>
                {arrows.map((arrow) => {
                  if (!arrow) return null;
                  const midX = (arrow.x1 + arrow.x2) / 2;
                  return (
                    <path
                      key={arrow.id}
                      d={`M ${arrow.x1} ${arrow.y1} C ${midX} ${arrow.y1}, ${midX} ${arrow.y2}, ${arrow.x2} ${arrow.y2}`}
                      fill="none"
                      stroke="var(--gantt-arrow-color, #94a3b8)"
                      strokeWidth="1.5"
                      markerEnd="url(#gantt-arrow)"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="gantt-tooltip"
          style={{ position: "fixed", left: tooltip.x, top: tooltip.y }}
        >
          <div className="gantt-tooltip__title">{tooltip.task.title}</div>
          <div className="gantt-tooltip__row">
            <span>Status:</span> {STATUS_LABELS[tooltip.task.status] ?? tooltip.task.status}
          </div>
          {tooltip.task.dueDate && (
            <div className="gantt-tooltip__row">
              <span>Due:</span> {new Date(tooltip.task.dueDate).toLocaleDateString()}
            </div>
          )}
          {tooltip.task.estimatedHours != null && (
            <div className="gantt-tooltip__row">
              <span>Est.:</span> {tooltip.task.estimatedHours}h
            </div>
          )}
          {tooltip.task.assigneeName && (
            <div className="gantt-tooltip__row">
              <span>Assignee:</span> {tooltip.task.assigneeName}
            </div>
          )}
          {tooltip.task.isCriticalPath && (
            <div className="gantt-tooltip__badge gantt-tooltip__badge--critical">Critical Path</div>
          )}
          {tooltip.task.isBlocked && (
            <div className="gantt-tooltip__badge gantt-tooltip__badge--blocked">Blocked</div>
          )}
        </div>
      )}

      {/* Unscheduled phases */}
      {hasUnscheduled && (
        <div className="gantt-unscheduled">
          <h3 className="gantt-unscheduled__title">Unscheduled</h3>
          <p className="gantt-unscheduled__hint">These phases have no start or end dates. Add dates in the Plan tab to place them on the timeline.</p>
          {data.unscheduledPhases.map((phase) => (
            <div key={phase.id} className="gantt-unscheduled__phase">
              <div className="gantt-unscheduled__phase-name">{phase.name}</div>
              {phase.tasks.length > 0 && (
                <ul className="gantt-unscheduled__tasks">
                  {phase.tasks.map((task) => (
                    <li key={task.id} className={`gantt-unscheduled__task${task.status === "completed" ? " gantt-unscheduled__task--done" : ""}`}>
                      <span className="gantt-unscheduled__task-status" />
                      {task.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
