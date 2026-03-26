"use client";

import type { IdeaCanvasLayer } from "@lifekeeper/types";
import type { JSX } from "react";
import { useState } from "react";

export interface CanvasLayerPanelProps {
  layers: IdeaCanvasLayer[];
  activeLayerId: string | null;
  onSetActiveLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onRename: (layerId: string, name: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  onMoveUp: (layerId: string) => void;
  onMoveDown: (layerId: string) => void;
  onAdd: () => void;
  onDelete: (layerId: string) => void;
  onClose: () => void;
}

export function CanvasLayerPanel({
  layers,
  activeLayerId,
  onSetActiveLayer,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onChangeOpacity,
  onMoveUp,
  onMoveDown,
  onAdd,
  onDelete,
  onClose,
}: CanvasLayerPanelProps): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const sorted = [...layers].sort((a, b) => b.sortOrder - a.sortOrder); // top layer first

  function handleStartRename(layer: IdeaCanvasLayer) {
    setEditingId(layer.id);
    setEditingName(layer.name);
  }

  function handleCommitRename(layerId: string) {
    const trimmed = editingName.trim();
    if (trimmed) onRename(layerId, trimmed);
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, layerId: string) {
    if (e.key === "Enter") handleCommitRename(layerId);
    if (e.key === "Escape") setEditingId(null);
  }

  return (
    <div className="idea-canvas__layer-panel">
      <div className="idea-canvas__layer-panel-header">
        <span className="idea-canvas__layer-panel-title">Layers</span>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={onClose}
          title="Close layers panel"
        >
          ✕
        </button>
      </div>

      <div className="idea-canvas__layer-list">
        {sorted.map((layer, idx) => {
          const isActive = layer.id === activeLayerId;
          const isTop = idx === 0;
          const isBottom = idx === sorted.length - 1;
          // In descending order, "move up" = increase sortOrder = visually higher
          const realIdx = layers.findIndex((l) => l.id === layer.id);

          return (
            <div
              key={layer.id}
              className={`idea-canvas__layer-row${isActive ? " idea-canvas__layer-row--active" : ""}${layer.locked ? " idea-canvas__layer-row--locked" : ""}`}
              onClick={() => onSetActiveLayer(layer.id)}
            >
              {/* Visibility toggle */}
              <button
                type="button"
                className={`idea-canvas__layer-btn idea-canvas__layer-visibility${!layer.visible ? " idea-canvas__layer-visibility--hidden" : ""}`}
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
              >
                {layer.visible ? "👁" : "🚫"}
              </button>

              {/* Lock toggle */}
              <button
                type="button"
                className={`idea-canvas__layer-btn idea-canvas__layer-lock${layer.locked ? " idea-canvas__layer-lock--active" : ""}`}
                title={layer.locked ? "Unlock layer" : "Lock layer"}
                onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>

              {/* Layer name */}
              <div className="idea-canvas__layer-name-wrap">
                {editingId === layer.id ? (
                  <input
                    className="idea-canvas__layer-name-input"
                    value={editingName}
                    autoFocus
                    maxLength={100}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleCommitRename(layer.id)}
                    onKeyDown={(e) => handleKeyDown(e, layer.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="idea-canvas__layer-name"
                    title="Double-click to rename"
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(layer); }}
                  >
                    {layer.name}
                  </span>
                )}
              </div>

              {/* Opacity */}
              <input
                type="range"
                className="idea-canvas__layer-opacity"
                min={0}
                max={1}
                step={0.05}
                value={layer.opacity}
                title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Move up/down */}
              <div className="idea-canvas__layer-order-btns">
                <button
                  type="button"
                  className="idea-canvas__layer-btn"
                  title="Move layer up"
                  disabled={isTop}
                  onClick={(e) => { e.stopPropagation(); onMoveUp(layer.id); }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="idea-canvas__layer-btn"
                  title="Move layer down"
                  disabled={isBottom}
                  onClick={(e) => { e.stopPropagation(); onMoveDown(layer.id); }}
                >
                  ▼
                </button>
              </div>

              {/* Delete */}
              <button
                type="button"
                className="idea-canvas__layer-btn idea-canvas__layer-delete"
                title="Delete layer"
                disabled={layers.length <= 1}
                onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="idea-canvas__layer-panel-footer">
        <button
          type="button"
          className="button button--ghost button--small idea-canvas__layer-add"
          onClick={onAdd}
          disabled={layers.length >= 20}
          title={layers.length >= 20 ? "Maximum 20 layers" : "Add new layer"}
        >
          + Add Layer
        </button>
        <span className="idea-canvas__layer-count">{layers.length}/20</span>
      </div>
    </div>
  );
}
