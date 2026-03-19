"use client";

import type { Entry, NoteFolder } from "@lifekeeper/types";
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
};

export function NoteEditor({ householdId, entry, folderOptions }: NoteEditorProps): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title ?? "");
  const [body, setBody] = useState(entry.body);
  const [folderId, setFolderId] = useState<string | null>(entry.folderId);
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
    router.push(`/notes?householdId=${householdId}`);
  }, [householdId, entry.id, router]);

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

  return (
    <div className="note-editor">
      <div className="note-editor__bar">
        <Link
          href={`/notes?householdId=${householdId}`}
          className="button button--ghost button--small"
        >
          ← Notes
        </Link>
        <div className="note-editor__bar-actions">
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
