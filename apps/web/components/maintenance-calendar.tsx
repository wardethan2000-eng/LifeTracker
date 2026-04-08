"use client";

import type { DueWorkItem } from "@aegis/types";
import Link from "next/link";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useCompletionSlideOver } from "./completion-slide-over-context";

type MaintenanceCalendarProps = {
  items: DueWorkItem[];
};

type DayCell = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  overdueItems: DueWorkItem[];
  dueItems: DueWorkItem[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendarGrid(year: number, month: number, items: DueWorkItem[]): DayCell[] {
  // Items keyed by ISO date string (YYYY-MM-DD)
  const byDate = new Map<string, DueWorkItem[]>();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  for (const item of items) {
    if (!item.nextDueAt) continue;
    const d = new Date(item.nextDueAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = byDate.get(key) ?? [];
    arr.push(item);
    byDate.set(key, arr);
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun

  const cells: DayCell[] = [];

  // Pad with previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ date: d, isCurrentMonth: false, isToday: false, overdueItems: [], dueItems: [] });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayItems = byDate.get(key) ?? [];
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    cells.push({
      date,
      isCurrentMonth: true,
      isToday: key === todayKey,
      overdueItems: dayItems.filter((i) => i.status === "overdue" || (isPast && i.status === "due")),
      dueItems: dayItems.filter((i) => i.status === "due" && !isPast),
    });
  }

  // Pad to complete last row (to 6 rows = 42 cells)
  const totalCells = Math.ceil(cells.length / 7) * 7;
  let nextDay = 1;
  while (cells.length < totalCells) {
    cells.push({ date: new Date(year, month + 1, nextDay++), isCurrentMonth: false, isToday: false, overdueItems: [], dueItems: [] });
  }

  return cells;
}

export function MaintenanceCalendar({ items }: MaintenanceCalendarProps): JSX.Element {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { openSlideOver } = useCompletionSlideOver();

  const cells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, items),
    [viewYear, viewMonth, items]
  );

  const goToPrevMonth = (): void => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = (): void => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = (): void => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(null);
  };

  const selectedItems = useMemo((): DueWorkItem[] => {
    if (!selectedDay) return [];
    return cells.find((c) => {
      const k = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}-${String(c.date.getDate()).padStart(2, "0")}`;
      return k === selectedDay;
    })?.overdueItems.concat(
      cells.find((c) => {
        const k = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}-${String(c.date.getDate()).padStart(2, "0")}`;
        return k === selectedDay;
      })?.dueItems ?? []
    ) ?? [];
  }, [cells, selectedDay]);

  // Overdue items that have no specific due date (usage-based or past-due)
  const undatedOverdueItems = useMemo(
    () => items.filter((i) => i.status === "overdue" && !i.nextDueAt),
    [items]
  );

  return (
    <div className="maint-calendar">
      <div className="maint-calendar__toolbar">
        <button type="button" className="button button--ghost button--sm" onClick={goToPrevMonth} aria-label="Previous month">‹</button>
        <span className="maint-calendar__month-label">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" className="button button--ghost button--sm" onClick={goToNextMonth} aria-label="Next month">›</button>
        <button type="button" className="button button--ghost button--sm" onClick={goToToday} style={{ marginLeft: 8 }}>Today</button>
      </div>

      <div className="maint-calendar__grid" role="grid" aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}>
        {DAY_LABELS.map((d) => (
          <div key={d} className="maint-calendar__day-header" role="columnheader">{d}</div>
        ))}

        {cells.map((cell) => {
          const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
          const hasItems = cell.overdueItems.length + cell.dueItems.length > 0;
          const isSelected = selectedDay === key;

          return (
            <div
              key={key}
              className={[
                "maint-calendar__day",
                !cell.isCurrentMonth ? "maint-calendar__day--other-month" : "",
                cell.isToday ? "maint-calendar__day--today" : "",
                hasItems ? "maint-calendar__day--has-items" : "",
                isSelected ? "maint-calendar__day--selected" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => hasItems ? setSelectedDay(isSelected ? null : key) : undefined}
              role={hasItems ? "button" : "gridcell"}
              tabIndex={hasItems ? 0 : -1}
              aria-pressed={hasItems ? isSelected : undefined}
              onKeyDown={(e) => {
                if (hasItems && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setSelectedDay(isSelected ? null : key);
                }
              }}
            >
              <span className="maint-calendar__day-num">{cell.date.getDate()}</span>
              <div className="maint-calendar__day-dots">
                {cell.overdueItems.length > 0 && (
                  <span className="maint-calendar__dot maint-calendar__dot--overdue" aria-hidden="true" />
                )}
                {cell.dueItems.length > 0 && (
                  <span className="maint-calendar__dot maint-calendar__dot--due" aria-hidden="true" />
                )}
              </div>
              {hasItems && (
                <span className="maint-calendar__day-count">
                  {cell.overdueItems.length + cell.dueItems.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDay && selectedItems.length > 0 && (
        <div className="maint-calendar__detail">
          <div className="maint-calendar__detail-header">
            <h3>
              {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <button
              type="button"
              className="maint-calendar__detail-close"
              onClick={() => setSelectedDay(null)}
              aria-label="Close day detail"
            >✕</button>
          </div>
          <div className="maint-calendar__detail-items">
            {selectedItems.map((item) => (
              <div key={item.scheduleId} className={`maint-calendar__detail-item maint-calendar__detail-item--${item.status}`}>
                <div className="maint-calendar__detail-item-info">
                  <Link href={`/assets/${item.assetId}`} className="text-link">{item.assetName}</Link>
                  <span className="maint-calendar__detail-item-schedule">{item.scheduleName}</span>
                </div>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => openSlideOver({ assetId: item.assetId, assetName: item.assetName, scheduleId: item.scheduleId, scheduleName: item.scheduleName })}
                >
                  Log
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undated overdue items (usage-based) */}
      {undatedOverdueItems.length > 0 && (
        <div className="maint-calendar__undated">
          <h3 className="maint-calendar__undated-title">Usage-Based Overdue ({undatedOverdueItems.length})</h3>
          <p className="maint-calendar__undated-note">These items are overdue based on usage readings, not calendar dates.</p>
          <div className="maint-calendar__detail-items">
            {undatedOverdueItems.map((item) => (
              <div key={item.scheduleId} className="maint-calendar__detail-item maint-calendar__detail-item--overdue">
                <div className="maint-calendar__detail-item-info">
                  <Link href={`/assets/${item.assetId}`} className="text-link">{item.assetName}</Link>
                  <span className="maint-calendar__detail-item-schedule">{item.scheduleName}</span>
                </div>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => openSlideOver({ assetId: item.assetId, assetName: item.assetName, scheduleId: item.scheduleId, scheduleName: item.scheduleName })}
                >
                  Log
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
