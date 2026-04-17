"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createCanvas, createEntry, updateEntry } from "../lib/api";
import { importIdeaLegacyNotesAction } from "../app/actions";
import { ExpandableCard } from "./expandable-card";

export type NccNoteSummary = {
  id: string;
  title: string | null;
  body: string;
  bodyFormat: string;
  entryDate: string;
};

export type NccCanvasSummary = {
  id: string;
  name: string;
  canvasMode: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
};

type NccLegacyIdeaNote = {
  id: string;
  text: string;
  createdAt: string;
};

type NotesAndCanvasCardProps = {
  householdId: string;
  entityType: "asset" | "project" | "hobby" | "idea";
  entityId: string;
  recentNote: NccNoteSummary | null;
  canvases: NccCanvasSummary[];
  allNotesHref: string;
  legacyIdeaNotes?: NccLegacyIdeaNote[];
};

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "…";
}

function formatCanvasMode(mode: string): string {
  switch (mode) {
    case "freehand": return "Freehand";
    case "diagram": return "Diagram";
    case "floorplan": return "Canvas";
    default: return mode;
  }
}

type StatusTone = "success" | "error" | "info";

export function NotesAndCanvasCard({
  householdId,
  entityType,
  entityId,
  recentNote: initialNote,
  canvases: initialCanvases,
  allNotesHref,
  legacyIdeaNotes: initialLegacyIdeaNotes = [],
}: NotesAndCanvasCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"notes" | "canvas">("notes");

  // Notes state
  const [note, setNote] = useState<NccNoteSummary | null>(initialNote);
  const [editingBody, setEditingBody] = useState(false);
  const [editBody, setEditBody] = useState(initialNote?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [noteStatus, setNoteStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [legacyIdeaNotes, setLegacyIdeaNotes] = useState<NccLegacyIdeaNote[]>(initialLegacyIdeaNotes);
  const [migratingLegacyNotes, setMigratingLegacyNotes] = useState(false);

  // Canvas state
  const [canvases] = useState<NccCanvasSummary[]>(initialCanvases);
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState("");
  const [canvasCreateMode, setCanvasCreateMode] = useState(false);
  const [canvasStatus, setCanvasStatus] = useState<{ tone: StatusTone; message: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleBodyBlur = useCallback(async () => {
    if (!note || editBody === note.body) {
      setEditingBody(false);
      return;
    }
    setNoteStatus({ tone: "info", message: "Saving note..." });
    setSaving(true);
    try {
      const updated = await updateEntry(householdId, note.id, { body: editBody });
      setNote({
        id: updated.id,
        title: updated.title ?? null,
        body: updated.body,
        bodyFormat: updated.bodyFormat,
        entryDate: updated.entryDate,
      });
      setEditingBody(false);
      setNoteStatus({ tone: "success", message: "Note saved." });
    } catch {
      setNoteStatus({ tone: "error", message: "Could not save the note. Changes are still in the editor." });
      // keep editing state open on failure
    } finally {
      setSaving(false);
    }
  }, [householdId, note, editBody]);

  const handleCreateNote = useCallback(async () => {
    const body = createBody.trim();
    if (!body) return;
    setNoteStatus({ tone: "info", message: "Creating note..." });
    setCreating(true);
    try {
      const created = await createEntry(householdId, {
        title: createTitle.trim() || null,
        body,
        entityType,
        entityId,
        entryDate: new Date().toISOString(),
      });
      setNote({
        id: created.id,
        title: created.title ?? null,
        body: created.body,
        bodyFormat: created.bodyFormat,
        entryDate: created.entryDate,
      });
      setCreateMode(false);
      setCreateTitle("");
      setCreateBody("");
      setNoteStatus({ tone: "success", message: "Note created." });
    } catch {
      setNoteStatus({ tone: "error", message: "Could not create the note. Please retry." });
      // leave form open so user can retry
    } finally {
      setCreating(false);
    }
  }, [householdId, entityType, entityId, createTitle, createBody]);

  const handleCreateCanvas = useCallback(async () => {
    const name = newCanvasName.trim() || "Untitled Canvas";
    setCanvasStatus({ tone: "info", message: "Creating canvas..." });
    setCreatingCanvas(true);
    try {
      const created = await createCanvas(householdId, {
        name,
        entityType,
        entityId,
        canvasMode: "freehand",
      });
      setCanvasStatus({ tone: "success", message: "Opening canvas..." });
      router.push(`/canvases/${created.id}`);
    } catch {
      setCanvasStatus({ tone: "error", message: "Could not create the canvas. Please retry." });
      setCreatingCanvas(false);
    }
  }, [householdId, entityType, entityId, newCanvasName, router]);

  const handleImportLegacyIdeaNotes = useCallback(async () => {
    if (entityType !== "idea" || legacyIdeaNotes.length === 0) {
      return;
    }

    setNoteStatus({ tone: "info", message: `Importing ${legacyIdeaNotes.length} legacy note${legacyIdeaNotes.length === 1 ? "" : "s"}...` });
    setMigratingLegacyNotes(true);
    try {
      const importedCount = await importIdeaLegacyNotesAction(householdId, entityId, legacyIdeaNotes);
      setLegacyIdeaNotes([]);
      setNoteStatus({ tone: "success", message: `Imported ${importedCount} legacy note${importedCount === 1 ? "" : "s"}.` });
      router.refresh();
    } catch {
      setNoteStatus({ tone: "error", message: "Could not import legacy idea notes." });
    } finally {
      setMigratingLegacyNotes(false);
    }
  }, [entityId, entityType, householdId, legacyIdeaNotes, router]);

  // ── Preview (collapsed state) ──────────────────────────────────────
  const previewContent = (
    <div className="ncc-preview">
      <div className="ncc-preview__item">
        <span className="ncc-preview__label">Note</span>
        {note ? (
          <span className="ncc-preview__text">{truncate(note.body, 80)}</span>
        ) : (
          <span className="ncc-preview__empty">No notes yet</span>
        )}
      </div>
      <div className="ncc-preview__divider" />
      <div className="ncc-preview__item">
        <span className="ncc-preview__label">Canvas</span>
        {canvases.length > 0 ? (
          <span className="ncc-canvas-chip">{canvases.at(0)?.name ?? "Untitled Canvas"}</span>
        ) : (
          <span className="ncc-preview__empty">No canvases</span>
        )}
      </div>
    </div>
  );

  // ── Expanded: Notes tab ────────────────────────────────────────────
  const notesTab = (
    <div className="ncc-panel">
      {entityType === "idea" && legacyIdeaNotes.length > 0 ? (
        <div className="ncc-legacy-banner">
          <div className="ncc-legacy-banner__content">
            <strong>Legacy idea notes detected</strong>
            <p>
              This idea still has {legacyIdeaNotes.length} older note{legacyIdeaNotes.length === 1 ? "" : "s"} stored in the legacy idea record.
              Import them into the shared notes system to keep everything in one place.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={migratingLegacyNotes}
            onClick={() => { void handleImportLegacyIdeaNotes(); }}
          >
            {migratingLegacyNotes ? "Importing..." : `Import ${legacyIdeaNotes.length} note${legacyIdeaNotes.length === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : null}
      {note ? (
        <div className="ncc-note">
          {note.title ? <p className="ncc-note__title">{note.title}</p> : null}
          {editingBody ? (
            <textarea
              ref={textareaRef}
              className="ncc-note__textarea"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onBlur={() => { void handleBodyBlur(); }}
              disabled={saving}
              rows={6}
              autoFocus
            />
          ) : (
            <p
              className="ncc-note__body"
              title="Click to edit"
              onClick={() => {
                setEditBody(note.body);
                setEditingBody(true);
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
            >
              {note.body}
            </p>
          )}
          {saving ? <span className="ncc-status">Saving…</span> : null}
        </div>
      ) : createMode ? (
        <div className="ncc-create-form">
          <input
            type="text"
            className="ncc-create-form__title"
            placeholder="Title (optional)"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
          />
          <textarea
            className="ncc-create-form__body"
            placeholder="Write your note…"
            value={createBody}
            onChange={(e) => setCreateBody(e.target.value)}
            rows={5}
            autoFocus
          />
          <div className="ncc-create-form__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={creating || !createBody.trim()}
              onClick={() => { void handleCreateNote(); }}
            >
              {creating ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={creating}
              onClick={() => { setCreateMode(false); setCreateTitle(""); setCreateBody(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ncc-empty-cta"
          onClick={() => setCreateMode(true)}
        >
          + Take a note…
        </button>
      )}
      {noteStatus ? <p className={`ncc-feedback ncc-feedback--${noteStatus.tone}`}>{noteStatus.message}</p> : null}
      <div className="ncc-panel__footer">
        <Link href={allNotesHref} className="text-link">View all notes →</Link>
      </div>
    </div>
  );

  // ── Expanded: Canvas tab ───────────────────────────────────────────
  const canvasTab = (
    <div className="ncc-panel">
      {canvases.length > 0 ? (
        <ul className="ncc-canvas-list">
          {canvases.map((c) => (
            <li key={c.id} className="ncc-canvas-item">
              <div className="ncc-canvas-item__info">
                <span className="ncc-canvas-item__name">{c.name}</span>
                <div className="ncc-canvas-item__meta">
                  <span className="pill">{formatCanvasMode(c.canvasMode)}</span>
                  <span className="ncc-canvas-item__count">{c.nodeCount} nodes</span>
                </div>
              </div>
              <Link href={`/canvases/${c.id}`} className="btn btn--ghost btn--sm">
                Open →
              </Link>
            </li>
          ))}
        </ul>
      ) : !canvasCreateMode ? (
        <p className="ncc-empty-state">No canvases yet.</p>
      ) : null}

      {canvasCreateMode ? (
        <div className="ncc-create-form ncc-create-form--canvas">
          <input
            type="text"
            className="ncc-create-form__title"
            placeholder="Canvas name (optional)"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            autoFocus
          />
          <div className="ncc-create-form__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={creatingCanvas}
              onClick={() => { void handleCreateCanvas(); }}
            >
              {creatingCanvas ? "Creating…" : "Create & open"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={creatingCanvas}
              onClick={() => { setCanvasCreateMode(false); setNewCanvasName(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ncc-empty-cta"
          onClick={() => setCanvasCreateMode(true)}
        >
          + New canvas
        </button>
      )}
      {canvasStatus ? <p className={`ncc-feedback ncc-feedback--${canvasStatus.tone}`}>{canvasStatus.message}</p> : null}
    </div>
  );

  return (
    <ExpandableCard
      title="Notes & Canvas"
      modalTitle="Notes & Canvas"
      previewContent={previewContent}
    >
      <div className="ncc-tabs">
        <button
          type="button"
          className={`ncc-tab${activeTab === "notes" ? " ncc-tab--active" : ""}`}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          className={`ncc-tab${activeTab === "canvas" ? " ncc-tab--active" : ""}`}
          onClick={() => setActiveTab("canvas")}
        >
          Canvases {canvases.length > 0 ? `(${canvases.length})` : ""}
        </button>
      </div>
      {activeTab === "notes" ? notesTab : canvasTab}
    </ExpandableCard>
  );
}
