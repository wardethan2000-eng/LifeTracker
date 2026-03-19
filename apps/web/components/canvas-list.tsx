"use client";

import type { IdeaCanvasSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { createCanvas, deleteCanvas, getCanvases } from "../lib/api";

type CanvasListProps = {
  householdId: string;
  initialCanvases: IdeaCanvasSummary[];
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CanvasList({ householdId, initialCanvases }: CanvasListProps): JSX.Element {
  const [canvases, setCanvases] = useState<IdeaCanvasSummary[]>(initialCanvases);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createCanvas(householdId, { name });
      const updated = await getCanvases(householdId);
      setCanvases(updated);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }, [householdId, newName]);

  const handleDelete = useCallback(async (canvasId: string) => {
    if (!confirm("Delete this canvas?")) return;
    await deleteCanvas(householdId, canvasId);
    setCanvases((prev) => prev.filter((c) => c.id !== canvasId));
  }, [householdId]);

  return (
    <div className="canvas-list">
      <div className="canvas-list__create">
        <input
          type="text"
          className="canvas-list__create-input"
          placeholder="New canvas name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <button
          type="button"
          className="button button--primary button--small"
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
        >
          {creating ? "Creating…" : "Create Canvas"}
        </button>
      </div>

      {canvases.length === 0 ? (
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
