"use client";

import type { Entry } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { updateEntry } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";

type PinnedNotesCardProps = {
  householdId: string;
  entries: Entry[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function PinnedNotesCard({ householdId, entries }: PinnedNotesCardProps): JSX.Element | null {
  const { formatDate } = useFormattedDate();
  const [pinned, setPinned] = useState(entries);

  const handleUnpin = useCallback(
    async (entryId: string, currentFlags: string[]) => {
      const nextFlags = currentFlags.filter((f) => f !== "pinned");
      setPinned((prev) => prev.filter((e) => e.id !== entryId));
      await updateEntry(householdId, entryId, { flags: nextFlags as Entry["flags"] });
    },
    [householdId]
  );

  if (pinned.length === 0) return null;

  return (
    <div className="pinned-notes-card">
      <div className="pinned-notes-card__header">
        <span className="pinned-notes-card__icon">📌</span>
        <h3 className="pinned-notes-card__title">Pinned Notes</h3>
      </div>
      <ul className="pinned-notes-card__list">
        {pinned.map((entry) => {
          const preview = entry.bodyFormat === "rich_text"
            ? truncate(stripHtml(entry.body), 120)
            : truncate(entry.body, 120);

          return (
            <li key={entry.id} className="pinned-notes-card__item">
              <Link
                href={`/notes/${entry.id}?householdId=${householdId}`}
                className="pinned-notes-card__link"
              >
                <strong className="pinned-notes-card__item-title">
                  {entry.reminderAt && <span className="note-reminder-badge" title={`Reminder: ${formatDate(entry.reminderAt)}`}>🔔</span>}
                  {entry.title || preview.slice(0, 60) || "Untitled"}
                </strong>
                <span className="pinned-notes-card__item-date">
                  {formatDate(entry.entryDate)}
                </span>
              </Link>
              <button
                type="button"
                className="button button--ghost button--xs pinned-notes-card__unpin"
                onClick={() => handleUnpin(entry.id, entry.flags as string[])}
                title="Unpin note"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
