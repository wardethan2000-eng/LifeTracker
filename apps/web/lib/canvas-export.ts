/**
 * Canvas export utilities — SVG/PNG download from the current canvas state.
 * These run entirely client-side; no server round-trip needed.
 */

import type { IdeaCanvasNode, IdeaCanvasEdge } from "@lifekeeper/types";
import { renderCanvasToSVG, type CanvasRenderOptions } from "./canvas-svg-render";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Convert relative paths in imageUrlMap to absolute URLs for standalone export. */
function absolutizeImageUrls(map?: Map<string, string>): Map<string, string> | undefined {
  if (!map || map.size === 0) return undefined;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return map;
  const result = new Map<string, string>();
  for (const [id, url] of map) {
    result.set(id, url.startsWith("/") ? `${origin}${url}` : url);
  }
  return result;
}

function buildExportOpts(opts: CanvasRenderOptions): CanvasRenderOptions {
  const absMap = absolutizeImageUrls(opts.imageUrlMap);
  const result: CanvasRenderOptions = { ...opts };
  if (absMap) {
    result.imageUrlMap = absMap;
  } else {
    delete result.imageUrlMap;
  }
  return result;
}

/**
 * Export the canvas as an SVG file and trigger a browser download.
 */
export function exportCanvasToSVG(
  nodes: IdeaCanvasNode[],
  edges: IdeaCanvasEdge[],
  canvasName: string,
  opts: CanvasRenderOptions = {},
) {
  const svg = renderCanvasToSVG(nodes, edges, buildExportOpts(opts));
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${canvasName || "canvas"}.svg`);
}

/**
 * Export the canvas as a PNG file and trigger a browser download.
 * Uses an offscreen canvas element for rasterization.
 * @param scale Pixel density multiplier (default 2 for retina)
 */
export function exportCanvasToPNG(
  nodes: IdeaCanvasNode[],
  edges: IdeaCanvasEdge[],
  canvasName: string,
  opts: CanvasRenderOptions = {},
  scale = 2,
) {
  const svg = renderCanvasToSVG(nodes, edges, buildExportOpts(opts));
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((pngBlob) => {
      if (pngBlob) downloadBlob(pngBlob, `${canvasName || "canvas"}.png`);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); };
  img.src = url;
}
