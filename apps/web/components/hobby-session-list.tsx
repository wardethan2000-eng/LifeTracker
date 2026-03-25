"use client";

import type { HobbySessionSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useMemo } from "react";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle
} from "./section-filter";
import { useMultiSelect } from "../lib/use-multi-select";
import { BulkActionBar } from "./bulk-action-bar";
import { HobbyBulkActions } from "./hobby-bulk-actions";
import { useFormattedDate } from "../lib/formatted-date";

type HobbySessionListProps = {
  hobbyId: string;
  householdId: string;
  sessions: HobbySessionSummary[];
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "pill pill--success";
    case "paused": return "pill pill--warning";
    case "archived": return "pill pill--muted";
    case "completed": return "pill pill--success";
    case "planned": return "pill pill--muted";
    default: return "pill";
  }
}

export function HobbySessionList({ hobbyId, householdId, sessions }: HobbySessionListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();

  const allIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const allSelected = selectedCount > 0 && allIds.every((id) => isSelected(id));
  const selectedItems = useMemo(
    () => sessions.filter((s) => isSelected(s.id)),
    [sessions, isSelected]
  );

  return (
    <SectionFilterProvider items={sessions} keys={["name", "recipeName"]} placeholder="Filter sessions by name or recipe">
      <div>
        <section className="panel">
          <div className="panel__header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                className="bulk-checkbox"
                checked={allSelected}
                onChange={() => toggleGroup(allIds, !allSelected)}
                aria-label="Select all sessions"
                disabled={sessions.length === 0}
              />
              <h2>Sessions</h2>
            </div>
            <div className="panel__header-actions">
              <SectionFilterToggle />
              <Link href={`/hobbies/${hobbyId}/sessions/new`} className="button button--primary button--sm">New Session</Link>
            </div>
          </div>
          <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection}>
            <HobbyBulkActions
              householdId={householdId}
              hobbyId={hobbyId}
              selectedItems={selectedItems}
              onBulkComplete={clearSelection}
            />
          </BulkActionBar>
          <SectionFilterBar />
          <div className="panel__body--padded">
            <SectionFilterChildren<HobbySessionSummary>>
              {(filteredSessions) => (
                <>
                  {sessions.length === 0 ? <p className="panel__empty">No sessions yet. Start your first session to begin tracking.</p> : null}
                  {sessions.length > 0 && filteredSessions.length === 0 ? <p className="panel__empty">No sessions match that search.</p> : null}
                  {filteredSessions.length > 0 ? (
                    <ul className="hobby-session-list">
                      {filteredSessions.map((session) => (
                        <li key={session.id} className="hobby-session-row">
                          <input
                            type="checkbox"
                            className="bulk-checkbox"
                            checked={isSelected(session.id)}
                            onChange={() => toggleItem(session.id)}
                            aria-label={`Select ${session.name}`}
                          />
                          <Link
                            href={`/hobbies/${hobbyId}/sessions/${session.id}`}
                            className="hobby-session-card"
                          >
                            <div className="hobby-session-card__header">
                              <div>
                                <strong>{session.name}</strong>
                                {session.recipeName ? <span className="hobby-session-card__recipe">from {session.recipeName}</span> : null}
                              </div>
                              <span className={statusBadgeClass(session.status)}>{session.status}</span>
                            </div>
                            <div className="hobby-session-card__meta">
                              <span>{session.completedStepCount}/{session.stepCount} steps</span>
                              <span>{session.ingredientCount} ingredients</span>
                              {session.rating != null ? <span>{"★".repeat(session.rating)}</span> : null}
                              <span>Started {formatDate(session.startDate)}</span>
                              {session.completedDate ? <span>Completed {formatDate(session.completedDate)}</span> : null}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </SectionFilterChildren>
          </div>
        </section>
      </div>
    </SectionFilterProvider>
  );
}