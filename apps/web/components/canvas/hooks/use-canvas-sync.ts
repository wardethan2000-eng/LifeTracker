import { useCallback, useEffect, useRef } from "react";
import type { IdeaCanvasNode } from "@aegis/types";
import { batchUpdateCanvasNodes } from "../../../lib/api";

const SYNC_DEBOUNCE_MS = 800;

type UseCanvasSyncInput = {
  householdId: string;
  canvasId: string;
  /** External timer refs that should also be cleaned up on unmount */
  viewportTimerRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
};

export function useCanvasSync({
  householdId,
  canvasId,
  viewportTimerRef,
}: UseCanvasSyncInput) {
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingNodeUpdates = useRef<Map<string, Partial<IdeaCanvasNode>>>(new Map());

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
        rotation: u.rotation,
      })),
    });
  }, [householdId, canvasId]);

  const scheduleSyncPositions = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(flushPendingPositions, SYNC_DEBOUNCE_MS);
  }, [flushPendingPositions]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (viewportTimerRef?.current) clearTimeout(viewportTimerRef.current);
    };
  }, [viewportTimerRef]);

  return {
    syncTimerRef,
    pendingNodeUpdates,
    flushPendingPositions,
    scheduleSyncPositions,
  };
}
