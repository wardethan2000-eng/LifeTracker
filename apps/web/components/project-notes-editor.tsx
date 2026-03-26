"use client";

import type { Entry } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createEntry, getEntries, updateEntry } from "../lib/api";
import { RichEditor } from "./rich-editor";

type ProjectNotesEditorProps = {
  householdId: string;
  projectId: string;
};

export function ProjectNotesEditor({ householdId, projectId }: ProjectNotesEditorProps): JSX.Element {
  const [content, setContent] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntryIdRef = useRef<string | null>(null);

  useEffect(() => {
    getEntries(householdId, {
      entityType: "project",
      entityId: projectId,
      entryType: "note",
      limit: 1,
    }).then((result) => {
      const entry: Entry | undefined = result.items[0];
      if (entry) {
        pendingEntryIdRef.current = entry.id;
        setContent(entry.body ?? "");
      }
      setReady(true);
    }).catch(() => {
      setReady(true);
    });
  }, [householdId, projectId]);

  const handleChange = useCallback(
    (html: string) => {
      setContent(html);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const currentEntryId = pendingEntryIdRef.current;
          if (currentEntryId) {
            await updateEntry(householdId, currentEntryId, {
              body: html,
              bodyFormat: "rich_text",
            });
          } else {
            const created = await createEntry(householdId, {
              body: html,
              bodyFormat: "rich_text",
              entryDate: new Date().toISOString(),
              entityType: "project",
              entityId: projectId,
              entryType: "note",
              flags: [],
              tags: [],
              measurements: [],
            });
            pendingEntryIdRef.current = created.id;
          }
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [householdId, projectId]
  );

  if (!ready) {
    return <div className="phase-notes-editor--loading" />;
  }

  return (
    <div className="project-notes-editor">
      <div className="project-notes-editor__toolbar">
        <span className="project-notes-editor__status">
          {saving ? "Saving…" : "Auto-saved"}
        </span>
      </div>
      <RichEditor
        content={content}
        onChange={handleChange}
        placeholder="Project notes — decisions, context, reference info, anything worth remembering…"
      />
    </div>
  );
}
