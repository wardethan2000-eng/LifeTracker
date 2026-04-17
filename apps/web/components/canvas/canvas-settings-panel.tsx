"use client";

import type { UpdateCanvasSettingsInput } from "@aegis/types";
import type { JSX } from "react";
import { useEffect, useState } from "react";

const PHYSICAL_UNITS = ["ft", "m", "in", "cm"] as const;

export interface CanvasSettingsPanelProps {
  settings: UpdateCanvasSettingsInput;
  resolvedBgUrl: string | null;
  bgImageDims: { w: number; h: number } | null;
  bgUploading: boolean;
  bgUploadError: string | null;
  onSave: (patch: UpdateCanvasSettingsInput) => void;
  onClose: () => void;
  onRemoveBgImage: () => void;
  onUploadBgImage: (file: File) => void;
  onFitViewportToImage: (w: number, h: number) => void;
  onStartCrop?: () => void;
  onAddReferenceImage?: () => void;
  embedded?: boolean;
}

export function CanvasSettingsPanel({
  settings, resolvedBgUrl, bgImageDims, bgUploading, bgUploadError,
  onSave, onClose, onRemoveBgImage, onUploadBgImage, onFitViewportToImage,
  onStartCrop, onAddReferenceImage,
  embedded = false,
}: CanvasSettingsPanelProps): JSX.Element {
  const [local, setLocal] = useState<UpdateCanvasSettingsInput>({ ...settings });
  const hasCrop = local.backgroundImageCropX != null && local.backgroundImageCropY != null
    && local.backgroundImageCropW != null && local.backgroundImageCropH != null;

  useEffect(() => {
    setLocal({ ...settings });
  }, [settings]);

  return (
    <div className={`idea-canvas__settings-panel${embedded ? " idea-canvas__settings-panel--embedded" : ""}`}>
      <div className="idea-canvas__settings-header">
        <h3>Canvas Settings</h3>
        {!embedded ? (
          <button type="button" className="button button--ghost button--small" onClick={onClose}>✕</button>
        ) : null}
      </div>
      <div className="idea-canvas__settings-body">
        <section className="idea-canvas__settings-section">
          <div className="idea-canvas__settings-section-header">
            <h4>Scale & grid</h4>
            <p>These settings control snapping and real-world measurements.</p>
          </div>
          <div className="idea-canvas__settings-row">
            <label>Measurement unit</label>
            <select value={local.physicalUnit ?? ""}
              onChange={(e) => setLocal((p) => ({ ...p, physicalUnit: (e.target.value || null) as UpdateCanvasSettingsInput["physicalUnit"] }))}>
              <option value="">None</option>
              {PHYSICAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="idea-canvas__settings-row">
            <label>Grid size</label>
            <input type="number" min={8} max={200} step={4}
              value={local.gridSize ?? 24}
              onChange={(e) => setLocal((p) => ({ ...p, gridSize: parseInt(e.target.value) || 24 }))} />
          </div>
          <div className="idea-canvas__settings-row">
            <label>Snap to grid</label>
            <input type="checkbox" checked={!!local.snapToGrid}
              onChange={(e) => setLocal((p) => ({ ...p, snapToGrid: e.target.checked }))} />
          </div>
          <div className="idea-canvas__settings-row">
            <label>Show dimensions</label>
            <input type="checkbox" checked={!!local.showDimensions}
              onChange={(e) => setLocal((p) => ({ ...p, showDimensions: e.target.checked }))} />
          </div>
          <div className="idea-canvas__settings-row idea-canvas__settings-row--info">
            <span>
              {local.physicalUnit
                ? `Current scale: 1 grid square = 1 ${local.physicalUnit}`
                : "Choose a unit or calibrate from an image before drafting floor plans."}
            </span>
          </div>
        </section>

        <section className="idea-canvas__settings-section">
          <div className="idea-canvas__settings-section-header">
            <h4>Canvas size</h4>
            <p>Optional physical bounds for the workspace.</p>
          </div>
          {local.physicalUnit ? (
            <>
              <div className="idea-canvas__settings-row">
                <label>Width</label>
                <input type="number" min={0} step={0.1}
                  value={local.physicalWidth ?? ""}
                  onChange={(e) => setLocal((p) => ({ ...p, physicalWidth: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder={`e.g. 20 ${local.physicalUnit}`} />
              </div>
              <div className="idea-canvas__settings-row">
                <label>Height</label>
                <input type="number" min={0} step={0.1}
                  value={local.physicalHeight ?? ""}
                  onChange={(e) => setLocal((p) => ({ ...p, physicalHeight: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder={`e.g. 15 ${local.physicalUnit}`} />
              </div>
            </>
          ) : (
            <div className="idea-canvas__settings-row idea-canvas__settings-row--info">
              <span>Set a measurement unit first if you want the canvas bounds to represent real-world size.</span>
            </div>
          )}
        </section>

        <section className="idea-canvas__settings-section">
          <div className="idea-canvas__settings-section-header">
            <h4>Reference image</h4>
            <p>Upload, crop, and align a floor plan image for tracing.</p>
          </div>
          <div className="idea-canvas__settings-row idea-canvas__settings-row--full">
            <label>Background image</label>
            <div className="idea-canvas__bg-image-controls">
              {resolvedBgUrl ? (
                <>
                  <span className="idea-canvas__bg-image-name">
                    {bgImageDims ? `${bgImageDims.w} × ${bgImageDims.h} px` : "Uploaded"}
                  </span>
                  <button type="button" className="button button--ghost button--small"
                    onClick={() => onRemoveBgImage()}>Remove</button>
                  <button type="button" className="button button--ghost button--small"
                    onClick={() => { if (bgImageDims) onFitViewportToImage(bgImageDims.w, bgImageDims.h); }}>Fit view</button>
                  {onStartCrop ? (
                    <button type="button" className="button button--ghost button--small"
                      onClick={() => { onStartCrop(); onClose(); }}>Crop</button>
                  ) : null}
                  {hasCrop ? (
                    <button type="button" className="button button--ghost button--small"
                      onClick={() => setLocal((p) => ({
                        ...p,
                        backgroundImageCropX: null,
                        backgroundImageCropY: null,
                        backgroundImageCropW: null,
                        backgroundImageCropH: null,
                      }))}>Clear crop</button>
                  ) : null}
                </>
              ) : (
                <>
                  <label className={`button button--ghost button--small idea-canvas__upload-btn${bgUploading ? " idea-canvas__upload-btn--loading" : ""}`}>
                    {bgUploading ? "Uploading…" : "Upload image"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      disabled={bgUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadBgImage(f);
                        e.target.value = "";
                      }} />
                  </label>
                  <span className="idea-canvas__bg-image-hint">PNG, JPG, WebP up to 50 MB</span>
                  {bgUploadError ? (
                    <span className="idea-canvas__upload-error" title={bgUploadError}>⚠️ {bgUploadError}</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {resolvedBgUrl ? (
            <>
              <div className="idea-canvas__settings-row">
                <label>Image opacity</label>
                <input type="range" min={0} max={1} step={0.05}
                  value={local.backgroundImageOpacity ?? 0.5}
                  onChange={(e) => setLocal((p) => ({ ...p, backgroundImageOpacity: parseFloat(e.target.value) }))} />
                <span className="idea-canvas__settings-value">{Math.round((local.backgroundImageOpacity ?? 0.5) * 100)}%</span>
              </div>
              <div className="idea-canvas__settings-row">
                <label>Image scale</label>
                <input type="range" min={0.01} max={50} step={0.05}
                  value={local.backgroundImageScale ?? 1}
                  onChange={(e) => setLocal((p) => ({ ...p, backgroundImageScale: parseFloat(e.target.value) }))} />
                <span className="idea-canvas__settings-value">{Math.round((local.backgroundImageScale ?? 1) * 100)}%</span>
              </div>
              <div className="idea-canvas__settings-row">
                <label>Lock image</label>
                <input type="checkbox" checked={!!local.backgroundImageLocked}
                  onChange={(e) => setLocal((p) => ({ ...p, backgroundImageLocked: e.target.checked }))} />
              </div>
              <div className="idea-canvas__settings-row">
                <label>Reset image</label>
                <button type="button" className="button button--ghost button--small"
                  onClick={() => setLocal((p) => ({ ...p, backgroundImageX: 0, backgroundImageY: 0, backgroundImageScale: 1 }))}>
                  Reset position
                </button>
              </div>
            </>
          ) : null}
          {onAddReferenceImage ? (
            <div className="idea-canvas__settings-row idea-canvas__settings-row--full">
              <label>Reference images</label>
              <button type="button" className="button button--ghost button--small"
                onClick={() => { onAddReferenceImage(); onClose(); }}>
                + Add reference image
              </button>
              <span className="idea-canvas__bg-image-hint">
                Added as image nodes on a locked &ldquo;Reference&rdquo; layer
              </span>
            </div>
          ) : null}
        </section>
      </div>
      <div className="idea-canvas__settings-footer">
        {!embedded ? (
          <button type="button" className="button button--ghost button--small" onClick={onClose}>Cancel</button>
        ) : null}
        <button type="button" className="button button--primary button--small" onClick={() => onSave(local)}>
          {embedded ? "Apply settings" : "Save"}
        </button>
      </div>
    </div>
  );
}
