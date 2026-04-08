/**
 * Reusable SVG rendering for canvas nodes and edges.
 * Pure functions — no React, no browser DOM, no event handlers.
 * Used by: CanvasThumbnail component, SVG/PNG export.
 */

import type { IdeaCanvasThumbnailEdge, IdeaCanvasThumbnailNode, CanvasNodeShape, CanvasEdgeStyle } from "@aegis/types";
import {
  wallPolygonFromLine,
  computeWallPolygonsWithMiters,
  arcFromThreePoints,
  svgArcPath,
  arcLength,
  arcWallPolygonPath,
  fmtPhysical,
} from "../components/canvas/canvas-tools/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CanvasRenderOptions = {
  showGrid?: boolean;
  showDimensions?: boolean;
  physicalUnit?: string | null;
  pixelsPerUnit?: number | null;
  /** Map of nodeId → resolved image URL (data URI or HTTP URL) */
  imageUrlMap?: Map<string, string>;
  /** Background color for the SVG canvas (default: white) */
  backgroundColor?: string;
  /** Resolved background image URL (data URI or HTTP URL) */
  backgroundImageUrl?: string;
  /** Opacity for the background image (0–1, default 0.5) */
  backgroundImageOpacity?: number;
  /** Natural pixel dimensions of the background image */
  bgImageDims?: { w: number; h: number };
};

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shapeRadius(shape: CanvasNodeShape | string | null | undefined): number {
  switch (shape) {
    case "rounded": return 12;
    case "pill": return 999;
    default: return 4;
  }
}

function edgeDasharray(style: CanvasEdgeStyle | string | null | undefined): string {
  switch (style) {
    case "dashed": return ' stroke-dasharray="8,4"';
    case "dotted": return ' stroke-dasharray="3,3"';
    default: return "";
  }
}

function getNodeCenter(n: IdeaCanvasThumbnailNode) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

function getEdgeAnchors(source: IdeaCanvasThumbnailNode, target: IdeaCanvasThumbnailNode) {
  const s = getNodeCenter(source);
  const t = getNodeCenter(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const angle = Math.atan2(dy, dx);

  const clampToEdge = (node: IdeaCanvasThumbnailNode, a: number) => {
    const c = getNodeCenter(node);
    if (node.shape === "diamond") {
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const vertices = [
        { x: c.cx, y: node.y },
        { x: node.x + node.width, y: c.cy },
        { x: c.cx, y: node.y + node.height },
        { x: node.x, y: c.cy },
      ];
      let best = { x: c.cx, y: node.y };
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

function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const midX = sx + dx * 0.5;
  const cpOffset = Math.min(Math.abs(dx) * 0.3, 80);
  return `M ${sx} ${sy} C ${midX + cpOffset} ${sy}, ${midX - cpOffset} ${ty}, ${tx} ${ty}`;
}

// ─── Bounding box ────────────────────────────────────────────────────────────

export function computeBoundingBox(nodes: IdeaCanvasThumbnailNode[], padding = 40): BoundingBox {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 200, maxY: 120, width: 200, height: 120 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.objectType === "line" || n.objectType === "wall" || n.objectType === "dimension") {
      minX = Math.min(minX, n.x, n.x2);
      maxX = Math.max(maxX, n.x, n.x2);
      minY = Math.min(minY, n.y, n.y2);
      maxY = Math.max(maxY, n.y, n.y2);
    } else if (n.objectType === "door" || n.objectType === "window") {
      const r = Math.max(n.width, n.height) / 2;
      minX = Math.min(minX, n.x - r);
      maxX = Math.max(maxX, n.x + r);
      minY = Math.min(minY, n.y - r);
      maxY = Math.max(maxY, n.y + r);
    } else {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    }
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ─── Node rendering ──────────────────────────────────────────────────────────

function renderImageNode(node: IdeaCanvasThumbnailNode, imgUrl?: string): string {
  if (imgUrl) {
    return `<image href="${esc(imgUrl)}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="#f0f4f8" stroke="#475569" stroke-width="1.5"/>`;
}

function renderObjectNode(node: IdeaCanvasThumbnailNode, imgUrl?: string): string {
  let clipDef = "";
  let clipAttr = "";
  if (node.maskJson) {
    try {
      const mask = JSON.parse(node.maskJson) as
        | { type: "crop"; x: number; y: number; w: number; h: number }
        | { type: "polygon"; points: { x: number; y: number }[] };
      const clipId = `clip-${node.id}`;
      clipAttr = ` clip-path="url(#${clipId})"`;
      if (mask.type === "crop") {
        clipDef = `<defs><clipPath id="${clipId}"><rect x="${node.x + mask.x * node.width}" y="${node.y + mask.y * node.height}" width="${mask.w * node.width}" height="${mask.h * node.height}"/></clipPath></defs>`;
      } else if (mask.type === "polygon") {
        const pts = mask.points.map(p => `${node.x + p.x * node.width},${node.y + p.y * node.height}`).join(" ");
        clipDef = `<defs><clipPath id="${clipId}"><polygon points="${pts}"/></clipPath></defs>`;
      }
    } catch { /* ignore */ }
  }
  const inner = imgUrl
    ? `<image href="${esc(imgUrl)}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" preserveAspectRatio="xMidYMid meet"${clipAttr}/>`
    : `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="#f0f4f8" stroke="#475569" stroke-width="1.5"/>`;
  return `${clipDef}${inner}`;
}

function renderWallNode(
  node: IdeaCanvasThumbnailNode,
  wallMiterPolygons: Map<string, { x: number; y: number }[]>,
  opts: CanvasRenderOptions,
): string {
  const thickness = node.strokeWidth ?? 6;
  const wallFill = node.fillColor ?? "#d1d5db";
  const wallStroke = node.strokeColor ?? "#374151";
  const isCurved = node.pointAx != null && node.pointAy != null;

  if (isCurved) {
    const arc = arcFromThreePoints(
      { x: node.x, y: node.y },
      { x: node.pointAx!, y: node.pointAy! },
      { x: node.x2, y: node.y2 },
    );
    if (arc) {
      const thickD = arcWallPolygonPath(node.x, node.y, node.x2, node.y2, arc.radius, arc.sweepFlag, thickness);
      const len = arcLength(arc);
      const mx = (node.x + node.x2) / 2;
      const my = (node.y + node.y2) / 2;
      let label = "";
      if (opts.showDimensions && opts.pixelsPerUnit && opts.physicalUnit) {
        const text = fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit);
        label = `<text x="${mx}" y="${my - thickness / 2 - 6}" text-anchor="middle" font-size="11" fill="#333">${esc(text)}</text>`;
      }
      return `<g>`
        + `<path d="${thickD}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
        + `<circle cx="${node.x}" cy="${node.y}" r="${thickness / 2}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
        + `<circle cx="${node.x2}" cy="${node.y2}" r="${thickness / 2}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
        + label
        + `</g>`;
    }
  }

  const miterPoly = wallMiterPolygons.get(node.id);
  const poly = miterPoly ?? wallPolygonFromLine(node.x, node.y, node.x2, node.y2, thickness);
  const polyPts = poly.map(p => `${p.x},${p.y}`).join(" ");

  let label = "";
  if (opts.showDimensions && opts.pixelsPerUnit && opts.physicalUnit) {
    const dx = node.x2 - node.x;
    const dy = node.y2 - node.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const mx = (node.x + node.x2) / 2;
    const my = (node.y + node.y2) / 2;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const dispAngle = Math.abs(angle) > 90 ? angle + 180 : angle;
    const text = fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit);
    label = `<text x="${mx}" y="${my - thickness / 2 - 4}" text-anchor="middle" font-size="11" fill="#333" transform="rotate(${dispAngle}, ${mx}, ${my})">${esc(text)}</text>`;
  }

  return `<g>`
    + `<polygon points="${polyPts}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
    + `<circle cx="${node.x}" cy="${node.y}" r="${thickness / 2}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
    + `<circle cx="${node.x2}" cy="${node.y2}" r="${thickness / 2}" fill="${wallFill}" stroke="${wallStroke}" stroke-width="1"/>`
    + label
    + `</g>`;
}

function renderLineNode(node: IdeaCanvasThumbnailNode): string {
  const stroke = node.strokeColor ?? "#475569";
  const sw = node.strokeWidth ?? 1.5;
  return `<line x1="${node.x}" y1="${node.y}" x2="${node.x2}" y2="${node.y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function renderDimensionNode(node: IdeaCanvasThumbnailNode, opts: CanvasRenderOptions): string {
  const ax = node.pointAx ?? node.x;
  const ay = node.pointAy ?? node.y;
  const bx = node.pointBx ?? node.x2;
  const by = node.pointBy ?? node.y2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return "";
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const displayAngle = Math.abs(angle) > 90 ? angle + 180 : angle;
  const label = opts.pixelsPerUnit && opts.physicalUnit
    ? fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit)
    : `${Math.round(len)}px`;
  const perpX = -dy / len * 10;
  const perpY = dx / len * 10;
  const tickLen = 6;
  const nx = -dy / len, ny = dx / len;
  return `<g>`
    + `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="4,2"/>`
    + `<line x1="${ax + nx * tickLen}" y1="${ay + ny * tickLen}" x2="${ax - nx * tickLen}" y2="${ay - ny * tickLen}" stroke="#6366f1" stroke-width="1.5"/>`
    + `<line x1="${bx + nx * tickLen}" y1="${by + ny * tickLen}" x2="${bx - nx * tickLen}" y2="${by - ny * tickLen}" stroke="#6366f1" stroke-width="1.5"/>`
    + `<text x="${mx + perpX}" y="${my + perpY}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#6366f1" transform="rotate(${displayAngle}, ${mx + perpX}, ${my + perpY})">${esc(label)}</text>`
    + `</g>`;
}

function renderRoomNode(node: IdeaCanvasThumbnailNode, opts: CanvasRenderOptions): string {
  let pts = "";
  let polyPoints: { x: number; y: number }[] = [];
  if (node.maskJson) {
    try {
      const mask = JSON.parse(node.maskJson) as { type: string; points: { x: number; y: number }[] };
      if (mask.type === "polygon") {
        polyPoints = mask.points.map(p => ({ x: node.x + p.x, y: node.y + p.y }));
        pts = polyPoints.map(p => `${p.x},${p.y}`).join(" ");
      }
    } catch { /* no-op */ }
  }
  if (!pts) {
    polyPoints = [
      { x: node.x, y: node.y },
      { x: node.x + node.width, y: node.y },
      { x: node.x + node.width, y: node.y + node.height },
      { x: node.x, y: node.y + node.height },
    ];
    pts = polyPoints.map(p => `${p.x},${p.y}`).join(" ");
  }
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const fill = node.fillColor ?? "rgba(99,102,241,0.07)";
  const stroke = node.strokeColor ?? "#6366f1";
  // Compute area dynamically
  let areaText = "";
  if (opts.pixelsPerUnit && opts.physicalUnit && polyPoints.length >= 3) {
    let area = 0;
    const n = polyPoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += polyPoints[i]!.x * polyPoints[j]!.y;
      area -= polyPoints[j]!.x * polyPoints[i]!.y;
    }
    area = Math.abs(area) / 2;
    const physArea = area / (opts.pixelsPerUnit * opts.pixelsPerUnit);
    areaText = `${physArea % 1 === 0 ? physArea.toFixed(0) : physArea.toFixed(1)} ${opts.physicalUnit}²`;
  }
  let label = "";
  if (node.label && areaText) {
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="#333">`
      + `<tspan x="${cx}" dy="-0.5em" font-size="13" font-weight="600">${esc(node.label)}</tspan>`
      + `<tspan x="${cx}" dy="1.2em" font-size="11" opacity="0.7">${esc(areaText)}</tspan>`
      + `</text>`;
  } else if (node.label) {
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="600" fill="#333">${esc(node.label)}</text>`;
  } else if (areaText) {
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#333" opacity="0.7">${esc(areaText)}</text>`;
  }
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,2"/>${label}`;
}

function renderDoorNode(node: IdeaCanvasThumbnailNode): string {
  const w = node.width;
  const h = node.height || 6;
  const rot = node.rotation ?? 0;
  const stroke = node.strokeColor ?? "#374151";
  return `<g transform="translate(${node.x},${node.y}) rotate(${rot})">`
    + `<rect x="${-w / 2}" y="${-h / 2 - 1}" width="${w}" height="${h + 2}" fill="#ffffff" stroke="none"/>`
    + `<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="${stroke}" stroke-width="1.5"/>`
    + `<path d="M ${w / 2},0 A ${w},${w} 0 0,1 ${-w / 2 + w * (1 - Math.cos(Math.PI / 2))},${-w * Math.sin(Math.PI / 2)}" fill="none" stroke="${stroke}" stroke-width="0.75" stroke-dasharray="3,2"/>`
    + `<circle cx="${-w / 2}" cy="0" r="2" fill="${stroke}"/>`
    + `</g>`;
}

function renderWindowNode(node: IdeaCanvasThumbnailNode): string {
  const w = node.width;
  const h = node.height || 6;
  const rot = node.rotation ?? 0;
  const stroke = node.strokeColor ?? "#374151";
  return `<g transform="translate(${node.x},${node.y}) rotate(${rot})">`
    + `<rect x="${-w / 2}" y="${-h / 2 - 1}" width="${w}" height="${h + 2}" fill="#ffffff" stroke="none"/>`
    + `<rect x="${-w / 2}" y="${-h / 4}" width="${w}" height="${h / 2}" fill="none" stroke="${stroke}" stroke-width="1"/>`
    + `<line x1="${-w / 2}" y1="-1" x2="${w / 2}" y2="-1" stroke="#93c5fd" stroke-width="1"/>`
    + `<line x1="${-w / 2}" y1="1" x2="${w / 2}" y2="1" stroke="#93c5fd" stroke-width="1"/>`
    + `</g>`;
}

function renderStairsNode(node: IdeaCanvasThumbnailNode, pixelsPerUnit?: number | null): string {
  const w = node.width;
  const h = node.height;
  const stepCount = Math.max(3, Math.round(h / (pixelsPerUnit ? pixelsPerUnit * 0.25 : 12)));
  const stepH = h / stepCount;
  const fill = node.fillColor ?? "rgba(255,255,255,0.9)";
  const stroke = node.strokeColor ?? "#374151";
  let steps = "";
  for (let i = 0; i < stepCount - 1; i++) {
    const sy = node.y + stepH * (i + 1);
    steps += `<line x1="${node.x}" y1="${sy}" x2="${node.x + w}" y2="${sy}" stroke="${stroke}" stroke-width="0.5"/>`;
  }
  return `<g>`
    + `<rect x="${node.x}" y="${node.y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
    + steps
    + `<line x1="${node.x + w / 2}" y1="${node.y + h * 0.85}" x2="${node.x + w / 2}" y2="${node.y + h * 0.15}" stroke="${stroke}" stroke-width="1.5"/>`
    + `<polygon points="${node.x + w / 2},${node.y + h * 0.1} ${node.x + w / 2 - 5},${node.y + h * 0.2} ${node.x + w / 2 + 5},${node.y + h * 0.2}" fill="${stroke}"/>`
    + `</g>`;
}

function renderFreehandNode(node: IdeaCanvasThumbnailNode): string {
  let d = "";
  if (node.pointsJson) {
    try {
      const pts = JSON.parse(node.pointsJson) as { x: number; y: number }[];
      d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    } catch { /* ignore */ }
  }
  if (!d) d = `M${node.x},${node.y} L${node.x + node.width},${node.y + node.height}`;
  const stroke = node.strokeColor ?? "#333333";
  const sw = node.strokeWidth ?? 2;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function renderCircleNode(node: IdeaCanvasThumbnailNode): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rx = node.width / 2;
  const ry = node.height / 2;
  const fill = node.fillColor ?? node.color ?? "transparent";
  const stroke = node.strokeColor ?? "#475569";
  const sw = node.strokeWidth ?? 1.5;
  let label = "";
  if (node.label) {
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#333">${esc(node.label)}</text>`;
  }
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>${label}`;
}

function renderTextNode(node: IdeaCanvasThumbnailNode): string {
  if (!node.label) return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="transparent"/>`;
  return `<text x="${node.x + 4}" y="${node.y + 16}" font-size="14" fill="#333">`
    + `<tspan>${esc(node.label)}</tspan></text>`;
}

function renderRectNode(node: IdeaCanvasThumbnailNode): string {
  const fill = node.fillColor ?? node.color ?? "transparent";
  const stroke = node.strokeColor ?? "#475569";
  const sw = node.strokeWidth ?? 1.5;
  let label = "";
  if (node.label) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#333">${esc(node.label)}</text>`;
  }
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="4" ry="4" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>${label}`;
}

function renderFlowchartNode(node: IdeaCanvasThumbnailNode): string {
  const r = shapeRadius(node.shape);
  const fill = node.fillColor ?? node.color ?? "#f8fafc";
  const stroke = node.strokeColor ?? "#475569";
  const sw = node.strokeWidth ?? 1.5;
  let shape: string;
  if (node.shape === "diamond") {
    const d = `M ${node.x + node.width / 2} ${node.y} L ${node.x + node.width} ${node.y + node.height / 2} L ${node.x + node.width / 2} ${node.y + node.height} L ${node.x} ${node.y + node.height / 2} Z`;
    shape = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else {
    shape = `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  }
  let label = "";
  if (node.label) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    label = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#333">${esc(node.label)}</text>`;
  }
  return shape + label;
}

// ─── Single node dispatch ────────────────────────────────────────────────────

export function renderNodeSVG(
  node: IdeaCanvasThumbnailNode,
  wallMiterPolygons: Map<string, { x: number; y: number }[]>,
  opts: CanvasRenderOptions,
): string {
  const imgUrl = opts.imageUrlMap?.get(node.id);
  switch (node.objectType) {
    case "image":     return renderImageNode(node, imgUrl);
    case "object":    return renderObjectNode(node, imgUrl);
    case "wall":      return renderWallNode(node, wallMiterPolygons, opts);
    case "line":      return renderLineNode(node);
    case "dimension": return renderDimensionNode(node, opts);
    case "room":      return renderRoomNode(node, opts);
    case "door":      return renderDoorNode(node);
    case "window":    return renderWindowNode(node);
    case "stairs":    return renderStairsNode(node, opts.pixelsPerUnit);
    case "freehand":  return renderFreehandNode(node);
    case "circle":    return renderCircleNode(node);
    case "text":      return renderTextNode(node);
    case "rect":      return renderRectNode(node);
    default:          return renderFlowchartNode(node);
  }
}

// ─── Edge rendering ──────────────────────────────────────────────────────────

export function renderEdgeSVG(
  edge: IdeaCanvasThumbnailEdge,
  nodeMap: Map<string, IdeaCanvasThumbnailNode>,
): string {
  const source = nodeMap.get(edge.sourceNodeId);
  const target = nodeMap.get(edge.targetNodeId);
  if (!source || !target) return "";
  const a = getEdgeAnchors(source, target);
  const path = bezierPath(a.sx, a.sy, a.tx, a.ty);
  const dash = edgeDasharray(edge.style as CanvasEdgeStyle);
  let label = "";
  if (edge.label) {
    const lx = (a.sx + a.tx) / 2;
    const ly = (a.sy + a.ty) / 2;
    label = `<text x="${lx}" y="${ly - 6}" text-anchor="middle" font-size="12" fill="#666">${esc(edge.label)}</text>`;
  }
  return `<path d="${path}" fill="none" stroke="#888" stroke-width="1.5"${dash} marker-end="url(#arrowhead)"/>${label}`;
}

// ─── Grid rendering ──────────────────────────────────────────────────────────

function renderGrid(box: BoundingBox, gridSize?: number): string {
  const step = gridSize ?? 40;
  const majorStep = step * 5;
  let svg = "";
  const xStart = Math.floor(box.minX / step) * step;
  const xEnd = Math.ceil(box.maxX / step) * step;
  const yStart = Math.floor(box.minY / step) * step;
  const yEnd = Math.ceil(box.maxY / step) * step;
  for (let x = xStart; x <= xEnd; x += step) {
    const isMajor = Math.abs(Math.round(x / majorStep) * majorStep - x) < step * 0.001;
    const color = isMajor ? "#6e8098" : "#b8c4ce";
    const sw = isMajor ? 1 : 0.5;
    svg += `<line x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}" stroke="${color}" stroke-width="${sw}"/>`;
  }
  for (let y = yStart; y <= yEnd; y += step) {
    const isMajor = Math.abs(Math.round(y / majorStep) * majorStep - y) < step * 0.001;
    const color = isMajor ? "#6e8098" : "#b8c4ce";
    const sw = isMajor ? 1 : 0.5;
    svg += `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${color}" stroke-width="${sw}"/>`;
  }
  return svg;
}

// ─── Full canvas rendering ───────────────────────────────────────────────────

/**
 * Render a complete SVG document string from canvas nodes and edges.
 * The result is a standalone SVG that auto-fits all content.
 */
export function renderCanvasToSVG(
  nodes: IdeaCanvasThumbnailNode[],
  edges: IdeaCanvasThumbnailEdge[],
  opts: CanvasRenderOptions = {},
): string {
  const box = computeBoundingBox(nodes);
  const bg = opts.backgroundColor ?? "#ffffff";

  // Pre-compute wall miter polygons
  const wallNodes = nodes.filter(n => n.objectType === "wall");
  const wallMiterPolygons = wallNodes.length >= 2
    ? computeWallPolygonsWithMiters(wallNodes)
    : new Map<string, { x: number; y: number }[]>();

  // Build node map for edge anchoring
  const nodeMap = new Map<string, IdeaCanvasThumbnailNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Assemble SVG fragments
  let body = "";

  // Background
  body += `<rect x="${box.minX}" y="${box.minY}" width="${box.width}" height="${box.height}" fill="${bg}"/>`;

  // Background image (if present)
  if (opts.backgroundImageUrl && opts.bgImageDims) {
    const imgOp = opts.backgroundImageOpacity ?? 0.5;
    body += `<image href="${esc(opts.backgroundImageUrl)}" x="0" y="0" width="${opts.bgImageDims.w}" height="${opts.bgImageDims.h}" opacity="${imgOp}" preserveAspectRatio="none"/>`;
  }

  // Grid
  if (opts.showGrid) {
    body += renderGrid(box);
  }

  // Edges
  for (const edge of edges) {
    body += renderEdgeSVG(edge, nodeMap);
  }

  // Nodes (sorted by sortOrder)
  const sorted = [...nodes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const node of sorted) {
    body += renderNodeSVG(node, wallMiterPolygons, opts);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.minX} ${box.minY} ${box.width} ${box.height}" width="${box.width}" height="${box.height}">`
    + `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#888"/></marker></defs>`
    + body
    + `</svg>`;
}
