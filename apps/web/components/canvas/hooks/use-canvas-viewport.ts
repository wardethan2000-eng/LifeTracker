import { useCallback, useRef, useState } from "react";
import type React from "react";
import { updateCanvas } from "../../../lib/api";

const SYNC_DEBOUNCE_MS = 800;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

type UseCanvasViewportInput = {
  initialZoom: number;
  initialPanX: number;
  initialPanY: number;
  householdId: string;
  canvasId: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
};

export function useCanvasViewport({
  initialZoom,
  initialPanX,
  initialPanY,
  householdId,
  canvasId,
  svgRef,
}: UseCanvasViewportInput) {
  const [zoom, setZoom] = useState(initialZoom);
  const [panX, setPanX] = useState(initialPanX);
  const [panY, setPanY] = useState(initialPanY);

  const viewportTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const syncViewport = useCallback(async (z: number, px: number, py: number) => {
    await updateCanvas(householdId, canvasId, { zoom: z, panX: px, panY: py });
  }, [householdId, canvasId]);

  const scheduleViewportSync = useCallback((z: number, px: number, py: number) => {
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => syncViewport(z, px, py), SYNC_DEBOUNCE_MS);
  }, [syncViewport]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - panX,
      y: (clientY - rect.top) / zoom - panY,
    };
  }, [zoom, panX, panY, svgRef]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
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
  }, [zoom, panX, panY, svgRef, scheduleViewportSync]);

  return {
    zoom, setZoom,
    panX, setPanX,
    panY, setPanY,
    screenToCanvas,
    scheduleViewportSync,
    handleWheel,
    viewportTimerRef,
  };
}
