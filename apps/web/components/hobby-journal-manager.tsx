"use client";

import type { HobbyLog, HobbyLogType } from "@lifekeeper/types";
import { useState, type FormEvent, type JSX } from "react";
import { createHobbyLog, deleteHobbyLog, updateHobbyLog } from "../lib/api";

type HobbyJournalManagerProps = {
  householdId: string;
  hobbyId: string;
  initialLogs: HobbyLog[];
};

type LogDraft = {
  title: string;
  content: string;
  logDate: string;
  logType: HobbyLogType;
};

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

const emptyLogDraft = (): LogDraft => ({
  title: "",
  content: "",
  logDate: todayInputValue(),
  logType: "note",
});

const logTypeLabels: Record<HobbyLogType, string> = {
  note: "General Note",
  tasting: "Observation / Tasting",
  progress: "Success / Progress",
  issue: "Failure / Issue",
};

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function sortLogs(logs: HobbyLog[]): HobbyLog[] {
  return [...logs].sort((left, right) => new Date(right.logDate).getTime() - new Date(left.logDate).getTime());
}

export function HobbyJournalManager({ householdId, hobbyId, initialLogs }: HobbyJournalManagerProps): JSX.Element {
  const [logs, setLogs] = useState(() => sortLogs(initialLogs));
  const [newLog, setNewLog] = useState<LogDraft>(emptyLogDraft());
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LogDraft>(emptyLogDraft());
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleCreateLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingKey) return;

    setPendingKey("log-create");
    setError(null);

    try {
      const created = await createHobbyLog(householdId, hobbyId, {
        ...(newLog.title.trim() ? { title: newLog.title.trim() } : {}),
        content: newLog.content.trim(),
        logDate: toIsoDate(newLog.logDate),
        logType: newLog.logType,
      });
      setLogs((current) => sortLogs([created, ...current]));
      setNewLog(emptyLogDraft());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create journal entry.");
    } finally {
      setPendingKey(null);
    }
  };

  const beginEditing = (log: HobbyLog) => {
    setEditingLogId(log.id);
    setEditDraft({
      title: log.title ?? "",
      content: log.content,
      logDate: log.logDate.slice(0, 10),
      logType: log.logType,
    });
  };

  const handleSaveLog = async (logId: string) => {
    if (pendingKey) return;

    setPendingKey(`log-save-${logId}`);
    setError(null);

    try {
      const updated = await updateHobbyLog(householdId, hobbyId, logId, {
        title: editDraft.title.trim() ? editDraft.title.trim() : null,
        content: editDraft.content.trim(),
        logDate: toIsoDate(editDraft.logDate),
        logType: editDraft.logType,
      });
      setLogs((current) => sortLogs(current.map((log) => log.id === logId ? updated : log)));
      setEditingLogId(null);
      setEditDraft(emptyLogDraft());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update journal entry.");
    } finally {
      setPendingKey(null);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (pendingKey) return;

    setPendingKey(`log-delete-${logId}`);
    setError(null);

    try {
      await deleteHobbyLog(householdId, hobbyId, logId);
      setLogs((current) => current.filter((log) => log.id !== logId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete journal entry.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="hobby-manager-stack">
      <section className="panel">
        <div className="panel__header"><h2>History & Journal</h2></div>
        <div className="panel__body--padded hobby-manager-stack">
          <div className="hobby-history-intro">
            <strong>Detailed history matters.</strong>
            <p>Use this journal to capture project milestones, maintenance work, successes, failures, tasting notes, and lessons learned.</p>
          </div>
          <form className="form-grid" onSubmit={handleCreateLog}>
            <label className="field">
              <span>Entry Type</span>
              <select value={newLog.logType} onChange={(event) => setNewLog((current) => ({ ...current, logType: event.target.value as HobbyLogType }))} disabled={pendingKey !== null}>
                {Object.entries(logTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={newLog.logDate} onChange={(event) => setNewLog((current) => ({ ...current, logDate: event.target.value }))} disabled={pendingKey !== null} />
            </label>
            <label className="field field--full">
              <span>Title</span>
              <input value={newLog.title} onChange={(event) => setNewLog((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Successful batch, equipment failure, maintenance checkpoint" disabled={pendingKey !== null} />
            </label>
            <label className="field field--full">
              <span>Details</span>
              <textarea value={newLog.content} onChange={(event) => setNewLog((current) => ({ ...current, content: event.target.value }))} rows={5} placeholder="Write down what happened, why it mattered, and what to repeat or avoid next time." disabled={pendingKey !== null} />
            </label>
            <div className="inline-actions inline-actions--end field--full">
              <button type="submit" className="button button--primary button--sm" disabled={pendingKey !== null || !newLog.content.trim() || !newLog.logDate}>
                {pendingKey === "log-create" ? "Saving…" : "Add Journal Entry"}
              </button>
            </div>
          </form>
          {error ? <p className="workbench-error">{error}</p> : null}
        </div>
      </section>

      {logs.length === 0 ? (
        <section className="panel">
          <div className="panel__body--padded">
            <p className="panel__empty">No journal entries yet.</p>
          </div>
        </section>
      ) : logs.map((log) => (
        <article key={log.id} className={`session-log-entry session-log-entry--${log.logType}`}>
          {editingLogId === log.id ? (
            <div className="hobby-manager-card">
              <div className="form-grid">
                <label className="field">
                  <span>Entry Type</span>
                  <select value={editDraft.logType} onChange={(event) => setEditDraft((current) => ({ ...current, logType: event.target.value as HobbyLogType }))}>
                    {Object.entries(logTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={editDraft.logDate} onChange={(event) => setEditDraft((current) => ({ ...current, logDate: event.target.value }))} />
                </label>
                <label className="field field--full">
                  <span>Title</span>
                  <input value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label className="field field--full">
                  <span>Details</span>
                  <textarea value={editDraft.content} onChange={(event) => setEditDraft((current) => ({ ...current, content: event.target.value }))} rows={4} />
                </label>
              </div>
              <div className="inline-actions inline-actions--end">
                <button type="button" className="button button--ghost button--sm" onClick={() => setEditingLogId(null)} disabled={pendingKey !== null}>
                  Cancel
                </button>
                <button type="button" className="button button--primary button--sm" onClick={() => void handleSaveLog(log.id)} disabled={pendingKey !== null || !editDraft.content.trim()}>
                  {pendingKey === `log-save-${log.id}` ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="session-log-entry__topline">
                <div>
                  <strong>{log.title ?? logTypeLabels[log.logType]}</strong>
                  <div className="inline-actions">
                    <span className="pill">{logTypeLabels[log.logType]}</span>
                    <span className="pill">{formatDate(log.logDate)}</span>
                  </div>
                </div>
                <div className="inline-actions">
                  <button type="button" className="button button--secondary button--sm" onClick={() => beginEditing(log)} disabled={pendingKey !== null}>
                    Edit
                  </button>
                  <button type="button" className="button button--ghost button--sm" onClick={() => void handleDeleteLog(log.id)} disabled={pendingKey !== null}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="session-log-entry__content">{log.content}</div>
            </>
          )}
        </article>
      ))}
    </div>
  );
}