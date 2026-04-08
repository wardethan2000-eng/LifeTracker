"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvasObject, CanvasObjectCategory } from "@aegis/types";
import { canvasObjectCategoryValues } from "@aegis/types";
import {
  fetchCanvasObjects,
  getAttachmentDownloadUrl,
  deleteCanvasObject,
} from "../lib/api";
import {
  CANVAS_OBJECT_PRESETS,
  CANVAS_OBJECT_PRESETS_BY_CATEGORY,
  type CanvasObjectPreset,
} from "../lib/canvas-object-presets";
import CanvasObjectEditor from "./canvas-object-editor";

/** What the picker returns when the user picks an item to place on the canvas */
export type CanvasObjectPlacement =
  | { source: "preset"; preset: CanvasObjectPreset }
  | { source: "library"; object: CanvasObject; resolvedUrl: string };

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

interface CanvasObjectPickerProps {
  householdId: string;
  onPlace: (placement: CanvasObjectPlacement) => void;
  onClose: () => void;
}

export default function CanvasObjectPicker({
  householdId,
  onPlace,
  onClose,
}: CanvasObjectPickerProps) {
  const [activeCategory, setActiveCategory] = useState<CanvasObjectCategory>("vehicle");
  const [libraryObjects, setLibraryObjects] = useState<CanvasObject[]>([]);
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingObject, setEditingObject] = useState<CanvasObject | undefined>(undefined);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const objects = await fetchCanvasObjects(householdId);
      setLibraryObjects(objects);
      // Resolve download URLs for uploaded objects
      const entries = await Promise.allSettled(
        objects
          .filter((o) => o.imageSource === "uploaded" && o.attachmentId)
          .map(async (o) => {
            const { url } = await getAttachmentDownloadUrl(householdId, o.attachmentId!);
            return [o.id, url] as [string, string];
          })
      );
      const urlMap = new Map<string, string>();
      for (const result of entries) {
        if (result.status === "fulfilled") {
          urlMap.set(result.value[0], result.value[1]);
        }
      }
      setResolvedUrls(urlMap);
    } catch {
      // Non-fatal — library simply shows empty
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handlePlacePreset = useCallback(
    (preset: CanvasObjectPreset) => {
      onPlace({ source: "preset", preset });
    },
    [onPlace]
  );

  const handlePlaceLibraryObject = useCallback(
    async (obj: CanvasObject) => {
      if (obj.imageSource === "preset" && obj.presetKey) {
        const preset = CANVAS_OBJECT_PRESETS.find((p) => p.key === obj.presetKey);
        if (preset) {
          onPlace({ source: "preset", preset });
          return;
        }
      }
      const resolvedUrl = resolvedUrls.get(obj.id) ?? "";
      onPlace({ source: "library", object: obj, resolvedUrl });
    },
    [resolvedUrls, onPlace]
  );

  const handleDeleteObject = useCallback(
    async (objectId: string) => {
      if (!confirm("Remove this object from your library?")) return;
      try {
        await deleteCanvasObject(householdId, objectId);
        setLibraryObjects((prev) => prev.filter((o) => o.id !== objectId));
      } catch {
        // best-effort
      }
    },
    [householdId]
  );

  const handleEditorSave = useCallback(
    (obj: CanvasObject) => {
      setLibraryObjects((prev) => {
        const idx = prev.findIndex((o) => o.id === obj.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = obj;
          return next;
        }
        return [...prev, obj];
      });
      setEditorOpen(false);
      setEditingObject(undefined);
      // Re-load to refresh resolved URLs
      void loadLibrary();
    },
    [loadLibrary]
  );

  const presetsForCategory = CANVAS_OBJECT_PRESETS_BY_CATEGORY[activeCategory];
  const libraryForCategory = libraryObjects.filter((o) => o.category === activeCategory);

  return (
    <>
      <div className="canvas-obj-picker__backdrop" onClick={onClose} />
      <div className="canvas-obj-picker">
        <div className="canvas-obj-picker__header">
          <div>
            <span className="canvas-obj-picker__title">Object Library</span>
            <span className="canvas-obj-picker__subtitle">Choose an object, then click the canvas to place it</span>
          </div>
          <button
            type="button"
            className="canvas-obj-picker__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Category tabs */}
        <div className="canvas-obj-picker__tabs">
          {canvasObjectCategoryValues.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`canvas-obj-picker__tab${activeCategory === cat ? " canvas-obj-picker__tab--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="canvas-obj-picker__body">
          {/* User library section */}
          {(libraryForCategory.length > 0 || loading) && (
            <section className="canvas-obj-picker__section">
              <div className="canvas-obj-picker__section-header">
                <span>My Objects</span>
                <button
                  type="button"
                  className="canvas-obj-picker__add-btn"
                  onClick={() => { setEditingObject(undefined); setEditorOpen(true); }}
                >
                  + New Object
                </button>
              </div>
              {loading ? (
                <p className="canvas-obj-picker__loading">Loading…</p>
              ) : (
                <div className="canvas-obj-picker__grid">
                  {libraryForCategory.map((obj) => {
                    const imgSrc = obj.imageSource === "preset" && obj.presetKey
                      ? obj.presetKey
                      : resolvedUrls.get(obj.id);
                    return (
                      <div key={obj.id} className="canvas-obj-picker__item">
                        <button
                          type="button"
                          className="canvas-obj-picker__item-thumb"
                          onClick={() => handlePlaceLibraryObject(obj)}
                          title={`Place "${obj.name}"`}
                        >
                          {imgSrc ? (
                            <img src={imgSrc} alt={obj.name} />
                          ) : (
                            <span className="canvas-obj-picker__item-placeholder">?</span>
                          )}
                          <span className="canvas-obj-picker__place-label">Place</span>
                        </button>
                        <div className="canvas-obj-picker__item-label">{obj.name}</div>
                        <div className="canvas-obj-picker__item-actions">
                          <button
                            type="button"
                            className="canvas-obj-picker__item-edit"
                            title="Edit"
                            onClick={() => { setEditingObject(obj); setEditorOpen(true); }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="canvas-obj-picker__item-delete"
                            title="Delete"
                            onClick={() => handleDeleteObject(obj.id)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Preset section (always visible for category) */}
          {presetsForCategory.length > 0 && (
            <section className="canvas-obj-picker__section">
              <div className="canvas-obj-picker__section-header">
                <span>Presets</span>
                {libraryForCategory.length === 0 && !loading && (
                  <button
                    type="button"
                    className="canvas-obj-picker__add-btn"
                    onClick={() => { setEditingObject(undefined); setEditorOpen(true); }}
                  >
                    + New Object
                  </button>
                )}
              </div>
              <div className="canvas-obj-picker__grid">
                {presetsForCategory.map((preset) => (
                  <div key={preset.key} className="canvas-obj-picker__item">
                    <button
                      type="button"
                      className="canvas-obj-picker__item-thumb"
                      onClick={() => handlePlacePreset(preset)}
                      title={`Place "${preset.label}"`}
                    >
                      <img src={preset.svgPath} alt={preset.label} />
                      <span className="canvas-obj-picker__place-label">Place</span>
                    </button>
                    <div className="canvas-obj-picker__item-label">{preset.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {presetsForCategory.length === 0 && libraryForCategory.length === 0 && !loading && (
            <div className="canvas-obj-picker__empty">
              <p>No objects yet in this category.</p>
              <button
                type="button"
                className="canvas-obj-picker__add-btn canvas-obj-picker__add-btn--lg"
                onClick={() => { setEditingObject(undefined); setEditorOpen(true); }}
              >
                + New Object
              </button>
            </div>
          )}
        </div>
      </div>

      {editorOpen && (
        <CanvasObjectEditor
          householdId={householdId}
          initialCategory={activeCategory}
          object={editingObject}
          onSave={handleEditorSave}
          onClose={() => { setEditorOpen(false); setEditingObject(undefined); }}
        />
      )}
    </>
  );
}
