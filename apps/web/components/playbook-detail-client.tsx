"use client";

import type { Playbook, PlaybookRun } from "@aegis/types";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  addPlaybookItem,
  startPlaybookRun,
  completePlaybookRunItem
} from "../lib/api";

type PlaybookDetailClientProps = {
  householdId: string;
  playbookId: string;
  playbook: Playbook;
  runs: PlaybookRun[];
};

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function PlaybookDetailClient({ householdId, playbookId, playbook, runs }: PlaybookDetailClientProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  // New item form
  const [newLabel, setNewLabel] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleAddItem = useCallback(() => {
    if (!newLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addPlaybookItem(householdId, playbookId, {
          label: newLabel.trim(),
          notes: newNotes.trim() || undefined
        });
        setNewLabel("");
        setNewNotes("");
        setAddingItem(false);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add item");
      }
    });
  }, [householdId, playbookId, newLabel, newNotes, startTransition, refresh]);

  const handleStartRun = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        await startPlaybookRun(householdId, playbookId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start run");
      }
    });
  }, [householdId, playbookId, startTransition, refresh]);

  const handleCompleteRunItem = useCallback((runId: string, itemId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await completePlaybookRunItem(householdId, playbookId, runId, itemId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete item");
      }
    });
  }, [householdId, playbookId, startTransition, refresh]);

  const triggerLabel = playbook.triggerMonth
    ? `${monthNames[playbook.triggerMonth]}${playbook.triggerDay ? ` ${playbook.triggerDay}` : ""}`
    : null;

  // Find the active (in-progress) run
  const activeRun = runs.find((r) => r.completedAt === null);
  const completedRuns = runs.filter((r) => r.completedAt !== null);

  return (
    <>
      {error && <p style={{ color: "var(--tone-danger, red)", padding: "8px 16px" }}>{error}</p>}

      {/* Header info */}
      <section className="panel">
        <div className="panel__header">
          <h2>{playbook.title}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {triggerLabel && <span className="pill pill--info">📅 {triggerLabel}</span>}
            {playbook.leadDays > 0 && <span className="pill pill--muted">{playbook.leadDays}d lead</span>}
            <span className={`pill ${playbook.isActive ? "pill--success" : "pill--muted"}`}>{playbook.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
        {playbook.description && (
          <div className="panel__body--padded"><p>{playbook.description}</p></div>
        )}
      </section>

      {/* Checklist Items */}
      <section className="panel">
        <div className="panel__header">
          <h2>Checklist Items ({playbook.items.length})</h2>
          <button type="button" className="button button--ghost button--xs" onClick={() => setAddingItem(!addingItem)} disabled={isPending}>
            {addingItem ? "Cancel" : "+ Add Item"}
          </button>
        </div>
        <div className="panel__body">
          {playbook.items.length === 0 && !addingItem ? (
            <div className="panel__empty">No items defined yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 0 }}>
              {playbook.items.map((item, idx) => (
                <div key={item.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink-muted)", minWidth: 28 }}>{idx + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <strong>{item.label}</strong>
                    {item.notes && <p className="note" style={{ marginTop: 4 }}>{item.notes}</p>}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      {item.asset && <span className="pill pill--muted">{item.asset.name}</span>}
                      {item.procedure && <span className="pill pill--info">{item.procedure.title}</span>}
                      {item.space && <span className="pill pill--muted">{item.space.name}</span>}
                      {item.inventoryItem && <span className="pill pill--muted">{item.inventoryItem.name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addingItem && (
            <div style={{ padding: "12px 16px", borderTop: playbook.items.length > 0 ? "1px solid var(--border)" : undefined }}>
              <div className="form-grid">
                <label className="field field--full">
                  <span>Label</span>
                  <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Drain sprinkler lines" />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="button button--primary button--sm" onClick={handleAddItem} disabled={isPending || !newLabel.trim()}>
                  {isPending ? "Adding…" : "Add Item"}
                </button>
                <button type="button" className="button button--ghost button--sm" onClick={() => setAddingItem(false)} disabled={isPending}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Active Run */}
      {activeRun ? (
        <section className="panel">
          <div className="panel__header">
            <h2>🔄 Active Run</h2>
            <span className="note">Started {formatDate(activeRun.startedAt)}</span>
          </div>
          <div className="panel__body">
            {activeRun.items.map((ri) => (
              <div
                key={ri.id}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: ri.isCompleted ? 0.6 : 1
                }}
              >
                {ri.isCompleted ? (
                  <span style={{ color: "var(--tone-success, green)", fontWeight: 600 }}>✓</span>
                ) : (
                  <button
                    type="button"
                    className="button button--ghost button--xs"
                    onClick={() => handleCompleteRunItem(activeRun.id, ri.id)}
                    disabled={isPending}
                    style={{ padding: "2px 8px" }}
                  >
                    ○
                  </button>
                )}
                <span style={{ textDecoration: ri.isCompleted ? "line-through" : undefined }}>
                  {ri.playbookItem?.label ?? `Item ${ri.playbookItemId}`}
                </span>
                {ri.completedAt && <span className="note" style={{ marginLeft: "auto" }}>{formatDate(ri.completedAt)}</span>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="panel__body--padded" style={{ textAlign: "center" }}>
            <button
              type="button"
              className="button button--primary"
              onClick={handleStartRun}
              disabled={isPending || playbook.items.length === 0}
            >
              {isPending ? "Starting…" : "Start New Run"}
            </button>
          </div>
        </section>
      )}

      {/* Completed Runs */}
      {completedRuns.length > 0 && (
        <section className="panel">
          <div className="panel__header">
            <h2>Run History ({completedRuns.length})</h2>
          </div>
          <div className="panel__body">
            <div className="schedule-stack">
              {completedRuns.map((run) => (
                <div key={run.id} className="schedule-card">
                  <div className="schedule-card__main">
                    <div className="schedule-card__info">
                      <strong>✅ Completed</strong>
                      <span className="note">{run.items.length} items</span>
                      <span className="note">Started {formatDate(run.startedAt)}</span>
                      {run.completedAt && <span className="note">Finished {formatDate(run.completedAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
