"use client";

import type {
  CanvasEdgeStyle,
  CanvasNodeShape,
  IdeaCanvas,
  IdeaCanvasEdge,
  IdeaCanvasNode,
  Entry,
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  batchUpdateCanvasNodes,
  createCanvasEdge,
  createCanvasNode,
  deleteCanvasEdge,
  deleteCanvasNode,
  updateCanvas,
  updateCanvasEdge,
  updateCanvasNode,
} from "../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type DragState =
  | { type: "none" }
  | { type: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { type: "node"; nodeId: string; startX: number; startY: number; startNodeX: number; startNodeY: number }
  | { type: "edge"; sourceNodeId: string; mouseX: number; mouseY: number };

type CanvasRendererProps = {
  householdId: string;
  canvas: IdeaCanvas;
  entries?: Entry[];
  onNavigateToNote?: (entryId: string) => void;
};

const NODE_COLORS = [
  { label: "Default", value: null },
  { label: "Blue", value: "#dbeafe" },
  { label: "Green", value: "#dcfce7" },
  { label: "Yellow", value: "#fef9c3" },
  { label: "Red", value: "#fee2e2" },
  { label: "Purple", value: "#f3e8ff" },
  { label: "Orange", value: "#ffedd5" },
];

const SHAPES: CanvasNodeShape[] = ["rectangle", "rounded", "pill", "diamond"];
const EDGE_STYLES: CanvasEdgeStyle[] = ["solid", "dashed", "dotted"];

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const SYNC_DEBOUNCE_MS = 800;

// ─── Geometry helpers ────────────────────────────────────────────────────────

function getNodeCenter(n: IdeaCanvasNode) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

function getEdgeAnchors(
  source: IdeaCanvasNode,
  target: IdeaCanvasNode
): { sx: number; sy: number; tx: number; ty: number } {
  const s = getNodeCenter(source);
  const t = getNodeCenter(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const angle = Math.atan2(dy, dx);

  // Clamp to node edge (rectangle approximation)
  const clamp = (node: IdeaCanvasNode, a: number): { x: number; y: number } => {
    const c = getNodeCenter(node);
    const hw = node.width / 2;
    const hh = node.height / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const sx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
    const sy = sin !== 0 ? hh / Math.abs(sin) : Infinity;
    const scale = Math.min(sx, sy);
    return { x: c.cx + cos * scale, y: c.cy + sin * scale };
  };

  const sp = clamp(source, angle);
  const tp = clamp(target, angle + Math.PI);
  return { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y };
}

function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const midX = sx + dx * 0.5;
  const cpOffset = Math.min(Math.abs(dx) * 0.3, 80);
  return `M ${sx} ${sy} C ${midX + cpOffset} ${sy}, ${midX - cpOffset} ${ty}, ${tx} ${ty}`;
}

function getShapePath(shape: CanvasNodeShape, x: number, y: number, w: number, h: number): string {
  switch (shape) {
    case "diamond": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`;
    }
    default:
      return "";
  }
}

function getShapeRadius(shape: CanvasNodeShape): number {
  switch (shape) {
    case "rounded": return 12;
    case "pill": return 999;
    default: return 4;
  }
}

function strokeDasharray(style: CanvasEdgeStyle): string | undefined {
  switch (style) {
    case "dashed": return "8,4";
    case "dotted": return "3,3";
    default: return undefined;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CanvasRenderer({
  householdId,
  canvas: initialCanvas,
  entries = [],
  onNavigateToNote,
}: CanvasRendererProps): JSX.Element {
  const [nodes, setNodes] = useState<IdeaCanvasNode[]>(initialCanvas.nodes);
  const [edges, setEdges] = useState<IdeaCanvasEdge[]>(initialCanvas.edges);
  const [zoom, setZoom] = useState(initialCanvas.zoom);
  const [panX, setPanX] = useState(initialCanvas.panX);
  const [panY, setPanY] = useState(initialCanvas.panY);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [showNotePicker, setShowNotePicker] = useState<string | null>(null);
  const [canvasName, setCanvasName] = useState(initialCanvas.name);
  const [editingName, setEditingName] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingNodeUpdates = useRef<Map<string, Partial<IdeaCanvasNode>>>(new Map());
  const canvasId = initialCanvas.id;

  const nodeMap = useMemo(() => {
    const m = new Map<string, IdeaCanvasNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const entryMap = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  // ─── Debounced sync ──────────────────────────────────────────────────────

  const flushPendingPositions = useCallback(async () => {
    const updates = Array.from(pendingNodeUpdates.current.entries()).map(
      ([id, data]) => ({ id, ...data })
    );
    pendingNodeUpdates.current.clear();
    if (updates.length === 0) return;
    await batchUpdateCanvasNodes(householdId, canvasId, {
      nodes: updates.map((u) => ({
        id: u.id,
        x: u.x,
        y: u.y,
        width: u.width,
        height: u.height,
      })),
    });
  }, [householdId, canvasId]);

  const scheduleSyncPositions = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(flushPendingPositions, SYNC_DEBOUNCE_MS);
  }, [flushPendingPositions]);

  const syncViewport = useCallback(async (z: number, px: number, py: number) => {
    await updateCanvas(householdId, canvasId, { zoom: z, panX: px, panY: py });
  }, [householdId, canvasId]);

  const viewportTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scheduleViewportSync = useCallback((z: number, px: number, py: number) => {
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => syncViewport(z, px, py), SYNC_DEBOUNCE_MS);
  }, [syncViewport]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    };
  }, []);

  // ─── SVG coordinate helpers ──────────────────────────────────────────────

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - panX,
      y: (clientY - rect.top) / zoom - panY,
    };
  }, [zoom, panX, panY]);

  // ─── Mouse handlers ─────────────────────────────────────────────────────

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Only pan if clicking blank area
    const target = e.target as SVGElement;
    if (target === svgRef.current || target.classList.contains("canvas-bg")) {
      setDrag({ type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setContextMenu(null);
    }
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (drag.type === "pan") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setPanX(drag.startPanX + dx);
      setPanY(drag.startPanY + dy);
    } else if (drag.type === "node") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      const newX = drag.startNodeX + dx;
      const newY = drag.startNodeY + dy;
      setNodes((prev) => prev.map((n) =>
        n.id === drag.nodeId ? { ...n, x: newX, y: newY } : n
      ));
      pendingNodeUpdates.current.set(drag.nodeId, {
        ...pendingNodeUpdates.current.get(drag.nodeId),
        x: newX,
        y: newY,
      });
    } else if (drag.type === "edge") {
      setDrag({ ...drag, mouseX: e.clientX, mouseY: e.clientY });
    }
  }, [drag, zoom]);

  const handleMouseUp = useCallback(() => {
    if (drag.type === "pan") {
      scheduleViewportSync(zoom, panX, panY);
    } else if (drag.type === "node") {
      scheduleSyncPositions();
    } else if (drag.type === "edge") {
      // edge creation is handled in node mouse-up
    }
    setDrag({ type: "none" });
  }, [drag, zoom, panX, panY, scheduleViewportSync, scheduleSyncPositions]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      scheduleViewportSync(next, panX, panY);
      return next;
    });
  }, [panX, panY, scheduleViewportSync]);

  // ─── Node interactions ───────────────────────────────────────────────────

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (drag.type === "edge") return; // drawing an edge, ignore

    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setContextMenu(null);
    setDrag({
      type: "node",
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    });
  }, [nodeMap, drag.type]);

  const handleNodeMouseUp = useCallback(async (nodeId: string) => {
    if (drag.type === "edge" && drag.sourceNodeId !== nodeId) {
      // Complete edge creation
      const edge = await createCanvasEdge(householdId, canvasId, {
        sourceNodeId: drag.sourceNodeId,
        targetNodeId: nodeId,
      });
      setEdges((prev) => [...prev, edge]);
      setDrag({ type: "none" });
    }
  }, [drag, householdId, canvasId]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    setSelectedNodeId(nodeId);
  }, []);

  // ─── Edge interactions ───────────────────────────────────────────────────

  const handleEdgeClick = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  const handleEdgeDoubleClick = useCallback((edgeId: string) => {
    setEditingEdgeId(edgeId);
  }, []);

  // ─── CRUD operations ────────────────────────────────────────────────────

  const handleAddNode = useCallback(async () => {
    // Place new node near viewport center
    const cx = -panX + 400 / zoom;
    const cy = -panY + 300 / zoom;
    const node = await createCanvasNode(householdId, canvasId, {
      label: "New Idea",
      x: cx - 80,
      y: cy - 40,
    });
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
    setEditingNodeId(node.id);
  }, [householdId, canvasId, panX, panY, zoom]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedNodeId) {
      await deleteCanvasNode(householdId, canvasId, selectedNodeId);
      setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
      setEdges((prev) => prev.filter((e) => e.sourceNodeId !== selectedNodeId && e.targetNodeId !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      await deleteCanvasEdge(householdId, canvasId, selectedEdgeId);
      setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, householdId, canvasId]);

  const handleStartEdge = useCallback(() => {
    if (!selectedNodeId) return;
    setDrag({ type: "edge", sourceNodeId: selectedNodeId, mouseX: 0, mouseY: 0 });
  }, [selectedNodeId]);

  const handleChangeColor = useCallback(async (color: string | null) => {
    if (!selectedNodeId) return;
    await updateCanvasNode(householdId, canvasId, selectedNodeId, { color });
    setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, color } : n));
  }, [selectedNodeId, householdId, canvasId]);

  const handleChangeShape = useCallback(async (shape: CanvasNodeShape) => {
    if (!selectedNodeId) return;
    await updateCanvasNode(householdId, canvasId, selectedNodeId, { shape });
    setNodes((prev) => prev.map((n) => n.id === selectedNodeId ? { ...n, shape } : n));
  }, [selectedNodeId, householdId, canvasId]);

  const handleChangeEdgeStyle = useCallback(async (style: CanvasEdgeStyle) => {
    if (!selectedEdgeId) return;
    await updateCanvasEdge(householdId, canvasId, selectedEdgeId, { style });
    setEdges((prev) => prev.map((e) => e.id === selectedEdgeId ? { ...e, style } : e));
  }, [selectedEdgeId, householdId, canvasId]);

  const handleLabelCommit = useCallback(async (nodeId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    await updateCanvasNode(householdId, canvasId, nodeId, { label: trimmed });
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, label: trimmed } : n));
    setEditingNodeId(null);
  }, [householdId, canvasId]);

  const handleEdgeLabelCommit = useCallback(async (edgeId: string, label: string) => {
    const value = label.trim() || null;
    await updateCanvasEdge(householdId, canvasId, edgeId, { label: value });
    setEdges((prev) => prev.map((e) => e.id === edgeId ? { ...e, label: value } : e));
    setEditingEdgeId(null);
  }, [householdId, canvasId]);

  const handleLinkNote = useCallback(async (nodeId: string, entryId: string | null) => {
    await updateCanvasNode(householdId, canvasId, nodeId, { entryId });
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, entryId } : n));
    setShowNotePicker(null);
    setContextMenu(null);
  }, [householdId, canvasId]);

  const handleNameCommit = useCallback(async () => {
    const trimmed = canvasName.trim();
    if (trimmed && trimmed !== initialCanvas.name) {
      await updateCanvas(householdId, canvasId, { name: trimmed });
    }
    setEditingName(false);
  }, [canvasName, householdId, canvasId, initialCanvas.name]);

  // ─── Fit to view ─────────────────────────────────────────────────────────

  const handleFitToView = useCallback(() => {
    if (nodes.length === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }

    const padding = 60;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(rect.width / contentW, rect.height / contentH)));
    const newPanX = -(minX - padding) + (rect.width / newZoom - contentW) / 2;
    const newPanY = -(minY - padding) + (rect.height / newZoom - contentH) / 2;

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
    scheduleViewportSync(newZoom, newPanX, newPanY);
  }, [nodes, scheduleViewportSync]);

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingNodeId || editingEdgeId || editingName) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingNodeId, editingEdgeId, editingName, handleDeleteSelected]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : undefined;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;

  return (
    <div className="idea-canvas">
      {/* Header */}
      <div className="idea-canvas__header">
        {editingName ? (
          <input
            className="idea-canvas__name-input"
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameCommit();
              if (e.key === "Escape") { setCanvasName(initialCanvas.name); setEditingName(false); }
            }}
            maxLength={200}
            autoFocus
          />
        ) : (
          <h2
            className="idea-canvas__name"
            onDoubleClick={() => setEditingName(true)}
            title="Double-click to rename"
          >
            {canvasName}
          </h2>
        )}
      </div>

      {/* Toolbar */}
      <div className="idea-canvas__toolbar">
        <button type="button" className="idea-canvas__tool-btn" onClick={handleAddNode} title="Add node">
          + Node
        </button>
        {selectedNodeId ? (
          <>
            <button type="button" className="idea-canvas__tool-btn" onClick={handleStartEdge} title="Draw edge from selected node">
              ↗ Connect
            </button>
            <select
              className="idea-canvas__tool-select"
              value={selectedNode?.color ?? ""}
              onChange={(e) => handleChangeColor(e.target.value || null)}
              title="Node color"
            >
              {NODE_COLORS.map((c) => (
                <option key={c.value ?? ""} value={c.value ?? ""}>{c.label}</option>
              ))}
            </select>
            <select
              className="idea-canvas__tool-select"
              value={selectedNode?.shape ?? "rectangle"}
              onChange={(e) => handleChangeShape(e.target.value as CanvasNodeShape)}
              title="Node shape"
            >
              {SHAPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </>
        ) : null}
        {selectedEdgeId ? (
          <select
            className="idea-canvas__tool-select"
            value={selectedEdge?.style ?? "solid"}
            onChange={(e) => handleChangeEdgeStyle(e.target.value as CanvasEdgeStyle)}
            title="Edge style"
          >
            {EDGE_STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : null}
        {(selectedNodeId || selectedEdgeId) ? (
          <button type="button" className="idea-canvas__tool-btn idea-canvas__tool-btn--danger" onClick={handleDeleteSelected} title="Delete selected">
            Delete
          </button>
        ) : null}
        <div className="idea-canvas__toolbar-spacer" />
        <button type="button" className="idea-canvas__tool-btn" onClick={() => {
          const next = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
          setZoom(next);
          scheduleViewportSync(next, panX, panY);
        }} title="Zoom out">−</button>
        <span className="idea-canvas__zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" className="idea-canvas__tool-btn" onClick={() => {
          const next = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
          setZoom(next);
          scheduleViewportSync(next, panX, panY);
        }} title="Zoom in">+</button>
        <button type="button" className="idea-canvas__tool-btn" onClick={handleFitToView} title="Fit to view">
          Fit
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="idea-canvas__svg"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: drag.type === "pan" ? "grabbing" : drag.type === "edge" ? "crosshair" : "default" }}
      >
        <g transform={`scale(${zoom}) translate(${panX}, ${panY})`}>
          {/* Background (click target) */}
          <rect className="canvas-bg" x={-50000} y={-50000} width={100000} height={100000} fill="transparent" />

          {/* Edges */}
          {edges.map((edge) => {
            const source = nodeMap.get(edge.sourceNodeId);
            const target = nodeMap.get(edge.targetNodeId);
            if (!source || !target) return null;
            const a = getEdgeAnchors(source, target);
            const path = bezierPath(a.sx, a.sy, a.tx, a.ty);
            const isSelected = edge.id === selectedEdgeId;

            return (
              <g key={edge.id}>
                {/* Invisible wider hit area */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                  onDoubleClick={() => handleEdgeDoubleClick(edge.id)}
                  style={{ cursor: "pointer" }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={isSelected ? "var(--accent)" : "var(--ink-muted, #888)"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={strokeDasharray(edge.style as CanvasEdgeStyle)}
                  markerEnd="url(#arrowhead)"
                  pointerEvents="none"
                />
                {/* Edge label */}
                {edge.label || editingEdgeId === edge.id ? (
                  <foreignObject
                    x={(a.sx + a.tx) / 2 - 50}
                    y={(a.sy + a.ty) / 2 - 12}
                    width={100}
                    height={24}
                  >
                    {editingEdgeId === edge.id ? (
                      <input
                        className="idea-canvas__edge-label-input"
                        defaultValue={edge.label ?? ""}
                        autoFocus
                        onBlur={(e) => handleEdgeLabelCommit(edge.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEdgeLabelCommit(edge.id, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setEditingEdgeId(null);
                        }}
                      />
                    ) : (
                      <span className="idea-canvas__edge-label">{edge.label}</span>
                    )}
                  </foreignObject>
                ) : null}
              </g>
            );
          })}

          {/* In-progress edge (while dragging) */}
          {drag.type === "edge" && drag.mouseX !== 0 ? (() => {
            const source = nodeMap.get(drag.sourceNodeId);
            if (!source) return null;
            const sc = getNodeCenter(source);
            const target = screenToCanvas(drag.mouseX, drag.mouseY);
            const path = bezierPath(sc.cx, sc.cy, target.x, target.y);
            return (
              <path
                d={path}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="6,3"
                pointerEvents="none"
              />
            );
          })() : null}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isEditing = node.id === editingNodeId;
            const linkedEntry = node.entryId ? entryMap.get(node.entryId) : undefined;
            const r = getShapeRadius(node.shape as CanvasNodeShape);

            return (
              <g key={node.id}>
                {node.shape === "diamond" ? (
                  <path
                    d={getShapePath("diamond", node.x, node.y, node.width, node.height)}
                    fill={node.color ?? "var(--surface)"}
                    stroke={isSelected ? "var(--accent)" : "var(--border)"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onMouseUp={() => handleNodeMouseUp(node.id)}
                    onDoubleClick={() => handleNodeDoubleClick(node.id)}
                    onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                    style={{ cursor: drag.type === "edge" ? "crosshair" : "grab" }}
                  />
                ) : (
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={r}
                    ry={r}
                    fill={node.color ?? "var(--surface)"}
                    stroke={isSelected ? "var(--accent)" : "var(--border)"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onMouseUp={() => handleNodeMouseUp(node.id)}
                    onDoubleClick={() => handleNodeDoubleClick(node.id)}
                    onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                    style={{ cursor: drag.type === "edge" ? "crosshair" : "grab" }}
                  />
                )}

                {/* Node content via foreignObject */}
                <foreignObject
                  x={node.x + 4}
                  y={node.y + 4}
                  width={node.width - 8}
                  height={node.height - 8}
                  pointerEvents={isEditing ? "auto" : "none"}
                >
                  {isEditing ? (
                    <input
                      className="idea-canvas__node-label-input"
                      defaultValue={node.label}
                      autoFocus
                      onBlur={(e) => handleLabelCommit(node.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLabelCommit(node.id, (e.target as HTMLInputElement).value);
                        if (e.key === "Escape") setEditingNodeId(null);
                      }}
                    />
                  ) : (
                    <div className="idea-canvas__node-content">
                      {linkedEntry ? (
                        <span className="idea-canvas__node-linked-icon" title={`Linked: ${linkedEntry.title ?? "Note"}`}>📄</span>
                      ) : null}
                      <span className="idea-canvas__node-label">{node.label}</span>
                    </div>
                  )}
                </foreignObject>
              </g>
            );
          })}
        </g>

        {/* SVG defs */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--ink-muted, #888)" />
          </marker>
        </defs>
      </svg>

      {/* Context menu */}
      {contextMenu ? (
        <>
          <div className="idea-canvas__context-backdrop" onClick={() => setContextMenu(null)} />
          <div className="idea-canvas__context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" onClick={() => { handleNodeDoubleClick(contextMenu.nodeId); setContextMenu(null); }}>
              Edit Label
            </button>
            <button type="button" onClick={() => { setShowNotePicker(contextMenu.nodeId); setContextMenu(null); }}>
              Link to Note
            </button>
            {nodeMap.get(contextMenu.nodeId)?.entryId ? (
              <>
                <button type="button" onClick={() => {
                  const entry = nodeMap.get(contextMenu.nodeId)?.entryId;
                  if (entry && onNavigateToNote) onNavigateToNote(entry);
                  setContextMenu(null);
                }}>
                  Go to Note
                </button>
                <button type="button" onClick={() => { handleLinkNote(contextMenu.nodeId, null); }}>
                  Unlink Note
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => {
              setSelectedNodeId(contextMenu.nodeId);
              handleStartEdge();
              setContextMenu(null);
            }}>
              Draw Edge From Here
            </button>
            <button type="button" className="idea-canvas__context-danger" onClick={() => {
              setSelectedNodeId(contextMenu.nodeId);
              handleDeleteSelected();
              setContextMenu(null);
            }}>
              Delete Node
            </button>
          </div>
        </>
      ) : null}

      {/* Note picker overlay */}
      {showNotePicker ? (
        <div className="idea-canvas__note-picker-overlay">
          <div className="idea-canvas__note-picker">
            <div className="idea-canvas__note-picker-header">
              <h3 style={{ margin: 0 }}>Link to Note</h3>
              <button type="button" className="button button--ghost button--small" onClick={() => setShowNotePicker(null)}>Cancel</button>
            </div>
            {entries.length === 0 ? (
              <p className="panel__empty">No notes available to link.</p>
            ) : (
              <ul className="idea-canvas__note-picker-list">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => handleLinkNote(showNotePicker, entry.id)}>
                      <strong>{entry.title || "Untitled"}</strong>
                      <span className="data-table__secondary">{entry.entryType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Edge drawing hint */}
      {drag.type === "edge" ? (
        <div className="idea-canvas__hint">Click on a target node to complete the connection, or click empty space to cancel.</div>
      ) : null}
    </div>
  );
}
