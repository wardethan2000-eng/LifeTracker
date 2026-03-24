"use client";

import type {
  CanvasEdgeStyle,
  CanvasMode,
  CanvasNodeShape,
  CanvasObjectType,
  IdeaCanvas,
  IdeaCanvasEdge,
  IdeaCanvasNode,
  Entry,
  UpdateCanvasSettingsInput,
} from "@lifekeeper/types";
import type { JSX } from "react";
import { createPortal } from "react-dom";
import CanvasObjectPicker, { type CanvasObjectPlacement } from "./canvas-object-picker";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  batchUpdateCanvasNodes,
  confirmAttachmentUpload,
  createCanvasEdge,
  createCanvasNode,
  deleteCanvasEdge,
  deleteCanvasNode,
  getAttachmentDownloadUrl,
  requestAttachmentUpload,
  updateCanvas,
  updateCanvasEdge,
  updateCanvasNode,
  updateCanvasSettings,
} from "../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTool = "select" | "pan" | "node" | "rect" | "circle" | "line" | "text" | "image" | "object" | "wall" | "measure";

type DragState =
  | { type: "none" }
  | { type: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { type: "node"; nodeIds: string[]; startX: number; startY: number; startPositions: Record<string, { x: number; y: number }> }
  | { type: "edge"; sourceNodeId: string; mouseX: number; mouseY: number }
  | { type: "rubber"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "draw"; tool: "rect" | "circle" | "line" | "text"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "resize"; nodeId: string; handle: ResizeHandle; startBounds: { x: number; y: number; width: number; height: number }; startX2: number; startY2: number; startMouseCX: number; startMouseCY: number }
  | { type: "wall"; startCX: number; startCY: number; endCX: number; endCY: number; shiftKey: boolean }
  | { type: "measure"; startCX: number; startCY: number; endCX: number; endCY: number };

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "line-start" | "line-end";

type HistoryEntry = { nodes: IdeaCanvasNode[]; edges: IdeaCanvasEdge[] };

const MAX_HISTORY = 50;

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
const PHYSICAL_UNITS = ["ft", "m", "in", "cm"] as const;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;
const SYNC_DEBOUNCE_MS = 800;
const MIN_SIZE = 10;

// ─── Geometry ────────────────────────────────────────────────────────────────

function getNodeCenter(n: IdeaCanvasNode) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

function getEdgeAnchors(source: IdeaCanvasNode, target: IdeaCanvasNode) {
  const s = getNodeCenter(source);
  const t = getNodeCenter(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const angle = Math.atan2(dy, dx);

  const clampToEdge = (node: IdeaCanvasNode, a: number) => {
    const c = getNodeCenter(node);
    // Diamond: use vertex math
    if (node.shape === "diamond") {
      const hw = node.width / 2;
      const hh = node.height / 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // Which diamond vertex is closest to angle a?
      const vertices = [
        { x: c.cx, y: node.y },        // top
        { x: node.x + node.width, y: c.cy }, // right
        { x: c.cx, y: node.y + node.height }, // bottom
        { x: node.x, y: c.cy },        // left
      ];
      let best = vertices[0];
      let bestDot = -Infinity;
      for (const v of vertices) {
        const dot = (v.x - c.cx) * cos + (v.y - c.cy) * sin;
        if (dot > bestDot) { bestDot = dot; best = v; }
      }
      return best;
    }
    const hw = node.width / 2;
    const hh = node.height / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const sx = cos !== 0 ? hw / Math.abs(cos) : Infinity;
    const sy = sin !== 0 ? hh / Math.abs(sin) : Infinity;
    const scale = Math.min(sx, sy);
    return { x: c.cx + cos * scale, y: c.cy + sin * scale };
  };

  const sp = clampToEdge(source, angle);
  const tp = clampToEdge(target, angle + Math.PI);
  return { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y };
}

function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const midX = sx + dx * 0.5;
  const cpOffset = Math.min(Math.abs(dx) * 0.3, 80);
  return `M ${sx} ${sy} C ${midX + cpOffset} ${sy}, ${midX - cpOffset} ${ty}, ${tx} ${ty}`;
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

function snapToGrid(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}

// Snap (dx, dy) to nearest allowed wall angle.
// Default: 0°/90°. With shiftKey: also 45°.
function snapWallAngle(dx: number, dy: number, shiftKey: boolean): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { dx: 0, dy: 0 };
  const angle = Math.atan2(dy, dx);
  const step = shiftKey ? Math.PI / 4 : Math.PI / 2;
  const snapped = Math.round(angle / step) * step;
  return { dx: Math.round(Math.cos(snapped) * len), dy: Math.round(Math.sin(snapped) * len) };
}

// Format a physical distance as a string with unit.
function fmtPhysical(px: number, pxPerUnit: number, unit: string): string {
  const v = px / pxPerUnit;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} ${unit}`;
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

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [showNotePicker, setShowNotePicker] = useState<string | null>(null);
  const [canvasName, setCanvasName] = useState(initialCanvas.name);
  const [editingName, setEditingName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const canvasMode: CanvasMode = (initialCanvas.canvasMode as CanvasMode) ?? "diagram";
  const [showDimensions, setShowDimensions] = useState(initialCanvas.showDimensions ?? true);
  // Wall chain: last completed wall endpoint (for chain drawing)
  const wallChainStartRef = useRef<{ cx: number; cy: number } | null>(null);
  // Cursor physical coord readout
  const [cursorPhysical, setCursorPhysical] = useState<{ x: number; y: number } | null>(null);
  const [settings, setSettings] = useState<UpdateCanvasSettingsInput>({
    physicalWidth: initialCanvas.physicalWidth,
    physicalHeight: initialCanvas.physicalHeight,
    physicalUnit: (initialCanvas.physicalUnit as UpdateCanvasSettingsInput["physicalUnit"]) ?? null,
    backgroundImageUrl: initialCanvas.backgroundImageUrl,
    snapToGrid: initialCanvas.snapToGrid,
    gridSize: initialCanvas.gridSize,
    showDimensions: initialCanvas.showDimensions ?? true,
  });
  // Resolved presigned download URL for the background image (re-fetched on mount/change)
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(null);
  const [bgImageDims, setBgImageDims] = useState<{ w: number; h: number } | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  // Map from nodeId -> resolved download URL for image object nodes
  const [nodeImageUrls, setNodeImageUrls] = useState<Map<string, string>>(new Map());
  const [imgObjUploading, setImgObjUploading] = useState(false);
  const [imgObjUploadError, setImgObjUploadError] = useState<string | null>(null);

  // Object picker panel visibility
  const [objectPickerOpen, setObjectPickerOpen] = useState(false);

  // Clipboard for copy/paste
  const clipboardRef = useRef<IdeaCanvasNode[]>([]);

  // Undo/redo
  const historyRef = useRef<HistoryEntry[]>([{ nodes: initialCanvas.nodes, edges: initialCanvas.edges }]);
  const historyIndexRef = useRef(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingNodeUpdates = useRef<Map<string, Partial<IdeaCanvasNode>>>(new Map());
  const canvasId = initialCanvas.id;

  const nodeMap = useMemo(() => {
    const m = new Map<string, IdeaCanvasNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // pixels per physical unit: 1 grid square = 1 unit
  const pixelsPerUnit = useMemo(() => {
    if (!settings.physicalUnit || !settings.gridSize) return null;
    return settings.gridSize;
  }, [settings.physicalUnit, settings.gridSize]);

  const entryMap = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  // ─── History ──────────────────────────────────────────────────────────────

  const pushHistory = useCallback((newNodes: IdeaCanvasNode[], newEdges: IdeaCanvasEdge[]) => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    // Trim any redo states
    stack.splice(idx + 1);
    stack.push({ nodes: newNodes, edges: newEdges });
    if (stack.length > MAX_HISTORY) stack.shift();
    historyIndexRef.current = stack.length - 1;
  }, []);

  const undo = useCallback(() => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    const entry = stack[historyIndexRef.current];
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setSelectedIds(new Set());
    // Sync to server after idle
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const updates = entry.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height, x2: n.x2, y2: n.y2 }));
      if (updates.length > 0) {
        await batchUpdateCanvasNodes(householdId, canvasId, { nodes: updates });
      }
    }, SYNC_DEBOUNCE_MS);
  }, [householdId, canvasId]);

  const redo = useCallback(() => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx >= stack.length - 1) return;
    historyIndexRef.current = idx + 1;
    const entry = stack[historyIndexRef.current];
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setSelectedIds(new Set());
  }, []);

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
        x2: u.x2,
        y2: u.y2,
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

  const maybeSnap = useCallback((val: number) => {
    if (settings.snapToGrid && settings.gridSize) return snapToGrid(val, settings.gridSize);
    return val;
  }, [settings.snapToGrid, settings.gridSize]);

  // ─── Mouse handlers ─────────────────────────────────────────────────────

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    const isBlank = target === svgRef.current || target.classList.contains("canvas-bg") || target.classList.contains("canvas-grid-line");
    if (!isBlank) return;

    setContextMenu(null);
    const cp = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === "pan") {
      setDrag({ type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY });
    } else if (activeTool === "select") {
      if (e.shiftKey) {
        // Shift+drag on empty canvas → rubber-band select
        setDrag({ type: "rubber", startCX: cp.x, startCY: cp.y, currentCX: cp.x, currentCY: cp.y });
      } else {
        // Plain drag on empty canvas → pan
        setDrag({ type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY });
        setSelectedIds(new Set());
        setSelectedEdgeId(null);
      }
    } else if (activeTool === "node") {
      // Create flowchart node immediately
      const x = maybeSnap(cp.x - 80);
      const y = maybeSnap(cp.y - 40);
      createCanvasNode(householdId, canvasId, {
        label: "",
        x, y,
        width: 160, height: 80,
        objectType: "flowchart",
      }).then((node) => {
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
        setEditingNodeId(node.id);
        setActiveTool("select");
      });
    } else if (activeTool === "rect" || activeTool === "circle" || activeTool === "line" || activeTool === "text") {
      setDrag({ type: "draw", tool: activeTool, startCX: cp.x, startCY: cp.y, currentCX: cp.x, currentCY: cp.y });
    } else if (activeTool === "wall") {
      // If we are continuing a wall chain, start from the last endpoint
      const chain = wallChainStartRef.current;
      const startCX = chain ? chain.cx : maybeSnap(cp.x);
      const startCY = chain ? chain.cy : maybeSnap(cp.y);
      setDrag({ type: "wall", startCX, startCY, endCX: startCX, endCY: startCY, shiftKey: e.shiftKey });
    } else if (activeTool === "measure") {
      setDrag({ type: "measure", startCX: maybeSnap(cp.x), startCY: maybeSnap(cp.y), endCX: maybeSnap(cp.x), endCY: maybeSnap(cp.y) });
    }
  }, [activeTool, panX, panY, screenToCanvas, maybeSnap, householdId, canvasId, nodes, edges, pushHistory, wallChainStartRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Update physical cursor readout
    if (pixelsPerUnit) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setCursorPhysical({ x: cp.x / pixelsPerUnit, y: cp.y / pixelsPerUnit });
    }
    if (drag.type === "pan") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setPanX(drag.startPanX + dx);
      setPanY(drag.startPanY + dy);
    } else if (drag.type === "node") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setNodes((prev) => prev.map((n) => {
        if (!drag.nodeIds.includes(n.id)) return n;
        const start = drag.startPositions[n.id];
        if (!start) return n;
        const newX = maybeSnap(start.x + dx);
        const newY = maybeSnap(start.y + dy);
        if (n.objectType === "line") {
          const lineDX = n.x2 - n.x;
          const lineDY = n.y2 - n.y;
          return { ...n, x: newX, y: newY, x2: newX + lineDX, y2: newY + lineDY };
        }
        return { ...n, x: newX, y: newY };
      }));
    } else if (drag.type === "edge") {
      setDrag({ ...drag, mouseX: e.clientX, mouseY: e.clientY });
    } else if (drag.type === "rubber") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, currentCX: cp.x, currentCY: cp.y });
    } else if (drag.type === "draw") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, currentCX: cp.x, currentCY: cp.y });
    } else if (drag.type === "resize") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const dx = cp.x - drag.startMouseCX;
      const dy = cp.y - drag.startMouseCY;
      const b = drag.startBounds;

      if (drag.handle === "line-start") {
        const newX = maybeSnap(b.x + dx);
        const newY = maybeSnap(b.y + dy);
        setNodes((prev) => prev.map((n) => n.id === drag.nodeId ? { ...n, x: newX, y: newY } : n));
        return;
      }
      if (drag.handle === "line-end") {
        const newX2 = maybeSnap(drag.startX2 + dx);
        const newY2 = maybeSnap(drag.startY2 + dy);
        setNodes((prev) => prev.map((n) => n.id === drag.nodeId ? { ...n, x2: newX2, y2: newY2 } : n));
        return;
      }

      let newX = b.x, newY = b.y, newW = b.width, newH = b.height;
      const h = drag.handle;

      if (h.includes("w")) { newX = Math.min(b.x + dx, b.x + b.width - MIN_SIZE); newW = b.x + b.width - newX; }
      if (h.includes("e")) { newW = Math.max(MIN_SIZE, b.width + dx); }
      if (h.includes("n")) { newY = Math.min(b.y + dy, b.y + b.height - MIN_SIZE); newH = b.y + b.height - newY; }
      if (h.includes("s")) { newH = Math.max(MIN_SIZE, b.height + dy); }

      newX = maybeSnap(newX); newY = maybeSnap(newY);
      newW = Math.max(MIN_SIZE, maybeSnap(newW)); newH = Math.max(MIN_SIZE, maybeSnap(newH));

      setNodes((prev) => prev.map((n) => n.id === drag.nodeId ? { ...n, x: newX, y: newY, width: newW, height: newH } : n));
    } else if (drag.type === "wall") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const rawDx = cp.x - drag.startCX;
      const rawDy = cp.y - drag.startCY;
      const snapped = snapWallAngle(rawDx, rawDy, e.shiftKey);
      setDrag({ ...drag, endCX: drag.startCX + snapped.dx, endCY: drag.startCY + snapped.dy, shiftKey: e.shiftKey });
    } else if (drag.type === "measure") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, endCX: cp.x, endCY: cp.y });
    }
  }, [drag, zoom, screenToCanvas, maybeSnap, pixelsPerUnit]);

  const handleMouseUp = useCallback(async () => {
    if (drag.type === "pan") {
      scheduleViewportSync(zoom, panX, panY);
    } else if (drag.type === "node") {
      // Commit pending positions to history and server
      const currentNodes = nodes;
      pushHistory(currentNodes, edges);
      for (const nodeId of drag.nodeIds) {
        const n = nodeMap.get(nodeId);
        if (!n) continue;
        pendingNodeUpdates.current.set(nodeId, { x: n.x, y: n.y, x2: n.x2, y2: n.y2 });
      }
      scheduleSyncPositions();
    } else if (drag.type === "rubber") {
      // Select all nodes within rubber-band rect
      const minX = Math.min(drag.startCX, drag.currentCX);
      const maxX = Math.max(drag.startCX, drag.currentCX);
      const minY = Math.min(drag.startCY, drag.currentCY);
      const maxY = Math.max(drag.startCY, drag.currentCY);
      const enclosed = nodes.filter((n) => {
        if (n.objectType === "line") {
          return n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY &&
                 n.x2 >= minX && n.x2 <= maxX && n.y2 >= minY && n.y2 <= maxY;
        }
        return n.x >= minX && n.x + n.width <= maxX && n.y >= minY && n.y + n.height <= maxY;
      });
      if (enclosed.length > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const n of enclosed) next.add(n.id);
          return next;
        });
      }
    } else if (drag.type === "draw") {
      const { tool, startCX, startCY, currentCX, currentCY } = drag;
      const distX = currentCX - startCX;
      const distY = currentCY - startCY;
      if (Math.abs(distX) < 4 && Math.abs(distY) < 4 && tool !== "text") {
        setDrag({ type: "none" });
        setActiveTool("select");
        return;
      }

      let nodeData: Parameters<typeof createCanvasNode>[2];
      if (tool === "line") {
        nodeData = {
          label: "",
          x: maybeSnap(startCX), y: maybeSnap(startCY),
          x2: maybeSnap(currentCX), y2: maybeSnap(currentCY),
          width: 1, height: 1,
          objectType: "line",
          strokeWidth: 2,
        };
      } else if (tool === "text") {
        nodeData = {
          label: "",
          x: maybeSnap(startCX), y: maybeSnap(startCY),
          width: 200, height: 40,
          objectType: "text",
        };
      } else {
        const x = maybeSnap(Math.min(startCX, currentCX));
        const y = maybeSnap(Math.min(startCY, currentCY));
        const w = Math.max(MIN_SIZE, maybeSnap(Math.abs(distX)));
        const h = Math.max(MIN_SIZE, maybeSnap(Math.abs(distY)));
        nodeData = {
          label: "",
          x, y,
          width: w, height: h,
          objectType: tool as CanvasObjectType,
          fillColor: "#e8f0fe",
          strokeWidth: 1,
        };
      }

      const node = await createCanvasNode(householdId, canvasId, nodeData);
      const newNodes = [...nodes, node];
      setNodes(newNodes);
      pushHistory(newNodes, edges);
      setSelectedIds(new Set([node.id]));
      if (tool === "text") setEditingNodeId(node.id);
      setActiveTool("select");
    } else if (drag.type === "resize") {
      const n = nodeMap.get(drag.nodeId);
      if (n) {
        const update: Partial<IdeaCanvasNode> = { x: n.x, y: n.y, width: n.width, height: n.height, x2: n.x2, y2: n.y2 };
        pendingNodeUpdates.current.set(drag.nodeId, update);
        pushHistory(nodes, edges);
        scheduleSyncPositions();
      }
    } else if (drag.type === "wall") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len >= 4) {
        // Snap wall angle
        const snapped = snapWallAngle(dx, dy, drag.shiftKey);
        const ex = maybeSnap(startCX + snapped.dx);
        const ey = maybeSnap(startCY + snapped.dy);
        const angle = Math.atan2(snapped.dy, snapped.dx) * (180 / Math.PI);
        const node = await createCanvasNode(householdId, canvasId, {
          label: "",
          x: maybeSnap(startCX), y: maybeSnap(startCY),
          x2: ex, y2: ey,
          width: 1, height: 1,
          objectType: "wall",
          strokeWidth: 6,
          strokeColor: "#374151",
          wallAngle: angle,
        });
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
        // Continue chain from this wall's endpoint
        wallChainStartRef.current = { cx: ex, cy: ey };
      }
    } else if (drag.type === "measure") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      if (Math.sqrt(dx * dx + dy * dy) >= 4) {
        const node = await createCanvasNode(householdId, canvasId, {
          label: "",
          x: startCX, y: startCY,
          x2: endCX, y2: endCY,
          width: 1, height: 1,
          objectType: "dimension",
          strokeColor: "#6366f1",
          strokeWidth: 1,
          pointAx: startCX, pointAy: startCY,
          pointBx: endCX, pointBy: endCY,
        });
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
        setActiveTool("select");
      }
    }
    setDrag({ type: "none" });
  }, [drag, zoom, panX, panY, scheduleViewportSync, nodes, edges, nodeMap, maybeSnap, pushHistory, householdId, canvasId, scheduleSyncPositions]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // Scroll wheel and two-finger swipe both zoom toward the cursor position
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;
    // Canvas-space point under mouse — stays fixed after zoom
    const canvasX = mouseScreenX / zoom - panX;
    const canvasY = mouseScreenY / zoom - panY;
    const clampedDelta = Math.max(-50, Math.min(50, e.deltaY));
    const factor = Math.exp(-clampedDelta * 0.008);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    const newPanX = mouseScreenX / newZoom - canvasX;
    const newPanY = mouseScreenY / newZoom - canvasY;
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
    scheduleViewportSync(newZoom, newPanX, newPanY);
  }, [zoom, panX, panY, scheduleViewportSync]);

  // ─── Node interactions ───────────────────────────────────────────────────

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;

    setContextMenu(null);
    if (drag.type === "edge") return;

    setSelectedEdgeId(null);

    if (activeTool === "edge" || drag.type === "edge") return;

    let newSelectedIds: Set<string>;
    if (e.shiftKey) {
      newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(nodeId)) newSelectedIds.delete(nodeId);
      else newSelectedIds.add(nodeId);
      setSelectedIds(newSelectedIds);
    } else {
      if (!selectedIds.has(nodeId)) {
        newSelectedIds = new Set([nodeId]);
        setSelectedIds(newSelectedIds);
      } else {
        newSelectedIds = new Set(selectedIds);
      }
    }

    const ids = Array.from(newSelectedIds);
    const startPositions: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      const n = nodeMap.get(id);
      if (n) startPositions[id] = { x: n.x, y: n.y };
    }

    setDrag({
      type: "node",
      nodeIds: ids,
      startX: e.clientX,
      startY: e.clientY,
      startPositions,
    });
  }, [nodeMap, drag.type, activeTool, selectedIds]);

  const handleNodeMouseUp = useCallback(async (nodeId: string) => {
    if (drag.type === "edge" && drag.sourceNodeId !== nodeId) {
      try {
        const edge = await createCanvasEdge(householdId, canvasId, {
          sourceNodeId: drag.sourceNodeId,
          targetNodeId: nodeId,
        });
        const newEdges = [...edges, edge];
        setEdges(newEdges);
        pushHistory(nodes, newEdges);
      } catch {
        // ignore (e.g. self-loop or non-flowchart node rejected by API)
      }
      setDrag({ type: "none" });
    }
  }, [drag, householdId, canvasId, edges, nodes, pushHistory]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Clamp menu to viewport
    const menuW = 180;
    const menuH = 200;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setContextMenu({ x, y, nodeId });
    if (!selectedIds.has(nodeId)) setSelectedIds(new Set([nodeId]));
  }, [selectedIds]);

  // ─── Resize handle interactions ──────────────────────────────────────────

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, nodeId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const cp = screenToCanvas(e.clientX, e.clientY);
    setDrag({
      type: "resize",
      nodeId,
      handle,
      startBounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      startX2: node.x2,
      startY2: node.y2,
      startMouseCX: cp.x,
      startMouseCY: cp.y,
    });
  }, [nodeMap, screenToCanvas]);

  // ─── Edge interactions ───────────────────────────────────────────────────

  const handleEdgeClick = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedIds(new Set());
    setContextMenu(null);
  }, []);

  const handleEdgeDoubleClick = useCallback((edgeId: string) => {
    setEditingEdgeId(edgeId);
  }, []);

  // ─── CRUD operations ────────────────────────────────────────────────────

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size > 0) {
      await Promise.all(Array.from(selectedIds).map((id) => deleteCanvasNode(householdId, canvasId, id)));
      const newNodes = nodes.filter((n) => !selectedIds.has(n.id));
      const newEdges = edges.filter((e) => !selectedIds.has(e.sourceNodeId) && !selectedIds.has(e.targetNodeId));
      setNodes(newNodes);
      setEdges(newEdges);
      pushHistory(newNodes, newEdges);
      setSelectedIds(new Set());
    } else if (selectedEdgeId) {
      await deleteCanvasEdge(householdId, canvasId, selectedEdgeId);
      const newEdges = edges.filter((e) => e.id !== selectedEdgeId);
      setEdges(newEdges);
      pushHistory(nodes, newEdges);
      setSelectedEdgeId(null);
    }
  }, [selectedIds, selectedEdgeId, householdId, canvasId, nodes, edges, pushHistory]);

  const handleStartEdge = useCallback(() => {
    const firstId = Array.from(selectedIds)[0];
    if (!firstId) return;
    const n = nodeMap.get(firstId);
    if (!n || n.objectType !== "flowchart") return;
    const center = getNodeCenter(n);
    setDrag({ type: "edge", sourceNodeId: firstId, mouseX: 0, mouseY: 0 });
  }, [selectedIds, nodeMap]);

  const handleChangeColor = useCallback(async (color: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { color })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, color } : n));
  }, [selectedIds, householdId, canvasId]);

  const handleChangeFillColor = useCallback(async (fillColor: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { fillColor })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, fillColor } : n));
  }, [selectedIds, householdId, canvasId]);

  const handleChangeStrokeColor = useCallback(async (strokeColor: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { strokeColor })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, strokeColor } : n));
  }, [selectedIds, householdId, canvasId]);

  const handleChangeStrokeWidth = useCallback(async (strokeWidth: number) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { strokeWidth })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, strokeWidth } : n));
  }, [selectedIds, householdId, canvasId]);

  const handleChangeShape = useCallback(async (shape: CanvasNodeShape) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { shape })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, shape } : n));
  }, [selectedIds, householdId, canvasId]);

  const handleChangeEdgeStyle = useCallback(async (style: CanvasEdgeStyle) => {
    if (!selectedEdgeId) return;
    await updateCanvasEdge(householdId, canvasId, selectedEdgeId, { style });
    setEdges((prev) => prev.map((e) => e.id === selectedEdgeId ? { ...e, style } : e));
  }, [selectedEdgeId, householdId, canvasId]);

  const handleLabelCommit = useCallback(async (nodeId: string, label: string) => {
    await updateCanvasNode(householdId, canvasId, nodeId, { label });
    setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, label } : n));
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

  const handleSaveSettings = useCallback(async (patch: UpdateCanvasSettingsInput) => {
    await updateCanvasSettings(householdId, canvasId, patch);
    setSettings((prev) => ({ ...prev, ...patch }));
    if (patch.showDimensions !== undefined) setShowDimensions(patch.showDimensions);
    setShowSettings(false);
  }, [householdId, canvasId]);

  // Fit viewport so the background image fills the SVG area
  const fitViewportToImage = useCallback((imgW: number, imgH: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const padding = 48;
    const newZoom = Math.min(
      (rect.width - padding * 2) / imgW,
      (rect.height - padding * 2) / imgH,
      2,
    );
    const newPanX = (rect.width / newZoom - imgW) / 2;
    const newPanY = (rect.height / newZoom - imgH) / 2;
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
    scheduleViewportSync(newZoom, newPanX, newPanY);
  }, [scheduleViewportSync]);

  // Load image dimensions from a URL into state
  const loadImageDims = useCallback((url: string) => {
    const img = new Image();
    img.onload = () => setBgImageDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, []);

  // Resolve the stored background image URL (may be an attachment reference)
  const resolveBackgroundUrl = useCallback(async (raw: string | null | undefined) => {
    if (!raw) { setResolvedBgUrl(null); return; }
    if (raw.startsWith("attachment:")) {
      const attachmentId = raw.slice("attachment:".length);
      try {
        const { url } = await getAttachmentDownloadUrl(householdId, attachmentId);
        setResolvedBgUrl(url);
        loadImageDims(url);
      } catch { setResolvedBgUrl(null); }
    } else {
      setResolvedBgUrl(raw);
      loadImageDims(raw);
    }
  }, [householdId, loadImageDims]);

  // On mount, resolve whatever is stored
  useEffect(() => {
    void resolveBackgroundUrl(settings.backgroundImageUrl);
    // Resolve any image object node URLs
    for (const n of initialCanvas.nodes) {
      if ((n.objectType === "image" || n.objectType === "object") && n.imageUrl) {
        void (async () => {
          if (!n.imageUrl) return;
          if (n.imageUrl.startsWith("attachment:")) {
            const id = n.imageUrl.slice("attachment:".length);
            try {
              const { url } = await getAttachmentDownloadUrl(householdId, id);
              setNodeImageUrls((prev) => new Map(prev).set(n.id, url));
            } catch { /* leave blank */ }
          } else {
            setNodeImageUrls((prev) => new Map(prev).set(n.id, n.imageUrl!));
          }
        })();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBgImageUpload = useCallback(async (file: File) => {
    setBgUploading(true);
    setBgUploadError(null);
    try {
      // Read natural dimensions from the local file
      const localUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(localUrl); };
        img.onerror = () => { resolve({ w: 1920, h: 1080 }); URL.revokeObjectURL(localUrl); };
        img.src = localUrl;
      });

      // Step 1: request presigned upload URL
      const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
        entityType: "canvas",
        entityId: canvasId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // Step 2: PUT the file directly to storage
      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}). Check that storage is running.`);

      // Step 3: confirm upload
      await confirmAttachmentUpload(householdId, attachment.id);

      // Step 4: get a fresh download URL
      const { url: downloadUrl } = await getAttachmentDownloadUrl(householdId, attachment.id);

      // Step 5: save — store attachment reference so we can refresh the URL on reload
      const newSettings: UpdateCanvasSettingsInput = {
        ...settings,
        backgroundImageUrl: `attachment:${attachment.id}`,
      };
      await updateCanvasSettings(householdId, canvasId, newSettings);
      setSettings(newSettings);
      setResolvedBgUrl(downloadUrl);
      setBgImageDims(dims);
      fitViewportToImage(dims.w, dims.h);
    } catch (err) {
      setBgUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBgUploading(false);
    }
  }, [householdId, canvasId, settings, fitViewportToImage]);

  const handleRemoveBgImage = useCallback(async () => {
    const newSettings: UpdateCanvasSettingsInput = { ...settings, backgroundImageUrl: null };
    await updateCanvasSettings(householdId, canvasId, newSettings);
    setSettings(newSettings);
    setResolvedBgUrl(null);
    setBgImageDims(null);
  }, [householdId, canvasId, settings]);

  // ─── Image object upload ──────────────────────────────────────────────────

  const handleImageObjectUpload = useCallback(async (file: File) => {
    setImgObjUploading(true);
    setImgObjUploadError(null);
    try {
      // Determine image dimensions from file
      const localUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(localUrl); };
        img.onerror = () => { resolve({ w: 200, h: 200 }); URL.revokeObjectURL(localUrl); };
        img.src = localUrl;
      });

      // Upload via attachment system
      const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
        entityType: "canvas",
        entityId: canvasId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });
      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}). Check that storage is running.`);
      await confirmAttachmentUpload(householdId, attachment.id);
      const { url: downloadUrl } = await getAttachmentDownloadUrl(householdId, attachment.id);

      // Place image node centered in current viewport
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      const viewCX = rect ? rect.width / 2 / zoom - panX : 200;
      const viewCY = rect ? rect.height / 2 / zoom - panY : 200;

      // Scale to fit within 600px max while preserving aspect ratio
      const maxDim = 600;
      const scale = Math.min(1, maxDim / Math.max(dims.w, dims.h));
      const w = Math.round(dims.w * scale);
      const h = Math.round(dims.h * scale);
      const x = maybeSnap(viewCX - w / 2);
      const y = maybeSnap(viewCY - h / 2);

      const node = await createCanvasNode(householdId, canvasId, {
        label: file.name.replace(/\.[^.]+$/, ""),
        x, y, width: w, height: h,
        objectType: "image",
        imageUrl: `attachment:${attachment.id}`,
        strokeWidth: 1,
      });

      setNodeImageUrls((prev) => new Map(prev).set(node.id, downloadUrl));
      const newNodes = [...nodes, node];
      setNodes(newNodes);
      pushHistory(newNodes, edges);
      setSelectedIds(new Set([node.id]));
      setActiveTool("select");
    } catch (err) {
      setImgObjUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setImgObjUploading(false);
    }
  }, [householdId, canvasId, zoom, panX, panY, nodes, edges, maybeSnap, pushHistory]);

  // ─── Place object from library / preset ───────────────────────────────────

  const handlePlaceObject = useCallback(async (placement: CanvasObjectPlacement) => {
    setObjectPickerOpen(false);
    setActiveTool("select");

    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const viewCX = rect ? rect.width / 2 / zoom - panX : 300;
    const viewCY = rect ? rect.height / 2 / zoom - panY : 200;

    let imageUrl: string;
    let resolvedUrl: string;
    let defaultWidth: number;
    let defaultHeight: number;
    let maskJson: string | undefined;

    if (placement.source === "preset") {
      const { preset } = placement;
      imageUrl = preset.svgPath;
      resolvedUrl = preset.svgPath;
      defaultWidth = preset.defaultWidth;
      defaultHeight = preset.defaultHeight;
    } else {
      const { object, resolvedUrl: ru } = placement;
      imageUrl = object.attachmentId ? `attachment:${object.attachmentId}` : ru;
      resolvedUrl = ru;
      defaultWidth = 160;
      defaultHeight = 160;
      maskJson = object.maskData ?? undefined;
    }

    const x = maybeSnap(viewCX - defaultWidth / 2);
    const y = maybeSnap(viewCY - defaultHeight / 2);

    const node = await createCanvasNode(householdId, canvasId, {
      label: placement.source === "preset" ? placement.preset.label : placement.object.name,
      x, y,
      width: defaultWidth,
      height: defaultHeight,
      objectType: "object",
      imageUrl,
      maskJson,
      strokeWidth: 0,
    });

    setNodeImageUrls((prev) => new Map(prev).set(node.id, resolvedUrl));
    const newNodes = [...nodes, node];
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setSelectedIds(new Set([node.id]));
  }, [householdId, canvasId, zoom, panX, panY, nodes, edges, maybeSnap, pushHistory]);

  // ─── Copy / Paste ─────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    clipboardRef.current = nodes.filter((n) => selectedIds.has(n.id));
  }, [selectedIds, nodes]);

  const handlePaste = useCallback(async () => {
    const clip = clipboardRef.current;
    if (clip.length === 0) return;
    const created = await Promise.all(
      clip.map((n) => createCanvasNode(householdId, canvasId, {
        label: n.label,
        x: n.x + 24, y: n.y + 24,
        x2: n.x2 + 24, y2: n.y2 + 24,
        width: n.width, height: n.height,
        color: n.color ?? undefined,
        strokeColor: n.strokeColor ?? undefined,
        fillColor: n.fillColor ?? undefined,
        strokeWidth: n.strokeWidth,
        shape: n.shape,
        objectType: n.objectType,
      }))
    );
    const newNodes = [...nodes, ...created];
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setSelectedIds(new Set(created.map((n) => n.id)));
  }, [householdId, canvasId, nodes, edges, pushHistory]);

  // ─── Fit to view ─────────────────────────────────────────────────────────

  const handleFitToView = useCallback(() => {
    if (nodes.length === 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.objectType === "line") {
        minX = Math.min(minX, n.x, n.x2); maxX = Math.max(maxX, n.x, n.x2);
        minY = Math.min(minY, n.y, n.y2); maxY = Math.max(maxY, n.y, n.y2);
      } else {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
      }
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
      if (editingNodeId || editingEdgeId || editingName || showSettings) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        handlePaste();
      } else if (e.key === "Escape") {
        setDrag({ type: "none" });
        setActiveTool("select");
        setEditingNodeId(null);
        setEditingEdgeId(null);
        wallChainStartRef.current = null; // cancel wall chain
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedIds(new Set(nodes.map((n) => n.id)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingNodeId, editingEdgeId, editingName, showSettings, handleDeleteSelected, undo, redo, handleCopy, handlePaste, nodes]);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const singleSelected = selectedIds.size === 1 ? nodeMap.get(Array.from(selectedIds)[0]) : undefined;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;
  const allFlowchartSelected = singleSelected?.objectType === "flowchart";

  // Grid lines — always visible, adaptive to zoom so screen spacing stays ~60px
  const gridLines = useMemo(() => {
    // When snap-to-grid is on, use the snap size; otherwise pick a nice power-of-10 step
    let step: number;
    if (settings.snapToGrid && settings.gridSize) {
      step = settings.gridSize;
    } else {
      const rawTarget = 60 / zoom;
      const exp = Math.floor(Math.log10(Math.max(rawTarget, 0.001)));
      const base = Math.pow(10, exp);
      const r = rawTarget / base;
      if (r < 1.5) step = base;
      else if (r < 3.5) step = base * 2;
      else if (r < 7.5) step = base * 5;
      else step = base * 10;
    }
    const majorStep = step * 5;
    // Visible canvas bounds (generous viewport estimate)
    const halfW = 1800 / zoom;
    const halfH = 1200 / zoom;
    const cx = -panX;
    const cy = -panY;
    const xStart = Math.floor((cx - halfW) / step) * step;
    const xEnd = Math.ceil((cx + halfW) / step) * step;
    const yStart = Math.floor((cy - halfH) / step) * step;
    const yEnd = Math.ceil((cy + halfH) / step) * step;
    const minor: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const major: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let x = xStart; x <= xEnd; x += step) {
      const isMajor = Math.abs(Math.round(x / majorStep) * majorStep - x) < step * 0.001;
      (isMajor ? major : minor).push({ x1: x, y1: yStart, x2: x, y2: yEnd });
    }
    for (let y = yStart; y <= yEnd; y += step) {
      const isMajor = Math.abs(Math.round(y / majorStep) * majorStep - y) < step * 0.001;
      (isMajor ? major : minor).push({ x1: xStart, y1: y, x2: xEnd, y2: y });
    }
    return { minor, major };
  }, [zoom, panX, panY, settings.snapToGrid, settings.gridSize]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderResizeHandles = (node: IdeaCanvasNode) => {
    const H = 8;
    const half = H / 2;

    if (node.objectType === "line") {
      return (
        <>
          <rect x={node.x - half} y={node.y - half} width={H} height={H}
            className="canvas-resize-handle"
            onMouseDown={(e) => handleResizeMouseDown(e, node.id, "line-start")} />
          <rect x={node.x2 - half} y={node.y2 - half} width={H} height={H}
            className="canvas-resize-handle"
            onMouseDown={(e) => handleResizeMouseDown(e, node.id, "line-end")} />
        </>
      );
    }

    const { x, y, width: w, height: h } = node;
    const handles: { handle: ResizeHandle; cx: number; cy: number }[] = [
      { handle: "nw", cx: x, cy: y },
      { handle: "n", cx: x + w / 2, cy: y },
      { handle: "ne", cx: x + w, cy: y },
      { handle: "e", cx: x + w, cy: y + h / 2 },
      { handle: "se", cx: x + w, cy: y + h },
      { handle: "s", cx: x + w / 2, cy: y + h },
      { handle: "sw", cx: x, cy: y + h },
      { handle: "w", cx: x, cy: y + h / 2 },
    ];
    return (
      <>
        {handles.map(({ handle, cx, cy }) => (
          <rect
            key={handle}
            x={cx - half} y={cy - half}
            width={H} height={H}
            className="canvas-resize-handle"
            onMouseDown={(e) => handleResizeMouseDown(e, node.id, handle)}
          />
        ))}
      </>
    );
  };

  const renderNode = (node: IdeaCanvasNode) => {
    const isSelected = selectedIds.has(node.id);
    const isEditing = node.id === editingNodeId;
    const linkedEntry = node.entryId ? entryMap.get(node.entryId) : undefined;
    const selStroke = "var(--accent)";
    const defaultStroke = node.strokeColor ?? "#475569";
    const stroke = isSelected ? selStroke : defaultStroke;
    const sw = isSelected ? 2.5 : (node.strokeWidth ?? 1.5);
    const cursor = drag.type === "edge" ? "crosshair" : "grab";

    const nodeEvents = {
      onMouseDown: (e: React.MouseEvent) => handleNodeMouseDown(e, node.id),
      onMouseUp: () => handleNodeMouseUp(node.id),
      onDoubleClick: () => handleNodeDoubleClick(node.id),
      onContextMenu: (e: React.MouseEvent) => handleNodeContextMenu(e, node.id),
    };

    if (node.objectType === "image") {
      const imgUrl = nodeImageUrls.get(node.id);
      return (
        <g key={node.id}>
          {imgUrl ? (
            <image href={imgUrl}
              x={node.x} y={node.y} width={node.width} height={node.height}
              preserveAspectRatio="xMidYMid meet"
              style={{ cursor }} {...nodeEvents} />
          ) : (
            <rect x={node.x} y={node.y} width={node.width} height={node.height}
              fill="#f0f4f8" stroke={stroke} strokeWidth={sw}
              style={{ cursor }} {...nodeEvents} />
          )}
          {/* Selection outline */}
          {isSelected ? (
            <rect x={node.x} y={node.y} width={node.width} height={node.height}
              fill="none" stroke="var(--accent)" strokeWidth={2}
              pointerEvents="none" />
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "object") {
      const imgUrl = nodeImageUrls.get(node.id);
      // Parse maskJson to build a clip path if present
      let clipId: string | null = null;
      let clipPathEl: JSX.Element | null = null;
      if (node.maskJson) {
        try {
          const mask = JSON.parse(node.maskJson) as
            | { type: "crop"; x: number; y: number; w: number; h: number }
            | { type: "polygon"; points: { x: number; y: number }[] };
          clipId = `clip-${node.id}`;
          if (mask.type === "crop") {
            const cx = node.x + mask.x * node.width;
            const cy = node.y + mask.y * node.height;
            const cw = mask.w * node.width;
            const ch = mask.h * node.height;
            clipPathEl = (
              <defs key={`defs-${node.id}`}>
                <clipPath id={clipId}>
                  <rect x={cx} y={cy} width={cw} height={ch} />
                </clipPath>
              </defs>
            );
          } else if (mask.type === "polygon") {
            const pts = mask.points
              .map((p) => `${node.x + p.x * node.width},${node.y + p.y * node.height}`)
              .join(" ");
            clipPathEl = (
              <defs key={`defs-${node.id}`}>
                <clipPath id={clipId}>
                  <polygon points={pts} />
                </clipPath>
              </defs>
            );
          }
        } catch {
          clipId = null;
        }
      }
      return (
        <g key={node.id}>
          {clipPathEl}
          {imgUrl ? (
            <image href={imgUrl}
              x={node.x} y={node.y} width={node.width} height={node.height}
              preserveAspectRatio="xMidYMid meet"
              clipPath={clipId ? `url(#${clipId})` : undefined}
              style={{ cursor }} {...nodeEvents} />
          ) : (
            <rect x={node.x} y={node.y} width={node.width} height={node.height}
              fill="#f0f4f8" stroke={stroke} strokeWidth={sw}
              style={{ cursor }} {...nodeEvents} />
          )}
          {isSelected ? (
            <rect x={node.x} y={node.y} width={node.width} height={node.height}
              fill="none" stroke="var(--accent)" strokeWidth={2}
              pointerEvents="none" />
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "line" || node.objectType === "wall") {
      const isWall = node.objectType === "wall";
      const wallSW = isWall ? ((node.strokeWidth ?? 6) * (isSelected ? 1.3 : 1)) : sw;
      const wallStroke = isWall ? (isSelected ? selStroke : (node.strokeColor ?? "#374151")) : stroke;
      // Physical length label for walls
      const wallLenLabel = (isWall && pixelsPerUnit && settings.physicalUnit) ? (() => {
        const dx = node.x2 - node.x;
        const dy = node.y2 - node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = (node.x + node.x2) / 2;
        const my = (node.y + node.y2) / 2;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const label = fmtPhysical(len, pixelsPerUnit, settings.physicalUnit!);
        return (
          <text
            x={mx} y={my - 6}
            textAnchor="middle" fontSize={11 / zoom} fill="var(--ink)"
            transform={`rotate(${Math.abs(angle) > 90 ? angle + 180 : angle}, ${mx}, ${my})`}
            pointerEvents="none" style={{ userSelect: "none" }}>
            {label}
          </text>
        );
      })() : null;
      return (
        <g key={node.id}>
          {/* Wide hit area */}
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke="transparent" strokeWidth={Math.max(wallSW * 2, 12)} style={{ cursor }}
            {...nodeEvents} />
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke={wallStroke} strokeWidth={wallSW} strokeLinecap="round"
            pointerEvents="none" />
          {wallLenLabel}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "dimension") {
      const ax = node.pointAx ?? node.x;
      const ay = node.pointAy ?? node.y;
      const bx = node.pointBx ?? node.x2;
      const by = node.pointBy ?? node.y2;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const displayAngle = Math.abs(angle) > 90 ? angle + 180 : angle;
      const label = pixelsPerUnit && settings.physicalUnit
        ? fmtPhysical(len, pixelsPerUnit, settings.physicalUnit)
        : `${Math.round(len)}px`;
      // Perpendicular offset for the label
      const perpX = -dy / len * 10;
      const perpY = dx / len * 10;
      // Arrow tick marks
      const tickLen = 6 / zoom;
      const nx = -dy / len, ny = dx / len;
      return (
        <g key={node.id}>
          {/* Main dim line */}
          <line x1={ax} y1={ay} x2={bx} y2={by}
            stroke={isSelected ? selStroke : "#6366f1"} strokeWidth={1.5 / zoom}
            strokeDasharray={`${4 / zoom},${2 / zoom}`}
            style={{ cursor: "pointer" }} {...nodeEvents} />
          {/* End ticks */}
          <line x1={ax + nx * tickLen} y1={ay + ny * tickLen} x2={ax - nx * tickLen} y2={ay - ny * tickLen}
            stroke={isSelected ? selStroke : "#6366f1"} strokeWidth={1.5 / zoom} pointerEvents="none" />
          <line x1={bx + nx * tickLen} y1={by + ny * tickLen} x2={bx - nx * tickLen} y2={by - ny * tickLen}
            stroke={isSelected ? selStroke : "#6366f1"} strokeWidth={1.5 / zoom} pointerEvents="none" />
          {/* Label */}
          <text x={mx + perpX / zoom} y={my + perpY / zoom}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11 / zoom} fill="#6366f1"
            transform={`rotate(${displayAngle}, ${mx + perpX / zoom}, ${my + perpY / zoom})`}
            pointerEvents="none" style={{ userSelect: "none" }}>
            {label}
          </text>
          {isSelected && (
            <>
              <circle cx={ax} cy={ay} r={4 / zoom} fill={selStroke} pointerEvents="none" />
              <circle cx={bx} cy={by} r={4 / zoom} fill={selStroke} pointerEvents="none" />
            </>
          )}
        </g>
      );
    }

    if (node.objectType === "room") {
      // Room polygon stored in maskJson as { type: "polygon", points: {x,y}[] }
      let pts = "";
      if (node.maskJson) {
        try {
          const mask = JSON.parse(node.maskJson) as { type: string; points: { x: number; y: number }[] };
          if (mask.type === "polygon") pts = mask.points.map((p) => `${p.x},${p.y}`).join(" ");
        } catch { /* no-op */ }
      }
      if (!pts) pts = `${node.x},${node.y} ${node.x + node.width},${node.y} ${node.x + node.width},${node.y + node.height} ${node.x},${node.y + node.height}`;
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      return (
        <g key={node.id}>
          <polygon points={pts}
            fill={node.fillColor ?? "rgba(99,102,241,0.07)"}
            stroke={isSelected ? selStroke : (node.strokeColor ?? "#6366f1")}
            strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
            strokeDasharray={`${4 / zoom},${2 / zoom}`}
            style={{ cursor }} {...nodeEvents} />
          {node.label ? (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize={13 / zoom} fill="var(--ink)"
              pointerEvents="none" style={{ userSelect: "none" }}>
              {node.label}
            </text>
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "circle") {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const rx = node.width / 2;
      const ry = node.height / 2;
      return (
        <g key={node.id}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
            fill={node.fillColor ?? node.color ?? "transparent"}
            stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents} />
          {node.label ? (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize={14} fill="var(--ink)" style={{ pointerEvents: "none", userSelect: "none" }}>
              {node.label}
            </text>
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "text") {
      return (
        <g key={node.id}>
          <rect x={node.x} y={node.y} width={node.width} height={node.height}
            fill={isSelected ? "rgba(var(--accent-rgb, 99,102,241),0.05)" : "transparent"}
            stroke={isSelected ? selStroke : "none"} strokeWidth={sw}
            strokeDasharray={isSelected ? undefined : undefined}
            style={{ cursor }}
            {...nodeEvents} />
          <foreignObject x={node.x + 4} y={node.y + 2} width={node.width - 8} height={node.height - 4}
            pointerEvents={isEditing ? "auto" : "none"}>
            {isEditing ? (
              <textarea
                className="idea-canvas__node-label-input idea-canvas__node-label-input--text"
                defaultValue={node.label}
                autoFocus
                onBlur={(e) => handleLabelCommit(node.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { handleLabelCommit(node.id, (e.target as HTMLTextAreaElement).value); }
                }}
                style={{ width: "100%", height: "100%", resize: "none" }}
              />
            ) : (
              <div className="idea-canvas__text-content">{node.label}</div>
            )}
          </foreignObject>
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "rect") {
      return (
        <g key={node.id}>
          <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={4} ry={4}
            fill={node.fillColor ?? node.color ?? "transparent"}
            stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents} />
          {node.label ? (
            <foreignObject x={node.x + 4} y={node.y + 4} width={node.width - 8} height={node.height - 8}
              pointerEvents="none">
              <div className="idea-canvas__node-content">{node.label}</div>
            </foreignObject>
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    // flowchart (and default)
    const r = getShapeRadius(node.shape as CanvasNodeShape);
    const fillColor = node.fillColor ?? node.color ?? "#f8fafc";

    return (
      <g key={node.id}>
        {node.shape === "diamond" ? (
          <path
            d={`M ${node.x + node.width / 2} ${node.y} L ${node.x + node.width} ${node.y + node.height / 2} L ${node.x + node.width / 2} ${node.y + node.height} L ${node.x} ${node.y + node.height / 2} Z`}
            fill={fillColor} stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents}
          />
        ) : (
          <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={r} ry={r}
            fill={fillColor} stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents} />
        )}
        <foreignObject x={node.x + 4} y={node.y + 4} width={node.width - 8} height={node.height - 8}
          pointerEvents={isEditing ? "auto" : "none"}>
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
        {isSelected && selectedIds.size === 1 && renderResizeHandles(node)}
      </g>
    );
  };

  // ─── Draw preview ─────────────────────────────────────────────────────────

  const renderDrawPreview = () => {
    if (drag.type === "wall") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const len = Math.sqrt(dx * dx + dy * dy);
      return (
        <g>
          <line x1={startCX} y1={startCY} x2={endCX} y2={endCY}
            stroke="#374151" strokeWidth={6} strokeLinecap="round"
            strokeDasharray="8,4" pointerEvents="none" />
          {len > 4 && pixelsPerUnit && settings.physicalUnit ? (
            <text x={(startCX + endCX) / 2} y={(startCY + endCY) / 2 - 8}
              textAnchor="middle" fontSize={11 / zoom} fill="#374151" pointerEvents="none">
              {fmtPhysical(len, pixelsPerUnit, settings.physicalUnit)}
            </text>
          ) : null}
        </g>
      );
    }
    if (drag.type === "measure") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const len = Math.sqrt(dx * dx + dy * dy);
      return (
        <g>
          <line x1={startCX} y1={startCY} x2={endCX} y2={endCY}
            stroke="#6366f1" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom},${2 / zoom}`}
            pointerEvents="none" />
          {len > 4 && pixelsPerUnit && settings.physicalUnit ? (
            <text x={(startCX + endCX) / 2} y={(startCY + endCY) / 2 - 8 / zoom}
              textAnchor="middle" fontSize={11 / zoom} fill="#6366f1" pointerEvents="none">
              {fmtPhysical(len, pixelsPerUnit, settings.physicalUnit)}
            </text>
          ) : null}
          <circle cx={startCX} cy={startCY} r={3 / zoom} fill="#6366f1" pointerEvents="none" />
        </g>
      );
    }
    if (drag.type !== "draw") return null;
    const { tool, startCX, startCY, currentCX, currentCY } = drag;
    if (tool === "line") {
      return <line x1={startCX} y1={startCY} x2={currentCX} y2={currentCY}
        stroke="var(--accent)" strokeWidth={2} strokeDasharray="6,3" pointerEvents="none" />;
    }
    const x = Math.min(startCX, currentCX);
    const y = Math.min(startCY, currentCY);
    const w = Math.abs(currentCX - startCX);
    const h = Math.abs(currentCY - startCY);
    if (w < 2 && h < 2) return null;
    if (tool === "circle") {
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2}
        fill="rgba(99,102,241,0.1)" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6,3" pointerEvents="none" />;
    }
    return <rect x={x} y={y} width={w} height={h} rx={4}
      fill="rgba(99,102,241,0.1)" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6,3" pointerEvents="none" />;
  };

  // ─── Rubber band ─────────────────────────────────────────────────────────

  const renderRubberBand = () => {
    if (drag.type !== "rubber") return null;
    const x = Math.min(drag.startCX, drag.currentCX);
    const y = Math.min(drag.startCY, drag.currentCY);
    const w = Math.abs(drag.currentCX - drag.startCX);
    const h = Math.abs(drag.currentCY - drag.startCY);
    if (w < 2 && h < 2) return null;
    return <rect x={x} y={y} width={w} height={h}
      fill="rgba(99,102,241,0.1)" stroke="var(--accent)" strokeWidth={1} strokeDasharray="4,2" pointerEvents="none" />;
  };

  // ─── Auto parallel-wall dimension overlay (computed, not stored) ──────────

  const renderParallelWallDimensions = () => {
    if (!showDimensions || !pixelsPerUnit || !settings.physicalUnit) return null;
    const walls = nodes.filter((n) => n.objectType === "wall");
    if (walls.length < 2) return null;
    const els: JSX.Element[] = [];
    const ANGLE_THRESH = 8; // degrees
    const OFFSET = 20 / zoom;
    const ARROWLEN = 5 / zoom;
    const FONTSIZE = 10 / zoom;

    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const a = walls[i];
        const b = walls[j];
        const angA = (a.wallAngle ?? Math.atan2(a.y2 - a.y, a.x2 - a.x) * (180 / Math.PI));
        const angB = (b.wallAngle ?? Math.atan2(b.y2 - b.y, b.x2 - b.x) * (180 / Math.PI));
        let diff = Math.abs(angA - angB) % 180;
        if (diff > 90) diff = 180 - diff;
        if (diff > ANGLE_THRESH) continue; // not parallel

        // Compute perpendicular distance between parallel wall midpoints
        const midAx = (a.x + a.x2) / 2;
        const midAy = (a.y + a.y2) / 2;
        const midBx = (b.x + b.x2) / 2;
        const midBy = (b.y + b.y2) / 2;
        const wallAngleRad = angA * (Math.PI / 180);
        const wallDirX = Math.cos(wallAngleRad);
        const wallDirY = Math.sin(wallAngleRad);
        // perpendicular component of (midB - midA)
        const perpDist = Math.abs((midBx - midAx) * (-wallDirY) + (midBy - midAy) * wallDirX);
        if (perpDist < 4) continue; // overlapping

        const perpNx = -wallDirY;
        const perpNy = wallDirX;
        // sign so dimension line goes from A toward B
        const sign = (midBx - midAx) * perpNx + (midBy - midAy) * perpNy >= 0 ? 1 : -1;
        const lx1 = midAx + sign * perpNx * OFFSET;
        const ly1 = midAy + sign * perpNy * OFFSET;
        const lx2 = midAx + sign * perpNx * (OFFSET + perpDist);
        const ly2 = midAy + sign * perpNy * (OFFSET + perpDist);
        const mlx = (lx1 + lx2) / 2;
        const mly = (ly1 + ly2) / 2;
        const label = fmtPhysical(perpDist, pixelsPerUnit, settings.physicalUnit!);
        const displayAngle = angA === 0 ? 90 : (Math.abs(angA) < 45 ? 90 : 0);

        els.push(
          <g key={`pdim-${i}-${j}`} pointerEvents="none">
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
              stroke="#0ea5e9" strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom},${2 / zoom}`} />
            {/* arrowheads */}
            <line x1={lx1 + wallDirX * ARROWLEN} y1={ly1 + wallDirY * ARROWLEN}
              x2={lx1 - wallDirX * ARROWLEN} y2={ly1 - wallDirY * ARROWLEN}
              stroke="#0ea5e9" strokeWidth={1 / zoom} />
            <line x1={lx2 + wallDirX * ARROWLEN} y1={ly2 + wallDirY * ARROWLEN}
              x2={lx2 - wallDirX * ARROWLEN} y2={ly2 - wallDirY * ARROWLEN}
              stroke="#0ea5e9" strokeWidth={1 / zoom} />
            <text x={mlx} y={mly - FONTSIZE * 0.7}
              textAnchor="middle" fontSize={FONTSIZE} fill="#0ea5e9"
              transform={`rotate(${displayAngle}, ${mlx}, ${mly})`}
              style={{ userSelect: "none" }}>
              {label}
            </text>
          </g>
        );
      }
    }
    return <>{els}</>;
  };

  // ─── Ruler overlay (viewport-fixed, outside transform group) ─────────────

  const renderRuler = () => {
    if (!pixelsPerUnit || !settings.physicalUnit) return null;
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgW = rect.width;
    const svgH = rect.height;
    const rulerSize = 20;

    // Decide a nice tick spacing in physical units
    const minTickScreenPx = 40;
    const rawUnitStep = minTickScreenPx / (zoom * pixelsPerUnit);
    const exp = Math.floor(Math.log10(Math.max(rawUnitStep, 0.0001)));
    const base = Math.pow(10, exp);
    let unitStep = base;
    if (rawUnitStep / base > 5) unitStep = base * 10;
    else if (rawUnitStep / base > 2) unitStep = base * 5;
    else if (rawUnitStep / base > 1) unitStep = base * 2;

    const hTicks: JSX.Element[] = [];
    const vTicks: JSX.Element[] = [];

    // Compute visible canvas range
    const canvasLeft = -panX;
    const canvasTop = -panY;
    const canvasRight = canvasLeft + svgW / zoom;
    const canvasBottom = canvasTop + svgH / zoom;

    const firstX = Math.floor(canvasLeft / pixelsPerUnit / unitStep) * unitStep;
    const firstY = Math.floor(canvasTop / pixelsPerUnit / unitStep) * unitStep;

    for (let u = firstX; u * pixelsPerUnit < canvasRight; u += unitStep) {
      const screenX = (u * pixelsPerUnit + panX) * zoom;
      if (screenX < rulerSize || screenX > svgW) continue;
      const isMajor = Math.round(u / (unitStep * 5)) * (unitStep * 5) === Math.round(u * 1000) / 1000;
      hTicks.push(
        <g key={`hx${u}`}>
          <line x1={screenX} y1={isMajor ? 0 : rulerSize / 2} x2={screenX} y2={rulerSize}
            stroke="var(--ink)" strokeWidth={isMajor ? 1 : 0.5} />
          {isMajor ? (
            <text x={screenX + 2} y={rulerSize - 4} fontSize={8} fill="var(--ink)">{u}{settings.physicalUnit}</text>
          ) : null}
        </g>
      );
    }

    for (let u = firstY; u * pixelsPerUnit < canvasBottom; u += unitStep) {
      const screenY = (u * pixelsPerUnit + panY) * zoom;
      if (screenY < rulerSize || screenY > svgH) continue;
      const isMajor = Math.round(u / (unitStep * 5)) * (unitStep * 5) === Math.round(u * 1000) / 1000;
      vTicks.push(
        <g key={`vy${u}`}>
          <line x1={isMajor ? 0 : rulerSize / 2} y1={screenY} x2={rulerSize} y2={screenY}
            stroke="var(--ink)" strokeWidth={isMajor ? 1 : 0.5} />
          {isMajor ? (
            <text x={rulerSize - 2} y={screenY - 3} fontSize={8} fill="var(--ink)"
              transform={`rotate(-90 ${rulerSize - 2} ${screenY - 3})`}>{u}</text>
          ) : null}
        </g>
      );
    }

    return (
      <g className="canvas-ruler" pointerEvents="none">
        {/* Horizontal ruler */}
        <rect x={rulerSize} y={0} width={svgW - rulerSize} height={rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
        {hTicks}
        {/* Vertical ruler */}
        <rect x={0} y={rulerSize} width={rulerSize} height={svgH - rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
        {vTicks}
        {/* Corner box */}
        <rect x={0} y={0} width={rulerSize} height={rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
      </g>
    );
  };

  // ─── Settings panel ───────────────────────────────────────────────────────

  const SettingsPanel = () => {
    const [local, setLocal] = useState<UpdateCanvasSettingsInput>({ ...settings });

    return (
      <div className="idea-canvas__settings-panel">
        <div className="idea-canvas__settings-header">
          <h3>Canvas Settings</h3>
          <button type="button" className="button button--ghost button--small" onClick={() => setShowSettings(false)}>✕</button>
        </div>
        <div className="idea-canvas__settings-body">
          <div className="idea-canvas__settings-row">
            <label>Physical Width</label>
            <input type="number" min={0} step={0.1}
              value={local.physicalWidth ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, physicalWidth: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="e.g. 20" />
          </div>
          <div className="idea-canvas__settings-row">
            <label>Physical Height</label>
            <input type="number" min={0} step={0.1}
              value={local.physicalHeight ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, physicalHeight: e.target.value ? parseFloat(e.target.value) : null }))}
              placeholder="e.g. 15" />
          </div>
          <div className="idea-canvas__settings-row">
            <label>Unit</label>
            <select value={local.physicalUnit ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, physicalUnit: (e.target.value || null) as UpdateCanvasSettingsInput["physicalUnit"] }))}>
              <option value="">None</option>
              {PHYSICAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="idea-canvas__settings-row">
            <label>Snap to Grid</label>
            <input type="checkbox" checked={!!local.snapToGrid}
              onChange={(e) => setLocal((p) => ({ ...p, snapToGrid: e.target.checked }))} />
          </div>
          <div className="idea-canvas__settings-row">
            <label>Grid Size (px)</label>
            <input type="number" min={8} max={200} step={4}
              value={local.gridSize ?? 24}
              onChange={(e) => setLocal((p) => ({ ...p, gridSize: parseInt(e.target.value) || 24 }))} />
          </div>
          {local.physicalUnit ? (
            <>
              <div className="idea-canvas__settings-row">
                <label>Show Dimensions</label>
                <input type="checkbox" checked={!!local.showDimensions}
                  onChange={(e) => setLocal((p) => ({ ...p, showDimensions: e.target.checked }))} />
              </div>
              <div className="idea-canvas__settings-row idea-canvas__settings-row--info">
                <span>Scale: 1 grid square = 1 {local.physicalUnit}</span>
              </div>
            </>
          ) : null}
          <div className="idea-canvas__settings-row idea-canvas__settings-row--full">
            <label>Background Image</label>
            <div className="idea-canvas__bg-image-controls">
              {resolvedBgUrl ? (
                <>
                  <span className="idea-canvas__bg-image-name">
                    {bgImageDims ? `${bgImageDims.w} × ${bgImageDims.h} px` : "Uploaded"}
                  </span>
                  <button type="button" className="button button--ghost button--small"
                    onClick={async () => { await handleRemoveBgImage(); }}>Remove</button>
                  <button type="button" className="button button--ghost button--small"
                    onClick={() => { if (bgImageDims) fitViewportToImage(bgImageDims.w, bgImageDims.h); }}>Fit View</button>
                </>
              ) : (
                <>
                  <label className={`button button--ghost button--small idea-canvas__upload-btn${bgUploading ? " idea-canvas__upload-btn--loading" : ""}`}>
                    {bgUploading ? "Uploading…" : "Upload Image"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      disabled={bgUploading}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) await handleBgImageUpload(f);
                        e.target.value = "";
                      }} />
                  </label>
                  <span className="idea-canvas__bg-image-hint">PNG, JPG, WebP up to 50 MB</span>
                  {bgUploadError ? (
                    <span className="idea-canvas__upload-error" title={bgUploadError}>⚠️ {bgUploadError}</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="idea-canvas__settings-footer">
          <button type="button" className="button button--ghost button--small" onClick={() => setShowSettings(false)}>Cancel</button>
          <button type="button" className="button button--primary button--small" onClick={() => handleSaveSettings(local)}>Save</button>
        </div>
      </div>
    );
  };

  // ─── Physical scale label ─────────────────────────────────────────────────

  const renderScaleLabels = () => {
    if (!settings.physicalWidth || !settings.physicalUnit || !settings.gridSize) return null;
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // We estimate canvas width from the actual SVG bounding box at zoom=1
    const canvasWidthInPx = rect.width / zoom;
    const pxPerUnit = canvasWidthInPx / settings.physicalWidth;
    const unitStep = Math.pow(10, Math.floor(Math.log10(settings.physicalWidth / 5)));
    const steps = Math.floor(settings.physicalWidth / unitStep);
    const labels = [];
    for (let i = 0; i <= steps; i++) {
      const canvasX = -panX + (i * unitStep * pxPerUnit);
      labels.push(
        <text key={i} x={canvasX} y={-panY + 12} fontSize={10} fill="var(--ink-muted, #888)"
          textAnchor="middle" pointerEvents="none">
          {i * unitStep}{settings.physicalUnit}
        </text>
      );
    }
    return <>{labels}</>;
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const svgCursor = drag.type === "pan" ? "grabbing"
    : activeTool === "pan" ? "grab"
    : drag.type === "edge" || drag.type === "wall" || drag.type === "measure"
      || ["rect", "circle", "line", "text", "node", "wall", "measure"].includes(activeTool) ? "crosshair"
    : "default";

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
          <h2 className="idea-canvas__name" onDoubleClick={() => setEditingName(true)} title="Double-click to rename">
            {canvasName}
          </h2>
        )}
      </div>

      {/* Toolbar */}
      <div className="idea-canvas__toolbar">
        {/* Tool group */}
        <div className="idea-canvas__tool-group">
          <button type="button"
            className={`idea-canvas__tool-btn${activeTool === "select" ? " idea-canvas__tool-btn--active" : ""}`}
            onClick={() => setActiveTool("select")} title="Select / drag (S)">
            ▲ Select
          </button>
          <button type="button"
            className={`idea-canvas__tool-btn${activeTool === "pan" ? " idea-canvas__tool-btn--active" : ""}`}
            onClick={() => setActiveTool("pan")} title="Pan canvas (hold Alt)">
            ✋ Pan
          </button>
        </div>
        <div className="idea-canvas__toolbar-divider" />
        {/* Shape tools — diagram mode */}
        {canvasMode !== "floorplan" ? (
          <div className="idea-canvas__tool-group">
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "node" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("node")} title="Add flowchart node">
              ☐ Node
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "rect" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("rect")} title="Draw rectangle">
              ▭ Rect
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "circle" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("circle")} title="Draw circle/ellipse">
              ◯ Circle
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "line" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("line")} title="Draw line">
              ╱ Line
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "text" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("text")} title="Add text">
              T Text
            </button>
          </div>
        ) : null}
        {/* Floorplan tools */}
        {canvasMode === "floorplan" ? (
          <div className="idea-canvas__tool-group">
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "wall" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => { setActiveTool("wall"); }}
              title="Draw wall (chain drawing, Enter to finish, Esc to cancel)">
              ⊟ Wall
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "measure" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("measure")}
              title="Add manual dimension annotation">
              ↔ Measure
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "text" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("text")} title="Add text label">
              T Label
            </button>
            <button type="button"
              className={`idea-canvas__tool-btn${activeTool === "rect" ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={() => setActiveTool("rect")} title="Draw room/space rectangle">
              ▭ Room
            </button>
          </div>
        ) : null}
        <div className="idea-canvas__toolbar-divider" />
        {/* Object library button */}
        <button type="button"
          className={`idea-canvas__tool-btn${activeTool === "object" || objectPickerOpen ? " idea-canvas__tool-btn--active" : ""}`}
          title="Place object from library"
          onClick={() => { setActiveTool("object"); setObjectPickerOpen((v) => !v); }}>
          🧩 Object
        </button>
        <div className="idea-canvas__toolbar-divider" />
        {/* Connect (only when a flowchart node selected) */}
        {allFlowchartSelected ? (
          <button type="button" className="idea-canvas__tool-btn" onClick={handleStartEdge} title="Draw edge">
            ↗ Connect
          </button>
        ) : null}
        {/* Selection-specific controls */}
        {singleSelected ? (
          <>
            {singleSelected.objectType === "flowchart" ? (
              <>
                <select className="idea-canvas__tool-select"
                  value={singleSelected.color ?? ""}
                  onChange={(e) => handleChangeColor(e.target.value || null)} title="Fill color">
                  {NODE_COLORS.map((c) => (
                    <option key={c.value ?? ""} value={c.value ?? ""}>{c.label}</option>
                  ))}
                </select>
                <select className="idea-canvas__tool-select"
                  value={singleSelected.shape ?? "rectangle"}
                  onChange={(e) => handleChangeShape(e.target.value as CanvasNodeShape)} title="Shape">
                  {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            ) : singleSelected.objectType !== "line" ? (
              <input type="color" className="idea-canvas__color-picker"
                value={singleSelected.fillColor ?? "#e8f0fe"}
                onChange={(e) => handleChangeFillColor(e.target.value)}
                title="Fill color" />
            ) : null}
            {singleSelected.objectType !== "text" && singleSelected.objectType !== "flowchart" ? (
              <>
                <input type="color" className="idea-canvas__color-picker"
                  value={singleSelected.strokeColor ?? "#555555"}
                  onChange={(e) => handleChangeStrokeColor(e.target.value)}
                  title="Stroke color" />
                <select className="idea-canvas__tool-select"
                  value={singleSelected.strokeWidth ?? 1}
                  onChange={(e) => handleChangeStrokeWidth(parseInt(e.target.value))} title="Stroke width">
                  {[1, 2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w}px</option>)}
                </select>
              </>
            ) : null}
          </>
        ) : null}
        {selectedEdgeId ? (
          <select className="idea-canvas__tool-select"
            value={selectedEdge?.style ?? "solid"}
            onChange={(e) => handleChangeEdgeStyle(e.target.value as CanvasEdgeStyle)} title="Edge style">
            {EDGE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : null}
        {(selectedIds.size > 0 || selectedEdgeId) ? (
          <button type="button" className="idea-canvas__tool-btn idea-canvas__tool-btn--danger"
            onClick={handleDeleteSelected} title="Delete selected (Del)">
            🗑 Delete
          </button>
        ) : null}
        <div className="idea-canvas__toolbar-spacer" />
        {/* Undo / Redo */}
        <button type="button" className="idea-canvas__tool-btn" onClick={undo} title="Undo (Ctrl+Z)">↩</button>
        <button type="button" className="idea-canvas__tool-btn" onClick={redo} title="Redo (Ctrl+Y)">↪</button>
        <div className="idea-canvas__toolbar-divider" />
        {/* Zoom controls */}
        <button type="button" className="idea-canvas__tool-btn" onClick={() => {
          const next = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
          setZoom(next); scheduleViewportSync(next, panX, panY);
        }} title="Zoom out">−</button>
        <span className="idea-canvas__zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" className="idea-canvas__tool-btn" onClick={() => {
          const next = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
          setZoom(next); scheduleViewportSync(next, panX, panY);
        }} title="Zoom in">+</button>
        <button type="button" className="idea-canvas__tool-btn" onClick={handleFitToView} title="Fit all to view">Fit</button>
        <div className="idea-canvas__toolbar-divider" />
        <button type="button" className={`idea-canvas__tool-btn${showSettings ? " idea-canvas__tool-btn--active" : ""}`}
          onClick={() => setShowSettings((v) => !v)} title="Canvas settings">
          ⚙
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
        style={{ cursor: svgCursor }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--ink-muted, #888)" />
          </marker>
          <marker id="arrowhead-accent" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)" />
          </marker>
        </defs>

        <g transform={`scale(${zoom}) translate(${panX}, ${panY})`}>
          {/* Background */}
          <rect className="canvas-bg" x={-50000} y={-50000} width={100000} height={100000} fill="transparent" />

          {/* Grid — always rendered, scales with canvas */}
          {gridLines.minor.map((l, i) => (
            <line key={`gm${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#b8c4ce" strokeWidth={0.5 / zoom}
              className="canvas-grid-line" pointerEvents="none" />
          ))}
          {gridLines.major.map((l, i) => (
            <line key={`gM${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#6e8098" strokeWidth={1 / zoom}
              className="canvas-grid-line" pointerEvents="none" />
          ))}

          {/* Background image — rendered at canvas origin with natural pixel dimensions */}
          {resolvedBgUrl ? (
            <image href={resolvedBgUrl}
              x={0} y={0}
              width={bgImageDims?.w ?? 1920} height={bgImageDims?.h ?? 1080}
              opacity={0.5} pointerEvents="none" preserveAspectRatio="none" />
          ) : null}

          {/* Scale labels */}
          {renderScaleLabels()}

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
                <path d={path} fill="none" stroke="transparent" strokeWidth={12}
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                  onDoubleClick={() => handleEdgeDoubleClick(edge.id)}
                  style={{ cursor: "pointer" }} />
                <path d={path} fill="none"
                  stroke={isSelected ? "var(--accent)" : "var(--ink-muted, #888)"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  strokeDasharray={strokeDasharray(edge.style as CanvasEdgeStyle)}
                  markerEnd={isSelected ? "url(#arrowhead-accent)" : "url(#arrowhead)"}
                  pointerEvents="none" />
                {edge.label || editingEdgeId === edge.id ? (
                  <foreignObject x={(a.sx + a.tx) / 2 - 50} y={(a.sy + a.ty) / 2 - 12} width={100} height={24}>
                    {editingEdgeId === edge.id ? (
                      <input className="idea-canvas__edge-label-input"
                        defaultValue={edge.label ?? ""}
                        autoFocus
                        onBlur={(e) => handleEdgeLabelCommit(edge.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEdgeLabelCommit(edge.id, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setEditingEdgeId(null);
                        }} />
                    ) : (
                      <span className="idea-canvas__edge-label">{edge.label}</span>
                    )}
                  </foreignObject>
                ) : null}
              </g>
            );
          })}

          {/* In-progress edge */}
          {drag.type === "edge" && drag.mouseX !== 0 ? (() => {
            const source = nodeMap.get(drag.sourceNodeId);
            if (!source) return null;
            const sc = getNodeCenter(source);
            const target = screenToCanvas(drag.mouseX, drag.mouseY);
            return (
              <path d={bezierPath(sc.cx, sc.cy, target.x, target.y)}
                fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6,3"
                pointerEvents="none" />
            );
          })() : null}

          {/* Nodes */}
          {nodes.map(renderNode)}

          {/* Draw preview */}
          {renderDrawPreview()}

          {/* Auto parallel-wall dimension overlay */}
          {renderParallelWallDimensions()}

          {/* Rubber band */}
          {renderRubberBand()}
        </g>

        {/* Ruler strips — outside zoom group, fixed to viewport */}
        {renderRuler()}
      </svg>

      {/* Settings panel */}
      {showSettings ? <SettingsPanel /> : null}

      {/* Context menu */}
      {contextMenu ? (
        <>
          <div className="idea-canvas__context-backdrop" onClick={() => setContextMenu(null)} />
          <div className="idea-canvas__context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" onClick={() => { handleNodeDoubleClick(contextMenu.nodeId); setContextMenu(null); }}>
              Edit Label
            </button>
            {nodeMap.get(contextMenu.nodeId)?.objectType === "flowchart" ? (
              <button type="button" onClick={() => { setShowNotePicker(contextMenu.nodeId); setContextMenu(null); }}>
                Link to Note
              </button>
            ) : null}
            {nodeMap.get(contextMenu.nodeId)?.entryId ? (
              <>
                <button type="button" onClick={() => {
                  const entry = nodeMap.get(contextMenu.nodeId)?.entryId;
                  if (entry && onNavigateToNote) onNavigateToNote(entry);
                  setContextMenu(null);
                }}>Go to Note</button>
                <button type="button" onClick={() => { handleLinkNote(contextMenu.nodeId, null); }}>
                  Unlink Note
                </button>
              </>
            ) : null}
            {nodeMap.get(contextMenu.nodeId)?.objectType === "flowchart" ? (
              <button type="button" onClick={() => {
                setSelectedIds(new Set([contextMenu.nodeId]));
                handleStartEdge();
                setContextMenu(null);
              }}>Draw Edge From Here</button>
            ) : null}
            <button type="button" onClick={() => {
              setSelectedIds(new Set([contextMenu.nodeId]));
              handleCopy();
              setContextMenu(null);
            }}>Copy</button>
            <button type="button" className="idea-canvas__context-danger" onClick={() => {
              setSelectedIds(new Set([contextMenu.nodeId]));
              handleDeleteSelected();
              setContextMenu(null);
            }}>Delete</button>
          </div>
        </>
      ) : null}

      {/* Note picker */}
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

      {/* Hints */}
      {drag.type === "edge" ? (
        <div className="idea-canvas__hint">Click a target node to connect, or press Esc to cancel.</div>
      ) : activeTool !== "select" && activeTool !== "pan" && activeTool !== "object" ? (
        <div className="idea-canvas__hint">
          {activeTool === "wall"
            ? (wallChainStartRef.current
                ? "Click to continue wall chain. Enter to finish chain. Esc to cancel. Hold Shift for 45° angles."
                : "Click where the wall starts.")
            : activeTool === "measure"
              ? "Click and drag to add a dimension annotation."
              : activeTool === "node" ? "Click to place a flowchart node."
              : activeTool === "line" ? "Click and drag to draw a line."
              : activeTool === "text" ? "Click to place a text box."
              : `Click and drag to draw a ${activeTool}.`}
          {activeTool !== "wall" ? " Press Esc to cancel." : ""}
        </div>
      ) : null}

      {/* Physical cursor position status bar */}
      {cursorPhysical && settings.physicalUnit ? (
        <div className="idea-canvas__status-bar">
          {cursorPhysical.x.toFixed(1)} {settings.physicalUnit},{" "}
          {cursorPhysical.y.toFixed(1)} {settings.physicalUnit}
          {wallChainStartRef.current ? "  ·  Wall chain active — Esc to cancel" : ""}
        </div>
      ) : null}

      {/* Object Picker overlay — portalled to body to avoid overflow/stacking constraints */}
      {objectPickerOpen && typeof document !== "undefined" ? createPortal(
        <CanvasObjectPicker
          householdId={householdId}
          onPlace={(placement) => { void handlePlaceObject(placement); }}
          onClose={() => { setObjectPickerOpen(false); setActiveTool("select"); }}
        />,
        document.body
      ) : null}
    </div>
  );
}
