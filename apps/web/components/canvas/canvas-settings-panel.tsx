"use client";

import type { UpdateCanvasSettingsInput } from "@lifekeeper/types";
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
}

export function CanvasSettingsPanel({
  settings, resolvedBgUrl, bgImageDims, bgUploading, bgUploadError,
  onSave, onClose, onRemoveBgImage, onUploadBgImage, onFitViewportToImage,
}: CanvasSettingsPanelProps): JSX.Element {
  const [local, setLocal] = useState<UpdateCanvasSettingsInput>({ ...settings });

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
      </div>
      <div className="idea-canvas__settings-footer">
        <button type="button" className="button button--ghost button--small" onClick={onClose}>Cancel</button>
        <button type="button" className="button button--primary button--small" onClick={() => onSave(local)}>Save</button>
      </div>
    </div>
  );
}
