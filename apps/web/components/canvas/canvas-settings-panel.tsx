"use client";

import type { UpdateCanvasSettingsInput } from "@aegis/types";
import type { JSX } from "react";
import { useState } from "react";

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
}

export function CanvasSettingsPanel({
  settings, resolvedBgUrl, bgImageDims, bgUploading, bgUploadError,
  onSave, onClose, onRemoveBgImage, onUploadBgImage, onFitViewportToImage,
  onStartCrop, onAddReferenceImage,
}: CanvasSettingsPanelProps): JSX.Element {
  const [local, setLocal] = useState<UpdateCanvasSettingsInput>({ ...settings });
  const hasCrop = local.backgroundImageCropX != null && local.backgroundImageCropY != null
    && local.backgroundImageCropW != null && local.backgroundImageCropH != null;

  return (
    <div className="idea-canvas__settings-panel">
      <div className="idea-canvas__settings-header">
        <h3>Canvas Settings</h3>
        <button type="button" className="button button--ghost button--small" onClick={onClose}>✕</button>
      </div>
      <div className="idea-canvas__settings-body">
        <div className="idea-canvas__settings-row">
          <label>Physical Width</label>
          <input type="number" min={0} step={0.1}
            value={local.physicalWidth ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, physicalWidth: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder="e.g. 20" />
        </div>
        <div className="idea-canvas__settings-row">
          <label>Physical Height</label>
          <input type="number" min={0} step={0.1}
            value={local.physicalHeight ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, physicalHeight: e.target.value ? parseFloat(e.target.value) : null }))}
            placeholder="e.g. 15" />
        </div>
        <div className="idea-canvas__settings-row">
          <label>Unit</label>
          <select value={local.physicalUnit ?? ""}
            onChange={(e) => setLocal((p) => ({ ...p, physicalUnit: (e.target.value || null) as UpdateCanvasSettingsInput["physicalUnit"] }))}>
            <option value="">None</option>
            {PHYSICAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="idea-canvas__settings-row">
          <label>Snap to Grid</label>
          <input type="checkbox" checked={!!local.snapToGrid}
            onChange={(e) => setLocal((p) => ({ ...p, snapToGrid: e.target.checked }))} />
        </div>
        <div className="idea-canvas__settings-row">
          <label>Grid Size (px)</label>
          <input type="number" min={8} max={200} step={4}
            value={local.gridSize ?? 24}
            onChange={(e) => setLocal((p) => ({ ...p, gridSize: parseInt(e.target.value) || 24 }))} />
        </div>
        {local.physicalUnit ? (
          <>
            <div className="idea-canvas__settings-row">
              <label>Show Dimensions</label>
              <input type="checkbox" checked={!!local.showDimensions}
                onChange={(e) => setLocal((p) => ({ ...p, showDimensions: e.target.checked }))} />
            </div>
            <div className="idea-canvas__settings-row idea-canvas__settings-row--info">
              <span>Scale: 1 grid square = 1 {local.physicalUnit}</span>
            </div>
          </>
        ) : null}
        <div className="idea-canvas__settings-row idea-canvas__settings-row--full">
          <label>Background Image</label>
          <div className="idea-canvas__bg-image-controls">
            {resolvedBgUrl ? (
              <>
                <span className="idea-canvas__bg-image-name">
                  {bgImageDims ? `${bgImageDims.w} × ${bgImageDims.h} px` : "Uploaded"}
                </span>
                <button type="button" className="button button--ghost button--small"
                  onClick={() => onRemoveBgImage()}>Remove</button>
                <button type="button" className="button button--ghost button--small"
                  onClick={() => { if (bgImageDims) onFitViewportToImage(bgImageDims.w, bgImageDims.h); }}>Fit View</button>
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
                    }))}>Clear Crop</button>
                ) : null}
              </>
            ) : (
              <>
                <label className={`button button--ghost button--small idea-canvas__upload-btn${bgUploading ? " idea-canvas__upload-btn--loading" : ""}`}>
                  {bgUploading ? "Uploading…" : "Upload Image"}
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
          <div className="idea-canvas__settings-row">
            <label>Image Opacity</label>
            <input type="range" min={0} max={1} step={0.05}
              value={local.backgroundImageOpacity ?? 0.5}
              onChange={(e) => setLocal((p) => ({ ...p, backgroundImageOpacity: parseFloat(e.target.value) }))} />
            <span className="idea-canvas__settings-value">{Math.round((local.backgroundImageOpacity ?? 0.5) * 100)}%</span>
          </div>
        ) : null}
        {resolvedBgUrl ? (
          <div className="idea-canvas__settings-row">
            <label>Image Scale</label>
            <input type="range" min={0.01} max={50} step={0.05}
              value={local.backgroundImageScale ?? 1}
              onChange={(e) => setLocal((p) => ({ ...p, backgroundImageScale: parseFloat(e.target.value) }))} />
            <span className="idea-canvas__settings-value">{Math.round((local.backgroundImageScale ?? 1) * 100)}%</span>
          </div>
        ) : null}
        {resolvedBgUrl ? (
          <>
            <div className="idea-canvas__settings-row">
              <label>Lock Background</label>
              <input type="checkbox" checked={!!local.backgroundImageLocked}
                onChange={(e) => setLocal((p) => ({ ...p, backgroundImageLocked: e.target.checked }))} />
            </div>
            <div className="idea-canvas__settings-row">
              <button type="button" className="button button--ghost button--small"
                onClick={() => setLocal((p) => ({ ...p, backgroundImageX: 0, backgroundImageY: 0, backgroundImageScale: 1 }))}>
                Reset Position
              </button>
            </div>
          </>
        ) : null}
        {onAddReferenceImage ? (
          <div className="idea-canvas__settings-row idea-canvas__settings-row--full">
            <label>Reference Images</label>
            <button type="button" className="button button--ghost button--small"
              onClick={() => { onAddReferenceImage(); onClose(); }}>
              + Add Reference Image
            </button>
            <span className="idea-canvas__bg-image-hint">
              Added as image nodes on a locked &ldquo;Reference&rdquo; layer
            </span>
          </div>
        ) : null}
      </div>
      <div className="idea-canvas__settings-footer">
        <button type="button" className="button button--ghost button--small" onClick={onClose}>Cancel</button>
        <button type="button" className="button button--primary button--small" onClick={() => onSave(local)}>Save</button>
      </div>
    </div>
  );
}
