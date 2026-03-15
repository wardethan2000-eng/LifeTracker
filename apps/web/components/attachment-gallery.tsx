"use client";

import { useState, useCallback, useRef } from "react";
import type { Attachment } from "@lifekeeper/types";
import { getAttachmentDownloadUrl, deleteAttachment } from "../lib/api";
import { AttachmentLightbox } from "./attachment-lightbox";

type AttachmentGalleryProps = {
  householdId: string;
  attachments: Attachment[];
  onDelete?: (attachmentId: string) => void;
  compact?: boolean;
  readonly?: boolean;
};

type CachedUrl = { url: string; expiresAt: number };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function AttachmentGallery({
  householdId,
  attachments,
  onDelete,
  compact = false,
  readonly = false,
}: AttachmentGalleryProps) {
  const [urlCache, setUrlCache] = useState<Map<string, CachedUrl>>(new Map());
  const [lightbox, setLightbox] = useState<{ index: number; images: Array<{ id: string; url: string; caption?: string | null; filename: string }> } | null>(null);
  const pendingFetches = useRef<Set<string>>(new Set());

  const getUrl = useCallback(async (attachment: Attachment): Promise<string> => {
    const cached = urlCache.get(attachment.id);
    if (cached && Date.now() < cached.expiresAt) return cached.url;

    if (pendingFetches.current.has(attachment.id)) return cached?.url ?? "";

    pendingFetches.current.add(attachment.id);
    try {
      const { url } = await getAttachmentDownloadUrl(householdId, attachment.id);
      const entry: CachedUrl = { url, expiresAt: Date.now() + 55 * 60 * 1000 };
      setUrlCache((prev) => {
        const next = new Map(prev);
        next.set(attachment.id, entry);
        return next;
      });
      return url;
    } finally {
      pendingFetches.current.delete(attachment.id);
    }
  }, [householdId, urlCache]);

  const handleImageClick = useCallback(async (clickedIndex: number) => {
    const imageAttachments = attachments.filter((a) => IMAGE_TYPES.has(a.mimeType));
    const urls = await Promise.all(
      imageAttachments.map(async (a) => ({
        id: a.id,
        url: await getUrl(a),
        caption: a.caption,
        filename: a.originalFilename,
      }))
    );
    // Find the index within image-only attachments
    const imageIdx = imageAttachments.findIndex((a) => a.id === attachments[clickedIndex]?.id);
    setLightbox({ index: Math.max(imageIdx, 0), images: urls });
  }, [attachments, getUrl]);

  const handlePdfClick = useCallback(async (attachment: Attachment) => {
    const url = await getUrl(attachment);
    window.open(url, "_blank", "noopener");
  }, [getUrl]);

  const handleDelete = useCallback(async (attachmentId: string) => {
    await deleteAttachment(householdId, attachmentId);
    onDelete?.(attachmentId);
  }, [householdId, onDelete]);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className={`attachment-gallery${compact ? " attachment-gallery--compact" : ""}`}>
        {attachments.map((attachment, i) => {
          const isImage = IMAGE_TYPES.has(attachment.mimeType);

          return (
            <div
              key={attachment.id}
              className={`attachment-gallery__item${!isImage ? " attachment-gallery__item--pdf" : ""}`}
              onClick={() => isImage ? handleImageClick(i) : handlePdfClick(attachment)}
            >
              {isImage ? (
                <GalleryImage attachment={attachment} getUrl={getUrl} />
              ) : (
                <>
                  <span className="attachment-gallery__icon">📄</span>
                  <span className="attachment-gallery__filename">{attachment.originalFilename}</span>
                </>
              )}

              {!readonly && (
                <button
                  className="attachment-gallery__remove"
                  onClick={(e) => { e.stopPropagation(); handleDelete(attachment.id); }}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <AttachmentLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

// Sub-component to lazily load image URLs
function GalleryImage({
  attachment,
  getUrl,
}: {
  attachment: Attachment;
  getUrl: (a: Attachment) => Promise<string>;
}) {
  const [src, setSrc] = useState<string>("");

  // Load URL on mount
  useState(() => {
    getUrl(attachment).then(setSrc);
  });

  if (!src) {
    return <div style={{ width: "100%", height: "100%", background: "var(--surface-alt)" }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={attachment.caption ?? attachment.originalFilename} loading="lazy" />
  );
}
