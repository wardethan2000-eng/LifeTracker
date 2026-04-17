"use client";

import type { Entry, EntryFlag, NoteFolder } from "@aegis/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEntry, updateEntry } from "../lib/api";
import { RichEditor } from "./rich-editor";
import { SaveAsTemplateButton } from "./save-as-template-button";

type FolderOption = NoteFolder & { entryCount: number; childCount: number };

type NoteEditorProps = {
  householdId: string;
  entry: Entry;
  folderOptions: FolderOption[];
  backHref?: string;
  backLabel?: string;
};

const flagOptions: Array<{ value: EntryFlag; label: string; tone: string }> = [
  { value: "important", label: "⭐ Important", tone: "accent" },
  { value: "pinned", label: "📌 Pinned", tone: "info" },
  { value: "tip", label: "💡 Tip", tone: "success" },
  { value: "warning", label: "⚠ Warning", tone: "warning" },
  { value: "actionable", label: "🎯 Actionable", tone: "danger" },
  { value: "archived", label: "📦 Archived", tone: "muted" },
];

const repeatOptions: Array<{ label: string; value: number | null }> = [
  { label: "No repeat", value: null },
  { label: "Daily", value: 1 },
  { label: "Weekly", value: 7 },
  { label: "Biweekly", value: 14 },
  { label: "Monthly", value: 30 },
];

export function NoteEditor({ householdId, entry, folderOptions, backHref, backLabel = "← Notes" }: NoteEditorProps): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title ?? "");
  const [body, setBody] = useState(entry.body);
  const [folderId, setFolderId] = useState<string | null>(entry.folderId);
  const [flags, setFlags] = useState<EntryFlag[]>(entry.flags as EntryFlag[]);
  const [reminderAt, setReminderAt] = useState<string>(entry.reminderAt ? entry.reminderAt.slice(0, 16) : "");
  const [reminderRepeatDays, setReminderRepeatDays] = useState<number | null>(entry.reminderRepeatDays ?? null);
  const [reminderUntil, setReminderUntil] = useState<string>(entry.reminderUntil ? entry.reminderUntil.slice(0, 10) : "");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    async (patch: Parameters<typeof updateEntry>[2]) => {
      setSavingState("saving");
      try {
        await updateEntry(householdId, entry.id, patch);
        setSavingState("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSavingState("idle"), 2000);
      } catch {
        setSavingState("idle");
      }
    },
    [householdId, entry.id]
  );

  const debounceSave = useCallback(
    (patch: Parameters<typeof updateEntry>[2]) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => doSave(patch), 800);
    },
    [doSave]
  );

  const handleDelete = useCallback(async () => {
    if (!confirm("Permanently delete this note?")) return;
    await deleteEntry(householdId, entry.id);
    router.push(backHref ?? `/notes?householdId=${householdId}`);
  }, [backHref, householdId, entry.id, router]);

  const handleFolderChange = useCallback(
    async (newFolderId: string | null) => {
      setFolderId(newFolderId);
      await doSave({ folderId: newFolderId });
    },
    [doSave]
  );

  const handleDateBlur = useCallback(
    (value: string) => {
      if (!value) return;
      const iso = new Date(value + "T00:00:00.000Z").toISOString();
      doSave({ entryDate: iso });
    },
    [doSave]
  );

  const toggleFlag = useCallback(
    (flag: EntryFlag) => {
      setFlags((current) => {
        const next = current.includes(flag)
          ? current.filter((f) => f !== flag)
          : [...current, flag];
        doSave({ flags: next });
        return next;
      });
    },
    [doSave]
  );

  const handleReminderAtBlur = useCallback(
    (value: string) => {
      setReminderAt(value);
      if (!value) {
        doSave({ reminderAt: null, reminderRepeatDays: null, reminderUntil: null });
        setReminderRepeatDays(null);
        setReminderUntil("");
        return;
      }
      const iso = new Date(value).toISOString();
      doSave({ reminderAt: iso });
    },
    [doSave]
  );

  const handleRepeatChange = useCallback(
    (value: string) => {
      const days = value ? Number(value) : null;
      setReminderRepeatDays(days);
      doSave({ reminderRepeatDays: days });
    },
    [doSave]
  );

  const handleReminderUntilBlur = useCallback(
    (value: string) => {
      setReminderUntil(value);
      const iso = value ? new Date(value + "T23:59:59.000Z").toISOString() : null;
      doSave({ reminderUntil: iso });
    },
    [doSave]
  );

  return (
    <div className="note-editor">
      <div className="note-editor__bar">
        <Link
          href={backHref ?? `/notes?householdId=${householdId}`}
          className="button button--ghost button--small"
        >
          {backLabel}
        </Link>
        <div className="note-editor__bar-actions">
          {reminderAt && <span className="note-reminder-badge" title="Reminder set">🔔</span>}
          {savingState === "saving" && (
            <span className="note-editor__status note-editor__status--saving">Saving…</span>
          )}
          {savingState === "saved" && (
            <span className="note-editor__status note-editor__status--saved">Saved</span>
          )}
          <SaveAsTemplateButton
            householdId={householdId}
            body={body}
            entryType={entry.entryType}
            tags={Array.isArray(entry.tags) ? (entry.tags as string[]) : []}
            flags={Array.isArray(entry.flags) ? (entry.flags as string[]) : []}
          />
          <button
            type="button"
            className="button button--ghost button--small note-editor__delete-btn"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="note-editor__layout">
        <div className="note-editor__main">
          <input
            className="note-editor__title"
            type="text"
            placeholder="Untitled"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              debounceSave({ title: e.target.value || null });
            }}
          />
          <div className="note-editor__body">
            <RichEditor
              content={body}
              onChange={(html) => {
                setBody(html);
                debounceSave({ body: html, bodyFormat: "rich_text" });
              }}
            />
          </div>
        </div>

        <aside className="note-editor__meta">
          <div className="note-editor__meta-row">
            <span className="note-editor__meta-label">Folder</span>
            <select
              className="note-editor__meta-select"
              value={folderId ?? ""}
              onChange={(e) => handleFolderChange(e.target.value || null)}
            >
              <option value="">No folder</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="note-editor__meta-row">
            <span className="note-editor__meta-label">Date</span>
            <input
              type="date"
              className="note-editor__meta-date"
              defaultValue={entry.entryDate.slice(0, 10)}
              onBlur={(e) => handleDateBlur(e.target.value)}
            />
          </div>
          <div className="note-editor__meta-row">
            <span className="note-editor__meta-label">Type</span>
            <span className="note-editor__meta-value">{entry.entryType}</span>
          </div>

          <div className="note-editor__meta-row note-editor__meta-row--wrap">
            <span className="note-editor__meta-label">Flags</span>
            <div className="note-editor__flag-grid">
              {flagOptions.map((opt) => {
                const active = flags.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`note-editor__flag-toggle note-editor__flag-toggle--${opt.tone}${active ? " note-editor__flag-toggle--active" : ""}`}
                    onClick={() => toggleFlag(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="note-editor__meta-row note-editor__meta-row--wrap">
            <span className="note-editor__meta-label">Reminder</span>
            <div className="note-reminder-section">
              <input
                type="datetime-local"
                className="note-editor__meta-date"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                onBlur={(e) => handleReminderAtBlur(e.target.value)}
              />
              {reminderAt && (
                <>
                  <label className="note-reminder-section__field">
                    <span className="note-editor__meta-label">Repeat</span>
                    <select
                      className="note-editor__meta-select"
                      value={reminderRepeatDays ?? ""}
                      onChange={(e) => handleRepeatChange(e.target.value)}
                    >
                      {repeatOptions.map((r) => (
                        <option key={r.label} value={r.value ?? ""}>{r.label}</option>
                      ))}
                    </select>
                  </label>
                  {reminderRepeatDays && (
                    <label className="note-reminder-section__field">
                      <span className="note-editor__meta-label">Until</span>
                      <input
                        type="date"
                        className="note-editor__meta-date"
                        value={reminderUntil}
                        onChange={(e) => setReminderUntil(e.target.value)}
                        onBlur={(e) => handleReminderUntilBlur(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          {Array.isArray(entry.tags) && (entry.tags as string[]).length > 0 && (
            <div className="note-editor__meta-row note-editor__meta-row--wrap">
              <span className="note-editor__meta-label">Tags</span>
              <div className="note-editor__meta-tags">
                {(entry.tags as string[]).map((tag) => (
                  <span key={tag} className="pill pill--muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
