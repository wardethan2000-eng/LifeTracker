"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import type { ProjectNote } from "@lifekeeper/types";
import {
  createProjectNoteAction,
  deleteProjectNoteAction,
  toggleProjectNotePinAction,
  updateProjectNoteAction,
} from "../app/actions";
import { ConfirmActionForm } from "./confirm-action-form";

type NoteCanvasProps = {
  householdId: string;
  projectId: string;
  notes: ProjectNote[];
  phases?: { id: string; name: string }[];
};

const categoryOptions = [
  { value: "general", label: "General" },
  { value: "research", label: "Research" },
  { value: "reference", label: "Reference" },
  { value: "decision", label: "Decision" },
  { value: "measurement", label: "Measurement" },
] as const;

export function NoteCanvas({ householdId, projectId, notes, phases = [] }: NoteCanvasProps) {
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  return (
    <div className="note-canvas">
      <div className="note-canvas__header">
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Notes</h2>
        <NewNoteButton householdId={householdId} projectId={projectId} phases={phases} />
      </div>

      {pinnedNotes.length > 0 && (
        <>
          <div className="note-canvas__divider">📌 Pinned</div>
          {pinnedNotes.map((note) => (
            <NoteCard
              key={note.id}
              householdId={householdId}
              projectId={projectId}
              note={note}
              phases={phases}
            />
          ))}
        </>
      )}

      {unpinnedNotes.length > 0 && pinnedNotes.length > 0 && (
        <div className="note-canvas__divider">All Notes</div>
      )}

      {unpinnedNotes.map((note) => (
        <NoteCard
          key={note.id}
          householdId={householdId}
          projectId={projectId}
          note={note}
          phases={phases}
        />
      ))}

      {notes.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--ink-muted)" }}>
          <p>No notes yet. Click <strong>+ New Note</strong> to start writing.</p>
        </div>
      )}
    </div>
  );
}

/* ─── New Note Button ─── */

function NewNoteButton({
  householdId,
  projectId,
  phases,
}: {
  householdId: string;
  projectId: string;
  phases: { id: string; name: string }[];
}) {
  return (
    <form action={createProjectNoteAction}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="title" value="Untitled note" />
      <input type="hidden" name="body" value="" />
      <input type="hidden" name="category" value="general" />
      <button type="submit" className="button button--primary button--sm">+ New Note</button>
    </form>
  );
}

/* ─── Individual Note Card ─── */

function NoteCard({
  householdId,
  projectId,
  note,
  phases,
}: {
  householdId: string;
  projectId: string;
  note: ProjectNote;
  phases: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceSystem = (note as ProjectNote & { sourceSystem?: string }).sourceSystem ?? "legacy";

  const debouncedSave = useCallback(
    (newTitle: string, newBody: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const form = new FormData();
        form.set("householdId", householdId);
        form.set("projectId", projectId);
        form.set("noteId", note.id);
        form.set("title", newTitle);
        form.set("body", newBody);
        updateProjectNoteAction(form);
      }, 800);
    },
    [householdId, projectId, note.id]
  );

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      debouncedSave(newTitle, body);
    },
    [body, debouncedSave]
  );

  const handleBodyChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newBody = e.target.value;
      setBody(newBody);
      debouncedSave(title, newBody);
      // Auto-resize
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
    },
    [title, debouncedSave]
  );

  const createdDate = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={`note-card${note.isPinned ? " note-card--pinned" : ""}`}>
      <input
        className="note-card__title-input"
        value={title}
        onChange={handleTitleChange}
        placeholder="Note title"
      />
      <textarea
        className="note-card__body-input"
        value={body}
        onChange={handleBodyChange}
        placeholder="Start writing — markdown supported..."
        rows={3}
        style={{ overflow: "hidden" }}
        onFocus={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
      />

      {note.url && (
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="note-card__link"
        >
          🔗 {extractHostname(note.url)}
        </a>
      )}

      <div className="note-card__footer">
        {/* Pin/Unpin */}
        <form action={toggleProjectNotePinAction} style={{ display: "inline" }}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="noteId" value={note.id} />
          <input type="hidden" name="isPinned" value={note.isPinned ? "false" : "true"} />
          <input type="hidden" name="sourceSystem" value={sourceSystem} />
          <button type="submit" className={`note-card__action${note.isPinned ? " note-card__action--active" : ""}`}>
            📌 {note.isPinned ? "Pinned" : "Pin"}
          </button>
        </form>

        {/* Category */}
        <span className="note-card__action" title="Category">
          {categoryOptions.find((c) => c.value === note.category)?.label ?? note.category}
        </span>

        {/* Phase */}
        {note.phaseName && (
          <span className="note-card__action" title="Linked phase">
            📋 {note.phaseName}
          </span>
        )}

        {/* Creator */}
        {note.createdBy?.displayName && (
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            by {note.createdBy.displayName}
          </span>
        )}

        <span className="note-card__date">{createdDate}</span>

        {/* Delete */}
        <ConfirmActionForm
          action={deleteProjectNoteAction}
          hiddenFields={[
            { name: "householdId", value: householdId },
            { name: "projectId", value: projectId },
            { name: "noteId", value: note.id },
            { name: "sourceSystem", value: sourceSystem },
          ]}
          prompt="Delete this note?"
          triggerLabel="🗑"
          confirmLabel="Delete"
          triggerClassName="note-card__action note-card__action--danger"
          confirmClassName="button button--danger button--sm"
          cancelClassName="button button--ghost button--sm"
        />
      </div>
    </div>
  );
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
