"use client";

import type { IdeaCanvasSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createCanvas, deleteCanvas, getCanvases } from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";

type CanvasListProps = {
  householdId: string;
  initialCanvases: IdeaCanvasSummary[];
};

export function CanvasList({ householdId, initialCanvases }: CanvasListProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [canvases, setCanvases] = useState<IdeaCanvasSummary[]>(initialCanvases);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"diagram" | "floorplan">("diagram");
  const [loading, setLoading] = useState(initialCanvases.length === 0);

  const refreshCanvases = useCallback(async () => {
    setLoading(true);
    try {
      const updated = await getCanvases(householdId);
      setCanvases(updated);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const updated = await getCanvases(householdId);
        if (!cancelled) {
          setCanvases(updated);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createCanvas(householdId, { name, canvasMode: newMode });
      await refreshCanvases();
      setNewName("");
    } finally {
      setCreating(false);
    }
  }, [householdId, newName, newMode, refreshCanvases]);

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
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          autoFocus
        />
        <select
          className="canvas-list__create-mode"
          value={newMode}
          onChange={(e) => setNewMode(e.target.value as "diagram" | "floorplan")}
          aria-label="Canvas type"
        >
          <option value="diagram">General</option>
          <option value="floorplan">Floorplan</option>
        </select>
        <button
          type="button"
          className="button button--primary button--small"
          onClick={handleCreate}
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
        <div className="canvas-list__empty">
          <p>No canvases yet. Create one to start mapping your ideas.</p>
        </div>
      ) : (
        <div className="canvas-list__grid">
          {canvases.map((canvas) => (
            <div key={canvas.id} className="canvas-list__card">
              <Link
                href={`/canvases/${canvas.id}?householdId=${householdId}`}
                className="canvas-list__card-link"
              >
                <div className="canvas-list__card-preview">
                  <svg viewBox="0 0 200 120" className="canvas-list__card-svg">
                    {/* Simple visual placeholder showing node/edge counts */}
                    <rect x="30" y="20" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
                    <rect x="120" y="20" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
                    <rect x="75" y="70" width="50" height="30" rx="4" fill="var(--border)" opacity="0.5" />
                    <line x1="80" y1="35" x2="120" y2="35" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
                    <line x1="100" y1="70" x2="80" y2="50" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
                    <line x1="100" y1="70" x2="145" y2="50" stroke="var(--ink-muted)" strokeWidth="1" opacity="0.4" />
                  </svg>
                </div>
                <div className="canvas-list__card-info">
                  <strong className="canvas-list__card-name">{canvas.name}</strong>
                  <span className="canvas-list__card-meta">
                    {canvas.canvasMode && canvas.canvasMode !== "diagram" ? (
                      <span className="canvas-list__card-mode-badge">{canvas.canvasMode}</span>
                    ) : null}
                    {canvas.nodeCount} node{canvas.nodeCount !== 1 ? "s" : ""} · {canvas.edgeCount} edge{canvas.edgeCount !== 1 ? "s" : ""}
                  </span>
                  <time className="canvas-list__card-date">{formatDate(canvas.updatedAt)}</time>
                </div>
              </Link>
              <button
                type="button"
                className="canvas-list__card-delete"
                onClick={() => handleDelete(canvas.id)}
                title="Delete canvas"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
