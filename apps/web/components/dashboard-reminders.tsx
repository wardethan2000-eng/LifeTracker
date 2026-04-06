"use client";

import type { Entry, EntryResolvedEntity } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useTransition } from "react";
import { saveLayoutPreference } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";
import { useCoalescedRefresh } from "./use-coalesced-refresh";

function resolveEntityUrl(entity: EntryResolvedEntity): string | null {
  const { entityType, entityId, parentEntityType, parentEntityId } = entity;
  switch (entityType) {
    case "asset":
    case "schedule":
    case "maintenance_log":
      return `/assets/${entityId}`;
    case "project":
    case "project_phase":
      return `/projects/${entityId}`;
    case "inventory_item":
      return `/inventory/${entityId}`;
    case "hobby":
      return `/hobbies/${entityId}`;
    case "hobby_session":
    case "hobby_series":
    case "hobby_project":
    case "hobby_collection_item":
    case "hobby_project_milestone": {
      const hobbyId = parentEntityType === "hobby" ? parentEntityId : null;
      return hobbyId ? `/hobbies/${hobbyId}` : null;
    }
    case "idea":
      return `/ideas/${entityId}`;
    default:
      return null;
  }
}

type DashboardRemindersProps = {
  householdId: string;
  entries: Entry[];
  windowDays: number;
};

const windowOptions = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

function getRelativeLabel(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `in ${diffDays}d`;
}

export function DashboardReminders({ householdId, entries, windowDays }: DashboardRemindersProps): JSX.Element | null {
  const { formatDate } = useFormattedDate();
  const requestRefresh = useCoalescedRefresh();
  const [isPending, startTransition] = useTransition();

  const handleWindowChange = useCallback(
    (value: number) => {
      startTransition(async () => {
        await saveLayoutPreference({
          entityType: "reminders_dashboard",
          entityId: "window_days",
          layoutJson: [{ value }],
        });
        requestRefresh();
      });
    },
    [requestRefresh]
  );

  if (entries.length === 0) return null;

  return (
    <div className="dashboard-reminders">
      <div className="dashboard-reminders__header">
        <h3 className="dashboard-reminders__title">🔔 Upcoming Reminders</h3>
        <select
          className="dashboard-reminders__window"
          value={windowDays}
          onChange={(e) => handleWindowChange(Number(e.target.value))}
          disabled={isPending}
        >
          {windowOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <ul className="dashboard-reminders__list">
        {entries.map((entry) => {
          const entityLabel = entry.resolvedEntity?.label ?? entry.entityType;
          const parentLabel = entry.resolvedEntity?.parentLabel;
          const entityUrl = entry.resolvedEntity ? resolveEntityUrl(entry.resolvedEntity) : null;
          const displayLabel = parentLabel ? `${parentLabel} › ${entityLabel}` : entityLabel;
          return (
            <li key={entry.id} className="dashboard-reminders__item">
              <div className="dashboard-reminders__item-row">
                <Link
                  href={`/notes/${entry.id}?householdId=${householdId}`}
                  className="dashboard-reminders__link"
                >
                  <div className="dashboard-reminders__item-main">
                    <strong className="dashboard-reminders__item-title">
                      {entry.title || "Untitled"}
                    </strong>
                    <span className="dashboard-reminders__item-entity">
                      {displayLabel}
                    </span>
                  </div>
                  <div className="dashboard-reminders__item-meta">
                    <span className="dashboard-reminders__item-date">
                      {entry.reminderAt ? formatDate(entry.reminderAt) : ""}
                    </span>
                    <span className="dashboard-reminders__item-relative">
                      {entry.reminderAt ? getRelativeLabel(entry.reminderAt) : ""}
                    </span>
                    {entry.reminderRepeatDays && (
                      <span className="dashboard-reminders__item-repeat" title={`Repeats every ${entry.reminderRepeatDays}d`}>
                        ↻
                      </span>
                    )}
                  </div>
                </Link>
                {entityUrl && (
                  <Link
                    href={entityUrl}
                    className="dashboard-reminders__context-link"
                    title={`Open ${entityLabel}`}
                  >
                    →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
