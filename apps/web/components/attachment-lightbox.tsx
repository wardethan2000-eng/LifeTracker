"use client";

import { useState, useEffect, useCallback } from "react";

type AttachmentLightboxProps = {
  images: Array<{ id: string; url: string; caption?: string | null; filename: string }>;
  initialIndex: number;
  onClose: () => void;
};

export function AttachmentLightbox({ images, initialIndex, onClose }: AttachmentLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  const current = images[index];
  const hasMultiple = images.length > 1;

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
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  if (!current) return null;

  return (
    <div className="attachment-lightbox" onClick={onClose}>
      {hasMultiple && (
        <div className="attachment-lightbox__counter">
          {index + 1} / {images.length}
        </div>
      )}

      <button className="attachment-lightbox__close" onClick={onClose}>×</button>

      {hasMultiple && (
        <button
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
        alt={current.caption ?? current.filename}
        onClick={(e) => e.stopPropagation()}
      />

      {hasMultiple && (
        <button
          className="attachment-lightbox__nav attachment-lightbox__nav--next"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          ›
        </button>
      )}

      {(current.caption ?? current.filename) && (
        <div className="attachment-lightbox__caption">
          {current.caption ?? current.filename}
        </div>
      )}
    </div>
  );
}
