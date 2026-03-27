"use client";

import type { IdeaCanvasThumbnail } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { createCanvas, deleteCanvas, getCanvasesByEntityWithGeometry } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";
import { CanvasThumbnail } from "./canvas-thumbnail";

type EntityCanvasListProps = {
  householdId: string;
  entityType: string;
  entityId: string;
  initialCanvases: IdeaCanvasThumbnail[];
};

type CanvasTemplate = "blank" | "floorplan" | "flowchart";

const TEMPLATES: { value: CanvasTemplate; label: string }[] = [
  { value: "blank", label: "Blank Canvas" },
  { value: "floorplan", label: "Floor Plan" },
  { value: "flowchart", label: "Flowchart" },
];

function templateToMode(t: CanvasTemplate): "diagram" | "floorplan" {
  return t === "floorplan" ? "floorplan" : "diagram";
}

export function EntityCanvasList({
  householdId,
  entityType,
  entityId,
  initialCanvases,
}: EntityCanvasListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [canvases, setCanvases] = useState<IdeaCanvasThumbnail[]>(initialCanvases);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState<CanvasTemplate>("blank");
  const [loading, setLoading] = useState(false);

  const refreshCanvases = useCallback(async () => {
    setLoading(true);
    try {
      const updated = await getCanvasesByEntityWithGeometry(householdId, entityType, entityId);
      setCanvases(updated);
    } finally {
      setLoading(false);
    }
  }, [householdId, entityType, entityId]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createCanvas(householdId, {
        name,
        canvasMode: templateToMode(newTemplate),
        entityType,
        entityId,
      });
      await refreshCanvases();
      setNewName("");
    } finally {
      setCreating(false);
    }
  }, [householdId, entityType, entityId, newName, newTemplate, refreshCanvases]);

  const handleDelete = useCallback(async (canvasId: string) => {
    if (!confirm("Delete this canvas?")) return;
    await deleteCanvas(householdId, canvasId);
    await refreshCanvases();
  }, [householdId, refreshCanvases]);

  return (
    <div className="canvas-list">
      <div className="canvas-list__create">
        <input
          type="text"
          className="canvas-list__create-input"
          placeholder="Canvas name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => { if (e.key === "Enter") { void handleCreate(); } }}
        />
        <select
          className="canvas-list__create-mode"
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value as CanvasTemplate)}
          aria-label="Canvas template"
        >
          {TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="button button--primary button--small"
          onClick={() => { void handleCreate(); }}
          disabled={!newName.trim() || creating}
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </div>

      {loading && canvases.length === 0 ? (
        <div className="canvas-list__empty">
          <p>Loading canvases…</p>
        </div>
      ) : canvases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">🗺️</div>
          <h3 className="empty-state__title">No canvases yet</h3>
          <p className="empty-state__body">Create a canvas to visualize, map, or plan anything related to this item.</p>
        </div>
      ) : (
        <div className="canvas-list__grid">
          {canvases.map((canvas) => (
            <div key={canvas.id} className="canvas-list__card">
              <Link
                href={`/canvases/${canvas.id}?householdId=${householdId}`}
                className="canvas-list__card-link"
              >
                <CanvasThumbnail canvas={canvas} className="canvas-list__thumbnail" />
                <div className="canvas-list__card-info">
                  <span className="canvas-list__card-name">{canvas.name}</span>
                  <span className="canvas-list__card-date">{formatDate(canvas.createdAt)}</span>
                </div>
              </Link>
              <button
                type="button"
                className="button button--danger button--sm canvas-list__card-delete"
                onClick={() => { void handleDelete(canvas.id); }}
                aria-label={`Delete canvas ${canvas.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
