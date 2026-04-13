import PDFDocument from "pdfkit";

/** Read natural image dimensions from a PNG or JPEG buffer. Returns null if unrecognized. */
export function readImageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: first 8 bytes are signature, then IHDR chunk at offset 8, width at 16, height at 20
  if (buf.length > 24 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  }
  // JPEG: starts with FF D8; scan for SOF0/SOF2 marker
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1]!;
      // SOF0 (0xC0) or SOF2 (0xC2) — contains dimensions
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      // Skip to next marker
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }
  return null;
}

type PdfNode = {
  id: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  objectType: string;
  shape: string | null;
  label: string;
  color: string | null;
  strokeColor: string | null;
  fillColor: string | null;
  strokeWidth: number;
  fontSize: number;
  rotation: number;
  sortOrder: number;
  maskJson: string | null;
  pointsJson: string | null;
  pointAx: number | null;
  pointAy: number | null;
  pointBx: number | null;
  pointBy: number | null;
  wallThickness: number | null;
  swingDirection: string | null;
  stairDirection: string | null;
};

type PdfEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  style: string | null;
};

export type CanvasPdfInput = {
  name: string;
  nodes: PdfNode[];
  edges: PdfEdge[];
  canvasMode: string;
  physicalUnit: string | null;
  pixelsPerUnit: number | null;
  showDimensions: boolean;
  /** Background image buffer (JPEG/PNG) for satellite overlay */
  backgroundImage?: {
    buffer: Buffer;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    /** Natural image width in pixels (before canvas scale) */
    naturalWidth: number;
    /** Natural image height in pixels (before canvas scale) */
    naturalHeight: number;
    /** Crop region (normalised 0-1 fractions of the drawn image rect) */
    cropX?: number | null;
    cropY?: number | null;
    cropW?: number | null;
    cropH?: number | null;
  };
  /** Map of nodeId → image buffer for image/object nodes */
  nodeImages?: Map<string, Buffer>;
};

function computeBounds(nodes: PdfNode[], padding = 20) {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 200, maxY: 120 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.objectType === "line" || n.objectType === "wall" || n.objectType === "dimension") {
      minX = Math.min(minX, n.x, n.x2);
      maxX = Math.max(maxX, n.x, n.x2);
      minY = Math.min(minY, n.y, n.y2);
      maxY = Math.max(maxY, n.y, n.y2);
    } else if (n.objectType === "door" || n.objectType === "window") {
      const r = Math.max(n.width, n.height) / 2;
      minX = Math.min(minX, n.x - r); maxX = Math.max(maxX, n.x + r);
      minY = Math.min(minY, n.y - r); maxY = Math.max(maxY, n.y + r);
    } else {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + n.height);
    }
  }
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
}

function parseColor(c: string | null | undefined, fallback: string): string {
  if (!c) return fallback;
  if (c === "transparent") return "#ffffff";
  if (c.startsWith("rgba(")) {
    const parts = c.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      const r = Math.round(Number(parts[0]));
      const g = Math.round(Number(parts[1]));
      const b = Math.round(Number(parts[2]));
      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return c;
}

function fmtPhysical(pixels: number, ppu: number, unit: string): string {
  const val = pixels / ppu;
  return `${val.toFixed(val < 10 ? 1 : 0)} ${unit}`;
}

// ─── Wall Polygon Geometry ───────────────────────────────────────────────────

function wallPolygonFromLine(
  x1: number, y1: number, x2: number, y2: number, thickness: number,
): { x: number; y: number }[] {
  const dx = x2 - x1, dy = y2 - y1;
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

function computeWallMiterPolygons(
  walls: PdfNode[],
  snapRadius = 2,
): Map<string, { x: number; y: number }[]> {
  const result = new Map<string, { x: number; y: number }[]>();

  type WallInfo = {
    id: string; x1: number; y1: number; x2: number; y2: number;
    thickness: number; nx: number; ny: number;
  };
  const infos: WallInfo[] = walls.map(w => {
    const t = w.strokeWidth ?? 6;
    const dx = w.x2 - w.x, dy = w.y2 - w.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return { id: w.id, x1: w.x, y1: w.y, x2: w.x2, y2: w.y2, thickness: t, nx: 0, ny: 0 };
    return { id: w.id, x1: w.x, y1: w.y, x2: w.x2, y2: w.y2, thickness: t, nx: (-dy / len) * (t / 2), ny: (dx / len) * (t / 2) };
  });

  const close = (ax: number, ay: number, bx: number, by: number) =>
    Math.abs(ax - bx) <= snapRadius && Math.abs(ay - by) <= snapRadius;

  const lineIntersect = (
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number,
  ): { x: number; y: number } | null => {
    const d = (p1x - p2x) * (p3y - p4y) - (p1y - p2y) * (p3x - p4x);
    if (Math.abs(d) < 1e-10) return null;
    const t = ((p1x - p3x) * (p3y - p4y) - (p1y - p3y) * (p3x - p4x)) / d;
    return { x: p1x + t * (p2x - p1x), y: p1y + t * (p2y - p1y) };
  };

  for (const info of infos) {
    const corners = [
      { x: info.x1 + info.nx, y: info.y1 + info.ny },
      { x: info.x2 + info.nx, y: info.y2 + info.ny },
      { x: info.x2 - info.nx, y: info.y2 - info.ny },
      { x: info.x1 - info.nx, y: info.y1 - info.ny },
    ];

    // Miter at start endpoint (x1,y1)
    for (const other of infos) {
      if (other.id === info.id) continue;
      let se: "s" | "e" | null = null;
      if (close(info.x1, info.y1, other.x1, other.y1)) se = "s";
      else if (close(info.x1, info.y1, other.x2, other.y2)) se = "e";
      if (!se) continue;
      const oP1 = se === "s" ? { x: other.x1 + other.nx, y: other.y1 + other.ny } : { x: other.x2 + other.nx, y: other.y2 + other.ny };
      const oP2 = se === "s" ? { x: other.x2 + other.nx, y: other.y2 + other.ny } : { x: other.x1 + other.nx, y: other.y1 + other.ny };
      const oP3 = se === "s" ? { x: other.x1 - other.nx, y: other.y1 - other.ny } : { x: other.x2 - other.nx, y: other.y2 - other.ny };
      const oP4 = se === "s" ? { x: other.x2 - other.nx, y: other.y2 - other.ny } : { x: other.x1 - other.nx, y: other.y1 - other.ny };
      const mt = lineIntersect(corners[0]!.x, corners[0]!.y, corners[1]!.x, corners[1]!.y, oP1.x, oP1.y, oP2.x, oP2.y);
      if (mt && Math.hypot(mt.x - info.x1, mt.y - info.y1) < Math.hypot(corners[0]!.x - info.x1, corners[0]!.y - info.y1) * 4) corners[0] = mt;
      const mb = lineIntersect(corners[3]!.x, corners[3]!.y, corners[2]!.x, corners[2]!.y, oP3.x, oP3.y, oP4.x, oP4.y);
      if (mb && Math.hypot(mb.x - info.x1, mb.y - info.y1) < Math.hypot(corners[3]!.x - info.x1, corners[3]!.y - info.y1) * 4) corners[3] = mb;
      break;
    }

    // Miter at end endpoint (x2,y2)
    for (const other of infos) {
      if (other.id === info.id) continue;
      let se: "s" | "e" | null = null;
      if (close(info.x2, info.y2, other.x1, other.y1)) se = "s";
      else if (close(info.x2, info.y2, other.x2, other.y2)) se = "e";
      if (!se) continue;
      const oP1 = se === "s" ? { x: other.x1 + other.nx, y: other.y1 + other.ny } : { x: other.x2 + other.nx, y: other.y2 + other.ny };
      const oP2 = se === "s" ? { x: other.x2 + other.nx, y: other.y2 + other.ny } : { x: other.x1 + other.nx, y: other.y1 + other.ny };
      const oP3 = se === "s" ? { x: other.x1 - other.nx, y: other.y1 - other.ny } : { x: other.x2 - other.nx, y: other.y2 - other.ny };
      const oP4 = se === "s" ? { x: other.x2 - other.nx, y: other.y2 - other.ny } : { x: other.x1 - other.nx, y: other.y1 - other.ny };
      const mt = lineIntersect(corners[0]!.x, corners[0]!.y, corners[1]!.x, corners[1]!.y, oP1.x, oP1.y, oP2.x, oP2.y);
      if (mt && Math.hypot(mt.x - info.x2, mt.y - info.y2) < Math.hypot(corners[1]!.x - info.x2, corners[1]!.y - info.y2) * 4) corners[1] = mt;
      const mb = lineIntersect(corners[3]!.x, corners[3]!.y, corners[2]!.x, corners[2]!.y, oP3.x, oP3.y, oP4.x, oP4.y);
      if (mb && Math.hypot(mb.x - info.x2, mb.y - info.y2) < Math.hypot(corners[2]!.x - info.x2, corners[2]!.y - info.y2) * 4) corners[2] = mb;
      break;
    }

    result.set(info.id, corners);
  }
  return result;
}

function drawNode(doc: PDFKit.PDFDocument, node: PdfNode, s: number, ox: number, oy: number, opts: CanvasPdfInput, wallMiterPolygons: Map<string, { x: number; y: number }[]>) {
  const tx = (v: number) => (v - ox) * s;
  const ty = (v: number) => (v - oy) * s;
  const ts = (v: number) => v * s;

  switch (node.objectType) {
    case "wall": {
      const thickness = (node.strokeWidth ?? 6) * s;
      const wallFill = parseColor(node.fillColor, "#d1d5db");
      const wallStroke = parseColor(node.strokeColor, "#374151");

      // Use miter polygon if available, otherwise compute simple 4-corner polygon
      const miterPoly = wallMiterPolygons.get(node.id);
      const poly = miterPoly
        ? miterPoly.map(p => ({ x: tx(p.x), y: ty(p.y) }))
        : wallPolygonFromLine(tx(node.x), ty(node.y), tx(node.x2), ty(node.y2), thickness);

      if (poly.length >= 4) {
        doc.save();
        const p0 = poly[0]!;
        doc.moveTo(p0.x, p0.y);
        for (let i = 1; i < poly.length; i++) doc.lineTo(poly[i]!.x, poly[i]!.y);
        doc.closePath();
        doc.fillColor(wallFill).strokeColor(wallStroke).lineWidth(0.75).fillAndStroke();
        // Rounded endpoint caps
        const r = thickness / 2;
        doc.circle(tx(node.x), ty(node.y), Math.max(r, 1)).fillColor(wallFill).strokeColor(wallStroke).lineWidth(0.5).fillAndStroke();
        doc.circle(tx(node.x2), ty(node.y2), Math.max(r, 1)).fillColor(wallFill).strokeColor(wallStroke).lineWidth(0.5).fillAndStroke();
        doc.restore();
      }

      if (opts.showDimensions && opts.pixelsPerUnit && opts.physicalUnit) {
        const dx = node.x2 - node.x, dy = node.y2 - node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = tx((node.x + node.x2) / 2);
        const my = ty((node.y + node.y2) / 2) - thickness / 2 - 6;
        doc.fontSize(8).fillColor("#333333").text(fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit), mx - 30, my, { width: 60, align: "center" });
      }
      break;
    }
    case "room": {
      const fill = parseColor(node.fillColor, "#e8e8ff");
      const stroke = parseColor(node.strokeColor, "#6366f1");
      doc.save();
      // Render actual polygon if maskJson is available
      let roomPolyPoints: { x: number; y: number }[] = [];
      if (node.maskJson) {
        try {
          const mask = JSON.parse(node.maskJson) as { type: string; points: { x: number; y: number }[] };
          if (mask.type === "polygon" && mask.points.length >= 3) {
            roomPolyPoints = mask.points.map(p => ({ x: node.x + p.x, y: node.y + p.y }));
          }
        } catch { /* no-op */ }
      }
      if (roomPolyPoints.length >= 3) {
        const p0 = roomPolyPoints[0]!;
        doc.moveTo(tx(p0.x), ty(p0.y));
        for (let i = 1; i < roomPolyPoints.length; i++) {
          doc.lineTo(tx(roomPolyPoints[i]!.x), ty(roomPolyPoints[i]!.y));
        }
        doc.closePath();
      } else {
        doc.rect(tx(node.x), ty(node.y), ts(node.width), ts(node.height));
      }
      doc.fillColor(fill).strokeColor(stroke).lineWidth(0.5).dash(4, { space: 2 }).fillAndStroke();
      doc.undash().restore();
      // Compute area dynamically
      let roomAreaText = "";
      if (opts.pixelsPerUnit && opts.physicalUnit) {
        const pts = roomPolyPoints.length >= 3 ? roomPolyPoints : [
          { x: node.x, y: node.y },
          { x: node.x + node.width, y: node.y },
          { x: node.x + node.width, y: node.y + node.height },
          { x: node.x, y: node.y + node.height },
        ];
        let area = 0;
        const pn = pts.length;
        for (let i = 0; i < pn; i++) {
          const j = (i + 1) % pn;
          area += pts[i]!.x * pts[j]!.y;
          area -= pts[j]!.x * pts[i]!.y;
        }
        area = Math.abs(area) / 2;
        const physArea = area / (opts.pixelsPerUnit * opts.pixelsPerUnit);
        roomAreaText = `${physArea % 1 === 0 ? physArea.toFixed(0) : physArea.toFixed(1)} ${opts.physicalUnit}²`;
      }
      const roomCx = tx(node.x) + ts(node.width) / 2;
      const roomLabelY = ty(node.y) + ts(node.height) / 2;
      if (node.label && roomAreaText) {
        doc.fontSize(10).fillColor("#333333").text(node.label, roomCx - ts(node.width) / 2, roomLabelY - 12, { width: ts(node.width), align: "center" });
        doc.fontSize(8).fillColor("#666666").text(roomAreaText, roomCx - ts(node.width) / 2, roomLabelY + 2, { width: ts(node.width), align: "center" });
      } else if (node.label) {
        doc.fontSize(10).fillColor("#333333").text(node.label, roomCx - ts(node.width) / 2, roomLabelY - 5, { width: ts(node.width), align: "center" });
      } else if (roomAreaText) {
        doc.fontSize(8).fillColor("#666666").text(roomAreaText, roomCx - ts(node.width) / 2, roomLabelY - 5, { width: ts(node.width), align: "center" });
      }
      break;
    }
    case "door": {
      const w = ts(node.width);
      const swing = node.swingDirection ?? "left";
      const strokeCol = parseColor(node.strokeColor, "#374151");
      doc.save();
      doc.translate(tx(node.x), ty(node.y)).rotate(node.rotation ?? 0);
      doc.lineWidth(0.8).strokeColor(strokeCol);
      // Door leaf line
      doc.moveTo(-w / 2, 0).lineTo(w / 2, 0).stroke();
      // Swing arc(s)
      const arcRadius = w;
      if (swing === "left" || swing === "double") {
        // Hinge at left (-w/2, 0), arc sweeps from (w/2, 0) to (-w/2, -w)
        doc.save();
        doc.lineWidth(0.5).strokeColor(strokeCol).dash(3, { space: 2 });
        const path = doc.path(`M ${w / 2} 0 A ${arcRadius} ${arcRadius} 0 0 1 ${-w / 2} ${-arcRadius}`);
        path.stroke();
        doc.undash().restore();
        doc.circle(-w / 2, 0, 1.5).fillColor(strokeCol).fill();
      }
      if (swing === "right" || swing === "double") {
        // Hinge at right (w/2, 0), arc sweeps from (-w/2, 0) to (w/2, -w)
        doc.save();
        doc.lineWidth(0.5).strokeColor(strokeCol).dash(3, { space: 2 });
        const path = doc.path(`M ${-w / 2} 0 A ${arcRadius} ${arcRadius} 0 0 0 ${w / 2} ${-arcRadius}`);
        path.stroke();
        doc.undash().restore();
        doc.circle(w / 2, 0, 1.5).fillColor(strokeCol).fill();
      }
      doc.restore();
      break;
    }
    case "window": {
      const w = ts(node.width);
      const h = Math.max(ts(node.height || 6), 3);
      doc.save();
      doc.translate(tx(node.x), ty(node.y)).rotate(node.rotation ?? 0);
      doc.rect(-w / 2, -h / 4, w, h / 2).strokeColor(parseColor(node.strokeColor, "#374151")).lineWidth(0.5).stroke();
      doc.lineWidth(0.5).strokeColor("#93c5fd");
      doc.moveTo(-w / 2, -0.5).lineTo(w / 2, -0.5).stroke();
      doc.moveTo(-w / 2, 0.5).lineTo(w / 2, 0.5).stroke();
      doc.restore();
      break;
    }
    case "stairs": {
      const sx = tx(node.x), sy = ty(node.y), sw = ts(node.width), sh = ts(node.height);
      const dir = node.stairDirection ?? "up";
      const isHoriz = dir === "left" || dir === "right";
      const stepCount = Math.max(3, Math.round((isHoriz ? sw : sh) / 8));
      const stepSize = (isHoriz ? sw : sh) / stepCount;
      const strokeCol = parseColor(node.strokeColor, "#374151");
      doc.save();
      doc.rect(sx, sy, sw, sh).strokeColor(strokeCol).lineWidth(0.5);
      if (node.fillColor) doc.fillColor(parseColor(node.fillColor, "#ffffff")).fillAndStroke();
      else doc.stroke();
      for (let i = 1; i < stepCount; i++) {
        if (isHoriz) {
          doc.moveTo(sx + stepSize * i, sy).lineTo(sx + stepSize * i, sy + sh).lineWidth(0.3).stroke();
        } else {
          doc.moveTo(sx, sy + stepSize * i).lineTo(sx + sw, sy + stepSize * i).lineWidth(0.3).stroke();
        }
      }
      // Direction arrow
      const cx = sx + sw / 2, cy = sy + sh / 2;
      const arrowLen = (isHoriz ? sw : sh) * 0.35;
      const arrowSize = 4;
      doc.lineWidth(1).strokeColor(strokeCol);
      switch (dir) {
        case "up":
          doc.moveTo(cx, cy + arrowLen).lineTo(cx, cy - arrowLen).stroke();
          doc.polygon([cx, cy - arrowLen - 2], [cx - arrowSize, cy - arrowLen + arrowSize], [cx + arrowSize, cy - arrowLen + arrowSize]).fillColor(strokeCol).fill();
          break;
        case "down":
          doc.moveTo(cx, cy - arrowLen).lineTo(cx, cy + arrowLen).stroke();
          doc.polygon([cx, cy + arrowLen + 2], [cx - arrowSize, cy + arrowLen - arrowSize], [cx + arrowSize, cy + arrowLen - arrowSize]).fillColor(strokeCol).fill();
          break;
        case "left":
          doc.moveTo(cx + arrowLen, cy).lineTo(cx - arrowLen, cy).stroke();
          doc.polygon([cx - arrowLen - 2, cy], [cx - arrowLen + arrowSize, cy - arrowSize], [cx - arrowLen + arrowSize, cy + arrowSize]).fillColor(strokeCol).fill();
          break;
        case "right":
          doc.moveTo(cx - arrowLen, cy).lineTo(cx + arrowLen, cy).stroke();
          doc.polygon([cx + arrowLen + 2, cy], [cx + arrowLen - arrowSize, cy - arrowSize], [cx + arrowLen - arrowSize, cy + arrowSize]).fillColor(strokeCol).fill();
          break;
      }
      doc.restore();
      break;
    }
    case "line": {
      doc.save();
      doc.lineWidth(Math.max((node.strokeWidth ?? 1.5) * s, 0.5))
        .strokeColor(parseColor(node.strokeColor, "#475569"))
        .lineCap("round");
      doc.moveTo(tx(node.x), ty(node.y)).lineTo(tx(node.x2), ty(node.y2)).stroke();
      doc.restore();
      break;
    }
    case "dimension": {
      const ax = node.pointAx ?? node.x, ay = node.pointAy ?? node.y;
      const bx = node.pointBx ?? node.x2, by = node.pointBy ?? node.y2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.1) break;
      const nx = -dy / len, ny = dx / len;

      // Dimension line is offset from the measured points
      const offset = 12; // offset distance in canvas px
      const extLen = 16; // extension line length past dimension line
      const tickLen = 3; // how far extension lines go past dimension line
      const dimCol = "#6366f1";

      // The dimension line endpoints (offset from anchor points)
      const d1x = tx(ax) + nx * offset * s, d1y = ty(ay) + ny * offset * s;
      const d2x = tx(bx) + nx * offset * s, d2y = ty(by) + ny * offset * s;

      doc.save();
      // Extension lines from anchor points to dimension line
      doc.lineWidth(0.4).strokeColor(dimCol);
      doc.moveTo(tx(ax) + nx * 2 * s, ty(ay) + ny * 2 * s).lineTo(d1x + nx * tickLen * s, d1y + ny * tickLen * s).stroke();
      doc.moveTo(tx(bx) + nx * 2 * s, ty(by) + ny * 2 * s).lineTo(d2x + nx * tickLen * s, d2y + ny * tickLen * s).stroke();

      // Dimension line
      doc.lineWidth(0.6).strokeColor(dimCol);
      doc.moveTo(d1x, d1y).lineTo(d2x, d2y).stroke();

      // Arrowheads (filled triangles at each end)
      const aSize = 3;
      const ux = (dx / len), uy = (dy / len); // unit vector along dimension
      // Arrow at start (pointing toward center)
      doc.polygon(
        [d1x, d1y],
        [d1x + (ux * aSize * 2 + nx * aSize) * s, d1y + (uy * aSize * 2 + ny * aSize) * s],
        [d1x + (ux * aSize * 2 - nx * aSize) * s, d1y + (uy * aSize * 2 - ny * aSize) * s],
      ).fillColor(dimCol).fill();
      // Arrow at end (pointing toward center)
      doc.polygon(
        [d2x, d2y],
        [d2x + (-ux * aSize * 2 + nx * aSize) * s, d2y + (-uy * aSize * 2 + ny * aSize) * s],
        [d2x + (-ux * aSize * 2 - nx * aSize) * s, d2y + (-uy * aSize * 2 - ny * aSize) * s],
      ).fillColor(dimCol).fill();

      doc.restore();

      // Label centered along dimension line
      const label = opts.pixelsPerUnit && opts.physicalUnit
        ? fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit)
        : `${Math.round(len)}px`;
      const mx = (d1x + d2x) / 2;
      const my = (d1y + d2y) / 2 - 5;
      doc.fontSize(7).fillColor(dimCol).text(label, mx - 25, my, { width: 50, align: "center" });
      break;
    }
    case "freehand": {
      if (!node.pointsJson) break;
      try {
        const pts = JSON.parse(node.pointsJson) as { x: number; y: number }[];
        if (pts.length < 2) break;
        doc.save();
        doc.lineWidth(Math.max((node.strokeWidth ?? 2) * s, 0.5))
          .strokeColor(parseColor(node.strokeColor, "#333333")).lineCap("round").lineJoin("round");
        const p0 = pts[0]!;
        doc.moveTo(tx(p0.x), ty(p0.y));
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i]!;
          doc.lineTo(tx(p.x), ty(p.y));
        }
        doc.stroke();
        doc.restore();
      } catch { /* skip */ }
      break;
    }
    case "circle": {
      const cx = tx(node.x + node.width / 2);
      const cy = ty(node.y + node.height / 2);
      const rx = ts(node.width) / 2;
      const ry = ts(node.height) / 2;
      const fill = parseColor(node.fillColor ?? node.color, "#ffffff");
      const stroke = parseColor(node.strokeColor, "#475569");
      const sw = Math.max((node.strokeWidth ?? 1.5) * s, 0.5);
      doc.save();
      doc.ellipse(cx, cy, rx, ry).lineWidth(sw).fillColor(fill).strokeColor(stroke).fillAndStroke();
      doc.restore();
      if (node.label) {
        doc.fontSize((node.fontSize ?? 10) * s).fillColor("#333333").text(node.label, cx - rx, cy - 5, { width: rx * 2, align: "center" });
      }
      break;
    }
    case "text": {
      if (node.label) {
        doc.fontSize(Math.max((node.fontSize ?? 10) * s, 6)).fillColor("#333333")
          .text(node.label, tx(node.x) + 2, ty(node.y) + 2, { width: Math.max(ts(node.width) - 4, 20) });
      }
      break;
    }
    case "image":
    case "object": {
      const imgBuf = opts.nodeImages?.get(node.id);
      const nx = tx(node.x), ny = ty(node.y), nw = ts(node.width), nh = ts(node.height);
      const rot = node.rotation ?? 0;
      doc.save();
      if (rot !== 0) {
        doc.translate(nx + nw / 2, ny + nh / 2).rotate(rot).translate(-(nx + nw / 2), -(ny + nh / 2));
      }
      if (imgBuf) {
        try {
          doc.image(imgBuf, nx, ny, { width: nw, height: nh });
        } catch {
          // Fallback to placeholder if image is invalid
          doc.rect(nx, ny, nw, nh)
            .fillColor("#f0f4f8").strokeColor("#475569").lineWidth(0.75).fillAndStroke();
        }
      } else {
        doc.rect(nx, ny, nw, nh)
          .fillColor("#f0f4f8").strokeColor("#475569").lineWidth(0.75).fillAndStroke();
      }
      doc.restore();
      if (node.label) {
        doc.fontSize(Math.max(8 * s, 5)).fillColor("#666666")
          .text(node.label, nx, ny + nh / 2 - 5, { width: nw, align: "center" });
      }
      break;
    }
    default: {
      // rect / flowchart
      const r = node.shape === "rounded" ? Math.min(8 * s, ts(node.width) / 2) : node.shape === "pill" ? ts(node.height) / 2 : Math.min(3 * s, ts(node.width) / 2);
      const fill = parseColor(node.fillColor ?? node.color, "#f8fafc");
      const stroke = parseColor(node.strokeColor, "#475569");
      const sw = Math.max((node.strokeWidth ?? 1.5) * s, 0.5);

      if (node.shape === "diamond") {
        const cx = tx(node.x + node.width / 2);
        const cy = ty(node.y + node.height / 2);
        const hw = ts(node.width) / 2;
        const hh = ts(node.height) / 2;
        doc.save();
        doc.polygon([cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]);
        doc.lineWidth(sw).fillColor(fill).strokeColor(stroke).fillAndStroke();
        doc.restore();
        if (node.label) {
          doc.fontSize(Math.max((node.fontSize ?? 10) * s, 6)).fillColor("#333333").text(node.label, cx - hw, cy - 5, { width: hw * 2, align: "center" });
        }
      } else {
        doc.save();
        doc.roundedRect(tx(node.x), ty(node.y), ts(node.width), ts(node.height), r);
        doc.lineWidth(sw).fillColor(fill).strokeColor(stroke).fillAndStroke();
        doc.restore();
        if (node.label) {
          doc.fontSize(Math.max((node.fontSize ?? 10) * s, 6)).fillColor("#333333")
            .text(node.label, tx(node.x) + 4, ty(node.y) + ts(node.height) / 2 - 5, { width: Math.max(ts(node.width) - 8, 20), align: "center" });
        }
      }
      break;
    }
  }
}

function drawEdge(doc: PDFKit.PDFDocument, edge: PdfEdge, nodeMap: Map<string, PdfNode>, s: number, ox: number, oy: number) {
  const tx = (v: number) => (v - ox) * s;
  const ty = (v: number) => (v - oy) * s;

  const source = nodeMap.get(edge.sourceNodeId);
  const target = nodeMap.get(edge.targetNodeId);
  if (!source || !target) return;

  const sx = tx(source.x + source.width / 2);
  const sy = ty(source.y + source.height / 2);
  const ex = tx(target.x + target.width / 2);
  const ey = ty(target.y + target.height / 2);

  doc.save();
  doc.lineWidth(0.75).strokeColor("#888888");
  if (edge.style === "dashed") doc.dash(6, { space: 3 });
  else if (edge.style === "dotted") doc.dash(2, { space: 2 });

  const midX = (sx + ex) / 2;
  const cp1x = midX + Math.min(Math.abs(ex - sx) * 0.15, 40);
  const cp2x = midX - Math.min(Math.abs(ex - sx) * 0.15, 40);
  doc.moveTo(sx, sy).bezierCurveTo(cp1x, sy, cp2x, ey, ex, ey).stroke();
  doc.undash().restore();

  // Arrowhead
  const angle = Math.atan2(ey - sy, ex - sx);
  const aLen = 6;
  doc.save();
  doc.fillColor("#888888");
  doc.polygon(
    [ex, ey],
    [ex - aLen * Math.cos(angle - 0.4), ey - aLen * Math.sin(angle - 0.4)],
    [ex - aLen * Math.cos(angle + 0.4), ey - aLen * Math.sin(angle + 0.4)],
  ).fill();
  doc.restore();

  if (edge.label) {
    doc.fontSize(7).fillColor("#666666").text(edge.label, (sx + ex) / 2 - 25, (sy + ey) / 2 - 8, { width: 50, align: "center" });
  }
}

export function generateCanvasPdf(input: CanvasPdfInput): PDFKit.PDFDocument {
  const { nodes } = input;
  const bounds = computeBounds(nodes);
  const canvasW = bounds.maxX - bounds.minX;
  const canvasH = bounds.maxY - bounds.minY;

  // Use landscape if canvas is wider than tall
  const landscape = canvasW > canvasH * 1.2;
  const doc = new PDFDocument({
    margin: 40,
    autoFirstPage: false,
    layout: landscape ? "landscape" : "portrait",
  });

  renderCanvasPage(doc, input);

  // Add legend page for floorplan canvases
  if (input.canvasMode === "floorplan") {
    renderLegendPage(doc, input);
  }

  return doc;
}

/** Pick a round scale bar length in physical units that fits well on the page. */
function pickScaleBarLength(ppu: number, scale: number, maxBarPx: number): number {
  const maxPhysical = maxBarPx / (ppu * scale);
  const candidates = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c <= maxPhysical && c * ppu * scale >= 30) return c;
  }
  return candidates[0]!;
}

/** Pick a round grid spacing in physical units that gives ~40-120px cell size on the page. */
function pickGridSpacing(ppu: number, scale: number, _pageDim: number): number {
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const c of candidates) {
    const cellPx = c * ppu * scale;
    if (cellPx >= 40 && cellPx <= 120) return c;
  }
  // Fallback: pick candidate closest to 60px
  let best = candidates[0]!;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(c * ppu * scale - 60);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }
  return best;
}

/**
 * Render a canvas as a new page in an existing PDFDocument.
 * Adds a page, draws title + all nodes/edges scaled to fit.
 */
export function renderCanvasPage(doc: PDFKit.PDFDocument, input: CanvasPdfInput): void {
  const { nodes, edges, name } = input;
  const bounds = computeBounds(nodes);
  const canvasW = bounds.maxX - bounds.minX;
  const canvasH = bounds.maxY - bounds.minY;

  doc.addPage();

  const pageW = doc.page.width - 80; // margins
  const footerH = 50; // space for scale bar + metadata
  const pageH = doc.page.height - 120 - footerH; // margins + title + footer

  // Title
  doc.fontSize(16).fillColor("#1e293b").text(name, 40, 40, { width: pageW, align: "center" });

  // Subtitle: mode + physical size
  const subtitle: string[] = [];
  if (input.canvasMode === "floorplan") subtitle.push("Floor Plan");
  else if (input.canvasMode === "freehand") subtitle.push("Freehand");
  if (input.pixelsPerUnit && input.physicalUnit) {
    const physW = canvasW / input.pixelsPerUnit;
    const physH = canvasH / input.pixelsPerUnit;
    subtitle.push(`${physW.toFixed(1)} × ${physH.toFixed(1)} ${input.physicalUnit}`);
  }
  if (subtitle.length > 0) {
    doc.fontSize(9).fillColor("#64748b").text(subtitle.join(" · "), 40, doc.y, { width: pageW, align: "center" });
  }
  doc.moveDown(0.5);
  const startY = doc.y;

  // Scale to fit
  const scaleX = pageW / canvasW;
  const scaleY = pageH / canvasH;
  const scale = Math.min(scaleX, scaleY, 2); // Don't scale up beyond 2x

  const offsetX = bounds.minX - (pageW / scale - canvasW) / 2;
  const offsetY = bounds.minY;

  // Save for coordinate translation
  doc.save();
  doc.translate(40, startY);

  // Draw background image if provided
  if (input.backgroundImage) {
    const bg = input.backgroundImage;
    const tx = (v: number) => (v - offsetX) * scale;
    const ty = (v: number) => (v - offsetY) * scale;
    const imgW = bg.naturalWidth * bg.scale * scale;
    const imgH = bg.naturalHeight * bg.scale * scale;
    const imgX = tx(bg.x);
    const imgY = ty(bg.y);
    doc.save();
    doc.opacity(bg.opacity);
    const hasCrop = bg.cropX != null && bg.cropY != null && bg.cropW != null && bg.cropH != null && !(bg.cropX === 0 && bg.cropY === 0 && bg.cropW === 1 && bg.cropH === 1);
    if (hasCrop) {
      const clipX = imgX + bg.cropX! * imgW;
      const clipY = imgY + bg.cropY! * imgH;
      const clipW = bg.cropW! * imgW;
      const clipH = bg.cropH! * imgH;
      doc.rect(clipX, clipY, clipW, clipH).clip();
    }
    try {
      doc.image(bg.buffer, imgX, imgY, { width: imgW, height: imgH });
    } catch { /* skip invalid image */ }
    doc.opacity(1);
    doc.restore();
  }

  // Grid lines (floorplan mode with physical units)
  if (input.canvasMode === "floorplan" && input.pixelsPerUnit && input.physicalUnit) {
    const gridPhysical = pickGridSpacing(input.pixelsPerUnit, scale, Math.min(pageW, pageH));
    const gridPx = gridPhysical * input.pixelsPerUnit;
    doc.save();
    doc.lineWidth(0.25).strokeColor("#cbd5e1").dash(2, { space: 3 });
    // Vertical grid lines
    const firstX = Math.ceil(bounds.minX / gridPx) * gridPx;
    for (let gx = firstX; gx <= bounds.maxX; gx += gridPx) {
      const px = (gx - offsetX) * scale;
      if (px >= 0 && px <= pageW) {
        doc.moveTo(px, 0).lineTo(px, (canvasH) * scale).stroke();
      }
    }
    // Horizontal grid lines
    const firstY = Math.ceil(bounds.minY / gridPx) * gridPx;
    for (let gy = firstY; gy <= bounds.maxY; gy += gridPx) {
      const py = (gy - offsetY) * scale;
      if (py >= 0 && py <= pageH) {
        doc.moveTo(0, py).lineTo((canvasW) * scale, py).stroke();
      }
    }
    doc.undash().restore();
  }

  // Build node map for edges
  const nodeMap = new Map<string, PdfNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Precompute wall miter polygons
  const wallNodes = nodes.filter(n => n.objectType === "wall");
  const wallMiterPolygons = wallNodes.length >= 2
    ? computeWallMiterPolygons(wallNodes)
    : new Map<string, { x: number; y: number }[]>();

  // Draw edges first (behind nodes)
  for (const edge of edges) {
    drawEdge(doc, edge, nodeMap, scale, offsetX, offsetY);
  }

  // Draw nodes sorted by sortOrder
  const sorted = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const node of sorted) {
    drawNode(doc, node, scale, offsetX, offsetY, input, wallMiterPolygons);
  }

  doc.restore();

  // --- Footer: scale bar + north arrow + date ---
  const footerY = doc.page.height - 40 - footerH;

  // Scale bar (bottom-left)
  if (input.pixelsPerUnit && input.physicalUnit) {
    const barLen = pickScaleBarLength(input.pixelsPerUnit, scale, pageW * 0.3);
    const barPx = barLen * input.pixelsPerUnit * scale;
    const barX = 40;
    const barY = footerY + 20;
    const barH = 4;

    doc.save();
    doc.rect(barX, barY, barPx, barH).fillColor("#1e293b").fill();
    // Tick marks at ends
    doc.lineWidth(0.75).strokeColor("#1e293b");
    doc.moveTo(barX, barY - 3).lineTo(barX, barY + barH + 3).stroke();
    doc.moveTo(barX + barPx, barY - 3).lineTo(barX + barPx, barY + barH + 3).stroke();
    // Label
    const barLabel = `${barLen % 1 === 0 ? barLen.toFixed(0) : barLen.toFixed(1)} ${input.physicalUnit}`;
    doc.fontSize(8).fillColor("#1e293b").text(barLabel, barX, barY + barH + 5, { width: barPx, align: "center" });

    // Scale ratio annotation (e.g. "Scale: 1:50")
    // 1 point in PDF ≈ 1/72 inch. Compute how many physical units per PDF point.
    const ptsPerUnit = input.pixelsPerUnit * scale; // PDF points per physical unit
    const inchesPerPt = 1 / 72;
    let ratio: number;
    if (input.physicalUnit === "ft") {
      ratio = Math.round(1 / (ptsPerUnit * inchesPerPt / 12)); // 12 inches per foot
    } else if (input.physicalUnit === "in") {
      ratio = Math.round(1 / (ptsPerUnit * inchesPerPt));
    } else if (input.physicalUnit === "m") {
      ratio = Math.round(1 / (ptsPerUnit * inchesPerPt * 0.0254));
    } else if (input.physicalUnit === "cm") {
      ratio = Math.round(1 / (ptsPerUnit * inchesPerPt * 2.54));
    } else {
      ratio = Math.round(1 / (ptsPerUnit * inchesPerPt * 0.0254)); // fallback: assume meters
    }
    if (ratio > 1) {
      doc.fontSize(7).fillColor("#64748b").text(`Scale: 1:${ratio}`, barX + barPx + 12, barY + 1);
    }

    doc.restore();
  }

  // North arrow (bottom-right)
  const arrowX = doc.page.width - 60;
  const arrowY = footerY + 14;
  const arrowLen = 20;
  doc.save();
  doc.lineWidth(1.2).strokeColor("#1e293b");
  doc.moveTo(arrowX, arrowY + arrowLen).lineTo(arrowX, arrowY).stroke();
  // Arrowhead
  doc.fillColor("#1e293b");
  doc.polygon([arrowX, arrowY - 2], [arrowX - 4, arrowY + 6], [arrowX + 4, arrowY + 6]).fill();
  // "N" label
  doc.fontSize(9).fillColor("#1e293b").text("N", arrowX - 10, arrowY + arrowLen + 3, { width: 20, align: "center" });
  doc.restore();

  // Date (center-right)
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  doc.fontSize(7).fillColor("#94a3b8").text(dateStr, doc.page.width - 40 - 100, footerY + footerH - 10, { width: 100, align: "right" });
}

// ─── Legend Page ──────────────────────────────────────────────────────────────

function renderLegendPage(doc: PDFKit.PDFDocument, input: CanvasPdfInput): void {
  doc.addPage({ layout: "portrait", margin: 40 });
  const pageW = doc.page.width - 80;
  const left = 40;
  let y = 40;

  // Title
  doc.fontSize(14).fillColor("#1e293b").text("Legend & Symbol Key", left, y, { width: pageW, align: "center" });
  y += 28;

  doc.fontSize(9).fillColor("#64748b").text(input.name, left, y, { width: pageW, align: "center" });
  y += 24;

  // ── Symbol definitions ──
  const symbolH = 22;
  const iconW = 60;
  const labelX = left + iconW + 12;
  const col = "#374151";
  const symbols: { draw: (x: number, y: number) => void; label: string; desc: string }[] = [
    {
      label: "Wall",
      desc: "Structural wall with thickness",
      draw: (x, cy) => {
        const poly = wallPolygonFromLine(x + 4, cy, x + iconW - 4, cy, 6);
        if (poly.length >= 4) {
          doc.save();
          doc.moveTo(poly[0]!.x, poly[0]!.y);
          for (let i = 1; i < poly.length; i++) doc.lineTo(poly[i]!.x, poly[i]!.y);
          doc.closePath().fillColor("#d1d5db").strokeColor(col).lineWidth(0.5).fillAndStroke();
          doc.circle(x + 4, cy, 3).fillColor("#d1d5db").strokeColor(col).fillAndStroke();
          doc.circle(x + iconW - 4, cy, 3).fillColor("#d1d5db").strokeColor(col).fillAndStroke();
          doc.restore();
        }
      },
    },
    {
      label: "Door",
      desc: "Hinged door with swing arc",
      draw: (x, cy) => {
        const w = iconW - 8;
        const cx = x + iconW / 2;
        doc.save();
        doc.lineWidth(1).strokeColor(col);
        doc.moveTo(cx - w / 2, cy).lineTo(cx + w / 2, cy).stroke();
        doc.lineWidth(0.5).dash(3, { space: 2 });
        doc.path(`M ${cx + w / 2} ${cy} A ${w} ${w} 0 0 1 ${cx - w / 2} ${cy - w}`).stroke();
        doc.undash();
        doc.circle(cx - w / 2, cy, 1.5).fillColor(col).fill();
        doc.restore();
      },
    },
    {
      label: "Window",
      desc: "Window opening with glass lines",
      draw: (x, cy) => {
        const w = iconW - 8;
        const cx = x + iconW / 2;
        doc.save();
        doc.rect(cx - w / 2, cy - 3, w, 6).strokeColor(col).lineWidth(0.5).stroke();
        doc.lineWidth(0.5).strokeColor("#93c5fd");
        doc.moveTo(cx - w / 2, cy - 0.5).lineTo(cx + w / 2, cy - 0.5).stroke();
        doc.moveTo(cx - w / 2, cy + 0.5).lineTo(cx + w / 2, cy + 0.5).stroke();
        doc.restore();
      },
    },
    {
      label: "Stairs",
      desc: "Staircase with direction arrow",
      draw: (x, cy) => {
        const w = iconW - 8;
        const h = symbolH - 6;
        const sx = x + 4, sy = cy - h / 2;
        doc.save();
        doc.rect(sx, sy, w, h).strokeColor(col).lineWidth(0.5).stroke();
        const steps = 5;
        for (let i = 1; i < steps; i++) {
          doc.moveTo(sx, sy + (h / steps) * i).lineTo(sx + w, sy + (h / steps) * i).lineWidth(0.3).stroke();
        }
        doc.lineWidth(1).strokeColor(col);
        doc.moveTo(sx + w / 2, cy + h * 0.3).lineTo(sx + w / 2, cy - h * 0.3).stroke();
        doc.polygon([sx + w / 2, cy - h * 0.35], [sx + w / 2 - 3, cy - h * 0.15], [sx + w / 2 + 3, cy - h * 0.15]).fillColor(col).fill();
        doc.restore();
      },
    },
    {
      label: "Room",
      desc: "Named area with calculated square footage",
      draw: (x, cy) => {
        const w = iconW - 8;
        const h = symbolH - 6;
        doc.save();
        doc.rect(x + 4, cy - h / 2, w, h).fillColor("#e8e8ff").strokeColor("#6366f1").lineWidth(0.5).dash(4, { space: 2 }).fillAndStroke();
        doc.undash();
        doc.fontSize(6).fillColor("#333333").text("Room", x + 4, cy - 3, { width: w, align: "center" });
        doc.restore();
      },
    },
    {
      label: "Dimension",
      desc: "Measurement annotation",
      draw: (x, cy) => {
        const x1 = x + 4, x2 = x + iconW - 4;
        doc.save();
        doc.lineWidth(0.5).strokeColor("#6366f1").dash(3, { space: 2 });
        doc.moveTo(x1, cy).lineTo(x2, cy).stroke();
        doc.undash();
        doc.moveTo(x1, cy - 4).lineTo(x1, cy + 4).stroke();
        doc.moveTo(x2, cy - 4).lineTo(x2, cy + 4).stroke();
        doc.fontSize(6).fillColor("#6366f1").text("5.0 ft", x1, cy - 10, { width: x2 - x1, align: "center" });
        doc.restore();
      },
    },
  ];

  for (const sym of symbols) {
    const cy = y + symbolH / 2;
    sym.draw(left, cy);
    doc.fontSize(10).fillColor("#1e293b").text(sym.label, labelX, y + 2);
    doc.fontSize(8).fillColor("#64748b").text(sym.desc, labelX, y + 13);
    y += symbolH + 8;
  }

  // ── Project metadata ──
  y += 12;
  doc.moveTo(left, y).lineTo(left + pageW, y).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
  y += 12;
  doc.fontSize(11).fillColor("#1e293b").text("Project Details", left, y);
  y += 18;

  const meta: [string, string][] = [
    ["Name", input.name],
    ["Mode", input.canvasMode === "floorplan" ? "Floor Plan" : input.canvasMode],
  ];
  if (input.pixelsPerUnit && input.physicalUnit) {
    meta.push(["Unit", input.physicalUnit]);
    meta.push(["Scale", `${input.pixelsPerUnit.toFixed(1)} px/${input.physicalUnit}`]);
    const bounds = computeBounds(input.nodes);
    const physW = (bounds.maxX - bounds.minX - 40) / input.pixelsPerUnit;
    const physH = (bounds.maxY - bounds.minY - 40) / input.pixelsPerUnit;
    meta.push(["Drawing Size", `${physW.toFixed(1)} × ${physH.toFixed(1)} ${input.physicalUnit}`]);
  }

  // Count elements
  const counts = new Map<string, number>();
  for (const n of input.nodes) {
    const t = n.objectType;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const countParts: string[] = [];
  for (const [type, count] of counts) {
    if (["wall", "door", "window", "stairs", "room", "dimension"].includes(type)) {
      countParts.push(`${count} ${type}${count > 1 ? "s" : ""}`);
    }
  }
  if (countParts.length > 0) meta.push(["Elements", countParts.join(", ")]);

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  meta.push(["Generated", dateStr]);

  for (const [label, value] of meta) {
    doc.fontSize(8).fillColor("#64748b").text(label, left, y, { continued: true }).fillColor("#1e293b").text(`  ${value}`);
    y += 14;
  }
}
