"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createEntry, getEntries, updateEntry } from "../lib/api";

const RichEditor = dynamic(
  () => import("./rich-editor").then((m) => ({ default: m.RichEditor })),
  { ssr: false, loading: () => <div className="dashboard-notepad__loading" /> }
);

type DashboardNotepadProps = {
  householdId: string;
  entityType: string;
  entityId: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_DISPLAY_MS = 2000;
const NOTEPAD_TAG = "dashboard_notepad";

export function DashboardNotepad({ householdId, entityType, entityId }: DashboardNotepadProps) {
  const [body, setBody] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing notepad entry
  useEffect(() => {
    let cancelled = false;
    getEntries(householdId, {
      entityType,
      entityId,
      tags: [NOTEPAD_TAG],
      limit: 1,
    })
      .then((res) => {
        if (cancelled) return;
        const first = res.items[0];
        if (first) {
          setEntryId(first.id);
          setBody(first.body ?? "");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [householdId, entityType, entityId]);

  const persistNote = useCallback(
    async (text: string) => {
      setSaveStatus("saving");
      try {
        if (entryId) {
          await updateEntry(householdId, entryId, { body: text });
        } else {
          const entry = await createEntry(householdId, {
            entityType,
            entityId,
            title: "Dashboard Notepad",
            body: text,
            bodyFormat: "html",
            entryType: "note",
            entryDate: new Date().toISOString(),
            tags: [NOTEPAD_TAG],
          });
          setEntryId(entry.id);
        }
        setSaveStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), SAVED_DISPLAY_MS);
      } catch {
        setSaveStatus("error");
      }
    },
    [entryId, householdId, entityType, entityId]
  );

  if (loading) {
    return <div className="dashboard-card__empty">Loading…</div>;
  }

  const statusLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "saved" ? "Saved" :
    saveStatus === "error" ? "Save failed" :
    "Auto-saves as you type";

  return (
    <div className="dashboard-notepad">
      <RichEditor
        content={body}
        onChange={(html) => persistNote(html).catch(() => {})}
        placeholder="Quick notes…"
        compact
        debounceMs={SAVE_DEBOUNCE_MS}
      />
      <div className={`dashboard-notepad__status dashboard-notepad__status--${saveStatus}`}>
        {statusLabel}
      </div>
    </div>
  );
}
