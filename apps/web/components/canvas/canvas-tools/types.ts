import type { IdeaCanvasNode, IdeaCanvasEdge, CanvasObjectType } from "@aegis/types";
import type { ReactNode } from "react";

// ─── Active Tool Union ───────────────────────────────────────────────────────

export type ActiveTool =
  | "select"
  | "pan"
  | "node"
  | "rect"
  | "circle"
  | "line"
  | "text"
  | "image"
  | "object"
  | "wall"
  | "wall-arc"
  | "door"
  | "window"
  | "stairs"
  | "room"
  | "measure"
  | "freehand";

// ─── Canvas Settings ─────────────────────────────────────────────────────────

export interface CanvasSettings {
  physicalWidth: number | null;
  physicalHeight: number | null;
  physicalUnit: string | null;
  backgroundImageUrl: string | null;
  snapToGrid: boolean;
  gridSize: number;
  showDimensions: boolean;
}

// ─── Snap Result ─────────────────────────────────────────────────────────────

export interface SnapResult {
  x: number;
  y: number;
  snapped: boolean;
  /** ID of the node whose endpoint was snapped to */
  snapNodeId?: string;
}

// ─── Tool Context (passed to every tool handler) ─────────────────────────────

export interface ToolContext {
  /** Current nodes on the canvas */
  nodes: IdeaCanvasNode[];
  /** Current edges */
  edges: IdeaCanvasEdge[];
  /** Zoom level */
  zoom: number;
  /** Pan offset */
  panX: number;
  panY: number;
  /** Canvas settings (physical units, grid, etc.) */
  settings: CanvasSettings;
  /** Pixels per physical unit (gridSize when unit is set, else null) */
  pixelsPerUnit: number | null;
  /** Snap a value to grid if snap is enabled */
  maybeSnap: (val: number) => number;
  /** Find the nearest wall endpoint within snap radius */
  findNearestEndpoint: (cx: number, cy: number) => SnapResult;
  /** Convert screen coords to canvas coords */
  screenToCanvas: (screenX: number, screenY: number) => { cx: number; cy: number };
  /** Create a node on the server and add to local state */
  createNode: (data: Partial<IdeaCanvasNode> & { objectType: CanvasObjectType }) => Promise<IdeaCanvasNode>;
  /** Update a node */
  updateNode: (nodeId: string, data: Partial<IdeaCanvasNode>) => Promise<void>;
  /** Push a history snapshot for undo */
  pushHistory: () => void;
  /** Set the active tool */
  setActiveTool: (tool: ActiveTool) => void;
}

// ─── Tool Interface ──────────────────────────────────────────────────────────

export interface CanvasTool {
  name: string;
  cursor: string;
  onMouseDown?: (ctx: ToolContext, e: { cx: number; cy: number; shiftKey: boolean; button: number }) => void;
  onMouseMove?: (ctx: ToolContext, e: { cx: number; cy: number; shiftKey: boolean }) => void;
  onMouseUp?: (ctx: ToolContext, e: { cx: number; cy: number; shiftKey: boolean }) => void;
  onDoubleClick?: (ctx: ToolContext, e: { cx: number; cy: number }) => void;
  onKeyDown?: (ctx: ToolContext, e: { key: string; shiftKey: boolean; ctrlKey: boolean }) => void;
  /** Render a live preview overlay while the tool is active */
  renderPreview?: (ctx: ToolContext) => ReactNode;
  /** Called when the tool is deactivated (cleanup) */
  onDeactivate?: () => void;
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/** Snap (dx, dy) to nearest allowed wall angle. Default: 0°/90°. With Shift: also 45°. */
export function snapWallAngle(dx: number, dy: number, shiftKey: boolean): { dx: number; dy: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return { dx: 0, dy: 0 };
  const angle = Math.atan2(dy, dx);
  const step = shiftKey ? Math.PI / 4 : Math.PI / 2;
  const snapped = Math.round(angle / step) * step;
  return { dx: Math.round(Math.cos(snapped) * len), dy: Math.round(Math.sin(snapped) * len) };
}

/** Format a physical distance label (e.g. "12.5 ft") */
export function fmtPhysical(px: number, pxPerUnit: number, unit: string): string {
  const v = px / pxPerUnit;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} ${unit}`;
}

/** Ramer-Douglas-Peucker line simplification */
export function simplifyPoints(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    let dist: number;
    if (lenSq === 0) {
      dist = Math.sqrt((points[i]!.x - first.x) ** 2 + (points[i]!.y - first.y) ** 2);
    } else {
      const t = Math.max(0, Math.min(1, ((points[i]!.x - first.x) * dx + (points[i]!.y - first.y) * dy) / lenSq));
      const projX = first.x + t * dx;
      const projY = first.y + t * dy;
      dist = Math.sqrt((points[i]!.x - projX) ** 2 + (points[i]!.y - projY) ** 2);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPoints(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

// ─── Arc Geometry ────────────────────────────────────────────────────────────

export interface ArcParams {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  sweepFlag: 0 | 1;
}

/** Compute arc center and parameters from three points (start, midpoint on arc, end) */
export function arcFromThreePoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): ArcParams | null {
  // Find circumscribed circle of triangle p1-p2-p3
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null; // Collinear
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
  const radius = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);
  const startAngle = Math.atan2(ay - uy, ax - ux);
  const endAngle = Math.atan2(cy - uy, cx - ux);

  // Determine sweep direction: is p2 on the short arc from p1 to p3?
  const midAngle = Math.atan2(by - uy, bx - ux);
  const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const sweepFlag: 0 | 1 = cross > 0 ? 1 : 0;

  return { cx: ux, cy: uy, radius, startAngle, endAngle, sweepFlag };
}

/** Compute arc length from ArcParams */
export function arcLength(arc: ArcParams): number {
  let delta = arc.endAngle - arc.startAngle;
  if (arc.sweepFlag === 1) {
    if (delta <= 0) delta += 2 * Math.PI;
  } else {
    if (delta >= 0) delta -= 2 * Math.PI;
  }
  return Math.abs(delta) * arc.radius;
}

/** Get tangent direction at the start of an arc (radians) */
export function arcTangentAtStart(arc: ArcParams): number {
  // Tangent is perpendicular to radius at start point
  return arc.startAngle + (arc.sweepFlag === 1 ? Math.PI / 2 : -Math.PI / 2);
}

/** Get tangent direction at the end of an arc (radians) */
export function arcTangentAtEnd(arc: ArcParams): number {
  return arc.endAngle + (arc.sweepFlag === 1 ? Math.PI / 2 : -Math.PI / 2);
}

/** Generate SVG arc path from start to end through the arc */
export function svgArcPath(
  x1: number, y1: number,
  x2: number, y2: number,
  radius: number,
  sweepFlag: 0 | 1,
  largeArcFlag?: 0 | 1,
): string {
  const laf = largeArcFlag ?? 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${laf} ${sweepFlag} ${x2} ${y2}`;
}

// ─── Wall Polygon Geometry ───────────────────────────────────────────────────

export interface WallPolygon {
  /** Outer polygon points for the wall fill */
  points: { x: number; y: number }[];
}

/** Compute the 4-corner polygon for a straight wall given centerline + thickness */
export function wallPolygonFromLine(
  x1: number, y1: number,
  x2: number, y2: number,
  thickness: number,
): { x: number; y: number }[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return [];
  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);
  return [
    { x: x1 + nx, y: y1 + ny },
    { x: x2 + nx, y: y2 + ny },
    { x: x2 - nx, y: y2 - ny },
    { x: x1 - nx, y: y1 - ny },
  ];
}

/** Compute perpendicular offset points for arc wall thickness */
export function arcWallPolygonPath(
  x1: number, y1: number,
  x2: number, y2: number,
  radius: number,
  sweepFlag: 0 | 1,
  thickness: number,
): string {
  const innerR = radius - thickness / 2;
  const outerR = radius + thickness / 2;
  // Outer arc goes forward, inner arc goes backward
  const outerArc = `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 ${sweepFlag} ${x2} ${y2}`;
  // For inner arc, reverse direction
  const innerSweep: 0 | 1 = sweepFlag === 1 ? 0 : 1;
  const innerArc = `L ${x2} ${y2} A ${innerR} ${innerR} 0 0 ${innerSweep} ${x1} ${y1} Z`;
  return outerArc + " " + innerArc;
}

// ─── Endpoint Snapping ───────────────────────────────────────────────────────

const SNAP_RADIUS = 12;

export function findNearestWallEndpoint(
  cx: number,
  cy: number,
  nodes: IdeaCanvasNode[],
  zoom: number,
  excludeNodeId?: string,
): SnapResult {
  const threshold = SNAP_RADIUS / zoom;
  let bestDist = threshold;
  let bestX = cx;
  let bestY = cy;
  let bestNodeId: string | undefined;
  let snapped = false;

  for (const n of nodes) {
    if (n.id === excludeNodeId) continue;
    if (n.objectType !== "wall") continue;

    // Check start point
    const d1 = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
    if (d1 < bestDist) {
      bestDist = d1;
      bestX = n.x;
      bestY = n.y;
      bestNodeId = n.id;
      snapped = true;
    }
    // Check end point
    const d2 = Math.sqrt((n.x2 - cx) ** 2 + (n.y2 - cy) ** 2);
    if (d2 < bestDist) {
      bestDist = d2;
      bestX = n.x2;
      bestY = n.y2;
      bestNodeId = n.id;
      snapped = true;
    }
  }

  return { x: bestX, y: bestY, snapped, ...(bestNodeId != null ? { snapNodeId: bestNodeId } : {}) };
}

// ─── Room Area ───────────────────────────────────────────────────────────────

// ─── Wall Miter Joins ────────────────────────────────────────────────────────

interface WallEndpoint { x: number; y: number }

/** Given a set of wall nodes, compute adjusted polygon points with miter joins at shared endpoints.
 *  Returns a Map from wall node ID → polygon points (4 corners, adjusted for miters). */
export function computeWallPolygonsWithMiters(
  walls: Pick<IdeaCanvasNode, "id" | "x" | "y" | "x2" | "y2" | "strokeWidth">[],
  snapRadius = 2,
): Map<string, { x: number; y: number }[]> {
  const result = new Map<string, { x: number; y: number }[]>();

  // Build an index of shared endpoints:
  // For each wall, compute its basic polygon, then check for other walls sharing endpoints
  type WallInfo = {
    id: string;
    x1: number; y1: number; x2: number; y2: number;
    thickness: number;
    // Perpendicular normal (unit vector) * thickness/2
    nx: number; ny: number;
  };

  const infos: WallInfo[] = walls.map(w => {
    const t = w.strokeWidth ?? 6;
    const dx = w.x2 - w.x;
    const dy = w.y2 - w.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return { id: w.id, x1: w.x, y1: w.y, x2: w.x2, y2: w.y2, thickness: t, nx: 0, ny: 0 };
    return {
      id: w.id,
      x1: w.x, y1: w.y, x2: w.x2, y2: w.y2,
      thickness: t,
      nx: (-dy / len) * (t / 2),
      ny: (dx / len) * (t / 2),
    };
  });

  // Helper: check if two points are close enough to be considered shared
  const close = (a: WallEndpoint, b: WallEndpoint) =>
    Math.abs(a.x - b.x) <= snapRadius && Math.abs(a.y - b.y) <= snapRadius;

  // Helper: compute intersection of two lines (p1→p2) and (p3→p4)
  const lineIntersect = (
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number,
  ): { x: number; y: number } | null => {
    const d = (p1x - p2x) * (p3y - p4y) - (p1y - p2y) * (p3x - p4x);
    if (Math.abs(d) < 1e-10) return null; // parallel
    const t = ((p1x - p3x) * (p3y - p4y) - (p1y - p3y) * (p3x - p4x)) / d;
    return { x: p1x + t * (p2x - p1x), y: p1y + t * (p2y - p1y) };
  };

  for (const info of infos) {
    // Default polygon corners (no miter)
    const corners = [
      { x: info.x1 + info.nx, y: info.y1 + info.ny }, // top-left
      { x: info.x2 + info.nx, y: info.y2 + info.ny }, // top-right
      { x: info.x2 - info.nx, y: info.y2 - info.ny }, // bottom-right
      { x: info.x1 - info.nx, y: info.y1 - info.ny }, // bottom-left
    ];

    // Check for miter at start endpoint (x1,y1)
    for (const other of infos) {
      if (other.id === info.id) continue;
      // Check which endpoint of `other` shares this wall's start
      let otherSharedEnd: "start" | "end" | null = null;
      if (close({ x: info.x1, y: info.y1 }, { x: other.x1, y: other.y1 })) otherSharedEnd = "start";
      else if (close({ x: info.x1, y: info.y1 }, { x: other.x2, y: other.y2 })) otherSharedEnd = "end";
      if (!otherSharedEnd) continue;

      // Get the offset edge of the other wall at the shared endpoint
      const otherP1 = otherSharedEnd === "start"
        ? { x: other.x1 + other.nx, y: other.y1 + other.ny }
        : { x: other.x2 + other.nx, y: other.y2 + other.ny };
      const otherP2 = otherSharedEnd === "start"
        ? { x: other.x2 + other.nx, y: other.y2 + other.ny }
        : { x: other.x1 + other.nx, y: other.y1 + other.ny };
      const otherP3 = otherSharedEnd === "start"
        ? { x: other.x1 - other.nx, y: other.y1 - other.ny }
        : { x: other.x2 - other.nx, y: other.y2 - other.ny };
      const otherP4 = otherSharedEnd === "start"
        ? { x: other.x2 - other.nx, y: other.y2 - other.ny }
        : { x: other.x1 - other.nx, y: other.y1 - other.ny };

      // Miter on the positive-normal side (corners[0] = start+normal)
      const miterTop = lineIntersect(
        corners[0]!.x, corners[0]!.y, corners[1]!.x, corners[1]!.y,
        otherP1.x, otherP1.y, otherP2.x, otherP2.y,
      );
      if (miterTop) {
        // Clamp miter extension to avoid extreme spikes
        const origDist = Math.hypot(corners[0]!.x - info.x1, corners[0]!.y - info.y1);
        const miterDist = Math.hypot(miterTop.x - info.x1, miterTop.y - info.y1);
        if (miterDist < origDist * 4) {
          corners[0] = miterTop;
        }
      }

      // Miter on the negative-normal side (corners[3] = start-normal)
      const miterBot = lineIntersect(
        corners[3]!.x, corners[3]!.y, corners[2]!.x, corners[2]!.y,
        otherP3.x, otherP3.y, otherP4.x, otherP4.y,
      );
      if (miterBot) {
        const origDist = Math.hypot(corners[3]!.x - info.x1, corners[3]!.y - info.y1);
        const miterDist = Math.hypot(miterBot.x - info.x1, miterBot.y - info.y1);
        if (miterDist < origDist * 4) {
          corners[3] = miterBot;
        }
      }
      break; // only join with one wall per endpoint
    }

    // Check for miter at end endpoint (x2,y2)
    for (const other of infos) {
      if (other.id === info.id) continue;
      let otherSharedEnd: "start" | "end" | null = null;
      if (close({ x: info.x2, y: info.y2 }, { x: other.x1, y: other.y1 })) otherSharedEnd = "start";
      else if (close({ x: info.x2, y: info.y2 }, { x: other.x2, y: other.y2 })) otherSharedEnd = "end";
      if (!otherSharedEnd) continue;

      const otherP1 = otherSharedEnd === "start"
        ? { x: other.x1 + other.nx, y: other.y1 + other.ny }
        : { x: other.x2 + other.nx, y: other.y2 + other.ny };
      const otherP2 = otherSharedEnd === "start"
        ? { x: other.x2 + other.nx, y: other.y2 + other.ny }
        : { x: other.x1 + other.nx, y: other.y1 + other.ny };
      const otherP3 = otherSharedEnd === "start"
        ? { x: other.x1 - other.nx, y: other.y1 - other.ny }
        : { x: other.x2 - other.nx, y: other.y2 - other.ny };
      const otherP4 = otherSharedEnd === "start"
        ? { x: other.x2 - other.nx, y: other.y2 - other.ny }
        : { x: other.x1 - other.nx, y: other.y1 - other.ny };

      // Miter on the positive-normal side (corners[1] = end+normal)
      const miterTop = lineIntersect(
        corners[0]!.x, corners[0]!.y, corners[1]!.x, corners[1]!.y,
        otherP1.x, otherP1.y, otherP2.x, otherP2.y,
      );
      if (miterTop) {
        const origDist = Math.hypot(corners[1]!.x - info.x2, corners[1]!.y - info.y2);
        const miterDist = Math.hypot(miterTop.x - info.x2, miterTop.y - info.y2);
        if (miterDist < origDist * 4) {
          corners[1] = miterTop;
        }
      }

      // Miter on the negative-normal side (corners[2] = end-normal)
      const miterBot = lineIntersect(
        corners[3]!.x, corners[3]!.y, corners[2]!.x, corners[2]!.y,
        otherP3.x, otherP3.y, otherP4.x, otherP4.y,
      );
      if (miterBot) {
        const origDist = Math.hypot(corners[2]!.x - info.x2, corners[2]!.y - info.y2);
        const miterDist = Math.hypot(miterBot.x - info.x2, miterBot.y - info.y2);
        if (miterDist < origDist * 4) {
          corners[2] = miterBot;
        }
      }
      break;
    }

    result.set(info.id, corners);
  }

  return result;
}

/** Shoelace formula for polygon area */
export function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i]!.x * points[j]!.y;
    area -= points[j]!.x * points[i]!.y;
  }
  return Math.abs(area) / 2;
}

/** Centroid of a polygon */
export function polygonCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / points.length, y: cy / points.length };
}

/**
 * Project a canvas point onto the nearest wall segment.
 * Returns the projected point, the wall node, the parametric t (0..1),
 * and the wall angle in radians.
 * `maxDist` is the max perpendicular distance to consider.
 */
export function projectPointOnWall(
  px: number, py: number,
  walls: { id: string; x: number; y: number; x2: number; y2: number; strokeWidth: number; objectType: string }[],
  maxDist: number,
): { wallId: string; x: number; y: number; t: number; angle: number; wallThickness: number } | null {
  let best: { wallId: string; x: number; y: number; t: number; dist: number; angle: number; wallThickness: number } | null = null;
  for (const w of walls) {
    if (w.objectType !== "wall") continue;
    const dx = w.x2 - w.x;
    const dy = w.y2 - w.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const t = Math.max(0, Math.min(1, ((px - w.x) * dx + (py - w.y) * dy) / lenSq));
    const projX = w.x + t * dx;
    const projY = w.y + t * dy;
    const dist = Math.hypot(px - projX, py - projY);
    if (dist <= maxDist && (!best || dist < best.dist)) {
      best = { wallId: w.id, x: projX, y: projY, t, dist, angle: Math.atan2(dy, dx), wallThickness: w.strokeWidth };
    }
  }
  return best ? { wallId: best.wallId, x: best.x, y: best.y, t: best.t, angle: best.angle, wallThickness: best.wallThickness } : null;
}
