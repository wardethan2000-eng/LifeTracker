/**
 * Pure geometry and snapping utilities for the canvas renderer.
 * No React, no DOM — just math.
 */

import type { IdeaCanvasNode, CanvasNodeShape, CanvasEdgeStyle } from "@aegis/types";

// ─── Node geometry ───────────────────────────────────────────────────────────

export function getNodeCenter(n: IdeaCanvasNode) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

export function getEdgeAnchors(source: IdeaCanvasNode, target: IdeaCanvasNode) {
  const s = getNodeCenter(source);
  const t = getNodeCenter(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const angle = Math.atan2(dy, dx);

  const clampToEdge = (node: IdeaCanvasNode, a: number) => {
    const c = getNodeCenter(node);
    // Diamond: use vertex math
    if (node.shape === "diamond") {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
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

export function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const midX = sx + dx * 0.5;
  const cpOffset = Math.min(Math.abs(dx) * 0.3, 80);
  return `M ${sx} ${sy} C ${midX + cpOffset} ${sy}, ${midX - cpOffset} ${ty}, ${tx} ${ty}`;
}

export function getShapeRadius(shape: CanvasNodeShape): number {
  switch (shape) {
    case "rounded": return 12;
    case "pill": return 999;
    default: return 4;
  }
}

export function strokeDasharray(style: CanvasEdgeStyle): string | undefined {
  switch (style) {
    case "dashed": return "8,4";
    case "dotted": return "3,3";
    default: return undefined;
  }
}

// ─── Grid snapping ───────────────────────────────────────────────────────────

export function snapToGrid(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}

/** Snap (dx, dy) to nearest allowed wall angle. Default: 0°/90°. With shiftKey: also 45°. */
export function snapWallAngle(dx: number, dy: number, shiftKey: boolean): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { dx: 0, dy: 0 };
  const angle = Math.atan2(dy, dx);
  const step = shiftKey ? Math.PI / 4 : Math.PI / 2;
  const snapped = Math.round(angle / step) * step;
  return { dx: Math.round(Math.cos(snapped) * len), dy: Math.round(Math.sin(snapped) * len) };
}

// ─── Alignment snapping ──────────────────────────────────────────────────────

export type AlignGuide = { axis: "horizontal" | "vertical"; position: number };

/** Find alignment snap guides for nodes being dragged */
export function computeAlignmentGuides(
  draggedNodes: { x: number; y: number; width: number; height: number }[],
  otherNodes: { x: number; y: number; width: number; height: number }[],
  threshold: number,
): { guides: AlignGuide[]; snapDx: number; snapDy: number } {
  if (draggedNodes.length === 0 || otherNodes.length === 0) return { guides: [], snapDx: 0, snapDy: 0 };

  // Bounding box of dragged nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of draggedNodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Collect edges to test: left, center, right  /  top, center, bottom
  const dragHoriz = [minX, cx, maxX]; // x values
  const dragVert = [minY, cy, maxY]; // y values

  const guides: AlignGuide[] = [];
  let bestDx = Infinity, bestDy = Infinity;

  for (const o of otherNodes) {
    const ox = [o.x, o.x + o.width / 2, o.x + o.width];
    const oy = [o.y, o.y + o.height / 2, o.y + o.height];

    for (const dx of dragHoriz) {
      for (const oxx of ox) {
        const diff = oxx - dx;
        if (Math.abs(diff) < threshold && Math.abs(diff) <= Math.abs(bestDx)) {
          if (Math.abs(diff) < Math.abs(bestDx)) {
            bestDx = diff;
            for (let i = guides.length - 1; i >= 0; i--) {
              if (guides[i].axis === "vertical") guides.splice(i, 1);
            }
          }
          guides.push({ axis: "vertical", position: oxx });
        }
      }
    }

    for (const dy of dragVert) {
      for (const oyy of oy) {
        const diff = oyy - dy;
        if (Math.abs(diff) < threshold && Math.abs(diff) <= Math.abs(bestDy)) {
          if (Math.abs(diff) < Math.abs(bestDy)) {
            bestDy = diff;
            for (let i = guides.length - 1; i >= 0; i--) {
              if (guides[i].axis === "horizontal") guides.splice(i, 1);
            }
          }
          guides.push({ axis: "horizontal", position: oyy });
        }
      }
    }
  }

  return {
    guides,
    snapDx: Math.abs(bestDx) < threshold ? bestDx : 0,
    snapDy: Math.abs(bestDy) < threshold ? bestDy : 0,
  };
}
