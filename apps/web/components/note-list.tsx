"use client";

import type { Entry, NoteFolder } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { RichEditorDisplay } from "./rich-editor-display";

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NoteList({
  householdId,
  entries,
  loading,
  activeFolder,
  onDelete,
}: NoteListProps): JSX.Element {
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
                      {entry.title || preview.slice(0, 60) || "Untitled"}
                    </strong>
                    <time className="note-list__item-date">
                      {formatDate(entry.entryDate)}
                    </time>
                  </div>

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

                <button
                  className="note-list__delete"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm("Delete this note?")) onDelete(entry.id);
                  }}
                  title="Delete note"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
