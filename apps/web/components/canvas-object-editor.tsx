"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasObject, CanvasObjectCategory } from "@lifekeeper/types";
import { canvasObjectCategoryValues } from "@lifekeeper/types";
import {
  confirmAttachmentUpload,
  createCanvasObject,
  getAttachmentDownloadUrl,
  requestAttachmentUpload,
  updateCanvasObject,
} from "../lib/api";
import { CANVAS_OBJECT_PRESETS } from "../lib/canvas-object-presets";

const CATEGORY_LABELS: Record<CanvasObjectCategory, string> = {
  vehicle: "Vehicles",
  furniture: "Furniture",
  cabinet: "Cabinets",
  appliance: "Appliances",
  structure: "Structures",
  tool: "Tools",
  person: "People",
  electronics: "Electronics",
  custom: "Custom",
};

/** Normalized polygon point (0–1 relative to image) */
interface PolyPoint {
  x: number;
  y: number;
}

/** Stored in CanvasObject.maskData as JSON */
type MaskData =
  | { type: "crop"; x: number; y: number; w: number; h: number }
  | { type: "polygon"; points: PolyPoint[] };

interface CanvasObjectEditorProps {
  householdId: string;
  object?: CanvasObject;
  initialCategory?: CanvasObjectCategory;
  onSave: (obj: CanvasObject) => void;
  onClose: () => void;
}

export default function CanvasObjectEditor({
  householdId,
  object,
  initialCategory = "custom",
  onSave,
  onClose,
}: CanvasObjectEditorProps) {
  const [name, setName] = useState(object?.name ?? "");
  const [category, setCategory] = useState<CanvasObjectCategory>(
    (object?.category as CanvasObjectCategory) ?? initialCategory
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New attachment ID after upload
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
  // Existing object's resolved image URL
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Mask editing
  const [maskMode, setMaskMode] = useState<"none" | "crop" | "polygon">("none");
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [polyPoints, setPolyPoints] = useState<PolyPoint[]>([]);
  const [draggingCrop, setDraggingCrop] = useState<string | null>(null); // "move"|"nw"|"ne"|"sw"|"se"
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; rect: typeof cropRect } | null>(null);

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const MASK_CANVAS_W = 360;
  const MASK_CANVAS_H = 240;

  // Temp object id used for creating & attaching upload
  const savedObjectRef = useRef<CanvasObject | null>(null);

  // Load existing image URL if editing
  useEffect(() => {
    if (object?.imageSource === "preset" && object.presetKey) {
      setPreviewUrl(object.presetKey);
    } else if (object?.imageSource === "uploaded" && object.attachmentId) {
      getAttachmentDownloadUrl(householdId, object.attachmentId)
        .then(({ url }) => {
          setPreviewUrl(url);
          setExistingImageUrl(url);
        })
        .catch(() => {});
    }
    if (object?.maskData) {
      try {
        const mask = JSON.parse(object.maskData) as MaskData;
        if (mask.type === "crop") {
          setCropRect(mask);
          setMaskMode("crop");
        } else if (mask.type === "polygon") {
          setPolyPoints(mask.points);
          setMaskMode("polygon");
        }
      } catch {
        // ignore bad JSON
      }
    }
  }, [householdId, object]);

  // Draw mask overlay on canvas whenever mode/crop/poly/previewUrl changes
  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MASK_CANVAS_W, MASK_CANVAS_H);

    if (maskMode === "crop") {
      const x = cropRect.x * MASK_CANVAS_W;
      const y = cropRect.y * MASK_CANVAS_H;
      const w = cropRect.w * MASK_CANVAS_W;
      const h = cropRect.h * MASK_CANVAS_H;
      // Dark overlay outside crop
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, MASK_CANVAS_W, MASK_CANVAS_H);
      ctx.clearRect(x, y, w, h);
      // Border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Corner handles
      const hs = 8;
      ctx.fillStyle = "#fff";
      for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as [number, number][]) {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
    } else if (maskMode === "polygon" && polyPoints.length > 0) {
      const pts = polyPoints.map((p) => ({ x: p.x * MASK_CANVAS_W, y: p.y * MASK_CANVAS_H }));
      // Darken outside polygon
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, MASK_CANVAS_W, MASK_CANVAS_H);
      if (polyPoints.length >= 3) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      // Draw polygon outline + points
      ctx.strokeStyle = "#4af";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      if (polyPoints.length >= 3) ctx.closePath();
      ctx.stroke();
      for (const pt of pts) {
        ctx.fillStyle = "#4af";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [maskMode, cropRect, polyPoints]);

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        // If we haven't created the canvas object record yet, create a stub now so we can attach to it
        let objId = savedObjectRef.current?.id ?? object?.id;
        if (!objId) {
          const stub = await createCanvasObject(householdId, {
            name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
            category,
            imageSource: "uploaded",
          });
          savedObjectRef.current = stub;
          objId = stub.id;
          if (!name.trim()) setName(stub.name);
        }

        const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
          entityType: "canvas_object",
          entityId: objId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}). Check that storage is running.`);
        await confirmAttachmentUpload(householdId, attachment.id);
        const { url } = await getAttachmentDownloadUrl(householdId, attachment.id);

        setPendingAttachmentId(attachment.id);
        setPreviewUrl(url);
        setExistingImageUrl(null);
        // Update the stub with the new attachmentId
        const updated = await updateCanvasObject(householdId, objId, {
          attachmentId: attachment.id,
          imageSource: "uploaded",
        });
        savedObjectRef.current = updated;
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [householdId, object, name, category]
  );

  // ─── Crop drag logic ───────────────────────────────────────────────────────

  const getCropHandle = useCallback(
    (mx: number, my: number): string | null => {
      const x = cropRect.x * MASK_CANVAS_W;
      const y = cropRect.y * MASK_CANVAS_H;
      const w = cropRect.w * MASK_CANVAS_W;
      const h = cropRect.h * MASK_CANVAS_H;
      const hs = 10;
      const corners: [string, number, number][] = [
        ["nw", x, y], ["ne", x + w, y], ["sw", x, y + h], ["se", x + w, y + h],
      ];
      for (const [handle, hx, hy] of corners) {
        if (Math.abs(mx - hx) < hs && Math.abs(my - hy) < hs) return handle;
      }
      if (mx > x && mx < x + w && my > y && my < y + h) return "move";
      return null;
    },
    [cropRect]
  );

  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (maskMode !== "crop") return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const handle = getCropHandle(mx, my);
      if (handle) {
        setDraggingCrop(handle);
        dragStartRef.current = { mouseX: mx, mouseY: my, rect: { ...cropRect } };
      }
    },
    [maskMode, cropRect, getCropHandle]
  );

  const handleCropMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (maskMode !== "crop" || !draggingCrop || !dragStartRef.current) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = (mx - dragStartRef.current.mouseX) / MASK_CANVAS_W;
      const dy = (my - dragStartRef.current.mouseY) / MASK_CANVAS_H;
      const r = dragStartRef.current.rect;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

      let newRect = { ...r };
      if (draggingCrop === "move") {
        newRect.x = clamp(r.x + dx, 0, 1 - r.w);
        newRect.y = clamp(r.y + dy, 0, 1 - r.h);
      } else {
        const MIN_SIZE = 0.05;
        if (draggingCrop === "nw") {
          const newX = clamp(r.x + dx, 0, r.x + r.w - MIN_SIZE);
          const newY = clamp(r.y + dy, 0, r.y + r.h - MIN_SIZE);
          newRect = { x: newX, y: newY, w: r.x + r.w - newX, h: r.y + r.h - newY };
        } else if (draggingCrop === "ne") {
          const newY = clamp(r.y + dy, 0, r.y + r.h - MIN_SIZE);
          newRect = { x: r.x, y: newY, w: clamp(r.w + dx, MIN_SIZE, 1 - r.x), h: r.y + r.h - newY };
        } else if (draggingCrop === "sw") {
          const newX = clamp(r.x + dx, 0, r.x + r.w - MIN_SIZE);
          newRect = { x: newX, y: r.y, w: r.x + r.w - newX, h: clamp(r.h + dy, MIN_SIZE, 1 - r.y) };
        } else if (draggingCrop === "se") {
          newRect = { x: r.x, y: r.y, w: clamp(r.w + dx, MIN_SIZE, 1 - r.x), h: clamp(r.h + dy, MIN_SIZE, 1 - r.y) };
        }
      }
      setCropRect(newRect);
    },
    [maskMode, draggingCrop]
  );

  const handleCropMouseUp = useCallback(() => {
    setDraggingCrop(null);
    dragStartRef.current = null;
  }, []);

  // ─── Polygon click ─────────────────────────────────────────────────────────

  const handlePolyClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (maskMode !== "polygon") return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / MASK_CANVAS_W;
      const y = (e.clientY - rect.top) / MASK_CANVAS_H;
      // If clicking near first point (and ≥3 points) — close the polygon (no-op needed, already closed in draw)
      if (polyPoints.length >= 3) {
        const firstPt = polyPoints[0]!;
        const dist = Math.hypot((x - firstPt.x) * MASK_CANVAS_W, (y - firstPt.y) * MASK_CANVAS_H);
        if (dist < 10) return; // close click ignored — polygon already auto-closes
      }
      setPolyPoints((prev) => [...prev, { x, y }]);
    },
    [maskMode, polyPoints]
  );

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!name.trim()) { setSaveError("Name is required."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const maskData: MaskData | null = maskMode === "crop"
        ? { type: "crop", ...cropRect }
        : maskMode === "polygon" && polyPoints.length >= 3
          ? { type: "polygon", points: polyPoints }
          : null;

      const existingId = savedObjectRef.current?.id ?? object?.id;
      let saved: CanvasObject;

      if (existingId) {
        saved = await updateCanvasObject(householdId, existingId, {
          name: name.trim(),
          category,
          maskData: maskData ? JSON.stringify(maskData) : null,
          ...(pendingAttachmentId ? { attachmentId: pendingAttachmentId, imageSource: "uploaded" } : {}),
        });
      } else {
        saved = await createCanvasObject(householdId, {
          name: name.trim(),
          category,
          imageSource: "uploaded",
          maskData: maskData ? JSON.stringify(maskData) : null,
        });
      }
      onSave(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [householdId, object, name, category, maskMode, cropRect, polyPoints, pendingAttachmentId, onSave]);

  const currentImageUrl = previewUrl ?? existingImageUrl;

  return (
    <div className="canvas-obj-editor__overlay" onClick={onClose}>
      <div className="canvas-obj-editor" onClick={(e) => e.stopPropagation()}>
        <div className="canvas-obj-editor__header">
          <span>{object ? "Edit Object" : "New Object"}</span>
          <button type="button" className="canvas-obj-editor__close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="canvas-obj-editor__body">
          {/* Name field */}
          <label className="canvas-obj-editor__field">
            <span>Name</span>
            <input
              type="text"
              className="canvas-obj-editor__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Red Sedan"
            />
          </label>

          {/* Category */}
          <label className="canvas-obj-editor__field">
            <span>Category</span>
            <select
              className="canvas-obj-editor__select"
              value={category}
              onChange={(e) => setCategory(e.target.value as CanvasObjectCategory)}
            >
              {canvasObjectCategoryValues.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </label>

          {/* Image upload */}
          <div className="canvas-obj-editor__field">
            <span>Image</span>
            <div className="canvas-obj-editor__upload-row">
              <label className={`canvas-obj-editor__upload-btn${uploading ? " canvas-obj-editor__upload-btn--loading" : ""}`}>
                {uploading ? "Uploading…" : currentImageUrl ? "Replace Image" : "Upload Image"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await handleFileUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {uploadError && <span className="canvas-obj-editor__error">{uploadError}</span>}
            </div>
          </div>

          {/* Image preview + mask editor */}
          {currentImageUrl && (
            <div className="canvas-obj-editor__mask-section">
              <div className="canvas-obj-editor__mask-toolbar">
                <button
                  type="button"
                  className={`canvas-obj-editor__mask-btn${maskMode === "none" ? " canvas-obj-editor__mask-btn--active" : ""}`}
                  onClick={() => setMaskMode("none")}
                >No Mask</button>
                <button
                  type="button"
                  className={`canvas-obj-editor__mask-btn${maskMode === "crop" ? " canvas-obj-editor__mask-btn--active" : ""}`}
                  onClick={() => setMaskMode("crop")}
                >✂️ Crop</button>
                <button
                  type="button"
                  className={`canvas-obj-editor__mask-btn${maskMode === "polygon" ? " canvas-obj-editor__mask-btn--active" : ""}`}
                  onClick={() => { setMaskMode("polygon"); setPolyPoints([]); }}
                >⬡ Lasso</button>
                {maskMode === "polygon" && polyPoints.length > 0 && (
                  <button
                    type="button"
                    className="canvas-obj-editor__mask-btn"
                    onClick={() => setPolyPoints([])}
                  >Clear</button>
                )}
              </div>
              <div className="canvas-obj-editor__mask-canvas-wrap">
                {/* Base image */}
                <img
                  ref={imgRef}
                  src={currentImageUrl}
                  alt="Object preview"
                  className="canvas-obj-editor__mask-img"
                  style={{ width: MASK_CANVAS_W, height: MASK_CANVAS_H, objectFit: "contain" }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                  }}
                />
                {/* Overlay canvas for mask editing */}
                {maskMode !== "none" && (
                  <canvas
                    ref={maskCanvasRef}
                    width={MASK_CANVAS_W}
                    height={MASK_CANVAS_H}
                    className="canvas-obj-editor__mask-canvas"
                    onMouseDown={maskMode === "crop" ? handleCropMouseDown : undefined}
                    onMouseMove={maskMode === "crop" ? handleCropMouseMove : undefined}
                    onMouseUp={maskMode === "crop" ? handleCropMouseUp : undefined}
                    onMouseLeave={maskMode === "crop" ? handleCropMouseUp : undefined}
                    onClick={maskMode === "polygon" ? handlePolyClick : undefined}
                    style={{ cursor: maskMode === "polygon" ? "crosshair" : "default" }}
                  />
                )}
              </div>
              {maskMode === "polygon" && (
                <p className="canvas-obj-editor__mask-hint">
                  Click to add polygon points. Need at least 3 points.
                  {polyPoints.length < 3 ? ` (${polyPoints.length}/3)` : " ✓"}
                </p>
              )}
            </div>
          )}

          {saveError && <p className="canvas-obj-editor__save-error">{saveError}</p>}
        </div>

        <div className="canvas-obj-editor__footer">
          <button type="button" className="canvas-obj-editor__cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="canvas-obj-editor__save-btn"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? "Saving…" : "Save Object"}
          </button>
        </div>
      </div>
    </div>
  );
}
