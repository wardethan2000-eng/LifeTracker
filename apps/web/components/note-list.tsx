"use client";

import type { Entry, NoteFolder } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { RichEditorDisplay } from "./rich-editor-display";
import { SaveAsTemplateButton } from "./save-as-template-button";
import { useFormattedDate } from "../lib/formatted-date";

type NoteListProps = {
  householdId: string;
  entries: Entry[];
  loading: boolean;
  activeFolder: (NoteFolder & { entryCount: number; childCount: number }) | null;
  onDelete: (entryId: string) => Promise<void>;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function NoteList({
  householdId,
  entries,
  loading,
  activeFolder,
  onDelete,
}: NoteListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  return (
    <div className="note-list">
      <div className="note-list__header">
        <h2 className="note-list__title">
          {activeFolder ? activeFolder.name : "All Notes"}
        </h2>
        <span className="note-list__count">
          {entries.length} {entries.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {loading ? (
        <div className="note-list__loading">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="note-list__empty">
          <p>No notes yet.{activeFolder ? ` Create one in "${activeFolder.name}".` : " Use the quick capture above to get started."}</p>
        </div>
      ) : (
        <ul className="note-list__items">
          {entries.map((entry) => {
            const preview = entry.bodyFormat === "rich_text"
              ? truncate(stripHtml(entry.body), 200)
              : truncate(entry.body, 200);

            return (
              <li key={entry.id} className="note-list__item">
                <Link
                  href={`/notes/${entry.id}?householdId=${householdId}`}
                  className="note-list__link"
                >
                  <div className="note-list__item-header">
                    <strong className="note-list__item-title">
                      {entry.reminderAt && <span className="note-reminder-badge" title={`Reminder: ${formatDate(entry.reminderAt)}`}>🔔</span>}
                      {entry.title || preview.slice(0, 60) || "Untitled"}
                    </strong>
                    <time className="note-list__item-date">
                      {formatDate(entry.entryDate)}
                    </time>
                  </div>

                  {entry.flags && Array.isArray(entry.flags) && (entry.flags as string[]).length > 0 && (
                    <div className="note-list__item-flags">
                      {(entry.flags as string[]).map((flag) => (
                        <span key={flag} className={`pill pill--${flag === "important" || flag === "actionable" ? "accent" : flag === "warning" ? "warning" : "muted"}`}>{flag}</span>
                      ))}
                    </div>
                  )}

                  {entry.bodyFormat === "rich_text" ? (
                    <div className="note-list__item-preview">
                      <RichEditorDisplay
                        content={entry.body}
                        bodyFormat="rich_text"
                        className="note-list__rich-preview"
                      />
                    </div>
                  ) : (
                    <p className="note-list__item-preview">{preview}</p>
                  )}

                  {entry.tags && Array.isArray(entry.tags) && (entry.tags as string[]).length > 0 && (
                    <div className="note-list__item-tags">
                      {(entry.tags as string[]).map((tag) => (
                        <span key={tag} className="pill pill--muted">{tag}</span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className="note-list__actions">
                  <SaveAsTemplateButton
                    householdId={householdId}
                    body={entry.body}
                    entryType={entry.entryType}
                    tags={Array.isArray(entry.tags) ? entry.tags as string[] : []}
                    flags={Array.isArray(entry.flags) ? entry.flags as string[] : []}
                  />
                  <button
                    className="note-list__delete-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Delete this note?")) onDelete(entry.id);
                    }}
                    title="Delete note"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
