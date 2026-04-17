"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { IdeaCanvas, IdeaCanvasThumbnailNode, IdeaCanvasThumbnailEdge } from "@aegis/types";
import { getCanvas } from "../lib/api";
import { CanvasThumbnail } from "./canvas-thumbnail";
import { CanvasRenderer } from "./canvas-renderer";

type CanvasPreviewModalProps = {
  householdId: string;
  canvasId: string;
  canvasName: string;
  nodes: IdeaCanvasThumbnailNode[];
  edges: IdeaCanvasThumbnailEdge[];
  onClose: () => void;
};

export function CanvasPreviewModal({
  householdId,
  canvasId,
  canvasName,
  nodes,
  edges,
  onClose,
}: CanvasPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [fullCanvas, setFullCanvas] = useState<IdeaCanvas | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCanvas(householdId, canvasId)
      .then((c) => { if (!cancelled) setFullCanvas(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [householdId, canvasId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Trap focus on mount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    return () => prev?.focus();
  }, []);

  return (
    <div
      ref={backdropRef}
      className="canvas-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Canvas preview: ${canvasName}`}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="canvas-modal__panel">
        <div className="canvas-modal__header">
          <span className="canvas-modal__title">{canvasName}</span>
          <div className="canvas-modal__actions">
            <Link
              href={`/canvases/${canvasId}?householdId=${householdId}`}
              className="button button--sm"
            >
              Open editor →
            </Link>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={onClose}
              aria-label="Close preview"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="canvas-modal__body">
          {fullCanvas ? (
            <CanvasRenderer householdId={householdId} canvas={fullCanvas} simplified />
          ) : (
            <CanvasThumbnail nodes={nodes} edges={edges} className="canvas-modal__svg" />
          )}
        </div>
        {!fullCanvas && (
          <div className="canvas-modal__footer">
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {edges.length} edge{edges.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clickable canvas card for dashboards ────────────────────────────────────

type CanvasDashboardCardProps = {
  householdId: string;
  canvas: {
    id: string;
    name: string;
    canvasMode: string;
    nodeCount?: number;
    edgeCount?: number;
    nodes: IdeaCanvasThumbnailNode[];
    edges: IdeaCanvasThumbnailEdge[];
    updatedAt: string;
  };
};

export function CanvasDashboardCard({ householdId, canvas }: CanvasDashboardCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const nodeCount = canvas.nodeCount ?? canvas.nodes.length;
  const edgeCount = canvas.edgeCount ?? canvas.edges.length;

  return (
    <>
      <button
        type="button"
        className="canvas-dash-card"
        onClick={() => setPreviewOpen(true)}
        aria-label={`Preview ${canvas.name}`}
      >
        <div className="canvas-dash-card__thumb">
          <CanvasThumbnail
            nodes={canvas.nodes}
            edges={canvas.edges}
            className="canvas-dash-card__svg"
          />
          <div className="canvas-dash-card__overlay">
            <span className="canvas-dash-card__zoom-icon">⤢</span>
          </div>
        </div>
        <div className="canvas-dash-card__meta">
          <span className="canvas-dash-card__name">{canvas.name}</span>
          {canvas.canvasMode !== "diagram" && (
            <span className="canvas-dash-card__mode">{canvas.canvasMode}</span>
          )}
          <span className="canvas-dash-card__counts">
            {nodeCount} nodes · {edgeCount} edges
          </span>
        </div>
      </button>

      {previewOpen && (
        <CanvasPreviewModal
          householdId={householdId}
          canvasId={canvas.id}
          canvasName={canvas.name}
          nodes={canvas.nodes}
          edges={canvas.edges}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
