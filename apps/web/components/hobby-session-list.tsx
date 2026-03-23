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

function formatDate(value: string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HobbySessionList({ hobbyId, householdId, sessions }: HobbySessionListProps): JSX.Element {
  const { selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();

  const allIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const allSelected = selectedCount > 0 && allIds.every((id) => isSelected(id));
  const selectedItems = useMemo(
    () => sessions.filter((s) => isSelected(s.id)),
    [sessions, isSelected]
  );

  return (
    <SectionFilterProvider items={sessions} keys={["name", "recipeName"]} placeholder="Filter sessions by name or recipe">
      <div style={{ display: "grid", gap: "16px" }}>
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
                    <div style={{ display: "grid", gap: "12px" }}>
                      {filteredSessions.map((session) => (
                        <div
                          key={session.id}
                          style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
                        >
                          <input
                            type="checkbox"
                            className="bulk-checkbox"
                            checked={isSelected(session.id)}
                            onChange={() => toggleItem(session.id)}
                            aria-label={`Select ${session.name}`}
                            style={{ marginTop: 18, flexShrink: 0 }}
                          />
                          <Link
                            href={`/hobbies/${hobbyId}/sessions/${session.id}`}
                            style={{ textDecoration: "none", display: "block", flex: 1, padding: "16px", border: "1px solid var(--border)", borderRadius: "8px" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <strong>{session.name}</strong>
                                {session.recipeName ? <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginLeft: "8px" }}>from {session.recipeName}</span> : null}
                              </div>
                              <span className={statusBadgeClass(session.status)}>{session.status}</span>
                            </div>
                            <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                              <span>{session.completedStepCount}/{session.stepCount} steps</span>
                              <span>{session.ingredientCount} ingredients</span>
                              {session.rating != null ? <span>{"★".repeat(session.rating)}</span> : null}
                              <span>Started {formatDate(session.startDate)}</span>
                              {session.completedDate ? <span>Completed {formatDate(session.completedDate)}</span> : null}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
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