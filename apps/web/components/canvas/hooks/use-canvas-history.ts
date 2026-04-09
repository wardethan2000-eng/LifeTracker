import { useCallback, useRef } from "react";
import type { IdeaCanvasEdge, IdeaCanvasNode } from "@aegis/types";

type HistoryEntry = { nodes: IdeaCanvasNode[]; edges: IdeaCanvasEdge[] };

const MAX_HISTORY = 50;

type UseCanvasHistoryInput = {
  initialNodes: IdeaCanvasNode[];
  initialEdges: IdeaCanvasEdge[];
  setNodes: (nodes: IdeaCanvasNode[]) => void;
  setEdges: (edges: IdeaCanvasEdge[]) => void;
  clearSelection: () => void;
  /** Called after undo restores a snapshot — sync the restored nodes to server. */
  onUndoSync?: (nodes: IdeaCanvasNode[]) => void;
};

export function useCanvasHistory({
  initialNodes,
  initialEdges,
  setNodes,
  setEdges,
  clearSelection,
  onUndoSync,
}: UseCanvasHistoryInput) {
  const historyRef = useRef<HistoryEntry[]>([{ nodes: initialNodes, edges: initialEdges }]);
  const historyIndexRef = useRef(0);

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
    const entry = stack[historyIndexRef.current]!;
    setNodes(entry.nodes);
    setEdges(entry.edges);
    clearSelection();
    onUndoSync?.(entry.nodes);
  }, [setNodes, setEdges, clearSelection, onUndoSync]);

  const redo = useCallback(() => {
    const stack = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx >= stack.length - 1) return;
    historyIndexRef.current = idx + 1;
    const entry = stack[historyIndexRef.current]!;
    setNodes(entry.nodes);
    setEdges(entry.edges);
    clearSelection();
  }, [setNodes, setEdges, clearSelection]);

  return { pushHistory, undo, redo };
}
