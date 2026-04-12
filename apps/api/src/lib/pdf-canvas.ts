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

function drawNode(doc: PDFKit.PDFDocument, node: PdfNode, s: number, ox: number, oy: number, opts: CanvasPdfInput) {
  const tx = (v: number) => (v - ox) * s;
  const ty = (v: number) => (v - oy) * s;
  const ts = (v: number) => v * s;

  switch (node.objectType) {
    case "wall": {
      const sw = Math.max((node.strokeWidth ?? 6) * s, 1);
      doc.save();
      doc.lineWidth(sw).lineCap("round").strokeColor(parseColor(node.strokeColor, "#374151"));
      doc.moveTo(tx(node.x), ty(node.y)).lineTo(tx(node.x2), ty(node.y2)).stroke();
      doc.restore();
      if (opts.showDimensions && opts.pixelsPerUnit && opts.physicalUnit) {
        const dx = node.x2 - node.x, dy = node.y2 - node.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const mx = tx((node.x + node.x2) / 2);
        const my = ty((node.y + node.y2) / 2) - sw / 2 - 6;
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
      doc.save();
      doc.translate(tx(node.x), ty(node.y)).rotate(node.rotation ?? 0);
      doc.lineWidth(0.8).strokeColor(parseColor(node.strokeColor, "#374151"));
      doc.moveTo(-w / 2, 0).lineTo(w / 2, 0).stroke();
      doc.circle(-w / 2, 0, 1.5).fillColor(parseColor(node.strokeColor, "#374151")).fill();
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
      const stepCount = Math.max(3, Math.round(sh / 8));
      const stepH = sh / stepCount;
      doc.save();
      doc.rect(sx, sy, sw, sh).strokeColor(parseColor(node.strokeColor, "#374151")).lineWidth(0.5);
      if (node.fillColor) doc.fillColor(parseColor(node.fillColor, "#ffffff")).fillAndStroke();
      else doc.stroke();
      for (let i = 1; i < stepCount; i++) {
        doc.moveTo(sx, sy + stepH * i).lineTo(sx + sw, sy + stepH * i).lineWidth(0.3).stroke();
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
      const tickLen = 4;
      doc.save();
      doc.lineWidth(0.75).strokeColor("#6366f1").dash(3, { space: 2 });
      doc.moveTo(tx(ax), ty(ay)).lineTo(tx(bx), ty(by)).stroke();
      doc.undash();
      doc.moveTo(tx(ax + nx * tickLen), ty(ay + ny * tickLen)).lineTo(tx(ax - nx * tickLen), ty(ay - ny * tickLen)).stroke();
      doc.moveTo(tx(bx + nx * tickLen), ty(by + ny * tickLen)).lineTo(tx(bx - nx * tickLen), ty(by - ny * tickLen)).stroke();
      doc.restore();
      const label = opts.pixelsPerUnit && opts.physicalUnit
        ? fmtPhysical(len, opts.pixelsPerUnit, opts.physicalUnit)
        : `${Math.round(len)}px`;
      const mx = tx((ax + bx) / 2) + nx * 8;
      const my = ty((ay + by) / 2) + ny * 8;
      doc.fontSize(7).fillColor("#6366f1").text(label, mx - 25, my - 4, { width: 50, align: "center" });
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
    try {
      doc.image(bg.buffer, imgX, imgY, { width: imgW, height: imgH });
    } catch { /* skip invalid image */ }
    doc.opacity(1);
    doc.restore();
  }

  // Build node map for edges
  const nodeMap = new Map<string, PdfNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Draw edges first (behind nodes)
  for (const edge of edges) {
    drawEdge(doc, edge, nodeMap, scale, offsetX, offsetY);
  }

  // Draw nodes sorted by sortOrder
  const sorted = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const node of sorted) {
    drawNode(doc, node, scale, offsetX, offsetY, input);
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
