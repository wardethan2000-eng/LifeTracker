"use client";

import { useEffect, useState, useRef, useCallback, type JSX } from "react";
import type { SharedCanvas, IdeaCanvasThumbnailNode, IdeaCanvasThumbnailEdge } from "@aegis/types";
import { getSharedCanvas } from "../../../../lib/api";
import { renderCanvasToSVG } from "../../../../lib/canvas-svg-render";

interface Props {
  token: string;
}

export default function SharedCanvasContent({ token }: Props): JSX.Element {
  const [data, setData] = useState<SharedCanvas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSharedCanvas(token)
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.1), 10));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (loading) {
    return <div className="shared-canvas-page__loading"><p className="note">Loading canvas…</p></div>;
  }

  if (error) {
    return (
      <div className="shared-canvas-page__error">
        <h2>Cannot load canvas</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return <></>;

  const { canvas, permission, shareLabel } = data;
  const pixelsPerUnit = canvas.physicalUnit && canvas.gridSize ? canvas.gridSize : null;
  const svgContent = renderCanvasToSVG(
    canvas.nodes as unknown as IdeaCanvasThumbnailNode[],
    canvas.edges as unknown as IdeaCanvasThumbnailEdge[],
    {
      showDimensions: canvas.showDimensions ?? true,
      pixelsPerUnit,
      physicalUnit: canvas.physicalUnit ?? null,
    },
  );

  return (
    <>
      <header className="shared-canvas-header">
        <div className="shared-canvas-header__info">
          <h1>{canvas.name}</h1>
          {shareLabel && <span className="shared-canvas-header__label">{shareLabel}</span>}
          <span className={`pill pill--xs ${permission === "edit" ? "pill--warning" : "pill--info"}`}>
            {permission === "edit" ? "Editable" : "View only"}
          </span>
        </div>
        <div className="shared-canvas-header__controls">
          <button type="button" className="button button--sm button--ghost" onClick={() => setZoom(z => z * 1.2)}>+</button>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="button button--sm button--ghost" onClick={() => setZoom(z => z * 0.8)}>−</button>
          <button type="button" className="button button--sm button--ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
        </div>
      </header>

      <div
        ref={containerRef}
        className="shared-canvas-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <div
          className="shared-canvas-viewport__inner"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      <footer className="shared-canvas-footer">
        <span>Shared via Aegis</span>
        {canvas.physicalUnit && <span>Unit: {canvas.physicalUnit}</span>}
      </footer>
    </>
  );
}
