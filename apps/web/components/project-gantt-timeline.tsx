"use client";

import type { JSX } from "react";
import type {
  ProjectTimelineData,
  ProjectTimelinePhase,
  ProjectTimelineTask,
  ProjectTimelineEvent,
} from "@aegis/types";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateProjectPhaseAction,
  updateProjectTaskAction,
} from "../app/actions";

type ZoomLevel = "day" | "week" | "month";

type GanttRow =
  | { kind: "phase-header"; phase: ProjectTimelinePhase }
  | { kind: "task"; task: ProjectTimelineTask; phaseId: string };

type TooltipState =
  | { x: number; y: number; kind: "task"; task: ProjectTimelineTask }
  | { x: number; y: number; kind: "event"; event: ProjectTimelineEvent }
  | null;

type EditingState = {
  entityType: "phase" | "task";
  entityId: string;
  phaseId?: string;
  startDate: string;
  endDate: string;
  anchorX: number;
  anchorY: number;
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

const STATUS_DOTS: Record<string, string> = {
  pending: "gantt-status-dot--pending",
  in_progress: "gantt-status-dot--active",
  completed: "gantt-status-dot--done",
  skipped: "gantt-status-dot--skipped",
};

const EVENT_ICONS: Record<string, string> = {
  task_completed: "✓",
  phase_status_changed: "⚑",
  entry: "◆",
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

function toInputDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatShortDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Compute the effective bar start for a task
function getTaskBarStart(task: ProjectTimelineTask, phase: ProjectTimelinePhase): string | null {
  return task.startedAt ?? task.derivedStartDate ?? phase.startDate;
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

const COLUMN_WIDTH_PX: Record<ZoomLevel, number> = { day: 40, week: 110, month: 130 };
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 52;
const SIDEBAR_WIDTH = 290;
const EVENT_LANE_HEIGHT = 26;

export function ProjectGanttTimeline({ data, householdId, projectId }: Props): JSX.Element {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Build flat row list — include ALL phases (scheduled + unscheduled that have tasks)
  const { rows, allPhases } = useMemo(() => {
    const result: GanttRow[] = [];
    const all = [...data.scheduledPhases, ...data.unscheduledPhases];
    for (const phase of all) {
      result.push({ kind: "phase-header", phase });
      for (const task of phase.tasks) {
        result.push({ kind: "task", task, phaseId: phase.id });
      }
    }
    return { rows: result, allPhases: all };
  }, [data.scheduledPhases, data.unscheduledPhases]);

  // Collect all dates for chart range (including events and startedAt)
  const { chartStart, chartEnd, totalDays } = useMemo(() => {
    const dates: Date[] = [];

    for (const phase of allPhases) {
      const s = parseDate(phase.startDate);
      const e = parseDate(phase.targetEndDate);
      const ae = parseDate(phase.actualEndDate);
      if (s) dates.push(s);
      if (e) dates.push(e);
      if (ae) dates.push(ae);
      for (const task of phase.tasks) {
        const ts = parseDate(task.startedAt);
        const ds = parseDate(task.derivedStartDate);
        const de = parseDate(task.dueDate);
        const tc = parseDate(task.completedAt);
        if (ts) dates.push(ts);
        if (ds) dates.push(ds);
        if (de) dates.push(de);
        if (tc) dates.push(tc);
      }
    }

    for (const evt of data.events) {
      const d = parseDate(evt.date);
      if (d) dates.push(d);
    }

    const today = startOfDay(new Date());

    if (dates.length === 0) {
      return { chartStart: addDays(today, -14), chartEnd: addDays(today, 74), totalDays: 88 };
    }

    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));
    const cs = addDays(minDate, -7);
    const ce = addDays(maxDate, 14);
    return { chartStart: cs, chartEnd: ce, totalDays: diffDays(cs, ce) };
  }, [allPhases, data.events]);

  const dayToPx = useCallback(
    (day: number) => day * COLUMN_WIDTH_PX[zoom],
    [zoom],
  );

  const chartWidthPx = totalDays * COLUMN_WIDTH_PX[zoom];
  const today = startOfDay(new Date());
  const todayOffset = diffDays(chartStart, today);

  const headerCells = useMemo(
    () => buildHeaderCells(chartStart, chartEnd, zoom),
    [chartStart, chartEnd, zoom],
  );

  // taskId → row index for SVG arrows
  const taskRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, idx) => {
      if (row.kind === "task") map.set(row.task.id, idx);
    });
    return map;
  }, [rows]);

  // Task ID → phase lookup
  const taskPhaseMap = useMemo(() => {
    const map = new Map<string, ProjectTimelinePhase>();
    for (const phase of allPhases) {
      for (const task of phase.tasks) {
        map.set(task.id, phase);
      }
    }
    return map;
  }, [allPhases]);

  // Build dependency arrows
  const arrows = useMemo(() => {
    const allTasks = allPhases.flatMap((p) => p.tasks);
    return data.dependencies
      .map((dep) => {
        const predRowIdx = taskRowIndex.get(dep.predecessorTaskId);
        const succRowIdx = taskRowIndex.get(dep.successorTaskId);
        if (predRowIdx == null || succRowIdx == null) return null;

        const predTask = allTasks.find((t) => t.id === dep.predecessorTaskId);
        const succTask = allTasks.find((t) => t.id === dep.successorTaskId);
        if (!predTask || !succTask) return null;

        const predPhase = taskPhaseMap.get(predTask.id);
        const succPhase = taskPhaseMap.get(succTask.id);
        if (!predPhase || !succPhase) return null;

        const predEnd = parseDate(predTask.dueDate) ?? parseDate(predTask.completedAt);
        const succStart = parseDate(getTaskBarStart(succTask, succPhase)) ?? parseDate(succTask.dueDate);
        if (!predEnd || !succStart) return null;

        const x1 = dayToPx(diffDays(chartStart, predEnd));
        const y1 = HEADER_HEIGHT + predRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = dayToPx(diffDays(chartStart, succStart));
        const y2 = HEADER_HEIGHT + succRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        return { id: dep.id, x1, y1, x2, y2, dependencyType: dep.dependencyType };
      })
      .filter(Boolean);
  }, [data.dependencies, allPhases, taskRowIndex, taskPhaseMap, chartStart, dayToPx]);

  // Event markers positioned on the date axis
  const eventMarkers = useMemo(() => {
    return data.events.map((evt) => {
      const d = parseDate(evt.date);
      if (!d) return null;
      const x = dayToPx(diffDays(chartStart, d));
      return { ...evt, x };
    }).filter(Boolean) as Array<ProjectTimelineEvent & { x: number }>;
  }, [data.events, chartStart, dayToPx]);

  const totalChartHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + (eventMarkers.length > 0 ? EVENT_LANE_HEIGHT + 8 : 0);

  function getBarProps(startStr: string | null | undefined, endStr: string | null | undefined) {
    const s = parseDate(startStr);
    const e = parseDate(endStr);
    if (!s || !e || e < s) return null;
    const left = dayToPx(Math.max(0, diffDays(chartStart, s)));
    const right = dayToPx(Math.min(totalDays, diffDays(chartStart, e)));
    const width = right - left;
    if (width <= 0) return null;
    return { left, width };
  }

  // Diamond position for tasks with only a due date (no start)
  function getDiamondPos(dateStr: string | null | undefined) {
    const d = parseDate(dateStr);
    if (!d) return null;
    return dayToPx(diffDays(chartStart, d));
  }

  function handleTaskHover(e: React.MouseEvent, task: ProjectTimelineTask) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top, kind: "task", task });
  }

  function handleEventHover(e: React.MouseEvent, evt: ProjectTimelineEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ x: rect.right + 8, y: rect.top - 40, kind: "event", event: evt });
  }

  function handleBarClick(e: React.MouseEvent, entityType: "phase" | "task", entityId: string, phaseId?: string) {
    const phase = allPhases.find((p) => entityType === "phase" ? p.id === entityId : p.id === phaseId);
    const task = entityType === "task" ? allPhases.flatMap((p) => p.tasks).find((t) => t.id === entityId) : null;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditing({
      entityType,
      entityId,
      phaseId,
      startDate: entityType === "phase"
        ? toInputDate(phase?.startDate)
        : toInputDate(task?.dueDate),
      endDate: entityType === "phase"
        ? toInputDate(phase?.targetEndDate)
        : "",
      anchorX: rect.left,
      anchorY: rect.bottom + 4,
    });
  }

  async function handleDateSave() {
    if (!editing) return;
    setSaving(true);

    const formData = new FormData();
    formData.set("householdId", householdId);
    formData.set("projectId", projectId);

    if (editing.entityType === "phase") {
      formData.set("phaseId", editing.entityId);
      const phase = allPhases.find((p) => p.id === editing.entityId);
      formData.set("name", phase?.name ?? "");
      formData.set("status", phase?.status ?? "pending");
      formData.set("startDate", editing.startDate ? new Date(editing.startDate + "T00:00:00Z").toISOString() : "");
      formData.set("targetEndDate", editing.endDate ? new Date(editing.endDate + "T00:00:00Z").toISOString() : "");
      await updateProjectPhaseAction(formData);
    } else {
      formData.set("taskId", editing.entityId);
      const task = allPhases.flatMap((p) => p.tasks).find((t) => t.id === editing.entityId);
      formData.set("title", task?.title ?? "");
      formData.set("status", task?.status ?? "pending");
      formData.set("dueDate", editing.startDate ? new Date(editing.startDate + "T00:00:00Z").toISOString() : "");
      await updateProjectTaskAction(formData);
    }

    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  // Scroll to today on mount
  useEffect(() => {
    if (chartScrollRef.current && todayOffset > 0) {
      const scrollTarget = dayToPx(todayOffset) - chartScrollRef.current.clientWidth / 2;
      chartScrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAnyPhases = allPhases.length > 0;
  const totalTasks = allPhases.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalScheduled = data.scheduledPhases.length;

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

      {/* Legend */}
      <div className="gantt-legend">
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--planned" />Planned</span>
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--actual" />Actual</span>
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--overdue" />Overdue</span>
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--critical" />Critical Path</span>
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--blocked" />Blocked</span>
        <span className="gantt-legend__item"><span className="gantt-legend__swatch gantt-legend__swatch--done" />Completed</span>
        <span className="gantt-legend__item"><span className="gantt-legend__diamond" />Due date only</span>
        <span className="gantt-legend__item"><span className="gantt-legend__event-dot" />Event</span>
      </div>

      {/* Empty state */}
      {!hasAnyPhases && (
        <div className="gantt-empty">
          <p>No phases or tasks have been planned yet.</p>
          <p>Add phases and tasks with dates in the <a href={`/projects/${projectId}/plan?householdId=${householdId}`}>Plan tab</a> to see the timeline.</p>
        </div>
      )}

      {/* Main chart area */}
      {hasAnyPhases && rows.length > 0 && (
        <div className="gantt-workspace">
          {totalScheduled === 0 && (
            <div className="gantt-hint-banner">
              No dates set yet — click any phase name to add start and end dates
            </div>
          )}
          <div className="gantt-workspace__body">
          {/* Sidebar */}
          <div className="gantt-sidebar" style={{ width: SIDEBAR_WIDTH }}>
            <div className="gantt-sidebar__header" style={{ height: HEADER_HEIGHT }}>
              <span>Phase / Task</span>
            </div>
            {rows.map((row, idx) => {
              if (row.kind === "phase-header") {
                const pct = row.phase.totalTaskCount > 0
                  ? Math.round((row.phase.completedTaskCount / row.phase.totalTaskCount) * 100)
                  : 0;
                const isUnscheduled = !row.phase.startDate && !row.phase.targetEndDate;
                return (
                  <div
                    key={`ph-${row.phase.id}`}
                    className={`gantt-sidebar__row gantt-sidebar__row--phase${isUnscheduled ? " gantt-sidebar__row--unscheduled" : ""}`}
                    style={{ height: ROW_HEIGHT }}
                    onClick={(e) => handleBarClick(e, "phase", row.phase.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="gantt-sidebar__phase-name">{row.phase.name}</span>
                    {isUnscheduled ? (
                      <span className="gantt-sidebar__no-dates-tag">no dates</span>
                    ) : (
                      <span className="gantt-sidebar__phase-pct">{pct}%</span>
                    )}
                  </div>
                );
              }
              const task = row.task;
              const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "skipped" && new Date(task.dueDate) < today;
              return (
                <div
                  key={`t-${task.id}-${idx}`}
                  className={`gantt-sidebar__row gantt-sidebar__row--task${task.isCriticalPath ? " gantt-sidebar__row--critical" : ""}${isOverdue ? " gantt-sidebar__row--overdue" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={(e) => handleBarClick(e, "task", task.id, row.phaseId)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={`gantt-status-dot ${STATUS_DOTS[task.status] ?? ""}`} />
                  <span className="gantt-sidebar__task-name">{task.title}</span>
                  {task.assigneeName && (
                    <span className="gantt-sidebar__assignee">{task.assigneeName}</span>
                  )}
                </div>
              );
            })}
            {/* Event lane label */}
            {eventMarkers.length > 0 && (
              <div className="gantt-sidebar__row gantt-sidebar__row--events" style={{ height: EVENT_LANE_HEIGHT }}>
                <span className="gantt-sidebar__events-label">Events</span>
              </div>
            )}
          </div>

          {/* Chart scroll area */}
          <div className="gantt-chart-scroll" ref={chartScrollRef}>
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

              {/* Background grid */}
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
                <div className="gantt-today-marker" style={{ left: dayToPx(todayOffset), top: 0, height: totalChartHeight }} />
              )}

              {/* Rows with bars */}
              {rows.map((row, idx) => {
                const rowTop = HEADER_HEIGHT + idx * ROW_HEIGHT;

                if (row.kind === "phase-header") {
                  const phase = row.phase;
                  const bar = getBarProps(phase.startDate, phase.targetEndDate);
                  const pct = phase.totalTaskCount > 0
                    ? (phase.completedTaskCount / phase.totalTaskCount) * 100
                    : 0;

                  return (
                    <div key={`pr-${phase.id}`} className="gantt-row gantt-row--phase" style={{ top: rowTop, height: ROW_HEIGHT, width: chartWidthPx }}>
                      {bar ? (
                        <div
                          className="gantt-bar gantt-bar--phase"
                          style={{ left: bar.left, width: bar.width }}
                          onClick={(e) => handleBarClick(e, "phase", phase.id)}
                          role="button"
                          tabIndex={0}
                          title={`${phase.name} — ${Math.round(pct)}% complete`}
                        >
                          <div className="gantt-bar__phase-fill" style={{ width: `${pct}%` }} />
                        </div>
                      ) : (
                        <div
                          className="gantt-row__no-dates"
                          style={{ left: Math.max(16, dayToPx(Math.max(todayOffset, 2)) - 4) }}
                          onClick={(e) => handleBarClick(e, "phase", phase.id)}
                          role="button"
                          tabIndex={0}
                        >
                          + add dates
                        </div>
                      )}
                    </div>
                  );
                }

                // Task row
                const task = row.task;
                const phase = taskPhaseMap.get(task.id);
                const barStart = phase ? getTaskBarStart(task, phase) : task.derivedStartDate;
                const barEnd = task.dueDate;
                const bar = getBarProps(barStart, barEnd);

                const isCritical = data.criticalPathTaskIds.includes(task.id);
                const isCompleted = task.status === "completed" || task.status === "skipped";
                const isOverdue = task.dueDate && !isCompleted && new Date(task.dueDate) < today;

                // Actual progress overlay (startedAt → completedAt)
                const actualBar = isCompleted && task.startedAt && task.completedAt
                  ? getBarProps(task.startedAt, task.completedAt)
                  : null;

                // Overdue actual bar — completed after dueDate
                const isLateCompletion = isCompleted && task.completedAt && task.dueDate && new Date(task.completedAt) > new Date(task.dueDate);
                const overdueBar = isLateCompletion
                  ? getBarProps(task.dueDate, task.completedAt)
                  : null;

                // Diamond for tasks with only a dueDate (no bar)
                const diamondX = !bar ? getDiamondPos(task.dueDate) : null;

                return (
                  <div key={`tr-${task.id}-${idx}`} className="gantt-row gantt-row--task" style={{ top: rowTop, height: ROW_HEIGHT, width: chartWidthPx }}>
                    {/* Planned bar */}
                    {bar && (
                      <div
                        className={`gantt-bar gantt-bar--task${isCritical ? " gantt-bar--critical" : ""}${isCompleted ? " gantt-bar--done" : ""}${task.isBlocked ? " gantt-bar--blocked" : ""}${isOverdue ? " gantt-bar--overdue-outline" : ""}`}
                        style={{ left: bar.left, width: Math.max(bar.width, 8) }}
                        onMouseEnter={(e) => handleTaskHover(e, task)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={(e) => handleBarClick(e, "task", task.id, row.phaseId)}
                        role="button"
                        tabIndex={0}
                      >
                        {bar.width > 60 && <span className="gantt-bar__label">{task.title}</span>}
                      </div>
                    )}

                    {/* Actual completion overlay */}
                    {actualBar && (
                      <div
                        className={`gantt-bar gantt-bar--actual${isLateCompletion ? "" : " gantt-bar--actual-ok"}`}
                        style={{ left: actualBar.left, width: Math.max(actualBar.width, 4) }}
                      />
                    )}

                    {/* Overdue extension */}
                    {overdueBar && (
                      <div
                        className="gantt-bar gantt-bar--overdue"
                        style={{ left: overdueBar.left, width: Math.max(overdueBar.width, 4) }}
                      />
                    )}

                    {/* Diamond marker for date-only tasks */}
                    {diamondX != null && (
                      <div
                        className={`gantt-diamond${isCritical ? " gantt-diamond--critical" : ""}${isCompleted ? " gantt-diamond--done" : ""}${isOverdue ? " gantt-diamond--overdue" : ""}`}
                        style={{ left: diamondX - 6 }}
                        onMouseEnter={(e) => handleTaskHover(e, task)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={(e) => handleBarClick(e, "task", task.id, row.phaseId)}
                        role="button"
                        tabIndex={0}
                        title={task.title}
                      />
                    )}
                  </div>
                );
              })}

              {/* Event markers lane */}
              {eventMarkers.length > 0 && (
                <div className="gantt-event-lane" style={{ top: HEADER_HEIGHT + rows.length * ROW_HEIGHT, height: EVENT_LANE_HEIGHT, width: chartWidthPx }}>
                  {eventMarkers.map((evt) => (
                    <div
                      key={evt.id}
                      className={`gantt-event-marker gantt-event-marker--${evt.type}${evt.thumbnailUrl ? " gantt-event-marker--photo" : ""}${evt.entryType === "milestone" ? " gantt-event-marker--milestone" : ""}`}
                      style={{ left: evt.x - 8 }}
                      onMouseEnter={(e) => handleEventHover(e, evt)}
                      onMouseLeave={() => setTooltip(null)}
                      title={evt.title}
                    >
                      {evt.thumbnailUrl
                        ? <span className="gantt-event-marker__thumb" />
                        : <span className="gantt-event-marker__icon">{EVENT_ICONS[evt.type] ?? "·"}</span>
                      }
                    </div>
                  ))}
                </div>
              )}

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
        </div>
      )}

      {/* Task tooltip */}
      {tooltip && tooltip.kind === "task" && (
        <div className="gantt-tooltip" style={{ position: "fixed", left: tooltip.x, top: tooltip.y }}>
          <div className="gantt-tooltip__title">{tooltip.task.title}</div>
          <div className="gantt-tooltip__row">
            <span>Status:</span> {STATUS_LABELS[tooltip.task.status] ?? tooltip.task.status}
          </div>
          {tooltip.task.startedAt && (
            <div className="gantt-tooltip__row">
              <span>Started:</span> {formatShortDate(tooltip.task.startedAt)}
            </div>
          )}
          {tooltip.task.dueDate && (
            <div className="gantt-tooltip__row">
              <span>Due:</span> {formatShortDate(tooltip.task.dueDate)}
            </div>
          )}
          {tooltip.task.completedAt && (
            <div className="gantt-tooltip__row">
              <span>Completed:</span> {formatShortDate(tooltip.task.completedAt)}
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
          <div className="gantt-tooltip__hint">Click to edit dates</div>
        </div>
      )}

      {/* Event tooltip */}
      {tooltip && tooltip.kind === "event" && (
        <div className="gantt-tooltip" style={{ position: "fixed", left: tooltip.x, top: tooltip.y }}>
          <div className="gantt-tooltip__title">{tooltip.event.title}</div>
          <div className="gantt-tooltip__row">
            <span>Date:</span> {formatShortDate(tooltip.event.date)}
          </div>
          {tooltip.event.description && (
            <div className="gantt-tooltip__row gantt-tooltip__desc">{tooltip.event.description}</div>
          )}
          {tooltip.event.entryType && (
            <div className="gantt-tooltip__badge">{tooltip.event.entryType}</div>
          )}
          {tooltip.event.flags.length > 0 && (
            <div className="gantt-tooltip__row">
              {tooltip.event.flags.map((f) => (
                <span key={f} className="gantt-tooltip__badge">{f}</span>
              ))}
            </div>
          )}
          {tooltip.event.attachmentCount > 0 && (
            <div className="gantt-tooltip__row"><span>📎</span> {tooltip.event.attachmentCount} attachment{tooltip.event.attachmentCount !== 1 ? "s" : ""}</div>
          )}
        </div>
      )}

      {/* Inline date editor popover */}
      {editing && (
        <>
          <div className="gantt-popover-backdrop" onClick={() => setEditing(null)} />
          <div className="gantt-popover" style={{ left: editing.anchorX, top: editing.anchorY }}>
            <div className="gantt-popover__title">
              {editing.entityType === "phase" ? "Phase Dates" : "Task Due Date"}
            </div>
            {editing.entityType === "phase" ? (
              <div className="gantt-popover__fields">
                <label>
                  Start
                  <input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </label>
                <label>
                  End
                  <input
                    type="date"
                    value={editing.endDate}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <div className="gantt-popover__fields">
                <label>
                  Due Date
                  <input
                    type="date"
                    value={editing.startDate}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="gantt-popover__actions">
              <button className="gantt-popover__btn gantt-popover__btn--cancel" onClick={() => setEditing(null)}>Cancel</button>
              <button className="gantt-popover__btn gantt-popover__btn--save" onClick={handleDateSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
