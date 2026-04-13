"use client";

import type {
  CanvasEdgeStyle,
  CanvasGuide,
  CanvasMode,
  CanvasNodeShape,
  CanvasObjectType,
  IdeaCanvas,
  IdeaCanvasEdge,
  IdeaCanvasLayer,
  IdeaCanvasNode,
  Entry,
  UpdateCanvasSettingsInput,
} from "@aegis/types";
import type { JSX } from "react";
import { createPortal } from "react-dom";
import CanvasObjectPicker, { type CanvasObjectPlacement } from "./canvas-object-picker";
import { CanvasToolbar } from "./canvas/canvas-toolbar";
import { CanvasSettingsPanel } from "./canvas/canvas-settings-panel";
import { CanvasLayerPanel } from "./canvas/canvas-layer-panel";
import CanvasSharePanel from "./canvas/canvas-share-panel";
import type { ActiveTool } from "./canvas/canvas-tools/types";
import { simplifyPoints, findNearestWallEndpoint, wallPolygonFromLine, fmtPhysical, computeWallPolygonsWithMiters, arcFromThreePoints, svgArcPath, arcLength, arcWallPolygonPath, polygonArea, polygonCentroid, projectPointOnWall } from "./canvas/canvas-tools/types";
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
  createCanvasLayer,
  createCanvasNode,
  deleteCanvasEdge,
  deleteCanvasLayer,
  deleteCanvasNode,
  getAttachmentDownloadUrl,
  requestAttachmentUpload,
  updateCanvas,
  updateCanvasEdge,
  updateCanvasLayer,
  updateCanvasNode,
  updateCanvasSettings,
} from "../lib/api";
import { exportCanvasToSVG, exportCanvasToPNG } from "../lib/canvas-export";
import { useCanvasHistory, useCanvasViewport, useCanvasSync, useCanvasKeyboard } from "./canvas/hooks";
import {
  getNodeCenter,
  getEdgeAnchors,
  bezierPath,
  getShapeRadius,
  strokeDasharray,
  snapToGrid,
  snapWallAngle,
  computeAlignmentGuides,
  type AlignGuide,
} from "./canvas/canvas-tools/canvas-geometry";

// ─── Types ───────────────────────────────────────────────────────────────────

type DragState =
  | { type: "none" }
  | { type: "pan"; startX: number; startY: number; startPanX: number; startPanY: number }
  | { type: "node"; nodeIds: string[]; startX: number; startY: number; startPositions: Record<string, { x: number; y: number }> }
  | { type: "edge"; sourceNodeId: string; mouseX: number; mouseY: number }
  | { type: "rubber"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "draw"; tool: "rect" | "circle" | "line" | "text"; startCX: number; startCY: number; currentCX: number; currentCY: number }
  | { type: "resize"; nodeId: string; handle: ResizeHandle; startBounds: { x: number; y: number; width: number; height: number }; startX2: number; startY2: number; startMouseCX: number; startMouseCY: number }
  | { type: "wall"; startCX: number; startCY: number; endCX: number; endCY: number; shiftKey: boolean }
  | { type: "measure"; startCX: number; startCY: number; endCX: number; endCY: number }
  | { type: "freehand"; points: { x: number; y: number }[] }
  | { type: "guide"; guideId: string; axis: "horizontal" | "vertical"; startPosition: number }
  | { type: "group-resize"; handle: ResizeHandle; startBounds: { x: number; y: number; width: number; height: number }; startPositions: Record<string, { x: number; y: number; width: number; height: number }>; startMouseCX: number; startMouseCY: number }
  | { type: "bg-move"; startX: number; startY: number; startImgX: number; startImgY: number }
  | { type: "bg-resize"; handle: "nw" | "ne" | "se" | "sw"; startMouseCX: number; startMouseCY: number; startScale: number; startImgX: number; startImgY: number; imgW: number; imgH: number }
  | { type: "calibrate"; startCX: number; startCY: number; endCX: number; endCY: number }
  | { type: "rotate"; nodeId: string; centerCX: number; centerCY: number; startAngle: number; startRotation: number };

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "line-start" | "line-end";

type CanvasRendererProps = {
  householdId: string;
  canvas: IdeaCanvas;
  entries?: Entry[];
  onNavigateToNote?: (entryId: string) => void;
  simplified?: boolean;
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

// ─── Main Component ──────────────────────────────────────────────────────────

export function CanvasRenderer({
  householdId,
  canvas: initialCanvas,
  entries = [],
  onNavigateToNote,
  simplified = false,
}: CanvasRendererProps): JSX.Element {
  const [nodes, setNodes] = useState<IdeaCanvasNode[]>(initialCanvas.nodes);
  const [edges, setEdges] = useState<IdeaCanvasEdge[]>(initialCanvas.edges);
  const [layers, setLayers] = useState<IdeaCanvasLayer[]>(initialCanvas.layers ?? []);
  // The active layer new nodes will be created on
  const [activeLayerId, setActiveLayerId] = useState<string | null>(
    () => (initialCanvas.layers ?? []).find((l) => !l.locked)?.id ?? null
  );
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [activeFloor, setActiveFloor] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasId = initialCanvas.id;

  const {
    zoom, setZoom, panX, setPanX, panY, setPanY,
    screenToCanvas, scheduleViewportSync, handleWheel, viewportTimerRef,
  } = useCanvasViewport({
    initialZoom: initialCanvas.zoom,
    initialPanX: initialCanvas.panX,
    initialPanY: initialCanvas.panY,
    householdId,
    canvasId,
    svgRef,
  });

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
  const [showSharePanel, setShowSharePanel] = useState(false);
  const canvasMode: CanvasMode = (initialCanvas.canvasMode as CanvasMode) ?? "diagram";
  const [showDimensions, setShowDimensions] = useState(initialCanvas.showDimensions ?? true);
  // Guides — persistent lines dragged from rulers
  const [guides, setGuides] = useState<CanvasGuide[]>(initialCanvas.guides ?? []);
  // Temporary alignment guides shown during node drag
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);
  // Wall chain: last completed wall endpoint (for chain drawing)
  const wallChainStartRef = useRef<{ cx: number; cy: number } | null>(null);
  // Wall preview endpoint (tracks mouse while wall tool is active and chain is started)
  const [wallPreviewEnd, setWallPreviewEnd] = useState<{ cx: number; cy: number } | null>(null);
  // Inline wall dimension input: shown after placing a wall segment (only when physical units set)
  const [wallDimEdit, setWallDimEdit] = useState<{
    nodeId: string;
    /** Canvas coords of the wall start */
    sx: number; sy: number;
    /** Canvas coords of the wall end */
    ex: number; ey: number;
    /** Current input value (physical units string) */
    value: string;
  } | null>(null);
  // Curved wall (wall-arc) drawing state: phase 1 = start set, phase 2 = start+end set, mouse defines arc midpoint
  const arcWallRef = useRef<{
    phase: 1 | 2;
    sx: number; sy: number;   // start point
    ex?: number; ey?: number; // end point (set in phase 2)
  } | null>(null);
  const [arcPreview, setArcPreview] = useState<{
    sx: number; sy: number;
    ex: number; ey: number;
    mx: number; my: number; // arc midpoint (cursor)
    phase: 1 | 2;
  } | null>(null);
  // Room polygon drawing state
  const roomPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [roomPreviewPoints, setRoomPreviewPoints] = useState<{ x: number; y: number }[]>([]);
  const [roomPreviewCursor, setRoomPreviewCursor] = useState<{ x: number; y: number } | null>(null);
  // Door/window placement preview
  const [openingPreview, setOpeningPreview] = useState<{
    wallId: string; x: number; y: number; angle: number; wallThickness: number;
  } | null>(null);
  // Cursor physical coord readout
  const [cursorPhysical, setCursorPhysical] = useState<{ x: number; y: number } | null>(null);
  const [settings, setSettings] = useState<UpdateCanvasSettingsInput>({
    physicalWidth: initialCanvas.physicalWidth,
    physicalHeight: initialCanvas.physicalHeight,
    physicalUnit: (initialCanvas.physicalUnit as UpdateCanvasSettingsInput["physicalUnit"]) ?? null,
    backgroundImageUrl: initialCanvas.backgroundImageUrl,
    backgroundImageOpacity: initialCanvas.backgroundImageOpacity ?? 0.5,
    backgroundImageX: initialCanvas.backgroundImageX ?? 0,
    backgroundImageY: initialCanvas.backgroundImageY ?? 0,
    backgroundImageScale: initialCanvas.backgroundImageScale ?? 1,
    backgroundImageLocked: initialCanvas.backgroundImageLocked ?? false,
    backgroundImageCropX: initialCanvas.backgroundImageCropX ?? null,
    backgroundImageCropY: initialCanvas.backgroundImageCropY ?? null,
    backgroundImageCropW: initialCanvas.backgroundImageCropW ?? null,
    backgroundImageCropH: initialCanvas.backgroundImageCropH ?? null,
    snapToGrid: initialCanvas.snapToGrid,
    gridSize: initialCanvas.gridSize,
    showDimensions: initialCanvas.showDimensions ?? true,
  });
  // Resolved presigned download URL for the background image (re-fetched on mount/change)
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(null);
  const [bgImageDims, setBgImageDims] = useState<{ w: number; h: number } | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  // Background image crop mode
  const [bgCropMode, setBgCropMode] = useState(false);
  const [bgCropRect, setBgCropRect] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 1, h: 1 });
  // Calibration wizard prompt after upload
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(false);
  // Calibration dialog state: shown after user draws a calibration line
  const [calibrationLine, setCalibrationLine] = useState<{ startCX: number; startCY: number; endCX: number; endCY: number } | null>(null);
  const [calibrationInput, setCalibrationInput] = useState("");
  const calibrationInputRef = useRef<HTMLInputElement>(null);
  // Map from nodeId -> resolved download URL for image object nodes
  const [nodeImageUrls, setNodeImageUrls] = useState<Map<string, string>>(new Map());
  const [imgObjUploading, setImgObjUploading] = useState(false);
  const [imgObjUploadError, setImgObjUploadError] = useState<string | null>(null);

  // Object picker panel visibility
  const [objectPickerOpen, setObjectPickerOpen] = useState(false);
  const [pendingObjectPlacement, setPendingObjectPlacement] = useState<CanvasObjectPlacement | null>(null);

  // Clipboard for copy/paste
  const clipboardRef = useRef<IdeaCanvasNode[]>([]);

  // Server sync (debounced batch updates)
  const {
    syncTimerRef, pendingNodeUpdates,
    flushPendingPositions, scheduleSyncPositions,
  } = useCanvasSync({ householdId, canvasId, viewportTimerRef });

  // Undo/redo history
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const onUndoSync = useCallback((restoredNodes: IdeaCanvasNode[]) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const updates = restoredNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height, x2: n.x2, y2: n.y2, rotation: n.rotation }));
      if (updates.length > 0) {
        await batchUpdateCanvasNodes(householdId, canvasId, { nodes: updates });
      }
    }, SYNC_DEBOUNCE_MS);
  }, [householdId, canvasId, syncTimerRef]);
  const { pushHistory, undo, redo } = useCanvasHistory({
    initialNodes: initialCanvas.nodes,
    initialEdges: initialCanvas.edges,
    setNodes,
    setEdges,
    clearSelection,
    onUndoSync,
  });

  const nodeMap = useMemo(() => {
    const m = new Map<string, IdeaCanvasNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const defaultLayerId = useMemo(
    () => [...layers].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? null,
    [layers]
  );

  // Multi-storey: unique sorted floor numbers
  const floors = useMemo(() => {
    const set = new Set(layers.map((l) => l.floorNumber));
    return [...set].sort((a, b) => a - b);
  }, [layers]);

  // In floorplan mode, only show layers on the active floor (+visible). In other modes, show all visible.
  const visibleLayerIds = useMemo(() => {
    const isFloorplan = settings.canvasMode === "floorplan";
    return new Set(
      layers
        .filter((l) => l.visible && (!isFloorplan || l.floorNumber === activeFloor))
        .map((l) => l.id)
    );
  }, [layers, activeFloor, settings.canvasMode]);

  // Ghost nodes: nodes on floor below, rendered at reduced opacity
  const ghostLayerIds = useMemo(() => {
    if (settings.canvasMode !== "floorplan") return new Set<string>();
    return new Set(
      layers
        .filter((l) => l.floorNumber === activeFloor - 1)
        .map((l) => l.id)
    );
  }, [layers, activeFloor, settings.canvasMode]);

  const ghostNodes = useMemo(() => {
    if (ghostLayerIds.size === 0) return [];
    return nodes.filter((n) => {
      const lid = n.layerId ?? defaultLayerId;
      return lid && ghostLayerIds.has(lid);
    });
  }, [nodes, ghostLayerIds, defaultLayerId]);

  const sortedNodes = useMemo(() => {
    return [...nodes]
      .filter((n) => {
        const lid = n.layerId ?? defaultLayerId;
        return !lid || visibleLayerIds.has(lid);
      })
      .sort((a, b) => {
        const layerA = layers.find((l) => l.id === (a.layerId ?? defaultLayerId))?.sortOrder ?? -1;
        const layerB = layers.find((l) => l.id === (b.layerId ?? defaultLayerId))?.sortOrder ?? -1;
        if (layerA !== layerB) return layerA - layerB;
        return a.sortOrder - b.sortOrder;
      });
  }, [nodes, visibleLayerIds, layers, defaultLayerId]);

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

  // ─── SVG coordinate helpers ──────────────────────────────────────────────

  const maybeSnap = useCallback((val: number) => {
    if (settings.snapToGrid && settings.gridSize) return snapToGrid(val, settings.gridSize);
    return val;
  }, [settings.snapToGrid, settings.gridSize]);

  // ─── Mouse handlers ─────────────────────────────────────────────────────

  const placeObjectAtCanvasPoint = useCallback(async (placement: CanvasObjectPlacement, canvasX: number, canvasY: number) => {
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

    const x = maybeSnap(canvasX - defaultWidth / 2);
    const y = maybeSnap(canvasY - defaultHeight / 2);

    const node = await createNodeOnActiveLayer({
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
    setPendingObjectPlacement(null);
    setActiveTool("select");
  }, [householdId, canvasId, maybeSnap, nodes, edges, pushHistory]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    const isBlank = target === svgRef.current || target.classList.contains("canvas-bg") || target.classList.contains("canvas-grid-line");
    if (!isBlank) return;

    setContextMenu(null);
    const cp = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === "pan") {
      setDrag({ type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY });
    } else if (activeTool === "object") {
      if (!pendingObjectPlacement) return;
      void placeObjectAtCanvasPoint(pendingObjectPlacement, cp.x, cp.y);
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
      createNodeOnActiveLayer({
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
      // Click-to-place wall: first click starts chain, subsequent clicks place segments
      const chain = wallChainStartRef.current;
      if (!chain) {
        // Start chain: snap to existing wall endpoint or grid
        const snap = findNearestWallEndpoint(cp.x, cp.y, nodes, 15 / zoom);
        const sx = snap.snapped ? snap.x : maybeSnap(cp.x);
        const sy = snap.snapped ? snap.y : maybeSnap(cp.y);
        wallChainStartRef.current = { cx: sx, cy: sy };
        setWallPreviewEnd({ cx: sx, cy: sy });
      } else {
        // Place wall segment
        const rawDx = cp.x - chain.cx;
        const rawDy = cp.y - chain.cy;
        const snapped = snapWallAngle(rawDx, rawDy, e.shiftKey);
        const snap = findNearestWallEndpoint(chain.cx + snapped.dx, chain.cy + snapped.dy, nodes, 15 / zoom);
        const ex = snap.snapped ? snap.x : maybeSnap(chain.cx + snapped.dx);
        const ey = snap.snapped ? snap.y : maybeSnap(chain.cy + snapped.dy);
        const dx = ex - chain.cx;
        const dy = ey - chain.cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len >= 4) {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const wallStartCx = chain.cx;
          const wallStartCy = chain.cy;
          createNodeOnActiveLayer({
            label: "",
            x: chain.cx, y: chain.cy,
            x2: ex, y2: ey,
            width: 1, height: 1,
            objectType: "wall",
            strokeWidth: 6,
            strokeColor: "#374151",
            wallAngle: angle,
          }).then((node) => {
            const newNodes = [...nodes, node];
            setNodes(newNodes);
            pushHistory(newNodes, edges);
            setSelectedIds(new Set([node.id]));
            // Show inline dimension input if physical units are set
            if (pixelsPerUnit && settings.physicalUnit) {
              const physLen = len / pixelsPerUnit;
              setWallDimEdit({
                nodeId: node.id,
                sx: wallStartCx, sy: wallStartCy,
                ex, ey,
                value: physLen % 1 === 0 ? physLen.toFixed(0) : physLen.toFixed(1),
              });
            }
          });
          // Continue chain
          wallChainStartRef.current = { cx: ex, cy: ey };
          setWallPreviewEnd({ cx: ex, cy: ey });
        }
      }
    } else if (activeTool === "wall-arc") {
      // Curved wall 3-click flow: 1=start, 2=end, 3=finalize arc midpoint
      const state = arcWallRef.current;
      if (!state) {
        // Phase 1: set start point
        const snap = findNearestWallEndpoint(cp.x, cp.y, nodes, 15 / zoom);
        const sx = snap.snapped ? snap.x : maybeSnap(cp.x);
        const sy = snap.snapped ? snap.y : maybeSnap(cp.y);
        arcWallRef.current = { phase: 1, sx, sy };
        setArcPreview({ sx, sy, ex: sx, ey: sy, mx: sx, my: sy, phase: 1 });
      } else if (state.phase === 1) {
        // Phase 2: set end point
        const snap = findNearestWallEndpoint(cp.x, cp.y, nodes, 15 / zoom);
        const ex = snap.snapped ? snap.x : maybeSnap(cp.x);
        const ey = snap.snapped ? snap.y : maybeSnap(cp.y);
        arcWallRef.current = { phase: 2, sx: state.sx, sy: state.sy, ex, ey };
        setArcPreview({ sx: state.sx, sy: state.sy, ex, ey, mx: (state.sx + ex) / 2, my: (state.sy + ey) / 2, phase: 2 });
      } else {
        // Phase 3: finalize — use current arc preview midpoint to create arc wall
        if (arcPreview) {
          const arc = arcFromThreePoints(
            { x: state.sx, y: state.sy },
            { x: arcPreview.mx, y: arcPreview.my },
            { x: state.ex!, y: state.ey! },
          );
          if (arc) {
            createNodeOnActiveLayer({
              label: "",
              x: state.sx, y: state.sy,
              x2: state.ex!, y2: state.ey!,
              pointAx: arcPreview.mx, pointAy: arcPreview.my,
              width: 1, height: 1,
              objectType: "wall",
              strokeWidth: 6,
              strokeColor: "#374151",
            }).then((node) => {
              const newNodes = [...nodes, node];
              setNodes(newNodes);
              pushHistory(newNodes, edges);
              setSelectedIds(new Set([node.id]));
            });
          }
        }
        arcWallRef.current = null;
        setArcPreview(null);
      }
    } else if (activeTool === "measure") {
      setDrag({ type: "measure", startCX: maybeSnap(cp.x), startCY: maybeSnap(cp.y), endCX: maybeSnap(cp.x), endCY: maybeSnap(cp.y) });
    } else if (activeTool === "calibrate") {
      setDrag({ type: "calibrate", startCX: cp.x, startCY: cp.y, endCX: cp.x, endCY: cp.y });
    } else if (activeTool === "freehand") {
      setDrag({ type: "freehand", points: [{ x: cp.x, y: cp.y }] });
    } else if (activeTool === "room") {
      // Room polygon: each click adds a vertex; double-click closes
      const snap = findNearestWallEndpoint(maybeSnap(cp.x), maybeSnap(cp.y), nodes, 15 / zoom);
      const px = snap.snapped ? snap.x : maybeSnap(cp.x);
      const py = snap.snapped ? snap.y : maybeSnap(cp.y);
      const pts = roomPointsRef.current;
      // Close polygon: if clicking near start point and we have ≥3 points
      if (pts.length >= 3) {
        const d = Math.hypot(px - pts[0].x, py - pts[0].y);
        if (d < 15 / zoom) {
          // Compute bounding box
          const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
          const minX = Math.min(...xs), minY = Math.min(...ys);
          const maxX = Math.max(...xs), maxY = Math.max(...ys);
          const w = maxX - minX || 1, h = maxY - minY || 1;
          createNodeOnActiveLayer({
            label: "",
            x: minX, y: minY,
            width: w, height: h,
            objectType: "room",
            fillColor: "rgba(59,130,246,0.08)",
            strokeColor: "#3b82f6",
            strokeWidth: 1,
            maskJson: JSON.stringify({ type: "polygon", points: pts.map(p => ({ x: p.x - minX, y: p.y - minY })) }),
          }).then((node) => {
            const newNodes = [...nodes, node];
            setNodes(newNodes);
            pushHistory(newNodes, edges);
            setSelectedIds(new Set([node.id]));
            setEditingNodeId(node.id);
          });
          roomPointsRef.current = [];
          setRoomPreviewPoints([]);
          setRoomPreviewCursor(null);
          return;
        }
      }
      pts.push({ x: px, y: py });
      setRoomPreviewPoints([...pts]);
    } else if (activeTool === "door" || activeTool === "window") {
      // Place door/window on nearest wall
      const proj = projectPointOnWall(cp.x, cp.y, nodes as never[], 30 / zoom);
      if (!proj) return;
      // Default opening width: 36 inches / 0.9m scaled to pixels
      const defaultWidthPx = pixelsPerUnit ? pixelsPerUnit * (settings.physicalUnit === "ft" ? 3 : settings.physicalUnit === "in" ? 36 : 0.9) : 40;
      createNodeOnActiveLayer({
        label: "",
        x: proj.x, y: proj.y,
        width: defaultWidthPx,
        height: proj.wallThickness,
        objectType: activeTool,
        strokeColor: "#374151",
        strokeWidth: 1,
        rotation: (proj.angle * 180) / Math.PI,
        parentNodeId: proj.wallId,
      }).then((node) => {
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
      });
      setOpeningPreview(null);
    } else if (activeTool === "stairs") {
      // Stairs: create rectangle at click point
      const defaultW = pixelsPerUnit ? pixelsPerUnit * (settings.physicalUnit === "ft" ? 3 : settings.physicalUnit === "in" ? 36 : 0.9) : 60;
      const defaultH = pixelsPerUnit ? pixelsPerUnit * (settings.physicalUnit === "ft" ? 10 : settings.physicalUnit === "in" ? 120 : 3) : 120;
      createNodeOnActiveLayer({
        label: "",
        x: maybeSnap(cp.x) - defaultW / 2,
        y: maybeSnap(cp.y) - defaultH / 2,
        width: defaultW, height: defaultH,
        objectType: "stairs",
        fillColor: "rgba(255,255,255,0.9)",
        strokeColor: "#374151",
        strokeWidth: 1,
      }).then((node) => {
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
        setActiveTool("select");
      });
    }
  }, [activeTool, panX, panY, screenToCanvas, pendingObjectPlacement, placeObjectAtCanvasPoint, maybeSnap, householdId, canvasId, nodes, edges, pushHistory, wallChainStartRef, arcPreview, pixelsPerUnit, settings.physicalUnit, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Update physical cursor readout
    if (pixelsPerUnit) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setCursorPhysical({ x: cp.x / pixelsPerUnit, y: cp.y / pixelsPerUnit });
    }
    // Wall tool preview: track mouse when chain is active
    if (activeTool === "wall" && wallChainStartRef.current && drag.type === "none") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const chain = wallChainStartRef.current;
      const rawDx = cp.x - chain.cx;
      const rawDy = cp.y - chain.cy;
      const snapped = snapWallAngle(rawDx, rawDy, e.shiftKey);
      const snap = findNearestWallEndpoint(chain.cx + snapped.dx, chain.cy + snapped.dy, nodes, 15 / zoom);
      const ex = snap.snapped ? snap.x : maybeSnap(chain.cx + snapped.dx);
      const ey = snap.snapped ? snap.y : maybeSnap(chain.cy + snapped.dy);
      setWallPreviewEnd({ cx: ex, cy: ey });
    }
    // Arc wall tool preview
    if (activeTool === "wall-arc" && arcWallRef.current && drag.type === "none") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const state = arcWallRef.current;
      if (state.phase === 1) {
        // Phase 1: preview straight line from start to cursor (end position)
        const snap = findNearestWallEndpoint(cp.x, cp.y, nodes, 15 / zoom);
        const ex = snap.snapped ? snap.x : maybeSnap(cp.x);
        const ey = snap.snapped ? snap.y : maybeSnap(cp.y);
        setArcPreview({ sx: state.sx, sy: state.sy, ex, ey, mx: (state.sx + ex) / 2, my: (state.sy + ey) / 2, phase: 1 });
      } else if (state.phase === 2 && state.ex != null && state.ey != null) {
        // Phase 2: preview arc — cursor defines the midpoint the arc passes through
        setArcPreview({ sx: state.sx, sy: state.sy, ex: state.ex, ey: state.ey, mx: cp.x, my: cp.y, phase: 2 });
      }
    }
    // Room polygon: track cursor for preview closing edge
    if (activeTool === "room" && roomPointsRef.current.length > 0 && drag.type === "none") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setRoomPreviewCursor({ x: maybeSnap(cp.x), y: maybeSnap(cp.y) });
    }
    // Door/window placement preview: project cursor onto nearest wall
    if ((activeTool === "door" || activeTool === "window") && drag.type === "none") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const proj = projectPointOnWall(cp.x, cp.y, nodes as never[], 30 / zoom);
      setOpeningPreview(proj ? { wallId: proj.wallId, x: proj.x, y: proj.y, angle: proj.angle, wallThickness: proj.wallThickness } : null);
    }
    if (drag.type === "pan") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setPanX(drag.startPanX + dx);
      setPanY(drag.startPanY + dy);
    } else if (drag.type === "node") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;

      // Compute tentative positions first
      const tentative: { id: string; x: number; y: number; width: number; height: number }[] = [];
      for (const id of drag.nodeIds) {
        const start = drag.startPositions[id];
        const n = nodeMap.get(id);
        if (!start || !n) continue;
        tentative.push({ id, x: maybeSnap(start.x + dx), y: maybeSnap(start.y + dy), width: n.width, height: n.height });
      }

      // Smart alignment snapping: compare against non-dragged nodes
      const dragSet = new Set(drag.nodeIds);
      const otherNodes = nodes.filter(n => !dragSet.has(n.id));
      const alignThreshold = 8 / zoom;
      const align = computeAlignmentGuides(tentative, otherNodes, alignThreshold);

      // Also snap to persistent guide lines
      let guideDx = align.snapDx;
      let guideDy = align.snapDy;
      const guideLines: AlignGuide[] = [...align.guides];
      if (tentative.length > 0) {
        let tMinX = Infinity, tMinY = Infinity, tMaxX = -Infinity, tMaxY = -Infinity;
        for (const t of tentative) { tMinX = Math.min(tMinX, t.x); tMinY = Math.min(tMinY, t.y); tMaxX = Math.max(tMaxX, t.x + t.width); tMaxY = Math.max(tMaxY, t.y + t.height); }
        const tCx = (tMinX + tMaxX) / 2, tCy = (tMinY + tMaxY) / 2;
        for (const g of guides) {
          if (g.axis === "horizontal") {
            for (const edge of [tMinY, tCy, tMaxY]) {
              const diff = g.position - edge;
              if (Math.abs(diff) < alignThreshold && (guideDy === 0 || Math.abs(diff) < Math.abs(guideDy))) {
                guideDy = diff;
                // Remove existing horizontal guide lines and add this one
                for (let i = guideLines.length - 1; i >= 0; i--) { if (guideLines[i].axis === "horizontal") guideLines.splice(i, 1); }
                guideLines.push({ axis: "horizontal", position: g.position });
              }
            }
          } else {
            for (const edge of [tMinX, tCx, tMaxX]) {
              const diff = g.position - edge;
              if (Math.abs(diff) < alignThreshold && (guideDx === 0 || Math.abs(diff) < Math.abs(guideDx))) {
                guideDx = diff;
                for (let i = guideLines.length - 1; i >= 0; i--) { if (guideLines[i].axis === "vertical") guideLines.splice(i, 1); }
                guideLines.push({ axis: "vertical", position: g.position });
              }
            }
          }
        }
      }
      setAlignGuides(guideLines);

      setNodes((prev) => prev.map((n) => {
        if (!drag.nodeIds.includes(n.id)) return n;
        const start = drag.startPositions[n.id];
        if (!start) return n;
        const newX = maybeSnap(start.x + dx) + guideDx;
        const newY = maybeSnap(start.y + dy) + guideDy;
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
        setNodes((prev) => {
          // Find current position of the dragged endpoint to detect connected walls
          const primary = prev.find((n) => n.id === drag.nodeId);
          const curX = primary?.x ?? b.x;
          const curY = primary?.y ?? b.y;
          return prev.map((n) => {
            if (n.id === drag.nodeId) return { ...n, x: newX, y: newY };
            if (n.objectType === "wall" || n.objectType === "line" || n.objectType === "dimension") {
              const eps = 1;
              if (Math.abs(n.x - curX) < eps && Math.abs(n.y - curY) < eps) return { ...n, x: newX, y: newY };
              if (Math.abs(n.x2 - curX) < eps && Math.abs(n.y2 - curY) < eps) return { ...n, x2: newX, y2: newY };
            }
            return n;
          });
        });
        return;
      }
      if (drag.handle === "line-end") {
        const newX2 = maybeSnap(drag.startX2 + dx);
        const newY2 = maybeSnap(drag.startY2 + dy);
        setNodes((prev) => {
          const primary = prev.find((n) => n.id === drag.nodeId);
          const curX2 = primary?.x2 ?? drag.startX2;
          const curY2 = primary?.y2 ?? drag.startY2;
          return prev.map((n) => {
            if (n.id === drag.nodeId) return { ...n, x2: newX2, y2: newY2 };
            if (n.objectType === "wall" || n.objectType === "line" || n.objectType === "dimension") {
              const eps = 1;
              if (Math.abs(n.x - curX2) < eps && Math.abs(n.y - curY2) < eps) return { ...n, x: newX2, y: newY2 };
              if (Math.abs(n.x2 - curX2) < eps && Math.abs(n.y2 - curY2) < eps) return { ...n, x2: newX2, y2: newY2 };
            }
            return n;
          });
        });
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
    } else if (drag.type === "measure") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, endCX: cp.x, endCY: cp.y });
    } else if (drag.type === "rotate") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const currentAngle = Math.atan2(cp.y - drag.centerCY, cp.x - drag.centerCX);
      let delta = (currentAngle - drag.startAngle) * (180 / Math.PI);
      // Snap to 15° increments when shift is held
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      const newRotation = drag.startRotation + delta;
      setNodes((prev) => prev.map((n) => n.id === drag.nodeId ? { ...n, rotation: newRotation } : n));
    } else if (drag.type === "calibrate") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, endCX: cp.x, endCY: cp.y });
    } else if (drag.type === "freehand") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({ ...drag, points: [...drag.points, { x: cp.x, y: cp.y }] });
    } else if (drag.type === "guide") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const pos = drag.axis === "horizontal" ? cp.y : cp.x;
      setGuides(prev => prev.map(g => g.id === drag.guideId ? { ...g, position: pos } : g));
    } else if (drag.type === "group-resize") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const dx = cp.x - drag.startMouseCX;
      const dy = cp.y - drag.startMouseCY;
      const b = drag.startBounds;
      const h = drag.handle;

      let newX = b.x, newY = b.y, newW = b.width, newH = b.height;
      if (h.includes("w")) { newX = Math.min(b.x + dx, b.x + b.width - MIN_SIZE); newW = b.x + b.width - newX; }
      if (h.includes("e")) { newW = Math.max(MIN_SIZE, b.width + dx); }
      if (h.includes("n")) { newY = Math.min(b.y + dy, b.y + b.height - MIN_SIZE); newH = b.y + b.height - newY; }
      if (h.includes("s")) { newH = Math.max(MIN_SIZE, b.height + dy); }

      const scaleX = b.width > 0 ? newW / b.width : 1;
      const scaleY = b.height > 0 ? newH / b.height : 1;

      setNodes(prev => prev.map(n => {
        const sp = drag.startPositions[n.id];
        if (!sp) return n;
        return {
          ...n,
          x: newX + (sp.x - b.x) * scaleX,
          y: newY + (sp.y - b.y) * scaleY,
          width: Math.max(MIN_SIZE, sp.width * scaleX),
          height: Math.max(MIN_SIZE, sp.height * scaleY),
        };
      }));
    } else if (drag.type === "bg-move") {
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      setSettings(prev => ({ ...prev, backgroundImageX: drag.startImgX + dx, backgroundImageY: drag.startImgY + dy }));
    } else if (drag.type === "bg-resize") {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const dx = cp.x - drag.startMouseCX;
      const dy = cp.y - drag.startMouseCY;
      // Scale proportionally based on diagonal movement
      const diag = Math.sqrt(drag.imgW * drag.imgW + drag.imgH * drag.imgH) * drag.startScale;
      const delta = (dx + dy) * (drag.handle === "nw" || drag.handle === "sw" ? -1 : 1);
      const newScale = Math.max(0.01, drag.startScale + (diag > 0 ? (delta / diag) * drag.startScale : 0));
      // Anchor the opposite corner: compute new position so opposite corner stays fixed
      const anchorX = drag.handle.includes("e") ? drag.startImgX : drag.startImgX + drag.imgW * drag.startScale;
      const anchorY = drag.handle.includes("s") ? drag.startImgY : drag.startImgY + drag.imgH * drag.startScale;
      const newX = drag.handle.includes("e") ? anchorX : anchorX - drag.imgW * newScale;
      const newY = drag.handle.includes("s") ? anchorY : anchorY - drag.imgH * newScale;
      setSettings(prev => ({ ...prev, backgroundImageScale: newScale, backgroundImageX: newX, backgroundImageY: newY }));
    }
  }, [drag, zoom, screenToCanvas, maybeSnap, pixelsPerUnit, activeTool, nodes, guides]);

  const handleMouseUp = useCallback(async () => {
    if (drag.type === "pan") {
      scheduleViewportSync(zoom, panX, panY);
    } else if (drag.type === "node") {
      // Clear alignment guides
      setAlignGuides([]);
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

      const node = await createNodeOnActiveLayer(nodeData);
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
        // Also persist connected wall endpoints that were dragged along
        if (drag.handle === "line-start" || drag.handle === "line-end") {
          for (const other of nodes) {
            if (other.id === drag.nodeId) continue;
            if (other.objectType !== "wall" && other.objectType !== "line" && other.objectType !== "dimension") continue;
            const cur = nodeMap.get(other.id);
            if (!cur) continue;
            // If its coordinates changed from the initial load, it was moved by the connected drag
            const initial = drag.handle === "line-start"
              ? { x: drag.startBounds.x, y: drag.startBounds.y }
              : { x: drag.startX2, y: drag.startY2 };
            const now = drag.handle === "line-start"
              ? { x: n.x, y: n.y }
              : { x: n.x2, y: n.y2 };
            if (initial.x !== now.x || initial.y !== now.y) {
              pendingNodeUpdates.current.set(other.id, { x: cur.x, y: cur.y, x2: cur.x2, y2: cur.y2 });
            }
          }
        }
        pushHistory(nodes, edges);
        scheduleSyncPositions();
      }
    } else if (drag.type === "rotate") {
      const n = nodeMap.get(drag.nodeId);
      if (n) {
        pendingNodeUpdates.current.set(drag.nodeId, { rotation: n.rotation ?? 0 });
        pushHistory(nodes, edges);
        scheduleSyncPositions();
      }
    } else if (drag.type === "measure") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      if (Math.sqrt(dx * dx + dy * dy) >= 4) {
        const node = await createNodeOnActiveLayer({
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
    } else if (drag.type === "freehand") {
      const { points } = drag;
      if (points.length >= 2) {
        const simplified = simplifyPoints(points, 2);
        // Compute bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of simplified) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        const w = Math.max(1, maxX - minX);
        const h = Math.max(1, maxY - minY);
        const pointsJson = JSON.stringify(simplified);
        const node = await createNodeOnActiveLayer({
          label: "",
          x: minX, y: minY,
          width: w, height: h,
          objectType: "freehand",
          strokeColor: "#333333",
          strokeWidth: 2,
          pointsJson,
        });
        const newNodes = [...nodes, node];
        setNodes(newNodes);
        pushHistory(newNodes, edges);
        setSelectedIds(new Set([node.id]));
      }
    } else if (drag.type === "guide") {
      // If guide was dragged outside the canvas area (back to ruler), remove it
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const rulerSize = 20;
        const guide = guides.find(g => g.id === drag.guideId);
        if (guide) {
          const screenPos = drag.axis === "horizontal"
            ? (guide.position + panY) * zoom
            : (guide.position + panX) * zoom;
          if (screenPos < rulerSize) {
            // Dragged back to ruler — remove
            const newGuides = guides.filter(g => g.id !== drag.guideId);
            setGuides(newGuides);
            updateCanvasSettings(householdId, canvasId, { guides: newGuides });
          } else {
            // Persist updated position
            updateCanvasSettings(householdId, canvasId, { guides });
          }
        }
      }
    } else if (drag.type === "group-resize") {
      // Commit group resize to history and server
      pushHistory(nodes, edges);
      for (const id of Object.keys(drag.startPositions)) {
        const n = nodeMap.get(id);
        if (n) pendingNodeUpdates.current.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
      }
      scheduleSyncPositions();
    } else if (drag.type === "bg-move" || drag.type === "bg-resize") {
      // Persist the updated background image position/scale
      void updateCanvasSettings(householdId, canvasId, {
        backgroundImageX: settings.backgroundImageX,
        backgroundImageY: settings.backgroundImageY,
        backgroundImageScale: settings.backgroundImageScale,
      });
    } else if (drag.type === "calibrate") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const pixelLen = Math.sqrt(dx * dx + dy * dy);
      if (pixelLen >= 4) {
        setCalibrationLine({ startCX, startCY, endCX, endCY });
        setCalibrationInput("");
        setTimeout(() => calibrationInputRef.current?.focus(), 50);
        // Don't reset drag to keep the line visible; will reset after dialog
        return;
      }
    }
    setDrag({ type: "none" });
  }, [drag, zoom, panX, panY, scheduleViewportSync, nodes, edges, nodeMap, guides, maybeSnap, pushHistory, householdId, canvasId, scheduleSyncPositions, settings]);

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
        // Auto-select all nodes in the same group
        const gId = node.groupId;
        if (gId) {
          newSelectedIds = new Set(nodes.filter((n) => n.groupId === gId).map((n) => n.id));
        } else {
          newSelectedIds = new Set([nodeId]);
        }
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
  }, [nodeMap, drag.type, activeTool, selectedIds, nodes]);

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

  // ─── Rotation handle interactions ──────────────────────────────────────

  const handleRotateMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const cp = screenToCanvas(e.clientX, e.clientY);
    const startAngle = Math.atan2(cp.y - cy, cp.x - cx);
    setDrag({
      type: "rotate",
      nodeId,
      centerCX: cx,
      centerCY: cy,
      startAngle,
      startRotation: node.rotation ?? 0,
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

  const handleBringForward = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const sorted = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
    const newNodes = [...sorted];
    // Walk from top down so swaps don't cascade
    for (let i = newNodes.length - 2; i >= 0; i--) {
      if (selectedIds.has(newNodes[i].id) && !selectedIds.has(newNodes[i + 1].id)) {
        const tmp = newNodes[i];
        newNodes[i] = newNodes[i + 1];
        newNodes[i + 1] = tmp;
      }
    }
    // Reassign sortOrder based on new positions
    const updates: { id: string; sortOrder: number }[] = [];
    const updated = newNodes.map((n, idx) => {
      if (n.sortOrder !== idx) updates.push({ id: n.id, sortOrder: idx });
      return { ...n, sortOrder: idx };
    });
    if (updates.length === 0) return;
    setNodes(updated);
    pushHistory(updated, edges);
    await batchUpdateCanvasNodes(householdId, canvasId, { nodes: updates });
  }, [selectedIds, nodes, edges, householdId, canvasId, pushHistory]);

  const handleSendBackward = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const sorted = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
    const newNodes = [...sorted];
    // Walk from bottom up so swaps don't cascade
    for (let i = 1; i < newNodes.length; i++) {
      if (selectedIds.has(newNodes[i].id) && !selectedIds.has(newNodes[i - 1].id)) {
        const tmp = newNodes[i];
        newNodes[i] = newNodes[i - 1];
        newNodes[i - 1] = tmp;
      }
    }
    const updates: { id: string; sortOrder: number }[] = [];
    const updated = newNodes.map((n, idx) => {
      if (n.sortOrder !== idx) updates.push({ id: n.id, sortOrder: idx });
      return { ...n, sortOrder: idx };
    });
    if (updates.length === 0) return;
    setNodes(updated);
    pushHistory(updated, edges);
    await batchUpdateCanvasNodes(householdId, canvasId, { nodes: updates });
  }, [selectedIds, nodes, edges, householdId, canvasId, pushHistory]);

  const handleStartEdge = useCallback(() => {
    const firstId = Array.from(selectedIds)[0];
    if (!firstId) return;
    const n = nodeMap.get(firstId);
    if (!n || n.objectType !== "flowchart") return;
    const center = getNodeCenter(n);
    setDrag({ type: "edge", sourceNodeId: firstId, mouseX: 0, mouseY: 0 });
  }, [selectedIds, nodeMap]);

  const handleAlignNodes = useCallback(async (
    axis: "left" | "center-h" | "right" | "top" | "center-v" | "bottom" | "distribute-h" | "distribute-v"
  ) => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    const selected = nodes.filter((n) => ids.includes(n.id));

    let updated = [...nodes];
    if (axis === "left") {
      const minX = Math.min(...selected.map((n) => n.x));
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, x: minX } : n);
    } else if (axis === "right") {
      const maxX = Math.max(...selected.map((n) => n.x + n.width));
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, x: maxX - n.width } : n);
    } else if (axis === "center-h") {
      const minX = Math.min(...selected.map((n) => n.x));
      const maxX = Math.max(...selected.map((n) => n.x + n.width));
      const midX = (minX + maxX) / 2;
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, x: midX - n.width / 2 } : n);
    } else if (axis === "top") {
      const minY = Math.min(...selected.map((n) => n.y));
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, y: minY } : n);
    } else if (axis === "bottom") {
      const maxY = Math.max(...selected.map((n) => n.y + n.height));
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, y: maxY - n.height } : n);
    } else if (axis === "center-v") {
      const minY = Math.min(...selected.map((n) => n.y));
      const maxY = Math.max(...selected.map((n) => n.y + n.height));
      const midY = (minY + maxY) / 2;
      updated = nodes.map((n) => ids.includes(n.id) ? { ...n, y: midY - n.height / 2 } : n);
    } else if (axis === "distribute-h") {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      if (sorted.length < 3) return;
      const totalSpan = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x;
      const totalNodeWidth = sorted.reduce((s, n) => s + n.width, 0);
      const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1);
      let cursor = sorted[0].x + sorted[0].width;
      const posMap = new Map<string, number>();
      for (let i = 1; i < sorted.length - 1; i++) {
        posMap.set(sorted[i].id, cursor + gap);
        cursor += gap + sorted[i].width;
      }
      updated = nodes.map((n) => posMap.has(n.id) ? { ...n, x: posMap.get(n.id)! } : n);
    } else if (axis === "distribute-v") {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      if (sorted.length < 3) return;
      const totalSpan = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y;
      const totalNodeHeight = sorted.reduce((s, n) => s + n.height, 0);
      const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1);
      let cursor = sorted[0].y + sorted[0].height;
      const posMap = new Map<string, number>();
      for (let i = 1; i < sorted.length - 1; i++) {
        posMap.set(sorted[i].id, cursor + gap);
        cursor += gap + sorted[i].height;
      }
      updated = nodes.map((n) => posMap.has(n.id) ? { ...n, y: posMap.get(n.id)! } : n);
    }

    const nodeUpdates = updated
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ id: n.id, x: n.x, y: n.y }));
    if (nodeUpdates.length === 0) return;
    setNodes(updated);
    pushHistory(updated, edges);
    await batchUpdateCanvasNodes(householdId, canvasId, { nodes: nodeUpdates });
  }, [selectedIds, nodes, edges, householdId, canvasId, pushHistory]);

  const handleToggleSnap = useCallback(() => {
    setSettings((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const handleChangeColor = useCallback(async (color: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { color })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, color } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeFillColor = useCallback(async (fillColor: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { fillColor })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, fillColor } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeStrokeColor = useCallback(async (strokeColor: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { strokeColor })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, strokeColor } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeStrokeWidth = useCallback(async (strokeWidth: number) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { strokeWidth })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, strokeWidth } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeFontSize = useCallback(async (fontSize: number) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { fontSize })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, fontSize } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeWallHeight = useCallback(async (wallHeight: number | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { wallHeight })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, wallHeight } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeSwingDirection = useCallback(async (swingDirection: "left" | "right" | "double") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { swingDirection })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, swingDirection } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeStairDirection = useCallback(async (stairDirection: "up" | "down" | "left" | "right") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { stairDirection })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, stairDirection } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeStairFloors = useCallback(async (fromFloor: number | null, toFloor: number | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { fromFloor, toFloor })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, fromFloor, toFloor } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  /** Commit inline wall dimension edit: resize wall to specified physical length, keeping angle */
  const commitWallDimEdit = useCallback(async (confirm: boolean) => {
    if (!wallDimEdit) return;
    if (confirm && pixelsPerUnit) {
      const newPhysLen = parseFloat(wallDimEdit.value);
      if (!isNaN(newPhysLen) && newPhysLen > 0) {
        const dx = wallDimEdit.ex - wallDimEdit.sx;
        const dy = wallDimEdit.ey - wallDimEdit.sy;
        const oldLen = Math.sqrt(dx * dx + dy * dy);
        if (oldLen > 0.5) {
          const newPxLen = newPhysLen * pixelsPerUnit;
          const scale = newPxLen / oldLen;
          const newEx = wallDimEdit.sx + dx * scale;
          const newEy = wallDimEdit.sy + dy * scale;
          await updateCanvasNode(householdId, canvasId, wallDimEdit.nodeId, { x2: newEx, y2: newEy });
          setNodes((prev) => prev.map((n) =>
            n.id === wallDimEdit.nodeId ? { ...n, x2: newEx, y2: newEy } : n
          ));
          // Also update the chain start point so the next wall starts from the correct spot
          wallChainStartRef.current = { cx: newEx, cy: newEy };
        }
      }
    }
    setWallDimEdit(null);
  }, [wallDimEdit, pixelsPerUnit, householdId, canvasId]);

  const handleChangeShape = useCallback(async (shape: CanvasNodeShape) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { shape })));
    const newNodes = nodes.map((n) => ids.includes(n.id) ? { ...n, shape } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleChangeEdgeStyle = useCallback(async (style: CanvasEdgeStyle) => {
    if (!selectedEdgeId) return;
    await updateCanvasEdge(householdId, canvasId, selectedEdgeId, { style });
    const newEdges = edges.map((e) => e.id === selectedEdgeId ? { ...e, style } : e);
    setEdges(newEdges);
    pushHistory(nodes, newEdges);
  }, [selectedEdgeId, householdId, canvasId, nodes, edges, pushHistory]);

  const handleLabelCommit = useCallback(async (nodeId: string, label: string) => {
    await updateCanvasNode(householdId, canvasId, nodeId, { label });
    const newNodes = nodes.map((n) => n.id === nodeId ? { ...n, label } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setEditingNodeId(null);
  }, [householdId, canvasId, nodes, edges, pushHistory]);

  const handleEdgeLabelCommit = useCallback(async (edgeId: string, label: string) => {
    const value = label.trim() || null;
    await updateCanvasEdge(householdId, canvasId, edgeId, { label: value });
    const newEdges = edges.map((e) => e.id === edgeId ? { ...e, label: value } : e);
    setEdges(newEdges);
    pushHistory(nodes, newEdges);
    setEditingEdgeId(null);
  }, [householdId, canvasId, nodes, edges, pushHistory]);

  const handleLinkNote = useCallback(async (nodeId: string, entryId: string | null) => {
    await updateCanvasNode(householdId, canvasId, nodeId, { entryId });
    const newNodes = nodes.map((n) => n.id === nodeId ? { ...n, entryId } : n);
    setNodes(newNodes);
    pushHistory(newNodes, edges);
    setShowNotePicker(null);
    setContextMenu(null);
  }, [householdId, canvasId, nodes, edges, pushHistory]);

  // ─── Object grouping ────────────────────────────────────────────────────

  const handleGroupSelected = useCallback(async () => {
    if (selectedIds.size < 2) return;
    const groupId = crypto.randomUUID();
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { groupId })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, groupId } : n));
    pushHistory(nodes.map((n) => ids.includes(n.id) ? { ...n, groupId } : n), edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

  const handleUngroupSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => updateCanvasNode(householdId, canvasId, id, { groupId: null })));
    setNodes((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, groupId: null } : n));
    pushHistory(nodes.map((n) => ids.includes(n.id) ? { ...n, groupId: null } : n), edges);
  }, [selectedIds, householdId, canvasId, nodes, edges, pushHistory]);

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
    const imgScale = settings.backgroundImageScale ?? 1;
    const imgX = settings.backgroundImageX ?? 0;
    const imgY = settings.backgroundImageY ?? 0;
    const scaledW = imgW * imgScale;
    const scaledH = imgH * imgScale;
    const newZoom = Math.min(
      (rect.width - padding * 2) / scaledW,
      (rect.height - padding * 2) / scaledH,
      2,
    );
    const newPanX = (rect.width / newZoom - scaledW) / 2 - imgX;
    const newPanY = (rect.height / newZoom - scaledH) / 2 - imgY;
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
    scheduleViewportSync(newZoom, newPanX, newPanY);
  }, [scheduleViewportSync, settings.backgroundImageScale, settings.backgroundImageX, settings.backgroundImageY]);

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

  // Periodically refresh background image presigned URL (expires after 1hr)
  useEffect(() => {
    const raw = settings.backgroundImageUrl;
    if (!raw || !raw.startsWith("attachment:")) return;
    const interval = setInterval(() => {
      void resolveBackgroundUrl(raw);
    }, 45 * 60 * 1000); // refresh every 45 minutes
    return () => clearInterval(interval);
  }, [settings.backgroundImageUrl, resolveBackgroundUrl]);

  // Auto-dismiss calibration prompt on tool change or timeout
  useEffect(() => {
    if (!showCalibrationPrompt) return;
    const timeout = setTimeout(() => setShowCalibrationPrompt(false), 15000);
    return () => clearTimeout(timeout);
  }, [showCalibrationPrompt]);
  useEffect(() => {
    if (showCalibrationPrompt && activeTool !== "select") {
      setShowCalibrationPrompt(false);
    }
  }, [activeTool, showCalibrationPrompt]);

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
      // Show calibration prompt if no physical units set yet
      if (!settings.physicalUnit) {
        setShowCalibrationPrompt(true);
      }
    } catch (err) {
      setBgUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBgUploading(false);
    }
  }, [householdId, canvasId, settings, fitViewportToImage]);

  const handleRemoveBgImage = useCallback(async () => {
    const newSettings: UpdateCanvasSettingsInput = { ...settings, backgroundImageUrl: null, backgroundImageX: 0, backgroundImageY: 0, backgroundImageScale: 1, backgroundImageCropX: null, backgroundImageCropY: null, backgroundImageCropW: null, backgroundImageCropH: null, backgroundImageLocked: false };
    await updateCanvasSettings(householdId, canvasId, newSettings);
    setSettings(newSettings);
    setResolvedBgUrl(null);
    setBgImageDims(null);
  }, [householdId, canvasId, settings]);

  // Start background image crop mode
  const handleStartCrop = useCallback(() => {
    const cx = settings.backgroundImageCropX;
    const cy = settings.backgroundImageCropY;
    const cw = settings.backgroundImageCropW;
    const ch = settings.backgroundImageCropH;
    if (cx != null && cy != null && cw != null && ch != null) {
      setBgCropRect({ x: cx, y: cy, w: cw, h: ch });
    } else {
      setBgCropRect({ x: 0, y: 0, w: 1, h: 1 });
    }
    setBgCropMode(true);
  }, [settings]);

  const handleApplyCrop = useCallback(async () => {
    const patch: UpdateCanvasSettingsInput = {
      backgroundImageCropX: bgCropRect.x,
      backgroundImageCropY: bgCropRect.y,
      backgroundImageCropW: bgCropRect.w,
      backgroundImageCropH: bgCropRect.h,
    };
    await updateCanvasSettings(householdId, canvasId, patch);
    setSettings((prev) => ({ ...prev, ...patch }));
    setBgCropMode(false);
  }, [householdId, canvasId, bgCropRect]);

  const handleCancelCrop = useCallback(() => {
    setBgCropMode(false);
  }, []);

  // Add a reference image as an image node on a locked "Reference" layer
  const handleAddReferenceImage = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        // Read natural dimensions
        const localUrl = URL.createObjectURL(file);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(localUrl); };
          img.onerror = () => { resolve({ w: 800, h: 600 }); URL.revokeObjectURL(localUrl); };
          img.src = localUrl;
        });

        // Upload via attachment flow
        const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
          entityType: "canvas",
          entityId: canvasId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });
        const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
        await confirmAttachmentUpload(householdId, attachment.id);

        // Find or create a "Reference" layer
        let refLayer = layers.find((l) => l.name === "Reference");
        if (!refLayer) {
          const maxSort = layers.reduce((m, l) => Math.max(m, l.sortOrder), 0);
          refLayer = await createCanvasLayer(householdId, canvasId, {
            name: "Reference",
            locked: true,
            opacity: 0.3,
            sortOrder: maxSort + 1,
          });
          setLayers((prev) => [...prev, refLayer!]);
        }

        // Determine node size: fit to ~40% of viewport
        const svgEl = svgRef.current;
        const viewW = svgEl ? svgEl.getBoundingClientRect().width / zoom : 800;
        const viewH = svgEl ? svgEl.getBoundingClientRect().height / zoom : 600;
        const targetW = viewW * 0.4;
        const ratio = dims.h / dims.w;
        const nodeW = targetW;
        const nodeH = targetW * ratio;

        // Place at viewport center
        const cx = -panX + viewW / 2 - nodeW / 2;
        const cy = -panY + viewH / 2 - nodeH / 2;

        const newNode = await createCanvasNode(householdId, canvasId, {
          objectType: "image" as CanvasObjectType,
          label: file.name.replace(/\.[^.]+$/, ""),
          x: cx,
          y: cy,
          width: nodeW,
          height: nodeH,
          imageUrl: `attachment:${attachment.id}`,
          layerId: refLayer.id,
        });
        setNodes((prev) => [...prev, newNode]);

        // Resolve the image URL for rendering
        const { url: dlUrl } = await getAttachmentDownloadUrl(householdId, attachment.id);
        setNodeImageUrls((prev) => new Map(prev).set(newNode.id, dlUrl));
      } catch {
        // Silently fail — the user can retry from the settings panel
      }
    };
    input.click();
  }, [householdId, canvasId, layers, zoom, panX, panY]);

  // Start dragging/resizing the background image
  const handleBgImageMouseDown = useCallback((e: React.MouseEvent, handle?: "nw" | "ne" | "se" | "sw") => {
    e.stopPropagation();
    if (!bgImageDims) return;
    const imgX = settings.backgroundImageX ?? 0;
    const imgY = settings.backgroundImageY ?? 0;
    const imgScale = settings.backgroundImageScale ?? 1;
    if (handle) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      setDrag({
        type: "bg-resize",
        handle,
        startMouseCX: cp.x,
        startMouseCY: cp.y,
        startScale: imgScale,
        startImgX: imgX,
        startImgY: imgY,
        imgW: bgImageDims.w,
        imgH: bgImageDims.h,
      });
    } else {
      setDrag({
        type: "bg-move",
        startX: e.clientX,
        startY: e.clientY,
        startImgX: imgX,
        startImgY: imgY,
      });
    }
  }, [bgImageDims, settings, screenToCanvas]);

  // Apply calibration: user drew a line and entered a real-world distance
  const handleCalibrationConfirm = useCallback(async () => {
    if (!calibrationLine) return;
    const realDist = parseFloat(calibrationInput);
    if (!realDist || realDist <= 0) return;
    const { startCX, startCY, endCX, endCY } = calibrationLine;
    const dx = endCX - startCX;
    const dy = endCY - startCY;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    if (pixelDist < 1) return;
    // pixelsPerUnit = pixelDist / realDist, and gridSize = pixelsPerUnit
    const newGridSize = Math.round(Math.max(8, Math.min(200, pixelDist / realDist)));
    // Auto-set a unit if none is set
    const unit = settings.physicalUnit ?? "ft";
    const newSettings: UpdateCanvasSettingsInput = {
      ...settings,
      gridSize: newGridSize,
      physicalUnit: unit as UpdateCanvasSettingsInput["physicalUnit"],
      showDimensions: true,
    };
    await updateCanvasSettings(householdId, canvasId, newSettings);
    setSettings(newSettings);
    setCalibrationLine(null);
    setCalibrationInput("");
    setDrag({ type: "none" });
    setActiveTool("select");
  }, [calibrationLine, calibrationInput, settings, householdId, canvasId]);

  const handleCalibrationCancel = useCallback(() => {
    setCalibrationLine(null);
    setCalibrationInput("");
    setDrag({ type: "none" });
    setActiveTool("select");
  }, []);

  // ─── Layer handlers ───────────────────────────────────────────────────────

  const handleAddLayer = useCallback(async () => {
    const nextOrder = layers.length > 0 ? Math.max(...layers.map((l) => l.sortOrder)) + 1 : 0;
    const layer = await createCanvasLayer(householdId, canvasId, {
      name: `Layer ${layers.length + 1}`,
      sortOrder: nextOrder,
      floorNumber: settings.canvasMode === "floorplan" ? activeFloor : 0,
    });
    setLayers((prev) => [...prev, layer]);
    setActiveLayerId(layer.id);
  }, [householdId, canvasId, layers, activeFloor, settings.canvasMode]);

  const handleAddFloor = useCallback(async () => {
    const maxFloor = floors.length > 0 ? Math.max(...floors) : -1;
    const newFloor = maxFloor + 1;
    const nextOrder = layers.length > 0 ? Math.max(...layers.map((l) => l.sortOrder)) + 1 : 0;
    const layer = await createCanvasLayer(householdId, canvasId, {
      name: newFloor === 0 ? "Ground Floor" : `Floor ${newFloor}`,
      sortOrder: nextOrder,
      floorNumber: newFloor,
    });
    setLayers((prev) => [...prev, layer]);
    setActiveFloor(newFloor);
    setActiveLayerId(layer.id);
  }, [householdId, canvasId, layers, floors]);

  const handleUpdateLayer = useCallback(async (layerId: string, patch: Parameters<typeof updateCanvasLayer>[3]) => {
    const updated = await updateCanvasLayer(householdId, canvasId, layerId, patch);
    setLayers((prev) => prev.map((l) => l.id === layerId ? updated : l));
  }, [householdId, canvasId]);

  const handleDeleteLayer = useCallback(async (layerId: string) => {
    if (layers.length <= 1) return;
    await deleteCanvasLayer(householdId, canvasId, layerId);
    const remaining = layers.filter((l) => l.id !== layerId);
    setLayers(remaining);
    // Reassign nodes from the deleted layer to the default
    const defaultLayer = [...remaining].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    setNodes((prev) => prev.map((n) => n.layerId === layerId ? { ...n, layerId: defaultLayer?.id ?? null } : n));
    if (activeLayerId === layerId) {
      setActiveLayerId(defaultLayer?.id ?? null);
    }
  }, [householdId, canvasId, layers, activeLayerId]);

  const handleMoveLayerUp = useCallback(async (layerId: string) => {
    const sorted = [...layers].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx >= sorted.length - 1) return;
    // Swap with next item (higher sortOrder = visually higher)
    const next = sorted[idx + 1];
    const cur = sorted[idx];
    if (!cur || !next) return;
    const newLayers = layers.map((l) => {
      if (l.id === cur.id) return { ...l, sortOrder: next.sortOrder };
      if (l.id === next.id) return { ...l, sortOrder: cur.sortOrder };
      return l;
    });
    setLayers(newLayers);
    await updateCanvasLayer(householdId, canvasId, cur.id, { sortOrder: next.sortOrder });
    await updateCanvasLayer(householdId, canvasId, next.id, { sortOrder: cur.sortOrder });
  }, [householdId, canvasId, layers]);

  const handleMoveLayerDown = useCallback(async (layerId: string) => {
    const sorted = [...layers].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    const cur = sorted[idx];
    if (!cur || !prev) return;
    const newLayers = layers.map((l) => {
      if (l.id === cur.id) return { ...l, sortOrder: prev.sortOrder };
      if (l.id === prev.id) return { ...l, sortOrder: cur.sortOrder };
      return l;
    });
    setLayers(newLayers);
    await updateCanvasLayer(householdId, canvasId, cur.id, { sortOrder: prev.sortOrder });
    await updateCanvasLayer(householdId, canvasId, prev.id, { sortOrder: cur.sortOrder });
  }, [householdId, canvasId, layers]);

  // Helper: create a node on the active layer
  const createNodeOnActiveLayer = useCallback(
    (input: Parameters<typeof createCanvasNode>[2]) =>
      createCanvasNode(householdId, canvasId, { ...input, layerId: activeLayerId ?? undefined }),
    [householdId, canvasId, activeLayerId]
  );

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

      const node = await createNodeOnActiveLayer({
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
      setImgObjUploadError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setImgObjUploading(false);
    }
  }, [householdId, canvasId, zoom, panX, panY, nodes, edges, maybeSnap, pushHistory]);

  // ─── Place object from library / preset ───────────────────────────────────

  const handlePlaceObject = useCallback((placement: CanvasObjectPlacement) => {
    setObjectPickerOpen(false);
    setPendingObjectPlacement(placement);
    setActiveTool("object");
  }, []);

  // ─── Copy / Paste ─────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    clipboardRef.current = nodes.filter((n) => selectedIds.has(n.id));
  }, [selectedIds, nodes]);

  const handlePaste = useCallback(async () => {
    const clip = clipboardRef.current;
    if (clip.length === 0) return;
    // Map old groupIds to new ones so pasted groups stay grouped but separate from originals
    const groupIdMap = new Map<string, string>();
    for (const n of clip) {
      if (n.groupId && !groupIdMap.has(n.groupId)) groupIdMap.set(n.groupId, crypto.randomUUID());
    }
    const created = await Promise.all(
      clip.map((n) => createNodeOnActiveLayer({
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
        groupId: n.groupId ? groupIdMap.get(n.groupId) : undefined,
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

  const handleEscape = useCallback(() => {
    setDrag({ type: "none" });
    setActiveTool("select");
    setEditingNodeId(null);
    setEditingEdgeId(null);
    setPendingObjectPlacement(null);
    wallChainStartRef.current = null;
    setWallPreviewEnd(null);
    setWallDimEdit(null);
    arcWallRef.current = null;
    setArcPreview(null);
    roomPointsRef.current = [];
    setRoomPreviewPoints([]);
    setRoomPreviewCursor(null);
  }, []);

  const handleFinishWallChain = useCallback(() => {
    wallChainStartRef.current = null;
    setWallPreviewEnd(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  const handleRotate90 = useCallback(() => {
    if (selectedIds.size === 0) return;
    const nonRotatable = new Set(["wall", "dimension", "freehand", "room"]);
    const toRotate = nodes.filter((n) => selectedIds.has(n.id) && !nonRotatable.has(n.objectType));
    if (toRotate.length === 0) return;
    setNodes((prev) => prev.map((n) => {
      if (!selectedIds.has(n.id) || nonRotatable.has(n.objectType)) return n;
      return { ...n, rotation: ((n.rotation ?? 0) + 90) % 360 };
    }));
    for (const n of toRotate) {
      pendingNodeUpdates.current.set(n.id, { rotation: ((n.rotation ?? 0) + 90) % 360 });
    }
    pushHistory(nodes.map((n) => {
      if (!selectedIds.has(n.id) || nonRotatable.has(n.objectType)) return n;
      return { ...n, rotation: ((n.rotation ?? 0) + 90) % 360 };
    }), edges);
    scheduleSyncPositions();
  }, [selectedIds, nodes, edges, pushHistory, scheduleSyncPositions, pendingNodeUpdates]);

  useCanvasKeyboard({
    editingNodeId,
    editingEdgeId,
    editingName,
    showSettings,
    activeTool,
    physicalUnit: settings.physicalUnit,
    nodes,
    hasWallChain: wallChainStartRef.current !== null,
    onDelete: handleDeleteSelected,
    onUndo: undo,
    onRedo: redo,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onEscape: handleEscape,
    onFinishWallChain: handleFinishWallChain,
    onSelectAll: handleSelectAll,
    onRotate90: handleRotate90,
    onGroup: handleGroupSelected,
    onUngroup: handleUngroupSelected,
    setActiveTool,
  });

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
    // Rotation handle: above top-center, visible for rotatable object types
    const canRotate = !["wall", "dimension", "freehand", "room"].includes(node.objectType);
    const rotHandleY = y - 24 / zoom;
    const rotHandleCx = x + w / 2;
    return (
      <>
        {canRotate && (
          <>
            <line x1={rotHandleCx} y1={y} x2={rotHandleCx} y2={rotHandleY}
              stroke="var(--accent)" strokeWidth={1 / zoom} pointerEvents="none" />
            <circle cx={rotHandleCx} cy={rotHandleY} r={5 / zoom}
              fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5 / zoom}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => handleRotateMouseDown(e, node.id)} />
          </>
        )}
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

  // Pre-compute wall polygons with miter joins at shared endpoints
  const wallMiterPolygons = useMemo(() => {
    const wallNodes = nodes.filter((n) => n.objectType === "wall");
    if (wallNodes.length < 2) return new Map<string, { x: number; y: number }[]>();
    return computeWallPolygonsWithMiters(wallNodes);
  }, [nodes]);

  const renderNode = (node: IdeaCanvasNode) => {
    const isSelected = selectedIds.has(node.id);
    const isEditing = node.id === editingNodeId;
    const linkedEntry = node.entryId ? entryMap.get(node.entryId) : undefined;
    const selStroke = "var(--accent)";
    const defaultStroke = node.strokeColor ?? "#475569";
    const stroke = isSelected ? selStroke : defaultStroke;
    const sw = isSelected ? 2.5 : (node.strokeWidth ?? 1.5);
    const cursor = drag.type === "edge" ? "crosshair" : "grab";

    // Rotation transform for rotatable nodes
    const rot = node.rotation ?? 0;
    const rotTransform = rot !== 0 ? `rotate(${rot} ${node.x + node.width / 2} ${node.y + node.height / 2})` : undefined;

    const nodeEvents = {
      onMouseDown: (e: React.MouseEvent) => handleNodeMouseDown(e, node.id),
      onMouseUp: () => handleNodeMouseUp(node.id),
      onDoubleClick: () => handleNodeDoubleClick(node.id),
      onContextMenu: (e: React.MouseEvent) => handleNodeContextMenu(e, node.id),
    };

    if (node.objectType === "image") {
      const imgUrl = nodeImageUrls.get(node.id);
      return (
        <g key={node.id} transform={rotTransform}>
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
        <g key={node.id} transform={rotTransform}>
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

    if (node.objectType === "wall") {
      const thickness = (node.strokeWidth ?? 6) * (isSelected ? 1.15 : 1);
      const wallFill = isSelected ? "var(--accent-soft, rgba(99,102,241,0.15))" : (node.fillColor ?? "#d1d5db");
      const wallStroke = isSelected ? selStroke : (node.strokeColor ?? "#374151");
      const isCurved = node.pointAx != null && node.pointAy != null;

      if (isCurved) {
        // Curved wall: render as SVG arc
        const arc = arcFromThreePoints(
          { x: node.x, y: node.y },
          { x: node.pointAx!, y: node.pointAy! },
          { x: node.x2, y: node.y2 },
        );
        if (arc) {
          const centerD = svgArcPath(node.x, node.y, node.x2, node.y2, arc.radius, arc.sweepFlag);
          const thickD = arcWallPolygonPath(
            node.x, node.y, node.x2, node.y2,
            arc.radius, arc.sweepFlag, thickness,
          );
          const len = arcLength(arc);
          const mx = (node.x + node.x2) / 2;
          const my = (node.y + node.y2) / 2;
          const lenLabel = (pixelsPerUnit && settings.physicalUnit)
            ? fmtPhysical(len, pixelsPerUnit, settings.physicalUnit!)
            : null;
          return (
            <g key={node.id}>
              {/* Wide hit area arc */}
              <path d={centerD} fill="none" stroke="transparent"
                strokeWidth={Math.max(thickness * 2, 14)} style={{ cursor }} {...nodeEvents} />
              {/* Filled arc wall */}
              <path d={thickD} fill={wallFill} stroke={wallStroke}
                strokeWidth={1} pointerEvents="none" />
              {/* Endpoint dots */}
              <circle cx={node.x} cy={node.y} r={thickness / 2} fill={wallFill} stroke={wallStroke}
                strokeWidth={1} pointerEvents="none" />
              <circle cx={node.x2} cy={node.y2} r={thickness / 2} fill={wallFill} stroke={wallStroke}
                strokeWidth={1} pointerEvents="none" />
              {lenLabel ? (
                <text x={mx} y={my - thickness / 2 - 6}
                  textAnchor="middle" fontSize={11 / zoom} fill="var(--ink)"
                  pointerEvents="none" style={{ userSelect: "none" }}>
                  {lenLabel}
                </text>
              ) : null}
              {isSelected && (
                <path d={thickD} fill="none" stroke={selStroke}
                  strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom},${2 / zoom}`}
                  pointerEvents="none" />
              )}
              {isSelected && renderResizeHandles(node)}
            </g>
          );
        }
        // Fallback: render as straight wall if arc computation fails (e.g., collinear)
      }

      // Straight wall
      // Use miter-joined polygon if available, otherwise basic
      const miterPoly = wallMiterPolygons.get(node.id);
      const poly = miterPoly ?? wallPolygonFromLine(node.x, node.y, node.x2, node.y2, thickness);
      const polyPts = poly.map(p => `${p.x},${p.y}`).join(" ");
      // Wide transparent hit area (uses polygon shape, not stroke line)
      const hitPoly = wallPolygonFromLine(node.x, node.y, node.x2, node.y2, Math.max(thickness * 2, 14));
      const hitPts = hitPoly.map(p => `${p.x},${p.y}`).join(" ");
      // Physical length label
      const wallLenLabel = (pixelsPerUnit && settings.physicalUnit) ? (() => {
        const dx = node.x2 - node.x;
        const dy = node.y2 - node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = (node.x + node.x2) / 2;
        const my = (node.y + node.y2) / 2;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const label = fmtPhysical(len, pixelsPerUnit, settings.physicalUnit!);
        return (
          <text
            x={mx} y={my - thickness / 2 - 4}
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
          <polygon points={hitPts} fill="transparent" style={{ cursor }} {...nodeEvents} />
          {/* Filled wall polygon */}
          <polygon points={polyPts} fill={wallFill} stroke={wallStroke}
            strokeWidth={1} pointerEvents="none" />
          {/* Endpoint dots */}
          <circle cx={node.x} cy={node.y} r={thickness / 2} fill={wallFill} stroke={wallStroke}
            strokeWidth={1} pointerEvents="none" />
          <circle cx={node.x2} cy={node.y2} r={thickness / 2} fill={wallFill} stroke={wallStroke}
            strokeWidth={1} pointerEvents="none" />
          {wallLenLabel}
          {isSelected && (
            <>
              {/* Selection outline */}
              <polygon points={polyPts} fill="none" stroke={selStroke}
                strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom},${2 / zoom}`}
                pointerEvents="none" />
            </>
          )}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "line") {
      return (
        <g key={node.id}>
          {/* Wide hit area */}
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke="transparent" strokeWidth={Math.max(sw * 2, 12)} style={{ cursor }}
            {...nodeEvents} />
          <line x1={node.x} y1={node.y} x2={node.x2} y2={node.y2}
            stroke={stroke} strokeWidth={sw} strokeLinecap="round"
            pointerEvents="none" />
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
      // Room polygon stored in maskJson as { type: "polygon", points: {x,y}[] } relative to node origin
      let pts = "";
      let polyPoints: { x: number; y: number }[] = [];
      if (node.maskJson) {
        try {
          const mask = JSON.parse(node.maskJson) as { type: string; points: { x: number; y: number }[] };
          if (mask.type === "polygon") {
            polyPoints = mask.points.map((p) => ({ x: node.x + p.x, y: node.y + p.y }));
            pts = polyPoints.map((p) => `${p.x},${p.y}`).join(" ");
          }
        } catch { /* no-op */ }
      }
      if (!pts) {
        polyPoints = [
          { x: node.x, y: node.y },
          { x: node.x + node.width, y: node.y },
          { x: node.x + node.width, y: node.y + node.height },
          { x: node.x, y: node.y + node.height },
        ];
        pts = polyPoints.map((p) => `${p.x},${p.y}`).join(" ");
      }
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      // Compute area dynamically from polygon geometry
      let areaText = "";
      if (pixelsPerUnit && settings.physicalUnit && polyPoints.length >= 3) {
        const pxArea = polygonArea(polyPoints);
        const physArea = pxArea / (pixelsPerUnit * pixelsPerUnit);
        areaText = `${physArea % 1 === 0 ? physArea.toFixed(0) : physArea.toFixed(1)} ${settings.physicalUnit}²`;
      }
      return (
        <g key={node.id}>
          <polygon points={pts}
            fill={node.fillColor ?? "rgba(99,102,241,0.07)"}
            stroke={isSelected ? selStroke : (node.strokeColor ?? "#6366f1")}
            strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
            strokeDasharray={`${4 / zoom},${2 / zoom}`}
            style={{ cursor }} {...nodeEvents} />
          {isEditing ? (
            <foreignObject x={node.x + 4} y={cy - 14} width={node.width - 8} height={28}
              pointerEvents="auto">
              <input
                className="idea-canvas__node-label-input"
                defaultValue={node.label}
                placeholder="Room name"
                autoFocus
                onBlur={(e) => handleLabelCommit(node.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLabelCommit(node.id, (e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setEditingNodeId(null);
                }}
              />
            </foreignObject>
          ) : (node.label || areaText) ? (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize={13 / zoom} fill="var(--ink)"
              pointerEvents="none" style={{ userSelect: "none" }}>
              {node.label ? (
                <tspan x={cx} dy={areaText ? "-0.5em" : "0"} fontWeight="600">{node.label}</tspan>
              ) : null}
              {areaText ? (
                <tspan x={cx} dy={node.label ? "1.2em" : "0"} fontSize={11 / zoom} opacity={0.7}>{areaText}</tspan>
              ) : null}
            </text>
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "door") {
      // Door: centered at (x,y), rotated to wall angle, width = opening width
      const w = node.width;
      const h = node.height || 6;
      const rot = node.rotation ?? 0;
      const swing = (node as Record<string, unknown>).swingDirection as string | null ?? "left";
      const strokeCol = isSelected ? selStroke : (node.strokeColor ?? "#374151");
      return (
        <g key={node.id} transform={`translate(${node.x},${node.y}) rotate(${rot})`}>
          {/* Gap clear rectangle (white to mask wall) */}
          <rect x={-w / 2} y={-h / 2 - 1} width={w} height={h + 2}
            fill="#ffffff" stroke="none" style={{ cursor }} {...nodeEvents} />
          {/* Door line (the leaf) */}
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0}
            stroke={strokeCol} strokeWidth={1.5 / zoom} pointerEvents="none" />
          {/* Swing arc(s) — left: hinge at left, right: hinge at right, double: both */}
          {(swing === "left" || swing === "double") && (
            <path d={`M ${w / 2},0 A ${w},${w} 0 0,1 ${-w / 2},${-w}`}
              fill="none" stroke={strokeCol}
              strokeWidth={0.75 / zoom} strokeDasharray={`${3 / zoom},${2 / zoom}`}
              pointerEvents="none" />
          )}
          {(swing === "right" || swing === "double") && (
            <path d={`M ${-w / 2},0 A ${w},${w} 0 0,0 ${w / 2},${-w}`}
              fill="none" stroke={strokeCol}
              strokeWidth={0.75 / zoom} strokeDasharray={`${3 / zoom},${2 / zoom}`}
              pointerEvents="none" />
          )}
          {/* Hinge markers */}
          {(swing === "left" || swing === "double") && (
            <circle cx={-w / 2} cy={0} r={2 / zoom} fill={node.strokeColor ?? "#374151"} pointerEvents="none" />
          )}
          {(swing === "right" || swing === "double") && (
            <circle cx={w / 2} cy={0} r={2 / zoom} fill={node.strokeColor ?? "#374151"} pointerEvents="none" />
          )}
          {isSelected && (
            <rect x={-w / 2 - 2} y={-w - 2} width={w + 4} height={w + h / 2 + 4}
              fill="none" stroke="var(--accent)" strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              pointerEvents="none" />
          )}
        </g>
      );
    }

    if (node.objectType === "window") {
      // Window: centered at (x,y), rotated to wall angle
      const w = node.width;
      const h = node.height || 6;
      const rot = node.rotation ?? 0;
      return (
        <g key={node.id} transform={`translate(${node.x},${node.y}) rotate(${rot})`}>
          {/* Gap clear rectangle */}
          <rect x={-w / 2} y={-h / 2 - 1} width={w} height={h + 2}
            fill="#ffffff" stroke="none" style={{ cursor }} {...nodeEvents} />
          {/* Window frame */}
          <rect x={-w / 2} y={-h / 4} width={w} height={h / 2}
            fill="none" stroke={isSelected ? selStroke : (node.strokeColor ?? "#374151")}
            strokeWidth={1 / zoom} pointerEvents="none" />
          {/* Glass panes (two parallel lines) */}
          <line x1={-w / 2} y1={-1 / zoom} x2={w / 2} y2={-1 / zoom}
            stroke={isSelected ? selStroke : "#93c5fd"} strokeWidth={1 / zoom} pointerEvents="none" />
          <line x1={-w / 2} y1={1 / zoom} x2={w / 2} y2={1 / zoom}
            stroke={isSelected ? selStroke : "#93c5fd"} strokeWidth={1 / zoom} pointerEvents="none" />
          {/* Hit area */}
          <rect x={-w / 2} y={-h / 2} width={w} height={h}
            fill="transparent" stroke="none" style={{ cursor }} {...nodeEvents} />
          {isSelected && (
            <rect x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4}
              fill="none" stroke="var(--accent)" strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              pointerEvents="none" />
          )}
        </g>
      );
    }

    if (node.objectType === "stairs") {
      // Stairs: rectangle with step lines and direction arrow
      const w = node.width;
      const h = node.height;
      const dir = (node as Record<string, unknown>).stairDirection as string | null ?? "up";
      const isHorizontal = dir === "left" || dir === "right";
      const stepCount = Math.max(3, Math.round((isHorizontal ? w : h) / (pixelsPerUnit ? pixelsPerUnit * 0.25 : 12)));
      const stepSize = (isHorizontal ? w : h) / stepCount;
      // Arrow geometry
      const cx = node.x + w / 2;
      const cy = node.y + h / 2;
      const arrowSize = 5 / zoom;
      let arrowLine: { x1: number; y1: number; x2: number; y2: number };
      let arrowHead: string;
      switch (dir) {
        case "down":
          arrowLine = { x1: cx, y1: node.y + h * 0.15, x2: cx, y2: node.y + h * 0.85 };
          arrowHead = `${cx},${node.y + h * 0.9} ${cx - arrowSize},${node.y + h * 0.8} ${cx + arrowSize},${node.y + h * 0.8}`;
          break;
        case "left":
          arrowLine = { x1: node.x + w * 0.85, y1: cy, x2: node.x + w * 0.15, y2: cy };
          arrowHead = `${node.x + w * 0.1},${cy} ${node.x + w * 0.2},${cy - arrowSize} ${node.x + w * 0.2},${cy + arrowSize}`;
          break;
        case "right":
          arrowLine = { x1: node.x + w * 0.15, y1: cy, x2: node.x + w * 0.85, y2: cy };
          arrowHead = `${node.x + w * 0.9},${cy} ${node.x + w * 0.8},${cy - arrowSize} ${node.x + w * 0.8},${cy + arrowSize}`;
          break;
        default: // up
          arrowLine = { x1: cx, y1: node.y + h * 0.85, x2: cx, y2: node.y + h * 0.15 };
          arrowHead = `${cx},${node.y + h * 0.1} ${cx - arrowSize},${node.y + h * 0.2} ${cx + arrowSize},${node.y + h * 0.2}`;
          break;
      }
      return (
        <g key={node.id}>
          {/* Outer rectangle */}
          <rect x={node.x} y={node.y} width={w} height={h}
            fill={node.fillColor ?? "rgba(255,255,255,0.9)"}
            stroke={isSelected ? selStroke : (node.strokeColor ?? "#374151")}
            strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
            style={{ cursor }} {...nodeEvents} />
          {/* Step lines */}
          {Array.from({ length: stepCount - 1 }, (_, i) => {
            if (isHorizontal) {
              const sx = node.x + stepSize * (i + 1);
              return <line key={i} x1={sx} y1={node.y} x2={sx} y2={node.y + h}
                stroke={node.strokeColor ?? "#374151"} strokeWidth={0.5 / zoom} pointerEvents="none" />;
            }
            const sy = node.y + stepSize * (i + 1);
            return <line key={i} x1={node.x} y1={sy} x2={node.x + w} y2={sy}
              stroke={node.strokeColor ?? "#374151"} strokeWidth={0.5 / zoom} pointerEvents="none" />;
          })}
          {/* Direction arrow */}
          <line x1={arrowLine.x1} y1={arrowLine.y1} x2={arrowLine.x2} y2={arrowLine.y2}
            stroke={node.strokeColor ?? "#374151"} strokeWidth={1.5 / zoom} pointerEvents="none" />
          <polygon points={arrowHead}
            fill={node.strokeColor ?? "#374151"} pointerEvents="none" />
          {/* Floor label */}
          {node.fromFloor != null && node.toFloor != null && (() => {
            const fmt = (f: number) => f === 0 ? "G" : f > 0 ? `${f}` : `B${Math.abs(f)}`;
            return (
              <text x={cx} y={node.y + h - 4 / zoom} textAnchor="middle"
                fontSize={9 / zoom} fill={node.strokeColor ?? "#374151"} fontWeight="600" pointerEvents="none">
                {`${fmt(node.fromFloor)}→${fmt(node.toFloor)}`}
              </text>
            );
          })()}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "freehand") {
      let d = "";
      if (node.pointsJson) {
        try {
          const pts = JSON.parse(node.pointsJson) as { x: number; y: number }[];
          d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
        } catch { /* ignore */ }
      }
      if (!d) {
        d = `M${node.x},${node.y} L${node.x + node.width},${node.y + node.height}`;
      }
      return (
        <g key={node.id}>
          {/* Wide hit area */}
          <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(sw * 4, 12)}
            style={{ cursor }} {...nodeEvents} />
          <path d={d} fill="none"
            stroke={isSelected ? selStroke : (node.strokeColor ?? "#333333")}
            strokeWidth={isSelected ? sw + 1 : (node.strokeWidth ?? 2)}
            strokeLinecap="round" strokeLinejoin="round"
            pointerEvents="none" />
          {isSelected ? (
            <rect x={node.x - 2} y={node.y - 2} width={node.width + 4} height={node.height + 4}
              fill="none" stroke="var(--accent)" strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              pointerEvents="none" />
          ) : null}
        </g>
      );
    }

    if (node.objectType === "circle") {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      const rx = node.width / 2;
      const ry = node.height / 2;
      return (
        <g key={node.id} transform={rotTransform}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
            fill={node.fillColor ?? node.color ?? "transparent"}
            stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents} />
          {node.label ? (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize={node.fontSize ?? 14} fill="var(--ink)" style={{ pointerEvents: "none", userSelect: "none" }}>
              {node.label}
            </text>
          ) : null}
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "text") {
      return (
        <g key={node.id} transform={rotTransform}>
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
                style={{ width: "100%", height: "100%", resize: "none", fontSize: `${node.fontSize ?? 14}px` }}
              />
            ) : (
              <div className="idea-canvas__text-content" style={{ fontSize: `${node.fontSize ?? 14}px` }}>{node.label}</div>
            )}
          </foreignObject>
          {isSelected && renderResizeHandles(node)}
        </g>
      );
    }

    if (node.objectType === "rect") {
      return (
        <g key={node.id} transform={rotTransform}>
          <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={4} ry={4}
            fill={node.fillColor ?? node.color ?? "transparent"}
            stroke={stroke} strokeWidth={sw}
            style={{ cursor }}
            {...nodeEvents} />
          {node.label ? (
            <foreignObject x={node.x + 4} y={node.y + 4} width={node.width - 8} height={node.height - 8}
              pointerEvents="none">
              <div className="idea-canvas__node-content" style={{ fontSize: `${node.fontSize ?? 14}px` }}>{node.label}</div>
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
      <g key={node.id} transform={rotTransform}>
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
              style={{ fontSize: `${node.fontSize ?? 14}px` }}
              onBlur={(e) => handleLabelCommit(node.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelCommit(node.id, (e.target as HTMLInputElement).value);
                if (e.key === "Escape") setEditingNodeId(null);
              }}
            />
          ) : (
            <div className="idea-canvas__node-content" style={{ fontSize: `${node.fontSize ?? 14}px` }}>
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
    if (drag.type === "freehand" && drag.points.length >= 2) {
      const d = drag.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
      return (
        <path d={d} fill="none" stroke="#333333" strokeWidth={2} strokeLinecap="round"
          strokeLinejoin="round" pointerEvents="none" />
      );
    }
    if (drag.type === "wall") {
      // Legacy drag-based preview (kept for backwards compat, but shouldn't fire with new click-based tool)
      return null;
    }
    // Wall click-based preview
    if (activeTool === "wall" && wallChainStartRef.current && wallPreviewEnd) {
      const startCX = wallChainStartRef.current.cx;
      const startCY = wallChainStartRef.current.cy;
      const endCX = wallPreviewEnd.cx;
      const endCY = wallPreviewEnd.cy;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const previewThickness = 6;
      const poly = wallPolygonFromLine(startCX, startCY, endCX, endCY, previewThickness);
      const polyPts = poly.map(p => `${p.x},${p.y}`).join(" ");
      return (
        <g>
          {/* Polygon preview outline */}
          <polygon points={polyPts} fill="rgba(209,213,219,0.35)" stroke="#374151"
            strokeWidth={1} strokeDasharray="6,3" pointerEvents="none" />
          {/* Endpoint caps */}
          <circle cx={startCX} cy={startCY} r={previewThickness / 2} fill="rgba(209,213,219,0.35)"
            stroke="#374151" strokeWidth={1} strokeDasharray="6,3" pointerEvents="none" />
          <circle cx={endCX} cy={endCY} r={previewThickness / 2} fill="rgba(209,213,219,0.35)"
            stroke="#374151" strokeWidth={1} strokeDasharray="6,3" pointerEvents="none" />
          {len > 4 && pixelsPerUnit && settings.physicalUnit ? (
            <text x={(startCX + endCX) / 2} y={(startCY + endCY) / 2 - previewThickness / 2 - 4}
              textAnchor="middle" fontSize={11 / zoom} fill="#374151" pointerEvents="none">
              {fmtPhysical(len, pixelsPerUnit, settings.physicalUnit)}
            </text>
          ) : null}
          {/* Start point marker */}
          <circle cx={startCX} cy={startCY} r={4 / zoom} fill="#374151" pointerEvents="none" />
          {/* Snap indicator at endpoint */}
          <circle cx={endCX} cy={endCY} r={4 / zoom} fill="#374151" opacity={0.5} pointerEvents="none" />
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
    // Calibration tool preview line
    if (drag.type === "calibrate") {
      const { startCX, startCY, endCX, endCY } = drag;
      const dx = endCX - startCX;
      const dy = endCY - startCY;
      const len = Math.sqrt(dx * dx + dy * dy);
      return (
        <g>
          <line x1={startCX} y1={startCY} x2={endCX} y2={endCY}
            stroke="#f59e0b" strokeWidth={2.5 / zoom} strokeDasharray={`${6 / zoom},${3 / zoom}`}
            pointerEvents="none" />
          {len > 4 ? (
            <text x={(startCX + endCX) / 2} y={(startCY + endCY) / 2 - 10 / zoom}
              textAnchor="middle" fontSize={12 / zoom} fill="#f59e0b" fontWeight="600" pointerEvents="none">
              {Math.round(len)} px — enter distance
            </text>
          ) : null}
          <circle cx={startCX} cy={startCY} r={4 / zoom} fill="#f59e0b" pointerEvents="none" />
          <circle cx={endCX} cy={endCY} r={4 / zoom} fill="#f59e0b" pointerEvents="none" />
        </g>
      );
    }
    // Calibration line persisted while dialog is open
    if (calibrationLine) {
      const { startCX, startCY, endCX, endCY } = calibrationLine;
      return (
        <g>
          <line x1={startCX} y1={startCY} x2={endCX} y2={endCY}
            stroke="#f59e0b" strokeWidth={2.5 / zoom}
            pointerEvents="none" />
          <circle cx={startCX} cy={startCY} r={4 / zoom} fill="#f59e0b" pointerEvents="none" />
          <circle cx={endCX} cy={endCY} r={4 / zoom} fill="#f59e0b" pointerEvents="none" />
        </g>
      );
    }
    // Arc wall preview
    if (arcPreview) {
      if (arcPreview.phase === 1) {
        // Phase 1: straight line from start to cursor
        return (
          <g>
            <line x1={arcPreview.sx} y1={arcPreview.sy} x2={arcPreview.ex} y2={arcPreview.ey}
              stroke="#374151" strokeWidth={2} strokeDasharray="6,3" opacity={0.6} pointerEvents="none" />
            <circle cx={arcPreview.sx} cy={arcPreview.sy} r={4 / zoom} fill="#374151" pointerEvents="none" />
            <circle cx={arcPreview.ex} cy={arcPreview.ey} r={4 / zoom} fill="#374151" opacity={0.5} pointerEvents="none" />
          </g>
        );
      } else {
        // Phase 2: arc preview from start to end passing through midpoint
        const arc = arcFromThreePoints(
          { x: arcPreview.sx, y: arcPreview.sy },
          { x: arcPreview.mx, y: arcPreview.my },
          { x: arcPreview.ex, y: arcPreview.ey },
        );
        if (arc) {
          const d = svgArcPath(arcPreview.sx, arcPreview.sy, arcPreview.ex, arcPreview.ey, arc.radius, arc.sweepFlag);
          const len = arcLength(arc);
          const midX = (arcPreview.sx + arcPreview.ex) / 2;
          const midY = (arcPreview.sy + arcPreview.ey) / 2;
          return (
            <g>
              <path d={d} fill="none" stroke="#374151" strokeWidth={6}
                strokeDasharray="8,4" opacity={0.6} pointerEvents="none" />
              {/* Arc midpoint indicator */}
              <circle cx={arcPreview.mx} cy={arcPreview.my} r={4 / zoom}
                fill="#0ea5e9" opacity={0.7} pointerEvents="none" />
              {/* Endpoint markers */}
              <circle cx={arcPreview.sx} cy={arcPreview.sy} r={4 / zoom} fill="#374151" pointerEvents="none" />
              <circle cx={arcPreview.ex} cy={arcPreview.ey} r={4 / zoom} fill="#374151" pointerEvents="none" />
              {/* Length label */}
              {len > 4 && pixelsPerUnit && settings.physicalUnit ? (
                <text x={midX} y={midY - 10}
                  textAnchor="middle" fontSize={11 / zoom} fill="#374151" pointerEvents="none">
                  {fmtPhysical(len, pixelsPerUnit, settings.physicalUnit)} (arc)
                </text>
              ) : null}
            </g>
          );
        }
        // Fallback: straight line if arc can't be computed (collinear)
        return (
          <g>
            <line x1={arcPreview.sx} y1={arcPreview.sy} x2={arcPreview.ex} y2={arcPreview.ey}
              stroke="#374151" strokeWidth={2} strokeDasharray="6,3" opacity={0.6} pointerEvents="none" />
            <circle cx={arcPreview.mx} cy={arcPreview.my} r={4 / zoom}
              fill="#0ea5e9" opacity={0.5} pointerEvents="none" />
          </g>
        );
      }
    }
    // Door/window placement preview
    if (openingPreview && (activeTool === "door" || activeTool === "window")) {
      const { x, y, angle, wallThickness } = openingPreview;
      const defaultW = pixelsPerUnit ? pixelsPerUnit * (settings.physicalUnit === "ft" ? 3 : settings.physicalUnit === "in" ? 36 : 0.9) : 40;
      const rot = (angle * 180) / Math.PI;
      if (activeTool === "door") {
        return (
          <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={0.6} pointerEvents="none">
            <rect x={-defaultW / 2} y={-wallThickness / 2 - 1} width={defaultW} height={wallThickness + 2}
              fill="#ffffff" stroke="none" />
            <line x1={-defaultW / 2} y1={0} x2={defaultW / 2} y2={0}
              stroke="#374151" strokeWidth={1.5 / zoom} />
            <path d={`M ${defaultW / 2},0 A ${defaultW},${defaultW} 0 0,1 ${-defaultW / 2 + defaultW * (1 - Math.cos(Math.PI / 2))},${-defaultW * Math.sin(Math.PI / 2)}`}
              fill="none" stroke="#374151" strokeWidth={0.75 / zoom} strokeDasharray={`${3 / zoom},${2 / zoom}`} />
            <circle cx={-defaultW / 2} cy={0} r={2 / zoom} fill="#374151" />
          </g>
        );
      } else {
        return (
          <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={0.6} pointerEvents="none">
            <rect x={-defaultW / 2} y={-wallThickness / 2 - 1} width={defaultW} height={wallThickness + 2}
              fill="#ffffff" stroke="none" />
            <rect x={-defaultW / 2} y={-wallThickness / 4} width={defaultW} height={wallThickness / 2}
              fill="none" stroke="#374151" strokeWidth={1 / zoom} />
            <line x1={-defaultW / 2} y1={-1 / zoom} x2={defaultW / 2} y2={-1 / zoom}
              stroke="#93c5fd" strokeWidth={1 / zoom} />
            <line x1={-defaultW / 2} y1={1 / zoom} x2={defaultW / 2} y2={1 / zoom}
              stroke="#93c5fd" strokeWidth={1 / zoom} />
          </g>
        );
      }
    }
    // Room polygon preview
    if (roomPreviewPoints.length > 0) {
      const pts = roomPreviewPoints;
      const cursor = roomPreviewCursor;
      const allPts = cursor ? [...pts, cursor] : pts;
      const polyPts = allPts.map(p => `${p.x},${p.y}`).join(" ");
      // Check if cursor is near start point (close indicator)
      const nearStart = cursor && pts.length >= 3 && Math.hypot(cursor.x - pts[0].x, cursor.y - pts[0].y) < 15 / zoom;
      return (
        <g>
          {/* Filled preview */}
          <polygon points={polyPts} fill="rgba(59,130,246,0.06)" stroke="#3b82f6"
            strokeWidth={1.5 / zoom} strokeDasharray={`${6 / zoom},${3 / zoom}`} pointerEvents="none" />
          {/* Vertex markers */}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4 / zoom}
              fill={i === 0 && nearStart ? "#22c55e" : "#3b82f6"} pointerEvents="none" />
          ))}
          {/* Close indicator ring around first point */}
          {nearStart && (
            <circle cx={pts[0].x} cy={pts[0].y} r={8 / zoom} fill="none"
              stroke="#22c55e" strokeWidth={2 / zoom} pointerEvents="none" />
          )}
          {/* Area label in preview */}
          {allPts.length >= 3 && pixelsPerUnit && settings.physicalUnit ? (() => {
            const pxArea = Math.abs(polygonArea(allPts));
            const physArea = pxArea / (pixelsPerUnit * pixelsPerUnit);
            const unit = settings.physicalUnit;
            const centroid = polygonCentroid(allPts);
            return (
              <text x={centroid.x} y={centroid.y} textAnchor="middle" dominantBaseline="central"
                fontSize={12 / zoom} fill="#3b82f6" opacity={0.7} pointerEvents="none">
                {physArea.toFixed(1)} {unit}²
              </text>
            );
          })() : null}
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
        <g key={`hx${u}`} pointerEvents="none">
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
        <g key={`vy${u}`} pointerEvents="none">
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
      <g className="canvas-ruler">
        {/* Horizontal ruler — draggable for horizontal guides */}
        <rect x={rulerSize} y={0} width={svgW - rulerSize} height={rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5}
          style={{ cursor: "s-resize" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            const cp = screenToCanvas(e.clientX, e.clientY);
            const id = `g_${Date.now()}`;
            const newGuide: CanvasGuide = { id, axis: "horizontal", position: cp.y };
            setGuides(prev => [...prev, newGuide]);
            setDrag({ type: "guide", guideId: id, axis: "horizontal", startPosition: cp.y });
          }}
        />
        {hTicks}
        {/* Vertical ruler — draggable for vertical guides */}
        <rect x={0} y={rulerSize} width={rulerSize} height={svgH - rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5}
          style={{ cursor: "e-resize" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            const cp = screenToCanvas(e.clientX, e.clientY);
            const id = `g_${Date.now()}`;
            const newGuide: CanvasGuide = { id, axis: "vertical", position: cp.x };
            setGuides(prev => [...prev, newGuide]);
            setDrag({ type: "guide", guideId: id, axis: "vertical", startPosition: cp.x });
          }}
        />
        {vTicks}
        {/* Corner box */}
        <rect x={0} y={0} width={rulerSize} height={rulerSize}
          fill="var(--surface)" stroke="var(--border)" strokeWidth={0.5} />
      </g>
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

  const handleExportSVG = useCallback(() => {
    exportCanvasToSVG(nodes, edges, canvasName, {
      showGrid: false,
      showDimensions: !!settings.showDimensions,
      physicalUnit: settings.physicalUnit,
      pixelsPerUnit,
      imageUrlMap: nodeImageUrls,
      backgroundImageUrl: resolvedBgUrl ?? undefined,
      backgroundImageOpacity: settings.backgroundImageOpacity,
      backgroundImageX: settings.backgroundImageX,
      backgroundImageY: settings.backgroundImageY,
      backgroundImageScale: settings.backgroundImageScale,
      backgroundImageCropX: settings.backgroundImageCropX ?? undefined,
      backgroundImageCropY: settings.backgroundImageCropY ?? undefined,
      backgroundImageCropW: settings.backgroundImageCropW ?? undefined,
      backgroundImageCropH: settings.backgroundImageCropH ?? undefined,
      bgImageDims: bgImageDims ?? undefined,
    });
  }, [nodes, edges, canvasName, settings.showDimensions, settings.physicalUnit, pixelsPerUnit, nodeImageUrls, resolvedBgUrl, settings.backgroundImageOpacity, settings.backgroundImageX, settings.backgroundImageY, settings.backgroundImageScale, settings.backgroundImageCropX, settings.backgroundImageCropY, settings.backgroundImageCropW, settings.backgroundImageCropH, bgImageDims]);

  const handleExportPNG = useCallback(() => {
    exportCanvasToPNG(nodes, edges, canvasName, {
      showGrid: false,
      showDimensions: !!settings.showDimensions,
      physicalUnit: settings.physicalUnit,
      pixelsPerUnit,
      imageUrlMap: nodeImageUrls,
      backgroundImageUrl: resolvedBgUrl ?? undefined,
      backgroundImageOpacity: settings.backgroundImageOpacity,
      backgroundImageX: settings.backgroundImageX,
      backgroundImageY: settings.backgroundImageY,
      backgroundImageScale: settings.backgroundImageScale,
      backgroundImageCropX: settings.backgroundImageCropX ?? undefined,
      backgroundImageCropY: settings.backgroundImageCropY ?? undefined,
      backgroundImageCropW: settings.backgroundImageCropW ?? undefined,
      backgroundImageCropH: settings.backgroundImageCropH ?? undefined,
      bgImageDims: bgImageDims ?? undefined,
    });
  }, [nodes, edges, canvasName, settings.showDimensions, settings.physicalUnit, pixelsPerUnit, nodeImageUrls, resolvedBgUrl, settings.backgroundImageOpacity, settings.backgroundImageX, settings.backgroundImageY, settings.backgroundImageScale, settings.backgroundImageCropX, settings.backgroundImageCropY, settings.backgroundImageCropW, settings.backgroundImageCropH, bgImageDims]);

  const handleExportPDF = useCallback(() => {
    const url = `/api/v1/households/${householdId}/canvases/${canvasId}/export/pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${canvasName || "canvas"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [householdId, canvasId, canvasName]);

  const svgCursor = drag.type === "pan" ? "grabbing"
    : drag.type === "bg-move" ? "grabbing"
    : drag.type === "bg-resize" ? (drag.handle === "nw" || drag.handle === "se" ? "nwse-resize" : "nesw-resize")
    : drag.type === "rotate" ? "grabbing"
    : drag.type === "calibrate" ? "crosshair"
    : activeTool === "pan" ? "grab"
    : activeTool === "calibrate" ? "crosshair"
    : drag.type === "freehand" || drag.type === "edge" || drag.type === "wall" || drag.type === "measure"
      || ["rect", "circle", "line", "text", "node", "wall", "wall-arc", "room", "door", "window", "stairs", "measure", "freehand"].includes(activeTool) ? "crosshair"
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
      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        hasPhysicalUnits={!!settings.physicalUnit}
        canvasMode={canvasMode}
        onOpenSettings={() => setShowSettings((v) => !v)}
        selectedCount={selectedIds.size}
        selectedEdgeId={selectedEdgeId}
        singleSelected={singleSelected ?? null}
        allFlowchartSelected={allFlowchartSelected}
        selectedEdge={selectedEdge ?? null}
        onStartEdge={handleStartEdge}
        onChangeColor={handleChangeColor}
        onChangeShape={handleChangeShape}
        onChangeFillColor={handleChangeFillColor}
        onChangeStrokeColor={handleChangeStrokeColor}
        onChangeStrokeWidth={handleChangeStrokeWidth}
        onChangeFontSize={handleChangeFontSize}
        onChangeEdgeStyle={handleChangeEdgeStyle}
        onChangeWallHeight={handleChangeWallHeight}
        onChangeSwingDirection={handleChangeSwingDirection}
        onChangeStairDirection={handleChangeStairDirection}
        onChangeStairFloors={handleChangeStairFloors}
        physicalUnit={settings.physicalUnit}
        pixelsPerUnit={pixelsPerUnit}
        onDeleteSelected={handleDeleteSelected}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        onZoomIn={() => {
          const next = Math.min(MAX_ZOOM, zoom + ZOOM_STEP * 2);
          setZoom(next); scheduleViewportSync(next, panX, panY);
        }}
        onZoomOut={() => {
          const next = Math.max(MIN_ZOOM, zoom - ZOOM_STEP * 2);
          setZoom(next); scheduleViewportSync(next, panX, panY);
        }}
        onFitToView={handleFitToView}
        objectPickerOpen={objectPickerOpen}
        onToggleObjectPicker={() => {
          if (objectPickerOpen) {
            setObjectPickerOpen(false);
            if (!pendingObjectPlacement) setActiveTool("select");
            return;
          }
          setActiveTool("object");
          setObjectPickerOpen(true);
        }}
        showSettings={showSettings}
        onToggleLayerPanel={() => setShowLayerPanel((v) => !v)}
        showLayerPanel={showLayerPanel}
        floors={floors}
        activeFloor={activeFloor}
        onFloorChange={setActiveFloor}
        onAddFloor={handleAddFloor}
        onExportSVG={handleExportSVG}
        onExportPNG={handleExportPNG}
        onExportPDF={handleExportPDF}
        onShare={simplified ? undefined : () => setShowSharePanel(v => !v)}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onAlignNodes={handleAlignNodes}
        onToggleSnap={handleToggleSnap}
        snapEnabled={settings.snapToGrid ?? false}
        simplified={simplified}
      />

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

          {/* Background image — positioned and scaled via settings */}
          {resolvedBgUrl ? (() => {
            const imgX = settings.backgroundImageX ?? 0;
            const imgY = settings.backgroundImageY ?? 0;
            const imgScale = settings.backgroundImageScale ?? 1;
            const imgW = (bgImageDims?.w ?? 1920) * imgScale;
            const imgH = (bgImageDims?.h ?? 1080) * imgScale;
            const handleSize = 10 / zoom;
            const isLocked = !!settings.backgroundImageLocked;
            const isActive = activeTool === "select" && drag.type === "none" && !isLocked;
            const hasCrop = settings.backgroundImageCropX != null && settings.backgroundImageCropY != null
              && settings.backgroundImageCropW != null && settings.backgroundImageCropH != null;
            const cropClipId = "bg-crop-clip";
            return (
              <g>
                {/* Crop clip-path definition */}
                {hasCrop ? (
                  <defs>
                    <clipPath id={cropClipId}>
                      <rect
                        x={imgX + settings.backgroundImageCropX! * imgW}
                        y={imgY + settings.backgroundImageCropY! * imgH}
                        width={settings.backgroundImageCropW! * imgW}
                        height={settings.backgroundImageCropH! * imgH} />
                    </clipPath>
                  </defs>
                ) : null}
                <image href={resolvedBgUrl}
                  x={imgX} y={imgY}
                  width={imgW} height={imgH}
                  opacity={settings.backgroundImageOpacity ?? 0.5}
                  preserveAspectRatio="none"
                  clipPath={hasCrop ? `url(#${cropClipId})` : undefined}
                  style={{ cursor: isActive ? "move" : undefined }}
                  pointerEvents={isActive ? "visiblePainted" : "none"}
                  onMouseDown={isActive ? (e) => handleBgImageMouseDown(e) : undefined} />
                {/* Border and resize handles — visible when select tool is active and not locked */}
                {isActive ? (
                  <>
                    <rect x={imgX} y={imgY} width={imgW} height={imgH}
                      fill="none" stroke="var(--accent, #3b82f6)" strokeWidth={1.5 / zoom}
                      strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                      pointerEvents="none" />
                    {(["nw", "ne", "se", "sw"] as const).map((h) => {
                      const hx = h.includes("e") ? imgX + imgW - handleSize / 2 : imgX - handleSize / 2;
                      const hy = h.includes("s") ? imgY + imgH - handleSize / 2 : imgY - handleSize / 2;
                      const cursor = h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";
                      return (
                        <rect key={h} x={hx} y={hy} width={handleSize} height={handleSize}
                          fill="white" stroke="var(--accent, #3b82f6)" strokeWidth={1 / zoom}
                          style={{ cursor }} rx={2 / zoom}
                          onMouseDown={(e) => handleBgImageMouseDown(e, h)} />
                      );
                    })}
                  </>
                ) : null}
                {/* Lock badge — shown when background is locked */}
                {isLocked && activeTool === "select" ? (
                  <g pointerEvents="none">
                    <rect x={imgX + imgW - 24 / zoom} y={imgY + 4 / zoom}
                      width={20 / zoom} height={20 / zoom}
                      rx={4 / zoom} fill="rgba(0,0,0,0.55)" />
                    <text x={imgX + imgW - 14 / zoom} y={imgY + 18 / zoom}
                      fontSize={13 / zoom} textAnchor="middle" fill="white">🔒</text>
                  </g>
                ) : null}
              </g>
            );
          })() : null}

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

          {/* Ghost overlay: floor below rendered at reduced opacity */}
          {ghostNodes.length > 0 && (
            <g opacity={0.15} pointerEvents="none" style={{ filter: "grayscale(1)" }}>
              {ghostNodes.map((n) => renderNode(n))}
            </g>
          )}

          {/* Nodes grouped by layer (visible layers in sortOrder, with per-layer opacity + lock) */}
          {(() => {
            const grouped = new Map<string, IdeaCanvasNode[]>();
            for (const n of sortedNodes) {
              const lid = n.layerId ?? defaultLayerId ?? "";
              const grp = grouped.get(lid) ?? [];
              grp.push(n);
              grouped.set(lid, grp);
            }
            return [...layers]
              .filter((l) => visibleLayerIds.has(l.id))
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((layer) => (
                <g key={layer.id} opacity={layer.opacity} pointerEvents={layer.locked ? "none" : "all"}>
                  {(grouped.get(layer.id) ?? []).map(renderNode)}
                </g>
              ));
          })()}

          {/* Draw preview */}
          {renderDrawPreview()}

          {/* Auto parallel-wall dimension overlay */}
          {renderParallelWallDimensions()}

          {/* Persistent guide lines */}
          {guides.map((g) => (
            <line
              key={g.id}
              x1={g.axis === "horizontal" ? -50000 : g.position}
              y1={g.axis === "horizontal" ? g.position : -50000}
              x2={g.axis === "horizontal" ? 50000 : g.position}
              y2={g.axis === "horizontal" ? g.position : 50000}
              stroke="#f472b6" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom},${4 / zoom}`}
              style={{ cursor: g.axis === "horizontal" ? "ns-resize" : "ew-resize" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDrag({ type: "guide", guideId: g.id, axis: g.axis, startPosition: g.position });
              }}
            />
          ))}

          {/* Alignment guides (ephemeral, during drag) */}
          {alignGuides.map((g, i) => (
            <line
              key={`align-${i}`}
              x1={g.axis === "horizontal" ? -50000 : g.position}
              y1={g.axis === "horizontal" ? g.position : -50000}
              x2={g.axis === "horizontal" ? 50000 : g.position}
              y2={g.axis === "horizontal" ? g.position : 50000}
              stroke="#6366f1" strokeWidth={1 / zoom}
              pointerEvents="none"
            />
          ))}

          {/* Group boundary indicators */}
          {(() => {
            const groups = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
            for (const n of nodes) {
              if (!n.groupId) continue;
              const g = groups.get(n.groupId);
              if (g) {
                g.minX = Math.min(g.minX, n.x);
                g.minY = Math.min(g.minY, n.y);
                g.maxX = Math.max(g.maxX, n.objectType === "line" ? Math.max(n.x, n.x2) : n.x + n.width);
                g.maxY = Math.max(g.maxY, n.objectType === "line" ? Math.max(n.y, n.y2) : n.y + n.height);
              } else {
                groups.set(n.groupId, {
                  minX: n.x,
                  minY: n.y,
                  maxX: n.objectType === "line" ? Math.max(n.x, n.x2) : n.x + n.width,
                  maxY: n.objectType === "line" ? Math.max(n.y, n.y2) : n.y + n.height,
                });
              }
            }
            const pad = 4 / zoom;
            return Array.from(groups.entries()).map(([gId, b]) => (
              <rect key={`grp-${gId}`}
                x={b.minX - pad} y={b.minY - pad}
                width={b.maxX - b.minX + pad * 2} height={b.maxY - b.minY + pad * 2}
                fill="none" stroke="var(--accent)" strokeWidth={1 / zoom}
                strokeDasharray={`${3 / zoom},${3 / zoom}`}
                opacity={0.45} rx={3 / zoom}
                pointerEvents="none" />
            ));
          })()}

          {/* Group selection bounding box with resize handles */}
          {selectedIds.size > 1 && drag.type !== "group-resize" ? (() => {
            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
            selectedIds.forEach(id => {
              const n = nodeMap.get(id);
              if (!n) return;
              gMinX = Math.min(gMinX, n.x);
              gMinY = Math.min(gMinY, n.y);
              gMaxX = Math.max(gMaxX, n.x + n.width);
              gMaxY = Math.max(gMaxY, n.y + n.height);
            });
            if (!isFinite(gMinX)) return null;
            const pad = 6 / zoom;
            const gx = gMinX - pad, gy = gMinY - pad;
            const gw = gMaxX - gMinX + pad * 2, gh = gMaxY - gMinY + pad * 2;
            const hSize = 8 / zoom;
            const hHalf = hSize / 2;
            const corners: { handle: ResizeHandle; cx: number; cy: number; cursor: string }[] = [
              { handle: "nw", cx: gx, cy: gy, cursor: "nwse-resize" },
              { handle: "ne", cx: gx + gw, cy: gy, cursor: "nesw-resize" },
              { handle: "se", cx: gx + gw, cy: gy + gh, cursor: "nwse-resize" },
              { handle: "sw", cx: gx, cy: gy + gh, cursor: "nesw-resize" },
              { handle: "n", cx: gx + gw / 2, cy: gy, cursor: "ns-resize" },
              { handle: "s", cx: gx + gw / 2, cy: gy + gh, cursor: "ns-resize" },
              { handle: "e", cx: gx + gw, cy: gy + gh / 2, cursor: "ew-resize" },
              { handle: "w", cx: gx, cy: gy + gh / 2, cursor: "ew-resize" },
            ];
            const startGroupResize = (e: React.MouseEvent, handle: ResizeHandle) => {
              e.stopPropagation();
              const cp = screenToCanvas(e.clientX, e.clientY);
              const startPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
              selectedIds.forEach(id => {
                const n = nodeMap.get(id);
                if (n) startPositions[id] = { x: n.x, y: n.y, width: n.width, height: n.height };
              });
              setDrag({
                type: "group-resize",
                handle,
                startBounds: { x: gMinX, y: gMinY, width: gMaxX - gMinX, height: gMaxY - gMinY },
                startPositions,
                startMouseCX: cp.x,
                startMouseCY: cp.y,
              });
            };
            return (
              <g pointerEvents="all">
                <rect x={gx} y={gy} width={gw} height={gh}
                  fill="none" stroke="var(--accent)" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom},${3 / zoom}`} pointerEvents="none" />
                {corners.map(c => (
                  <rect key={c.handle}
                    x={c.cx - hHalf} y={c.cy - hHalf} width={hSize} height={hSize}
                    fill="white" stroke="var(--accent)" strokeWidth={1.5 / zoom}
                    style={{ cursor: c.cursor }}
                    onMouseDown={(e) => startGroupResize(e, c.handle)} />
                ))}
              </g>
            );
          })() : null}

          {/* Rubber band */}
          {renderRubberBand()}
        </g>

        {/* Ruler strips — outside zoom group, fixed to viewport */}
        {renderRuler()}
      </svg>

      {/* Inline wall dimension input (floating over canvas) */}
      {wallDimEdit && svgRef.current ? (() => {
        const svgRect = svgRef.current.getBoundingClientRect();
        // Midpoint in canvas coords → screen coords
        const midCX = (wallDimEdit.sx + wallDimEdit.ex) / 2;
        const midCY = (wallDimEdit.sy + wallDimEdit.ey) / 2;
        const screenX = (midCX + panX) * zoom;
        const screenY = (midCY + panY) * zoom;
        return (
          <div className="idea-canvas__dim-input-overlay"
            style={{ left: screenX, top: screenY - 30 }}>
            <input
              type="text"
              className="idea-canvas__dim-input"
              value={wallDimEdit.value}
              onChange={(e) => setWallDimEdit({ ...wallDimEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitWallDimEdit(true); e.preventDefault(); }
                if (e.key === "Escape") { commitWallDimEdit(false); e.preventDefault(); }
                e.stopPropagation();
              }}
              onBlur={() => commitWallDimEdit(true)}
              autoFocus
              size={6}
            />
            <span className="idea-canvas__dim-input-unit">{settings.physicalUnit}</span>
          </div>
        );
      })() : null}

      {/* Calibration distance input dialog */}
      {calibrationLine && svgRef.current ? (() => {
        const svgRect = svgRef.current.getBoundingClientRect();
        const midCX = (calibrationLine.startCX + calibrationLine.endCX) / 2;
        const midCY = (calibrationLine.startCY + calibrationLine.endCY) / 2;
        const screenX = (midCX + panX) * zoom;
        const screenY = (midCY + panY) * zoom;
        const dx = calibrationLine.endCX - calibrationLine.startCX;
        const dy = calibrationLine.endCY - calibrationLine.startCY;
        const pixelLen = Math.sqrt(dx * dx + dy * dy);
        return (
          <div className="idea-canvas__calibrate-overlay"
            style={{ left: screenX, top: screenY - 50 }}>
            <p className="idea-canvas__calibrate-label">How long is this line?</p>
            <div className="idea-canvas__calibrate-row">
              <input
                ref={calibrationInputRef}
                type="number"
                className="idea-canvas__calibrate-input"
                value={calibrationInput}
                onChange={(e) => setCalibrationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { void handleCalibrationConfirm(); e.preventDefault(); }
                  if (e.key === "Escape") { handleCalibrationCancel(); e.preventDefault(); }
                  e.stopPropagation();
                }}
                placeholder="e.g. 50"
                min={0}
                step="any"
              />
              <select
                className="idea-canvas__calibrate-unit"
                value={settings.physicalUnit ?? "ft"}
                onChange={(e) => setSettings(prev => ({ ...prev, physicalUnit: (e.target.value || null) as UpdateCanvasSettingsInput["physicalUnit"] }))}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {PHYSICAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="idea-canvas__calibrate-actions">
              <button type="button" className="button button--ghost button--xs" onClick={handleCalibrationCancel}>Cancel</button>
              <button type="button" className="button button--primary button--xs" onClick={() => void handleCalibrationConfirm()}>Set Scale</button>
            </div>
            <p className="idea-canvas__calibrate-hint">{Math.round(pixelLen)} px drawn</p>
          </div>
        );
      })() : null}

      {/* Settings panel */}
      {showSettings ? (
        <CanvasSettingsPanel
          settings={settings}
          resolvedBgUrl={resolvedBgUrl}
          bgImageDims={bgImageDims}
          bgUploading={bgUploading}
          bgUploadError={bgUploadError}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          onRemoveBgImage={handleRemoveBgImage}
          onUploadBgImage={handleBgImageUpload}
          onFitViewportToImage={fitViewportToImage}
          onStartCrop={handleStartCrop}
          onAddReferenceImage={handleAddReferenceImage}
        />
      ) : null}

      {/* Share panel */}
      {showSharePanel ? (
        <CanvasSharePanel
          householdId={householdId}
          canvasId={initialCanvas.id}
          onClose={() => setShowSharePanel(false)}
        />
      ) : null}

      {/* Background image crop mode overlay */}
      {bgCropMode && resolvedBgUrl && bgImageDims ? (() => {
        const imgX = settings.backgroundImageX ?? 0;
        const imgY = settings.backgroundImageY ?? 0;
        const imgScale = settings.backgroundImageScale ?? 1;
        const imgW = bgImageDims.w * imgScale;
        const imgH = bgImageDims.h * imgScale;
        const cropX = imgX + bgCropRect.x * imgW;
        const cropY = imgY + bgCropRect.y * imgH;
        const cropW = bgCropRect.w * imgW;
        const cropH = bgCropRect.h * imgH;
        const hs = 8;
        return (
          <div className="idea-canvas__crop-overlay">
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              <g transform={`scale(${zoom}) translate(${panX}, ${panY})`}>
                {/* Dark overlay mask */}
                <defs>
                  <mask id="crop-mask">
                    <rect x={imgX} y={imgY} width={imgW} height={imgH} fill="white" />
                    <rect x={cropX} y={cropY} width={cropW} height={cropH} fill="black" />
                  </mask>
                </defs>
                <rect x={imgX} y={imgY} width={imgW} height={imgH}
                  fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" pointerEvents="none" />
                {/* Crop rect border */}
                <rect x={cropX} y={cropY} width={cropW} height={cropH}
                  fill="none" stroke="white" strokeWidth={2 / zoom} pointerEvents="none" />
                {/* Corner handles */}
                {(["nw", "ne", "se", "sw"] as const).map((h) => {
                  const hx = h.includes("e") ? cropX + cropW - hs / 2 / zoom : cropX - hs / 2 / zoom;
                  const hy = h.includes("s") ? cropY + cropH - hs / 2 / zoom : cropY - hs / 2 / zoom;
                  return (
                    <rect key={h} x={hx} y={hy} width={hs / zoom} height={hs / zoom}
                      fill="white" stroke="var(--accent)" strokeWidth={1 / zoom}
                      style={{ cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const startMouse = { x: e.clientX, y: e.clientY };
                        const startRect = { ...bgCropRect };
                        const onMove = (me: MouseEvent) => {
                          const dx = (me.clientX - startMouse.x) / zoom / imgW;
                          const dy = (me.clientY - startMouse.y) / zoom / imgH;
                          const r = { ...startRect };
                          if (h.includes("w")) { r.x = Math.max(0, Math.min(startRect.x + startRect.w - 0.02, startRect.x + dx)); r.w = startRect.w - (r.x - startRect.x); }
                          if (h.includes("e")) { r.w = Math.max(0.02, Math.min(1 - startRect.x, startRect.w + dx)); }
                          if (h.includes("n")) { r.y = Math.max(0, Math.min(startRect.y + startRect.h - 0.02, startRect.y + dy)); r.h = startRect.h - (r.y - startRect.y); }
                          if (h.includes("s")) { r.h = Math.max(0.02, Math.min(1 - startRect.y, startRect.h + dy)); }
                          setBgCropRect(r);
                        };
                        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      }} />
                  );
                })}
                {/* Drag crop body to move */}
                <rect x={cropX} y={cropY} width={cropW} height={cropH}
                  fill="transparent" style={{ cursor: "move" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startMouse = { x: e.clientX, y: e.clientY };
                    const startRect = { ...bgCropRect };
                    const onMove = (me: MouseEvent) => {
                      const dx = (me.clientX - startMouse.x) / zoom / imgW;
                      const dy = (me.clientY - startMouse.y) / zoom / imgH;
                      const nx = Math.max(0, Math.min(1 - startRect.w, startRect.x + dx));
                      const ny = Math.max(0, Math.min(1 - startRect.h, startRect.y + dy));
                      setBgCropRect({ ...startRect, x: nx, y: ny });
                    };
                    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }} />
              </g>
            </svg>
            <div className="idea-canvas__crop-bar">
              <button type="button" className="button button--primary button--small" onClick={handleApplyCrop}>Apply Crop</button>
              <button type="button" className="button button--ghost button--small" onClick={handleCancelCrop}>Cancel</button>
            </div>
          </div>
        );
      })() : null}

      {/* Calibration wizard prompt — shown after background image upload */}
      {showCalibrationPrompt ? (
        <div className="idea-canvas__calibration-prompt">
          <span>📐 Set the scale? Draw a line along a known dimension.</span>
          <button type="button" className="button button--primary button--small"
            onClick={() => { setActiveTool("calibrate"); setShowCalibrationPrompt(false); }}>
            Start Calibration
          </button>
          <button type="button" className="button button--ghost button--small"
            onClick={() => setShowCalibrationPrompt(false)}>
            Skip
          </button>
        </div>
      ) : null}

      {/* Layer panel */}
      {showLayerPanel ? (
        <CanvasLayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSetActiveLayer={setActiveLayerId}
          onToggleVisibility={(id) => handleUpdateLayer(id, { visible: !layers.find((l) => l.id === id)?.visible })}
          onToggleLock={(id) => handleUpdateLayer(id, { locked: !layers.find((l) => l.id === id)?.locked })}
          onRename={(id, name) => handleUpdateLayer(id, { name })}
          onChangeOpacity={(id, opacity) => handleUpdateLayer(id, { opacity })}
          onChangeFloorNumber={(id, floorNumber) => handleUpdateLayer(id, { floorNumber })}
          onMoveUp={handleMoveLayerUp}
          onMoveDown={handleMoveLayerDown}
          onAdd={handleAddLayer}
          onDelete={handleDeleteLayer}
          onClose={() => setShowLayerPanel(false)}
          isFloorplan={settings.canvasMode === "floorplan"}
        />
      ) : null}

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
            {selectedIds.size >= 2 ? (
              <button type="button" onClick={() => { handleGroupSelected(); setContextMenu(null); }}>
                Group <span style={{ opacity: 0.5, fontSize: "0.85em" }}>Ctrl+G</span>
              </button>
            ) : null}
            {nodeMap.get(contextMenu.nodeId)?.groupId ? (
              <button type="button" onClick={() => { handleUngroupSelected(); setContextMenu(null); }}>
                Ungroup <span style={{ opacity: 0.5, fontSize: "0.85em" }}>Ctrl+Shift+G</span>
              </button>
            ) : null}
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
      ) : activeTool === "object" ? (
        <div className="idea-canvas__hint">
          {objectPickerOpen
            ? "Choose an object from the library."
            : pendingObjectPlacement
              ? `Click the canvas to place ${pendingObjectPlacement.source === "preset" ? pendingObjectPlacement.preset.label : pendingObjectPlacement.object.name}. Press Esc to cancel.`
              : "Open the object library, then choose an object to place."}
        </div>
      ) : activeTool !== "select" && activeTool !== "pan" ? (
        <div className="idea-canvas__hint">
          {activeTool === "wall"
            ? (wallChainStartRef.current
                ? "Click to continue wall chain. Enter to finish chain. Esc to cancel. Hold Shift for 45° angles."
                : "Click where the wall starts.")
            : activeTool === "measure"
              ? "Click and drag to add a dimension annotation."
              : activeTool === "freehand"
                ? "Click and drag to draw freehand. Release to finish stroke."
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
          onPlace={handlePlaceObject}
          onClose={() => {
            setObjectPickerOpen(false);
            if (!pendingObjectPlacement) setActiveTool("select");
          }}
        />,
        document.body
      ) : null}
    </div>
  );
}
