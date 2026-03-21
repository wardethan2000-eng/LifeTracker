"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import type { IdeaNoteItem } from "@lifekeeper/types";
import { addIdeaNoteAction, removeIdeaNoteAction } from "../app/actions";
import { Card } from "./card";

type IdeaNotesLogProps = {
  householdId: string;
  ideaId: string;
  notes: IdeaNoteItem[];
};

function formatNoteDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function IdeaNotesLog({ householdId, ideaId, notes }: IdeaNotesLogProps): JSX.Element {
  const [localNotes, setLocalNotes] = useState<IdeaNoteItem[]>(notes);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAdd = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic update
    const optimisticNote: IdeaNoteItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setLocalNotes((prev) => [optimisticNote, ...prev]);
    setText("");

    startTransition(async () => {
      await addIdeaNoteAction(householdId, ideaId, trimmed);
    });

    // Re-focus for rapid entry
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [text, householdId, ideaId]);

  const handleRemove = useCallback(
    (noteId: string) => {
      setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
      startTransition(async () => {
        await removeIdeaNoteAction(householdId, ideaId, noteId);
      });
    },
    [householdId, ideaId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <Card title={`Notes (${localNotes.length})`}>
      {localNotes.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          No notes yet. Build context for this idea over time.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }} aria-live="polite">
          {localNotes.map((note) => (
            <div key={note.id} className="idea-note-entry">
              <div className="idea-note-entry__date">{formatNoteDate(note.createdAt)}</div>
              <div className="idea-note-entry__text">{note.text}</div>
              <button
                type="button"
                className="button button--ghost button--xs idea-note-entry__remove"
                onClick={() => handleRemove(note.id)}
                aria-label={`Remove note from ${formatNoteDate(note.createdAt)}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="idea-note-form">
        <textarea
          ref={textareaRef}
          className="input"
          placeholder="Add a note…"
          aria-label="New note text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
        />
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={handleAdd}
          disabled={isPending || !text.trim()}
          aria-label="Add note"
        >
          Add
        </button>
      </div>
    </Card>
  );
}
