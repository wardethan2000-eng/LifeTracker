"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import type { IdeaNoteItem } from "@aegis/types";
import { addIdeaNoteAction, removeIdeaNoteAction } from "../app/actions";
import { useTimezone } from "../lib/timezone-context";
import { Card } from "./card";
import { RichEditor } from "./rich-editor";

type IdeaNotesLogProps = {
  householdId: string;
  ideaId: string;
  notes: IdeaNoteItem[];
};

export function IdeaNotesLog({ householdId, ideaId, notes }: IdeaNotesLogProps): JSX.Element {
  const [localNotes, setLocalNotes] = useState<IdeaNoteItem[]>(notes);
  const { timezone } = useTimezone();

  const formatNoteDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  };

  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [richBody, setRichBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAdd = useCallback(() => {
    const trimmed = expanded ? richBody.trim() : text.trim();
    if (!trimmed) return;

    // Optimistic update
    const optimisticNote: IdeaNoteItem = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setLocalNotes((prev) => [optimisticNote, ...prev]);
    setText("");
    setRichBody("");
    if (expanded) setExpanded(false);

    startTransition(async () => {
      await addIdeaNoteAction(householdId, ideaId, trimmed);
    });

    // Re-focus for rapid entry
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [text, richBody, expanded, householdId, ideaId]);

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
        {expanded ? (
          <div className="idea-note-expanded-editor">
            <RichEditor
              content={richBody}
              onChange={setRichBody}
              placeholder="Write your note…"
              autoFocus
            />
          </div>
        ) : (
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
        )}
        <div className="idea-note-form__actions">
          <button
            type="button"
            className="button button--ghost button--xs"
            onClick={() => {
              if (!expanded && text.trim()) {
                setRichBody(`<p>${text}</p>`);
              }
              setExpanded(!expanded);
            }}
          >
            {expanded ? "↙ Collapse" : "⤢ Expand"}
          </button>
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={handleAdd}
            disabled={isPending || (expanded ? !richBody.trim() : !text.trim())}
            aria-label="Add note"
          >
            Add
          </button>
        </div>
      </div>
    </Card>
  );
}
