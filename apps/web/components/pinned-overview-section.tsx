"use client";

import type { JSX } from "react";
import { useCallback, useState } from "react";
import Link from "next/link";
import type { Entry, OverviewPin } from "@aegis/types";
import { updateEntry, removeOverviewPin } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";

type PinnedOverviewSectionProps = {
  householdId: string;
  entityType: string;
  entityId: string;
  entries: Entry[];
  overviewPins: OverviewPin[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function PinnedOverviewSection({
  householdId,
  entityType,
  entityId,
  entries,
  overviewPins,
}: PinnedOverviewSectionProps): JSX.Element | null {
  const { formatDate } = useFormattedDate();
  const [pinnedEntries, setPinnedEntries] = useState(entries);
  const [pins, setPins] = useState(overviewPins);

  const handleUnpinEntry = useCallback(
    async (entryId: string, currentFlags: string[]) => {
      const nextFlags = currentFlags.filter((f) => f !== "pinned");
      setPinnedEntries((prev) => prev.filter((e) => e.id !== entryId));
      await updateEntry(householdId, entryId, { flags: nextFlags as Entry["flags"] });
    },
    [householdId]
  );

  const handleUnpinItem = useCallback(async (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    await removeOverviewPin(pinId);
  }, []);

  const canvasPins = pins.filter((p) => p.itemType === "canvas");
  const attachmentPins = pins.filter((p) => p.itemType === "attachment");
  const hasAny = pinnedEntries.length > 0 || canvasPins.length > 0 || attachmentPins.length > 0;

  if (!hasAny) return null;

  return (
    <div className="pinned-overview-section">
      <div className="pinned-overview-section__header">
        <span className="pinned-overview-section__icon">📌</span>
        <h3 className="pinned-overview-section__title">Pinned</h3>
      </div>

      <div className="pinned-overview-section__grid">
        {pinnedEntries.map((entry) => {
          const preview =
            entry.bodyFormat === "rich_text"
              ? truncate(stripHtml(entry.body), 120)
              : truncate(entry.body, 120);

          return (
            <div key={entry.id} className="pinned-overview-section__card">
              <div className="pinned-overview-section__card-label">Note</div>
              <Link
                href={`/notes/${entry.id}?householdId=${householdId}`}
                className="pinned-overview-section__card-body"
              >
                <strong className="pinned-overview-section__card-title">
                  {entry.reminderAt && (
                    <span
                      className="note-reminder-badge"
                      title={`Reminder: ${formatDate(entry.reminderAt)}`}
                    >
                      🔔
                    </span>
                  )}
                  {entry.title || preview.slice(0, 60) || "Untitled"}
                </strong>
                <span className="pinned-overview-section__card-meta">
                  {formatDate(entry.entryDate)}
                </span>
                {preview && (
                  <p className="pinned-overview-section__card-preview">{preview}</p>
                )}
              </Link>
              <button
                type="button"
                className="button button--ghost button--xs pinned-overview-section__unpin"
                onClick={() => handleUnpinEntry(entry.id, entry.flags as string[])}
                title="Unpin"
              >
                ×
              </button>
            </div>
          );
        })}

        {canvasPins.map((pin) => {
          const canvas = pin.canvas;
          if (!canvas) return null;
          return (
            <div key={pin.id} className="pinned-overview-section__card">
              <div className="pinned-overview-section__card-label">Canvas</div>
              <Link
                href={`/${entityType === "asset" ? "assets" : entityType === "project" ? "projects" : entityType === "hobby" ? "hobbies" : "ideas"}/${entityId}/canvas`}
                className="pinned-overview-section__card-body"
              >
                <strong className="pinned-overview-section__card-title">{canvas.name}</strong>
                <span className="pinned-overview-section__card-meta">
                  {canvas.nodeCount} nodes · {canvas.edgeCount} edges
                </span>
              </Link>
              <button
                type="button"
                className="button button--ghost button--xs pinned-overview-section__unpin"
                onClick={() => handleUnpinItem(pin.id)}
                title="Unpin"
              >
                ×
              </button>
            </div>
          );
        })}

        {attachmentPins.map((pin) => {
          const att = pin.attachment;
          if (!att) return null;
          const isImage = att.mimeType.startsWith("image/");
          return (
            <div key={pin.id} className="pinned-overview-section__card pinned-overview-section__card--attachment">
              <div className="pinned-overview-section__card-label">
                {isImage ? "Image" : "Document"}
              </div>
              <div className="pinned-overview-section__card-body">
                {isImage && att.thumbnailKey ? (
                  <img
                    src={`/api/attachments/${att.id}/thumbnail`}
                    alt={att.caption ?? att.originalFilename}
                    className="pinned-overview-section__card-thumb"
                  />
                ) : (
                  <span className="pinned-overview-section__card-icon">📄</span>
                )}
                <span className="pinned-overview-section__card-title">
                  {att.caption ?? att.originalFilename}
                </span>
              </div>
              <button
                type="button"
                className="button button--ghost button--xs pinned-overview-section__unpin"
                onClick={() => handleUnpinItem(pin.id)}
                title="Unpin"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
