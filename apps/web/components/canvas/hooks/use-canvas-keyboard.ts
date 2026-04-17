import { useEffect } from "react";
import type { IdeaCanvasNode } from "@aegis/types";
import type { ActiveTool } from "../canvas-tools/types";

type UseCanvasKeyboardInput = {
  editingNodeId: string | null;
  editingEdgeId: string | null;
  editingName: boolean;
  showSettings: boolean;
  showLayerPanel: boolean;
  activeTool: ActiveTool;
  physicalUnit: string | null | undefined;
  nodes: IdeaCanvasNode[];
  hasWallChain: boolean;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onEscape: () => void;
  onFinishWallChain: () => void;
  onSelectAll: () => void;
  onRotate90: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  setActiveTool: (tool: ActiveTool) => void;
};

export function useCanvasKeyboard({
  editingNodeId,
  editingEdgeId,
  editingName,
  showSettings,
  showLayerPanel,
  activeTool,
  physicalUnit,
  nodes,
  hasWallChain,
  onDelete,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onEscape,
  onFinishWallChain,
  onSelectAll,
  onRotate90,
  onGroup,
  onUngroup,
  setActiveTool,
}: UseCanvasKeyboardInput) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingNodeId || editingEdgeId || editingName || showSettings || showLayerPanel) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        onDelete();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        onRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        onCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        onPaste();
      } else if (e.key === "Escape") {
        onEscape();
      } else if (e.key === "Enter" && activeTool === "wall" && hasWallChain) {
        onFinishWallChain();
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSelectAll();
      } else if (e.key === "g" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        onUngroup();
      } else if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        onGroup();
      } else if (e.key === "s" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("select");
      } else if (e.key === "p" && !e.ctrlKey && !e.metaKey) {
        setActiveTool("freehand");
      } else if (e.key === "w" && !e.ctrlKey && !e.metaKey) {
        if (physicalUnit) setActiveTool("wall");
      } else if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        onRotate90();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    editingNodeId, editingEdgeId, editingName, showSettings, showLayerPanel,
    onDelete, onUndo, onRedo, onCopy, onPaste, onEscape,
    onFinishWallChain, onSelectAll, onRotate90, onGroup, onUngroup,
    setActiveTool,
    nodes, activeTool, physicalUnit, hasWallChain,
  ]);
}
