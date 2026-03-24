// This file is intentionally empty — it was a build artifact from the canvas-renderer rewrite.
// It can be safely deleted.
export {};

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
  updateCanvasSettings,
} from "../lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActiveTool = "select" | "pan" | "node" | "rect" | "circle" | "line" | "text";

type DragState =
  | { type: "none" }
  | { type: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { type: "node"; nodeIds: string[]; startX: number; startY: number; startPositions: Record<string, { x: number; y: number }> }
  | { type: "edge"; sourceNodeId: string; mouseX: number; mouseY: number }
  | { type: "rubber"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "draw"; tool: "rect" | "circle" | "line" | "text"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "resize"; nodeId: string; handle: ResizeHandle; startBounds: { x: number; y: number; width: number; height: number }; startX2: number; startY2: number; startMouseCX: number; startMouseCY: number };

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
  const [settings, setSettings] = useState<UpdateCanvasSettingsInput>({
    physicalWidth: initialCanvas.physicalWidth,
    physicalHeight: initialCanvas.physicalHeight,
    physicalUnit: (initialCanvas.physicalUnit as UpdateCanvasSettingsInput["physicalUnit"]) ?? null,
    backgroundImageUrl: initialCanvas.backgroundImageUrl,
    snapToGrid: initialCanvas.snapToGrid,
    gridSize: initialCanvas.gridSize,
  });

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

    if (activeTool === "pan" || (activeTool === "select" && e.altKey)) {
      setDrag({ type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY });
    } else if (activeTool === "select") {
      // Start rubber-band
      setDrag({ type: "rubber", startCX: cp.x, startCY: cp.y, currentCX: cp.x, currentCY: cp.y });
      if (!e.shiftKey) {
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
    }
  }, [activeTool, panX, panY, screenToCanvas, maybeSnap, householdId, canvasId, nodes, edges, pushHistory]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
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
    }
  }, [drag, zoom, screenToCanvas, maybeSnap]);

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
          width: 0, height: 0,
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
    }
    setDrag({ type: "none" });
  }, [drag, zoom, panX, panY, scheduleViewportSync, nodes, edges, nodeMap, maybeSnap, pushHistory, householdId, canvasId, scheduleSyncPositions]);

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
    setShowSettings(false);
  }, [householdId, canvasId]);

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

  // Grid lines
  const gridLines = useMemo(() => {
    if (!settings.snapToGrid || !settings.gridSize) return { minor: [], major: [] };
    const gs = settings.gridSize;
    const range = 5000;
    const minor: { x1: number; y1: number; x2: number; y2: number; horiz: boolean }[] = [];
    const major: { x1: number; y1: number; x2: number; y2: number; horiz: boolean }[] = [];
    for (let i = -Math.ceil(range / gs); i <= Math.ceil(range / gs); i++) {
      const pos = i * gs;
      const isMajor = i % 5 === 0;
      const arr = isMajor ? major : minor;
      arr.push({ x1: pos, y1: -range, x2: pos, y2: range, horiz: false });
      arr.push({ x1: -range, y1: pos, x2: range, y2: pos, horiz: true });
    }
    return { minor, major };
  }, [settings.snapToGrid, settings.gridSize]);

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
    const defaultStroke = node.strokeColor ?? "var(--border)";
    const stroke = isSelected ? selStroke : defaultStroke;
    const sw = isSelected ? 2.5 : (node.strokeWidth ?? 1);
    const cursor = drag.type === "edge" ? "crosshair" : "grab";

    const nodeEvents = {
      onMouseDown: (e: React.MouseEvent) => handleNodeMouseDown(e, node.id),
      onMouseUp: () => handleNodeMouseUp(node.id),
      onDoubleClick: () => handleNodeDoubleClick(node.id),
      onContextMenu: (e: React.MouseEvent) => handleNodeContextMenu(e, node.id),
    };

    if (node.objectType === "line") {
      return (
        <g key={node.id}>
          {/* Wide hit area */}
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke="transparent" strokeWidth={12} style={{ cursor }}
            {...nodeEvents} />
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke={stroke} strokeWidth={sw}
            pointerEvents="none" />
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
    const fillColor = node.fillColor ?? node.color ?? "var(--surface)";

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
          <div className="idea-canvas__settings-row">
            <label>Background Image URL</label>
            <input type="url" value={local.backgroundImageUrl ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, backgroundImageUrl: e.target.value || null }))}
              placeholder="https://..." />
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
    : drag.type === "edge" || activeTool === "rect" || activeTool === "circle" || activeTool === "line" || activeTool === "text" || activeTool === "node" ? "crosshair"
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
        {/* Shape tools */}
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

          {/* Grid */}
          {settings.snapToGrid && gridLines.minor.map((l, i) => (
            <line key={`gm${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="var(--border)" strokeWidth={0.5} opacity={0.4}
              className="canvas-grid-line" pointerEvents="none" />
          ))}
          {settings.snapToGrid && gridLines.major.map((l, i) => (
            <line key={`gM${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="var(--border)" strokeWidth={1} opacity={0.7}
              className="canvas-grid-line" pointerEvents="none" />
          ))}

          {/* Background image */}
          {settings.backgroundImageUrl ? (
            <image href={settings.backgroundImageUrl}
              x={-panX} y={-panY}
              width={50000} height={50000}
              opacity={0.35} pointerEvents="none" preserveAspectRatio="xMinYMin meet" />
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

          {/* Rubber band */}
          {renderRubberBand()}
        </g>
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
      ) : activeTool !== "select" && activeTool !== "pan" ? (
        <div className="idea-canvas__hint">
          {activeTool === "node" ? "Click to place a flowchart node."
            : activeTool === "line" ? "Click and drag to draw a line."
            : activeTool === "text" ? "Click to place a text box."
            : `Click and drag to draw a ${activeTool}.`}
          {" "}Press Esc to cancel.
        </div>
      ) : null}
    </div>
  );
}
