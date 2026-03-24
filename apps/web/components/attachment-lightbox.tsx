"use client";

import { useState, useEffect, useCallback } from "react";

type LightboxImage = { id: string; url: string; caption?: string | null; filename: string };

type AttachmentLightboxProps = {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
  onCaptionUpdate?: (id: string, caption: string) => void;
};

export function AttachmentLightbox({ images, initialIndex, onClose, onCaptionUpdate }: AttachmentLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [captionOverrides, setCaptionOverrides] = useState<Map<string, string>>(new Map());
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");

  const current = images[index];
  const hasMultiple = images.length > 1;
  const currentCaption = captionOverrides.has(current?.id)
    ? captionOverrides.get(current.id)
    : current?.caption;

  // Reset editor when navigating
  useEffect(() => {
    setIsEditingCaption(false);
    setCaptionDraft("");
  }, [index]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditingCaption) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev, isEditingCaption]);

  const handleCaptionSave = useCallback(() => {
    if (!current) return;
    const trimmed = captionDraft.trim();
    setCaptionOverrides((prev) => new Map(prev).set(current.id, trimmed));
    onCaptionUpdate?.(current.id, trimmed);
    setIsEditingCaption(false);
  }, [current, captionDraft, onCaptionUpdate]);

  const startEditCaption = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!current) return;
    setCaptionDraft(captionOverrides.has(current.id) ? (captionOverrides.get(current.id) ?? "") : (current.caption ?? ""));
    setIsEditingCaption(true);
  }, [current, captionOverrides]);

  if (!current) return null;

  return (
    <div className="attachment-lightbox" onClick={onClose}>
      {hasMultiple && (
        <div className="attachment-lightbox__counter">
          {index + 1} / {images.length}
        </div>
      )}

      <button type="button" className="attachment-lightbox__close" onClick={onClose}>×</button>

      {hasMultiple && (
        <button
          type="button"
          className="attachment-lightbox__nav attachment-lightbox__nav--prev"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="attachment-lightbox__image"
        src={current.url}
        alt={currentCaption ?? current.filename}
        onClick={(e) => e.stopPropagation()}
      />

      {hasMultiple && (
        <button
          type="button"
          className="attachment-lightbox__nav attachment-lightbox__nav--next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          ›
        </button>
      )}

      {onCaptionUpdate ? (
        <div
          className="attachment-lightbox__caption attachment-lightbox__caption--editable"
          onClick={(e) => e.stopPropagation()}
        >
          {isEditingCaption ? (
            <div className="attachment-lightbox__caption-edit-row">
              <input
                className="attachment-lightbox__caption-input"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCaptionSave();
                  if (e.key === "Escape") setIsEditingCaption(false);
                }}
                placeholder="Add a caption…"
                maxLength={1000}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button type="button" className="attachment-lightbox__caption-save" onClick={handleCaptionSave}>Save</button>
              <button type="button" className="attachment-lightbox__caption-cancel" onClick={() => setIsEditingCaption(false)}>✕</button>
            </div>
          ) : (
            <button type="button" className="attachment-lightbox__caption-text" onClick={startEditCaption}>
              {currentCaption
                ? <>{currentCaption} <span className="attachment-lightbox__caption-edit-hint">✎</span></>
                : <span className="attachment-lightbox__caption-placeholder">Add a caption… ✎</span>
              }
            </button>
          )}
        </div>
      ) : (
        (currentCaption ?? current.filename) ? (
          <div className="attachment-lightbox__caption">
            {currentCaption ?? current.filename}
          </div>
        ) : null
      )}
    </div>
  );
}
