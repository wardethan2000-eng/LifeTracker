"use client";

import type { CanvasEdgeStyle, CanvasMode, CanvasNodeShape, IdeaCanvasNode } from "@aegis/types";
import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { ActiveTool } from "./canvas-tools/types";

type CanvasWorkflowInput = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitLabel: string;
};

type CanvasWorkflowAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

export type CanvasWorkflowContext = {
  title: string;
  description: string;
  chips?: string[] | undefined;
  note?: string | undefined;
  input?: CanvasWorkflowInput | undefined;
  actions?: CanvasWorkflowAction[] | undefined;
};

export interface CanvasToolbarProps {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  hasPhysicalUnits: boolean;
  onOpenSettings: () => void;
  canvasMode: CanvasMode;
  selectedCount: number;
  selectedEdgeId: string | null;
  singleSelected: IdeaCanvasNode | null;
  allFlowchartSelected: boolean;
  selectedEdge: { style: CanvasEdgeStyle } | null;
  onStartEdge: () => void;
  onChangeColor: (color: string | null) => void;
  onChangeShape: (shape: CanvasNodeShape) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeFontSize: (size: number) => void;
  onChangeEdgeStyle: (style: CanvasEdgeStyle) => void;
  onDeleteSelected: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onAlignNodes?: (axis: "left" | "center-h" | "right" | "top" | "center-v" | "bottom" | "distribute-h" | "distribute-v") => void;
  onToggleSnap?: () => void;
  snapEnabled?: boolean;
  onChangeWallHeight?: (height: number | null) => void;
  onChangeSwingDirection?: (dir: "left" | "right" | "double") => void;
  onChangeStairDirection?: (dir: "up" | "down" | "left" | "right") => void;
  onChangeStairFloors?: (fromFloor: number | null, toFloor: number | null) => void;
  onChangeWallLength?: (length: number) => void;
  onChangeWallStart?: (x: number, y: number) => void;
  onChangeWallEnd?: (x: number, y: number) => void;
  physicalUnit?: string | null;
  pixelsPerUnit?: number | null;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  objectPickerOpen: boolean;
  onToggleObjectPicker: () => void;
  showSettings: boolean;
  onToggleLayerPanel?: () => void;
  showLayerPanel?: boolean;
  floors?: number[];
  activeFloor?: number;
  onFloorChange?: (floor: number) => void;
  onAddFloor?: () => void;
  onExportSVG?: () => void;
  onExportPNG?: () => void;
  onExportPDF?: () => void;
  onShare?: () => void;
  showFloorplanStarter?: boolean;
  onStartFloorplanWalls?: () => void;
  onAddStarterRoom?: () => void;
  onTraceFloorplanImage?: () => void;
  toolWorkflowContext?: CanvasWorkflowContext | null;
  inspectorTab?: "selection" | "settings" | "layers";
  onShowInspectorSelection?: () => void;
  inspectorUtilityContent?: ReactNode;
  simplified?: boolean;
}

const NODE_COLORS = [
  { label: "Default", value: null },
  { label: "Blue", value: "#dbeafe" },
  { label: "Green", value: "#dcfce7" },
  { label: "Yellow", value: "#fef9c3" },
  { label: "Red", value: "#fee2e2" },
  { label: "Purple", value: "#f3e8ff" },
  { label: "Orange", value: "#ffedd5" },
] as const;

const SHAPES: CanvasNodeShape[] = ["rectangle", "rounded", "pill", "diamond"];
const EDGE_STYLES: CanvasEdgeStyle[] = ["solid", "dashed", "dotted"];

const FLOORPLAN_TOOLS = new Set<ActiveTool>([
  "wall",
  "wall-arc",
  "door",
  "window",
  "stairs",
  "room",
  "measure",
]);

type SectionProps = {
  title: string;
  compact?: boolean;
  children: ReactNode;
};

function ToolbarSection({ title, compact = false, children }: SectionProps): JSX.Element {
  return (
    <section className={`idea-canvas__surface-section${compact ? " idea-canvas__surface-section--compact" : ""}`}>
      <div className="idea-canvas__surface-section-title">{title}</div>
      {children}
    </section>
  );
}

export function CanvasToolbar(props: CanvasToolbarProps): JSX.Element {
  const {
    activeTool,
    onToolChange,
    hasPhysicalUnits,
    onOpenSettings,
    canvasMode,
    selectedCount,
    selectedEdgeId,
    singleSelected,
    allFlowchartSelected,
    selectedEdge,
    onStartEdge,
    onChangeColor,
    onChangeShape,
    onChangeFillColor,
    onChangeStrokeColor,
    onChangeStrokeWidth,
    onChangeFontSize,
    onChangeEdgeStyle,
    onDeleteSelected,
    onBringForward,
    onSendBackward,
    onAlignNodes,
    onToggleSnap,
    snapEnabled = false,
    onChangeWallHeight,
    onChangeSwingDirection,
    onChangeStairDirection,
    onChangeStairFloors,
    onChangeWallLength,
    onChangeWallStart,
    onChangeWallEnd,
    physicalUnit,
    pixelsPerUnit,
    onUndo,
    onRedo,
    zoom,
    onZoomIn,
    onZoomOut,
    onFitToView,
    objectPickerOpen,
    onToggleObjectPicker,
    onToggleLayerPanel,
    floors,
    activeFloor,
    onFloorChange,
    onAddFloor,
    onExportSVG,
    onExportPNG,
    onExportPDF,
    onShare,
    showFloorplanStarter = false,
    onStartFloorplanWalls,
    onAddStarterRoom,
    onTraceFloorplanImage,
    toolWorkflowContext,
    inspectorTab = "selection",
    onShowInspectorSelection,
    inspectorUtilityContent,
    simplified = false,
  } = props;

  const [drawExpanded, setDrawExpanded] = useState(canvasMode !== "floorplan");
  const [buildExpanded, setBuildExpanded] = useState(canvasMode === "floorplan");
  const [annotateExpanded, setAnnotateExpanded] = useState(true);
  const [wallGeometry, setWallGeometry] = useState({
    length: "",
    startX: "",
    startY: "",
    endX: "",
    endY: "",
  });

  const modeLabel: Record<CanvasMode, string> = {
    diagram: "Diagram",
    floorplan: "Floorplan",
    freehand: "Freehand",
  };

  const toolButtonClass = (tool: ActiveTool) => {
    let className = `idea-canvas__tool-btn${activeTool === tool ? " idea-canvas__tool-btn--active" : ""}`;
    if (FLOORPLAN_TOOLS.has(tool) && !hasPhysicalUnits) {
      className += " idea-canvas__tool-btn--no-units";
    }
    return className;
  };

  const activateTool = (tool: ActiveTool) => {
    if (FLOORPLAN_TOOLS.has(tool) && !hasPhysicalUnits) {
      onOpenSettings();
      return;
    }
    onToolChange(tool);
  };

  const renderToolButton = (
    tool: ActiveTool,
    label: string,
    title: string,
    icon?: string,
  ) => (
    <button
      key={tool}
      type="button"
      className={toolButtonClass(tool)}
      onClick={() => activateTool(tool)}
      title={title}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );

  const selectionSummary = selectedEdgeId
    ? "Adjust the selected connection"
    : selectedCount > 1
      ? `Arrange ${selectedCount} selected items`
      : singleSelected
        ? `Edit the selected ${singleSelected.objectType}`
        : "Select something on the canvas to edit it here";
  const inspectorSubtitle = inspectorTab === "selection"
    ? selectionSummary
    : inspectorTab === "settings"
      ? "Control grid, scale, and reference images"
      : "Choose the active layer and organize floors";

  useEffect(() => {
    if (singleSelected?.objectType !== "wall") {
      return;
    }
    const unitScale = pixelsPerUnit ?? 1;
    const length = Math.sqrt((singleSelected.x2 - singleSelected.x) ** 2 + (singleSelected.y2 - singleSelected.y) ** 2) / unitScale;
    setWallGeometry({
      length: length ? `${length % 1 === 0 ? length.toFixed(0) : length.toFixed(1)}` : "",
      startX: `${(singleSelected.x / unitScale).toFixed(1)}`,
      startY: `${(singleSelected.y / unitScale).toFixed(1)}`,
      endX: `${(singleSelected.x2 / unitScale).toFixed(1)}`,
      endY: `${(singleSelected.y2 / unitScale).toFixed(1)}`,
    });
  }, [pixelsPerUnit, singleSelected]);

  return (
    <div className="idea-canvas__workspace-chrome" aria-hidden="false">
      <aside className="idea-canvas__tool-rail">
        {!simplified ? (
          <div className="idea-canvas__surface-header">
            <span className="idea-canvas__mode-badge" title="Canvas mode">
              {modeLabel[canvasMode]}
            </span>
          </div>
        ) : null}

        {showFloorplanStarter && !simplified ? (
          <ToolbarSection title="Start here" compact>
            <div className="idea-canvas__surface-callout idea-canvas__surface-callout--primary">
              <strong>Start your floor plan</strong>
              <span>Use the default 1 ft grid, then either draw walls immediately or drop in a starter room to edit.</span>
              <div className="idea-canvas__tool-stack">
                {onStartFloorplanWalls ? (
                  <button type="button" className="idea-canvas__tool-btn idea-canvas__tool-btn--active" onClick={onStartFloorplanWalls}>
                    ⊟ Draw walls
                  </button>
                ) : null}
                {onAddStarterRoom ? (
                  <button type="button" className="idea-canvas__tool-btn" onClick={onAddStarterRoom}>
                    ▭ Use starter room
                  </button>
                ) : null}
                {onTraceFloorplanImage ? (
                  <button type="button" className="idea-canvas__tool-btn" onClick={onTraceFloorplanImage}>
                    🖼 Trace reference image
                  </button>
                ) : null}
              </div>
            </div>
          </ToolbarSection>
        ) : null}

        {toolWorkflowContext && !simplified ? (
          <ToolbarSection title="Workflow" compact>
            <div className="idea-canvas__drafting-panel">
              <div className="idea-canvas__drafting-copy">
                <strong>{toolWorkflowContext.title}</strong>
                <span>{toolWorkflowContext.description}</span>
              </div>
              {toolWorkflowContext.chips && toolWorkflowContext.chips.length > 0 ? (
                <div className="idea-canvas__drafting-metrics">
                  {toolWorkflowContext.chips.map((chip) => (
                    <span key={chip} className="idea-canvas__drafting-chip">{chip}</span>
                  ))}
                </div>
              ) : null}
              {toolWorkflowContext.input ? (
                <label className="idea-canvas__inspector-field">
                  <span>{toolWorkflowContext.input.label}</span>
                  <div className="idea-canvas__drafting-input-row">
                    <input
                      type="number"
                      className="idea-canvas__tool-input"
                      value={toolWorkflowContext.input.value}
                      min={0}
                      step="any"
                      placeholder={toolWorkflowContext.input.placeholder}
                      onChange={(event) => toolWorkflowContext.input?.onChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          toolWorkflowContext.input?.onSubmit();
                          event.preventDefault();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="idea-canvas__tool-btn"
                      onClick={toolWorkflowContext.input.onSubmit}
                      disabled={!toolWorkflowContext.input.canSubmit}
                    >
                      {toolWorkflowContext.input.submitLabel}
                    </button>
                  </div>
                </label>
              ) : null}
              {toolWorkflowContext.note ? (
                <div className="idea-canvas__drafting-note">{toolWorkflowContext.note}</div>
              ) : null}
              {toolWorkflowContext.actions && toolWorkflowContext.actions.length > 0 ? (
                <div className="idea-canvas__drafting-actions">
                  {toolWorkflowContext.actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className={`idea-canvas__tool-btn${action.tone === "danger" ? " idea-canvas__tool-btn--danger" : ""}`}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </ToolbarSection>
        ) : null}

        <ToolbarSection title="Navigate" compact>
          <div className="idea-canvas__tool-stack">
            {renderToolButton("select", "Select", "Select and move objects (S)", "↖")}
            {renderToolButton("pan", "Pan", "Pan the canvas", "✋")}
          </div>
        </ToolbarSection>

        <ToolbarSection title="Draw" compact>
          <div className="idea-canvas__surface-toggle-row">
            <button
              type="button"
              className="idea-canvas__group-toggle"
              onClick={() => setDrawExpanded((value) => !value)}
              aria-expanded={drawExpanded}
            >
              {drawExpanded ? "▾" : "▸"} Tools
            </button>
          </div>
          {drawExpanded ? (
            <div className="idea-canvas__tool-stack">
              {!simplified ? renderToolButton("freehand", "Pencil", "Freehand pencil (P)", "✏") : null}
              {!simplified ? renderToolButton("line", "Line", "Draw a line", "╱") : null}
              {!simplified ? renderToolButton("rect", "Rect", "Draw a rectangle", "▭") : null}
              {!simplified ? renderToolButton("circle", "Circle", "Draw a circle or ellipse", "◯") : null}
              {renderToolButton("text", "Text", "Add a text box", "T")}
              {renderToolButton("node", "Node", "Add a flowchart node", "☐")}
            </div>
          ) : null}
        </ToolbarSection>

        {!simplified ? (
          <ToolbarSection title="Build" compact>
            <div className="idea-canvas__surface-toggle-row">
              <button
                type="button"
                className="idea-canvas__group-toggle"
                onClick={() => setBuildExpanded((value) => !value)}
                aria-expanded={buildExpanded}
              >
                {buildExpanded ? "▾" : "▸"} Floorplan
              </button>
            </div>
            {buildExpanded ? (
              <div className="idea-canvas__tool-stack">
                {renderToolButton("wall", "Wall", "Draw walls (W)", "⊟")}
                {renderToolButton("wall-arc", "Arc Wall", "Draw curved walls", "⌒")}
                {renderToolButton("door", "Door", "Place a door on a wall", "🚪")}
                {renderToolButton("window", "Window", "Place a window on a wall", "▣")}
                {renderToolButton("stairs", "Stairs", "Place a stair object", "⊞")}
              </div>
            ) : null}
          </ToolbarSection>
        ) : null}

        {!simplified ? (
          <ToolbarSection title="Annotate" compact>
            <div className="idea-canvas__surface-toggle-row">
              <button
                type="button"
                className="idea-canvas__group-toggle"
                onClick={() => setAnnotateExpanded((value) => !value)}
                aria-expanded={annotateExpanded}
              >
                {annotateExpanded ? "▾" : "▸"} Helpers
              </button>
            </div>
            {annotateExpanded ? (
              <div className="idea-canvas__tool-stack">
                {renderToolButton("measure", "Dimension", "Add a dimension annotation", "↔")}
                {renderToolButton("room", "Room", "Trace a room polygon", "⬡")}
                {renderToolButton("calibrate", "Calibrate", "Set a real-world scale from an image", "📐")}
                <button
                  type="button"
                  className={`idea-canvas__tool-btn${activeTool === "object" || objectPickerOpen ? " idea-canvas__tool-btn--active" : ""}`}
                  onClick={onToggleObjectPicker}
                  title="Open the object library"
                >
                  <span aria-hidden="true">🧩</span>
                  <span>Objects</span>
                </button>
              </div>
            ) : null}
          </ToolbarSection>
        ) : null}

        {!hasPhysicalUnits && !simplified ? (
          <div className="idea-canvas__surface-callout">
            <strong>Floorplan tools need scale.</strong>
            <span>Set units or calibrate from a reference image to unlock walls, rooms, and dimensions.</span>
            <button type="button" className="idea-canvas__tool-btn" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        ) : null}
      </aside>

      <div className="idea-canvas__topbar">
        <div className="idea-canvas__topbar-group">
          <button type="button" className="idea-canvas__tool-btn" onClick={onUndo} title="Undo (Ctrl+Z)">↩</button>
          <button type="button" className="idea-canvas__tool-btn" onClick={onRedo} title="Redo (Ctrl+Y)">↪</button>
        </div>

        <div className="idea-canvas__topbar-group">
          <button type="button" className="idea-canvas__tool-btn" onClick={onZoomOut} title="Zoom out">−</button>
          <span className="idea-canvas__zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="idea-canvas__tool-btn" onClick={onZoomIn} title="Zoom in">+</button>
          <button type="button" className="idea-canvas__tool-btn" onClick={onFitToView} title="Fit canvas to view">Fit</button>
        </div>

        {onToggleSnap ? (
          <div className="idea-canvas__topbar-group">
            <button
              type="button"
              className={`idea-canvas__tool-btn${snapEnabled ? " idea-canvas__tool-btn--active" : ""}`}
              onClick={onToggleSnap}
              title={snapEnabled ? "Snap to grid is on" : "Snap to grid is off"}
            >
              ⊞ Snap
            </button>
          </div>
        ) : null}

        {!simplified && canvasMode === "floorplan" && floors && floors.length > 0 && onFloorChange ? (
          <div className="idea-canvas__topbar-group idea-canvas__floor-selector">
            <span className="idea-canvas__floor-label">Floor</span>
            <select
              className="idea-canvas__floor-select"
              value={activeFloor ?? 0}
              onChange={(event) => onFloorChange(Number(event.target.value))}
            >
              {floors.map((floor) => (
                <option key={floor} value={floor}>
                  {floor === 0 ? "Ground" : floor > 0 ? `Floor ${floor}` : `B${Math.abs(floor)}`}
                </option>
              ))}
            </select>
            {onAddFloor ? (
              <button type="button" className="idea-canvas__tool-btn" onClick={onAddFloor} title="Add floor">
                +
              </button>
            ) : null}
          </div>
        ) : null}

        {!simplified && (onExportSVG || onExportPNG || onExportPDF) ? (
          <div className="idea-canvas__topbar-group">
            {onExportSVG ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportSVG}>SVG</button> : null}
            {onExportPNG ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportPNG}>PNG</button> : null}
            {onExportPDF ? <button type="button" className="idea-canvas__tool-btn" onClick={onExportPDF}>PDF</button> : null}
          </div>
        ) : null}

        {!simplified && onShare ? (
          <div className="idea-canvas__topbar-group">
            <button type="button" className="idea-canvas__tool-btn" onClick={onShare}>🔗 Share</button>
          </div>
        ) : null}

      </div>

      {!simplified ? (
        <aside className="idea-canvas__inspector">
          <div className="idea-canvas__surface-header">
            <div>
              <div className="idea-canvas__surface-title">Inspector</div>
              <div className="idea-canvas__surface-subtitle">{inspectorSubtitle}</div>
            </div>
          </div>

          <div className="idea-canvas__inspector-tabs">
            <button
              type="button"
              className={`idea-canvas__inspector-tab${inspectorTab === "selection" ? " idea-canvas__inspector-tab--active" : ""}`}
              onClick={onShowInspectorSelection}
            >
              Selection
            </button>
            <button
              type="button"
              className={`idea-canvas__inspector-tab${inspectorTab === "settings" ? " idea-canvas__inspector-tab--active" : ""}`}
              onClick={onOpenSettings}
            >
              Settings
            </button>
            {onToggleLayerPanel ? (
              <button
                type="button"
                className={`idea-canvas__inspector-tab${inspectorTab === "layers" ? " idea-canvas__inspector-tab--active" : ""}`}
                onClick={onToggleLayerPanel}
              >
                Layers
              </button>
            ) : null}
          </div>

          {inspectorTab !== "selection" ? (
            <div className="idea-canvas__inspector-tab-panel">
              {inspectorUtilityContent}
            </div>
          ) : null}

          {inspectorTab === "selection" && selectedCount === 0 && !selectedEdgeId ? (
            <div className="idea-canvas__surface-callout">
              <strong>Nothing selected</strong>
              <span>Select a wall, room, object, or note to edit its properties here.</span>
            </div>
          ) : null}

          {inspectorTab === "selection" && allFlowchartSelected ? (
            <ToolbarSection title="Connections" compact>
              <button type="button" className="idea-canvas__tool-btn" onClick={onStartEdge}>
                ↗ Connect selected node
              </button>
            </ToolbarSection>
          ) : null}

          {inspectorTab === "selection" && singleSelected ? (
            <ToolbarSection title="Selection" compact>
              <div className="idea-canvas__inspector-controls">
                {singleSelected.objectType === "wall" ? (
                  <>
                    <div className="idea-canvas__inspector-group">
                      <div className="idea-canvas__inspector-group-title">Geometry</div>
                      <label className="idea-canvas__inspector-field">
                        <span>Length{physicalUnit ? ` (${physicalUnit})` : ""}</span>
                        <div className="idea-canvas__inspector-inline-input">
                          <input
                            type="number"
                            className="idea-canvas__tool-input idea-canvas__tool-input--full"
                            value={wallGeometry.length}
                            min={0}
                            step="0.1"
                            onChange={(event) => setWallGeometry((prev) => ({ ...prev, length: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const length = Number.parseFloat(wallGeometry.length);
                                if (Number.isFinite(length) && length > 0) {
                                  onChangeWallLength?.(length);
                                }
                                event.preventDefault();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="idea-canvas__tool-btn"
                            onClick={() => {
                              const length = Number.parseFloat(wallGeometry.length);
                              if (Number.isFinite(length) && length > 0) {
                                onChangeWallLength?.(length);
                              }
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </label>
                      <div className="idea-canvas__inspector-row idea-canvas__inspector-row--wall-points">
                        <label className="idea-canvas__inspector-field">
                          <span>Start X</span>
                          <input
                            type="number"
                            className="idea-canvas__tool-input idea-canvas__tool-input--full"
                            value={wallGeometry.startX}
                            step="0.1"
                            onChange={(event) => setWallGeometry((prev) => ({ ...prev, startX: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const x = Number.parseFloat(wallGeometry.startX);
                                const y = Number.parseFloat(wallGeometry.startY);
                                if (Number.isFinite(x) && Number.isFinite(y)) {
                                  onChangeWallStart?.(x, y);
                                }
                                event.preventDefault();
                              }
                            }}
                          />
                        </label>
                        <label className="idea-canvas__inspector-field">
                          <span>Start Y</span>
                          <input
                            type="number"
                            className="idea-canvas__tool-input idea-canvas__tool-input--full"
                            value={wallGeometry.startY}
                            step="0.1"
                            onChange={(event) => setWallGeometry((prev) => ({ ...prev, startY: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const x = Number.parseFloat(wallGeometry.startX);
                                const y = Number.parseFloat(wallGeometry.startY);
                                if (Number.isFinite(x) && Number.isFinite(y)) {
                                  onChangeWallStart?.(x, y);
                                }
                                event.preventDefault();
                              }
                            }}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="idea-canvas__tool-btn"
                        onClick={() => {
                          const x = Number.parseFloat(wallGeometry.startX);
                          const y = Number.parseFloat(wallGeometry.startY);
                          if (Number.isFinite(x) && Number.isFinite(y)) {
                            onChangeWallStart?.(x, y);
                          }
                        }}
                      >
                        Move start point
                      </button>
                      <div className="idea-canvas__inspector-row idea-canvas__inspector-row--wall-points">
                        <label className="idea-canvas__inspector-field">
                          <span>End X</span>
                          <input
                            type="number"
                            className="idea-canvas__tool-input idea-canvas__tool-input--full"
                            value={wallGeometry.endX}
                            step="0.1"
                            onChange={(event) => setWallGeometry((prev) => ({ ...prev, endX: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const x = Number.parseFloat(wallGeometry.endX);
                                const y = Number.parseFloat(wallGeometry.endY);
                                if (Number.isFinite(x) && Number.isFinite(y)) {
                                  onChangeWallEnd?.(x, y);
                                }
                                event.preventDefault();
                              }
                            }}
                          />
                        </label>
                        <label className="idea-canvas__inspector-field">
                          <span>End Y</span>
                          <input
                            type="number"
                            className="idea-canvas__tool-input idea-canvas__tool-input--full"
                            value={wallGeometry.endY}
                            step="0.1"
                            onChange={(event) => setWallGeometry((prev) => ({ ...prev, endY: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                const x = Number.parseFloat(wallGeometry.endX);
                                const y = Number.parseFloat(wallGeometry.endY);
                                if (Number.isFinite(x) && Number.isFinite(y)) {
                                  onChangeWallEnd?.(x, y);
                                }
                                event.preventDefault();
                              }
                            }}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="idea-canvas__tool-btn"
                        onClick={() => {
                          const x = Number.parseFloat(wallGeometry.endX);
                          const y = Number.parseFloat(wallGeometry.endY);
                          if (Number.isFinite(x) && Number.isFinite(y)) {
                            onChangeWallEnd?.(x, y);
                          }
                        }}
                      >
                        Move end point
                      </button>
                      <div className="idea-canvas__surface-note">
                        Shared joints stay connected, so adjacent walls move with the endpoint you edit.
                      </div>
                    </div>
                    <div className="idea-canvas__inspector-group">
                      <div className="idea-canvas__inspector-group-title">Appearance</div>
                      <label className="idea-canvas__inspector-field">
                        <span>Fill</span>
                        <input
                          type="color"
                          className="idea-canvas__color-picker"
                          value={singleSelected.fillColor ?? "#d1d5db"}
                          onChange={(event) => onChangeFillColor(event.target.value)}
                        />
                      </label>
                      <label className="idea-canvas__inspector-field">
                        <span>Stroke</span>
                        <input
                          type="color"
                          className="idea-canvas__color-picker"
                          value={singleSelected.strokeColor ?? "#374151"}
                          onChange={(event) => onChangeStrokeColor(event.target.value)}
                        />
                      </label>
                      <label className="idea-canvas__inspector-field">
                        <span>Thickness</span>
                        <select
                          className="idea-canvas__tool-select"
                          value={singleSelected.strokeWidth ?? 6}
                          onChange={(event) => onChangeStrokeWidth(parseInt(event.target.value))}
                        >
                          {[4, 6, 8, 10, 12, 16, 20].map((width) => (
                            <option key={width} value={width}>{width}px</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {onChangeWallHeight ? (
                      <div className="idea-canvas__inspector-group">
                        <div className="idea-canvas__inspector-group-title">Structure</div>
                        <label className="idea-canvas__inspector-field">
                          <span>Height</span>
                          <input
                            type="number"
                            className="idea-canvas__tool-input"
                            value={singleSelected.wallHeight ?? ""}
                            onChange={(event) => onChangeWallHeight(event.target.value ? parseFloat(event.target.value) : null)}
                            min={0}
                            step={0.1}
                            placeholder={physicalUnit ? `Height (${physicalUnit})` : "Height"}
                          />
                        </label>
                      </div>
                    ) : null}
                  </>
                ) : singleSelected.objectType === "door" ? (
                  <label className="idea-canvas__inspector-field">
                    <span>Swing</span>
                    <select
                      className="idea-canvas__tool-select"
                      value={(singleSelected as Record<string, unknown>).swingDirection as string ?? "left"}
                      onChange={(event) => onChangeSwingDirection?.(event.target.value as "left" | "right" | "double")}
                    >
                      <option value="left">Left hinge</option>
                      <option value="right">Right hinge</option>
                      <option value="double">Double</option>
                    </select>
                  </label>
                ) : singleSelected.objectType === "stairs" ? (
                  <>
                    <label className="idea-canvas__inspector-field">
                      <span>Direction</span>
                      <select
                        className="idea-canvas__tool-select"
                        value={(singleSelected as Record<string, unknown>).stairDirection as string ?? "up"}
                        onChange={(event) => onChangeStairDirection?.(event.target.value as "up" | "down" | "left" | "right")}
                      >
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    {floors && floors.length > 1 && onChangeStairFloors ? (
                      <div className="idea-canvas__inspector-row">
                        <label className="idea-canvas__inspector-field">
                          <span>From</span>
                          <select
                            className="idea-canvas__tool-select"
                            value={(singleSelected as Record<string, unknown>).fromFloor as number ?? activeFloor ?? 0}
                            onChange={(event) => {
                              const fromFloor = Number(event.target.value);
                              const toFloor = (singleSelected as Record<string, unknown>).toFloor as number ?? fromFloor + 1;
                              onChangeStairFloors(fromFloor, toFloor);
                            }}
                          >
                            {floors.map((floor) => (
                              <option key={floor} value={floor}>{floor === 0 ? "Ground" : floor > 0 ? `F${floor}` : `B${Math.abs(floor)}`}</option>
                            ))}
                          </select>
                        </label>
                        <label className="idea-canvas__inspector-field">
                          <span>To</span>
                          <select
                            className="idea-canvas__tool-select"
                            value={(singleSelected as Record<string, unknown>).toFloor as number ?? (activeFloor ?? 0) + 1}
                            onChange={(event) => {
                              const toFloor = Number(event.target.value);
                              const fromFloor = (singleSelected as Record<string, unknown>).fromFloor as number ?? activeFloor ?? 0;
                              onChangeStairFloors(fromFloor, toFloor);
                            }}
                          >
                            {floors.map((floor) => (
                              <option key={floor} value={floor}>{floor === 0 ? "Ground" : floor > 0 ? `F${floor}` : `B${Math.abs(floor)}`}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {singleSelected.objectType === "flowchart" ? (
                      <>
                        <div className="idea-canvas__inspector-palette">
                          {NODE_COLORS.filter((color) => color.value !== null).map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              className="idea-canvas__color-swatch"
                              style={{ background: color.value! }}
                              title={color.label}
                              onClick={() => onChangeFillColor(color.value!)}
                            />
                          ))}
                        </div>
                        <label className="idea-canvas__inspector-field">
                          <span>Custom fill</span>
                          <input
                            type="color"
                            className="idea-canvas__color-picker"
                            value={singleSelected.color ?? singleSelected.fillColor ?? "#dbeafe"}
                            onChange={(event) => onChangeColor(event.target.value)}
                          />
                        </label>
                        <label className="idea-canvas__inspector-field">
                          <span>Shape</span>
                          <select
                            className="idea-canvas__tool-select"
                            value={singleSelected.shape ?? "rectangle"}
                            onChange={(event) => onChangeShape(event.target.value as CanvasNodeShape)}
                          >
                            {SHAPES.map((shape) => (
                              <option key={shape} value={shape}>{shape}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : singleSelected.objectType !== "line" && singleSelected.objectType !== "freehand" ? (
                      <label className="idea-canvas__inspector-field">
                        <span>Fill</span>
                        <input
                          type="color"
                          className="idea-canvas__color-picker"
                          value={singleSelected.fillColor ?? "#e8f0fe"}
                          onChange={(event) => onChangeFillColor(event.target.value)}
                        />
                      </label>
                    ) : null}

                    {singleSelected.objectType !== "text" && singleSelected.objectType !== "flowchart" ? (
                      <>
                        <label className="idea-canvas__inspector-field">
                          <span>Stroke</span>
                          <input
                            type="color"
                            className="idea-canvas__color-picker"
                            value={singleSelected.strokeColor ?? "#555555"}
                            onChange={(event) => onChangeStrokeColor(event.target.value)}
                          />
                        </label>
                        <label className="idea-canvas__inspector-field">
                          <span>Weight</span>
                          <select
                            className="idea-canvas__tool-select"
                            value={singleSelected.strokeWidth ?? 1}
                            onChange={(event) => onChangeStrokeWidth(parseInt(event.target.value))}
                          >
                            {[1, 2, 3, 4, 6, 8].map((width) => (
                              <option key={width} value={width}>{width}px</option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : null}

                    {singleSelected.objectType === "flowchart" || singleSelected.objectType === "text" || singleSelected.objectType === "room" ? (
                      <label className="idea-canvas__inspector-field">
                        <span>Font size</span>
                        <select
                          className="idea-canvas__tool-select"
                          value={singleSelected.fontSize ?? 14}
                          onChange={(event) => onChangeFontSize(parseInt(event.target.value))}
                        >
                          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((size) => (
                            <option key={size} value={size}>{size}px</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </>
                )}
              </div>
            </ToolbarSection>
          ) : null}

          {selectedEdgeId && selectedEdge ? (
            <ToolbarSection title="Edge" compact>
              <label className="idea-canvas__inspector-field">
                <span>Style</span>
                <select
                  className="idea-canvas__tool-select"
                  value={selectedEdge.style ?? "solid"}
                  onChange={(event) => onChangeEdgeStyle(event.target.value as CanvasEdgeStyle)}
                >
                  {EDGE_STYLES.map((style) => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </label>
            </ToolbarSection>
          ) : null}

          {selectedCount > 0 ? (
            <ToolbarSection title="Arrange" compact>
              <div className="idea-canvas__inspector-actions">
                {onBringForward ? <button type="button" className="idea-canvas__tool-btn" onClick={onBringForward}>Bring forward</button> : null}
                {onSendBackward ? <button type="button" className="idea-canvas__tool-btn" onClick={onSendBackward}>Send backward</button> : null}
              </div>
              {selectedCount > 1 && onAlignNodes ? (
                <div className="idea-canvas__tool-group idea-canvas__align-group">
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("left")} title="Align left">Left</button>
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("center-h")} title="Center horizontally">Center X</button>
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("right")} title="Align right">Right</button>
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("top")} title="Align top">Top</button>
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("center-v")} title="Center vertically">Center Y</button>
                  <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("bottom")} title="Align bottom">Bottom</button>
                  {selectedCount > 2 ? (
                    <>
                      <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("distribute-h")} title="Distribute horizontally">Space X</button>
                      <button type="button" className="idea-canvas__tool-btn" onClick={() => onAlignNodes("distribute-v")} title="Distribute vertically">Space Y</button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </ToolbarSection>
          ) : null}

          {(selectedCount > 0 || selectedEdgeId) ? (
            <ToolbarSection title="Delete" compact>
              <button type="button" className="idea-canvas__tool-btn idea-canvas__tool-btn--danger" onClick={onDeleteSelected}>
                🗑 Delete selection
              </button>
            </ToolbarSection>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
