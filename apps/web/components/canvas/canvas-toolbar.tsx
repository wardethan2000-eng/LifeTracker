"use client";

import type { CanvasEdgeStyle, CanvasMode, CanvasNodeShape, IdeaCanvasNode } from "@lifekeeper/types";
import type { ActiveTool } from "./canvas-tools/types";
import { useState, type JSX } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CanvasToolbarProps {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  /** Whether physical units are configured on this canvas */
  hasPhysicalUnits: boolean;
  onOpenSettings: () => void;
  /** Canvas mode — controls which tool groups are expanded by default */
  canvasMode: CanvasMode;
  // Selection state
  selectedCount: number;
  selectedEdgeId: string | null;
  singleSelected: IdeaCanvasNode | null;
  allFlowchartSelected: boolean;
  selectedEdge: { style: CanvasEdgeStyle } | null;
  // Selection actions
  onStartEdge: () => void;
  onChangeColor: (color: string | null) => void;
  onChangeShape: (shape: CanvasNodeShape) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeEdgeStyle: (style: CanvasEdgeStyle) => void;
  onDeleteSelected: () => void;
  // Layer ordering
  onBringForward?: () => void;
  onSendBackward?: () => void;
  // Wall-specific actions
  onChangeWallHeight?: (height: number | null) => void;
  /** Physical unit string (e.g. "ft", "m") for displaying wall length */
  physicalUnit?: string | null;
  /** Pixels per physical unit for converting wall length */
  pixelsPerUnit?: number | null;
  // Undo/Redo
  onUndo: () => void;
  onRedo: () => void;
  // Zoom
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  // Object picker
  objectPickerOpen: boolean;
  onToggleObjectPicker: () => void;
  // Settings
  showSettings: boolean;
  // Layers
  onToggleLayerPanel?: () => void;
  showLayerPanel?: boolean;
  // Export
  onExportSVG?: () => void;
  onExportPNG?: () => void;
  onExportPDF?: () => void;
  /** Simplified mode: hides advanced tools for embedded use */
  simplified?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

export function CanvasToolbar(props: CanvasToolbarProps): JSX.Element {
  const {
    activeTool, onToolChange, hasPhysicalUnits, onOpenSettings,
    canvasMode,
    selectedCount, selectedEdgeId, singleSelected, allFlowchartSelected, selectedEdge,
    onStartEdge, onChangeColor, onChangeShape, onChangeFillColor,
    onChangeStrokeColor, onChangeStrokeWidth, onChangeEdgeStyle, onDeleteSelected,
    onChangeWallHeight, physicalUnit, pixelsPerUnit,
    onUndo, onRedo, zoom, onZoomIn, onZoomOut, onFitToView,
    objectPickerOpen, onToggleObjectPicker, showSettings,
    onToggleLayerPanel, showLayerPanel,
    onExportSVG, onExportPNG, onExportPDF,
    onBringForward, onSendBackward,
    simplified = false,
  } = props;

  // Expand draw tools by default in diagram/freehand mode, building tools in floorplan
  const [drawExpanded, setDrawExpanded] = useState(canvasMode !== "floorplan");
  const [buildExpanded, setBuildExpanded] = useState(canvasMode === "floorplan");

  const btn = (tool: ActiveTool) =>
    `idea-canvas__tool-btn${activeTool === tool ? " idea-canvas__tool-btn--active" : ""}`;

  const buildingToolClass = (tool: ActiveTool) => {
    let cls = btn(tool);
    if (!hasPhysicalUnits) cls += " idea-canvas__tool-btn--no-units";
    return cls;
  };

  const modeLabel: Record<CanvasMode, string> = { diagram: "Diagram", floorplan: "Floorplan", freehand: "Freehand" };

  return (
    <div className="idea-canvas__toolbar">
      {/* ── Mode badge ── */}
      {!simplified && (
        <>
          <span className="idea-canvas__mode-badge" title="Canvas mode (set in settings)">
            {modeLabel[canvasMode]}
          </span>
          <div className="idea-canvas__toolbar-divider" />
        </>
      )}

      {/* ── Navigation ── */}
      <div className="idea-canvas__tool-group">
        <button type="button" className={btn("select")}
          onClick={() => onToolChange("select")} title="Select / drag (S)">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M0 0v11.5l3-3L5.5 14l1.8-.9L4.8 8H10L0 0z" />
          </svg>{" "}Select
        </button>
        <button type="button" className={btn("pan")}
          onClick={() => onToolChange("pan")} title="Pan canvas (hold Alt)">
          ✋ Pan
        </button>
      </div>
      <div className="idea-canvas__toolbar-divider" />

      {/* ── Draw ── */}
      <div className="idea-canvas__tool-group">
        {!simplified && (
          <button type="button" className="idea-canvas__group-toggle"
            onClick={() => setDrawExpanded((v) => !v)}
            title={drawExpanded ? "Collapse drawing tools" : "Expand drawing tools"}
            aria-expanded={drawExpanded}>
            {drawExpanded ? "▾" : "▸"} Draw
          </button>
        )}
        {(simplified || drawExpanded) ? (
          <>
            {!simplified && (
              <>
                <button type="button" className={btn("freehand")}
                  onClick={() => onToolChange("freehand")} title="Freehand pencil (P)">
                  ✏ Pencil
                </button>
                <button type="button" className={btn("line")}
                  onClick={() => onToolChange("line")} title="Draw line">
                  ╱ Line
                </button>
                <button type="button" className={btn("rect")}
                  onClick={() => onToolChange("rect")} title="Draw rectangle">
                  ▭ Rect
                </button>
                <button type="button" className={btn("circle")}
                  onClick={() => onToolChange("circle")} title="Draw circle / ellipse">
                  ◯ Circle
                </button>
              </>
            )}
            <button type="button" className={btn("text")}
              onClick={() => onToolChange("text")} title="Add text">
              T Text
            </button>
            <button type="button" className={btn("node")}
              onClick={() => onToolChange("node")} title="Add flowchart node">
              ☐ Node
            </button>
          </>
        ) : null}
      </div>
      <div className="idea-canvas__toolbar-divider" />

      {!simplified && (
        <>
      {/* ── Building ── */}
      <div className="idea-canvas__tool-group">
        <button type="button" className="idea-canvas__group-toggle"
          onClick={() => setBuildExpanded((v) => !v)}
          title={buildExpanded ? "Collapse building tools" : "Expand building tools"}
          aria-expanded={buildExpanded}>
          {buildExpanded ? "▾" : "▸"} Build
        </button>
        {buildExpanded ? (
          <>
        <button type="button" className={buildingToolClass("wall")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("wall");
          }}
          title={hasPhysicalUnits ? "Draw wall — click to place, click again to chain (W)" : "Set physical units first"}>
          ⊟ Wall
        </button>
        <button type="button" className={buildingToolClass("wall-arc")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("wall-arc");
          }}
          title={hasPhysicalUnits ? "Draw curved wall — click start, click end, drag arc" : "Set physical units first"}>
          ⌒ Arc
        </button>
        <button type="button" className={buildingToolClass("door")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("door");
          }}
          title={hasPhysicalUnits ? "Place door on wall" : "Set physical units first"}>
          🚪 Door
        </button>
        <button type="button" className={buildingToolClass("window")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("window");
          }}
          title={hasPhysicalUnits ? "Place window on wall" : "Set physical units first"}>
          ☐ Win
        </button>
        <button type="button" className={buildingToolClass("stairs")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("stairs");
          }}
          title={hasPhysicalUnits ? "Draw staircase" : "Set physical units first"}>
          ⊞ Stairs
        </button>
          </>
        ) : null}
      </div>
      <div className="idea-canvas__toolbar-divider" />
        </>
      )}

      {!simplified && (
        <>
      {/* ── Annotations ── */}
      <div className="idea-canvas__tool-group">
        <button type="button" className={buildingToolClass("measure")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("measure");
          }}
          title={hasPhysicalUnits ? "Add dimension annotation" : "Set physical units first"}>
          ↔ Dim
        </button>
        <button type="button" className={buildingToolClass("room")}
          onClick={() => {
            if (!hasPhysicalUnits) { onOpenSettings(); return; }
            onToolChange("room");
          }}
          title={hasPhysicalUnits ? "Define room polygon — click points, double-click to close" : "Set physical units first"}>
          ⬡ Room
        </button>
      </div>
      <div className="idea-canvas__toolbar-divider" />

      {/* ── Library ── */}
      <button type="button"
        className={`idea-canvas__tool-btn${activeTool === "object" || objectPickerOpen ? " idea-canvas__tool-btn--active" : ""}`}
        title="Place object from library"
        onClick={onToggleObjectPicker}>
        🧩 Object
      </button>
      <div className="idea-canvas__toolbar-divider" />
        </>
      )}

      {/* ── Connect (flowchart) ── */}
      {allFlowchartSelected ? (
        <button type="button" className="idea-canvas__tool-btn" onClick={onStartEdge} title="Draw edge">
          ↗ Connect
        </button>
      ) : null}

      {/* ── Selection-specific controls ── */}
      {singleSelected ? (
        <>
          {singleSelected.objectType === "wall" ? (
            <>
              {/* Wall-specific properties */}
              <span className="idea-canvas__toolbar-divider" />
              <input type="color" className="idea-canvas__color-picker"
                value={singleSelected.fillColor ?? "#d1d5db"}
                onChange={(e) => onChangeFillColor(e.target.value)}
                title="Wall fill color" />
              <input type="color" className="idea-canvas__color-picker"
                value={singleSelected.strokeColor ?? "#374151"}
                onChange={(e) => onChangeStrokeColor(e.target.value)}
                title="Wall outline color" />
              <select className="idea-canvas__tool-select"
                value={singleSelected.strokeWidth ?? 6}
                onChange={(e) => onChangeStrokeWidth(parseInt(e.target.value))} title="Wall thickness">
                {[4, 6, 8, 10, 12, 16, 20].map((w) => <option key={w} value={w}>{w}px</option>)}
              </select>
              {pixelsPerUnit && physicalUnit ? (
                <span className="idea-canvas__wall-length" title="Wall length">
                  📏 {(() => {
                    const dx = singleSelected.x2 - singleSelected.x;
                    const dy = singleSelected.y2 - singleSelected.y;
                    const len = Math.sqrt(dx * dx + dy * dy) / pixelsPerUnit;
                    return `${len % 1 === 0 ? len.toFixed(0) : len.toFixed(1)} ${physicalUnit}`;
                  })()}
                </span>
              ) : null}
              {onChangeWallHeight ? (
                <input type="number" className="idea-canvas__tool-input"
                  value={singleSelected.wallHeight ?? ""}
                  onChange={(e) => onChangeWallHeight(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder={physicalUnit ? `Height (${physicalUnit})` : "Height"}
                  title="Wall height (reference only, not rendered)"
                  min={0} step={0.1} />
              ) : null}
            </>
          ) : singleSelected.objectType === "flowchart" ? (
            <>
              <select className="idea-canvas__tool-select"
                value={singleSelected.color ?? ""}
                onChange={(e) => onChangeColor(e.target.value || null)} title="Fill color">
                {NODE_COLORS.map((c) => (
                  <option key={c.value ?? ""} value={c.value ?? ""}>{c.label}</option>
                ))}
              </select>
              <select className="idea-canvas__tool-select"
                value={singleSelected.shape ?? "rectangle"}
                onChange={(e) => onChangeShape(e.target.value as CanvasNodeShape)} title="Shape">
                {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          ) : singleSelected.objectType !== "line" && singleSelected.objectType !== "freehand" ? (
            <input type="color" className="idea-canvas__color-picker"
              value={singleSelected.fillColor ?? "#e8f0fe"}
              onChange={(e) => onChangeFillColor(e.target.value)}
              title="Fill color" />
          ) : null}
          {singleSelected.objectType !== "text" && singleSelected.objectType !== "flowchart" && singleSelected.objectType !== "wall" ? (
            <>
              <input type="color" className="idea-canvas__color-picker"
                value={singleSelected.strokeColor ?? "#555555"}
                onChange={(e) => onChangeStrokeColor(e.target.value)}
                title="Stroke color" />
              <select className="idea-canvas__tool-select"
                value={singleSelected.strokeWidth ?? 1}
                onChange={(e) => onChangeStrokeWidth(parseInt(e.target.value))} title="Stroke width">
                {[1, 2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w}px</option>)}
              </select>
            </>
          ) : null}
        </>
      ) : null}
      {selectedEdgeId && selectedEdge ? (
        <select className="idea-canvas__tool-select"
          value={selectedEdge.style ?? "solid"}
          onChange={(e) => onChangeEdgeStyle(e.target.value as CanvasEdgeStyle)} title="Edge style">
          {EDGE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : null}
      {(selectedCount > 0 || selectedEdgeId) ? (
        <button type="button" className="idea-canvas__tool-btn idea-canvas__tool-btn--danger"
          onClick={onDeleteSelected} title="Delete selected (Del)">
          🗑 Delete
        </button>
      ) : null}
      {selectedCount > 0 && (onBringForward || onSendBackward) ? (
        <>
          <div className="idea-canvas__toolbar-divider" />
          {onBringForward ? <button type="button" className="idea-canvas__tool-btn" onClick={onBringForward} title="Bring forward">⬆</button> : null}
          {onSendBackward ? <button type="button" className="idea-canvas__tool-btn" onClick={onSendBackward} title="Send backward">⬇</button> : null}
        </>
      ) : null}

      <div className="idea-canvas__toolbar-spacer" />

      {/* ── Undo / Redo ── */}
      <button type="button" className="idea-canvas__tool-btn" onClick={onUndo} title="Undo (Ctrl+Z)">↩</button>
      <button type="button" className="idea-canvas__tool-btn" onClick={onRedo} title="Redo (Ctrl+Y)">↪</button>
      <div className="idea-canvas__toolbar-divider" />

      {/* ── Export ── */}
      {(!simplified && (onExportSVG || onExportPNG || onExportPDF)) ? (
        <>
          <div className="idea-canvas__tool-group idea-canvas__export-group">
            {onExportSVG ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportSVG} title="Download as SVG">SVG</button> : null}
            {onExportPNG ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportPNG} title="Download as PNG">PNG</button> : null}
            {onExportPDF ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportPDF} title="Export as PDF">PDF</button> : null}
          </div>
          <div className="idea-canvas__toolbar-divider" />
        </>
      ) : null}

      {/* ── Zoom controls ── */}
      <button type="button" className="idea-canvas__tool-btn" onClick={onZoomOut} title="Zoom out">−</button>
      <span className="idea-canvas__zoom-label">{Math.round(zoom * 100)}%</span>
      <button type="button" className="idea-canvas__tool-btn" onClick={onZoomIn} title="Zoom in">+</button>
      <button type="button" className="idea-canvas__tool-btn" onClick={onFitToView} title="Fit all to view">Fit</button>
      <div className="idea-canvas__toolbar-divider" />
      {!simplified && (
        <>
          <button type="button" className={`idea-canvas__tool-btn${showSettings ? " idea-canvas__tool-btn--active" : ""}`}
            onClick={onOpenSettings} title="Canvas settings">
            ⚙
          </button>
          {onToggleLayerPanel ? (
            <button type="button" className={`idea-canvas__tool-btn${showLayerPanel ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={onToggleLayerPanel} title="Layers">
              ☰
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
