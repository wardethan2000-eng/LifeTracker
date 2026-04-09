"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Attachment } from "@aegis/types";
import { addOverviewPin, deleteAttachment, getAttachmentDownloadUrl, getOverviewPins, removeOverviewPin, updateAttachment } from "../lib/api";
import { AttachmentLightbox } from "./attachment-lightbox";

type AttachmentGalleryProps = {
  householdId: string;
  attachments: Attachment[];
  onDelete?: (attachmentId: string) => void;
  onUpdate?: (attachment: Attachment) => void;
  onReorder?: (reorderedAttachments: Attachment[]) => void;
  compact?: boolean;
  readonly?: boolean;
  // Optional: when provided, shows pin-to-overview buttons
  entityType?: string;
  entityId?: string;
};

type CachedUrl = { url: string; expiresAt: number };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function sortByOrder(arr: Attachment[]): Attachment[] {
  return [...arr].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

export function AttachmentGallery({
  householdId,
  attachments,
  onDelete,
  onUpdate,
  onReorder,
  compact = false,
  readonly = false,
  entityType,
  entityId,
}: AttachmentGalleryProps) {
  const [urlCache, setUrlCache] = useState<Map<string, CachedUrl>>(new Map());
  const [items, setItems] = useState<Attachment[]>(() => sortByOrder(attachments));
  const [lightbox, setLightbox] = useState<{ index: number; images: Array<{ id: string; url: string; caption?: string | null; filename: string }> } | null>(null);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const pendingFetches = useRef<Set<string>>(new Set());
  const [pinnedAttachmentIds, setPinnedAttachmentIds] = useState<Set<string>>(new Set());
  const [pinIdMap, setPinIdMap] = useState<Map<string, string>>(new Map());

  // Load pinned attachment IDs when entity context is provided
  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;
    getOverviewPins(entityType, entityId)
      .then((pins) => {
        if (cancelled) return;
        const attachmentPins = pins.filter((p) => p.itemType === "attachment");
        setPinnedAttachmentIds(new Set(attachmentPins.map((p) => p.itemId)));
        setPinIdMap(new Map(attachmentPins.map((p) => [p.itemId, p.id])));
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  // Sync items when parent adds/removes attachments
  useEffect(() => {
    setItems((prev) => {
      const incoming = new Map(attachments.map((a) => [a.id, a]));
      const kept = prev
        .filter((a) => incoming.has(a.id))
        .map((a) => ({ ...a, ...incoming.get(a.id) }));
      const added = attachments.filter((a) => !prev.find((k) => k.id === a.id));
      return [...kept, ...added];
    });
  }, [attachments]);

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

  const handleImageClick = useCallback(async (clickedItem: Attachment) => {
    const imageItems = items.filter((a) => IMAGE_TYPES.has(a.mimeType));
    const urls = await Promise.all(
      imageItems.map(async (a) => ({
        id: a.id,
        url: await getUrl(a),
        caption: a.caption,
        filename: a.originalFilename,
      }))
    );
    const imageIdx = imageItems.findIndex((a) => a.id === clickedItem.id);
    setLightbox({ index: Math.max(imageIdx, 0), images: urls });
  }, [items, getUrl]);

  const handlePdfClick = useCallback(async (attachment: Attachment) => {
    const url = await getUrl(attachment);
    window.open(url, "_blank", "noopener");
  }, [getUrl]);

  const handleDelete = useCallback(async (attachmentId: string) => {
    await deleteAttachment(householdId, attachmentId);
    onDelete?.(attachmentId);
  }, [householdId, onDelete]);

  const handlePinToggle = useCallback(async (attachmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entityType || !entityId) return;
    const isPinned = pinnedAttachmentIds.has(attachmentId);
    if (isPinned) {
      const pinId = pinIdMap.get(attachmentId);
      if (!pinId) return;
      setPinnedAttachmentIds((prev) => { const next = new Set(prev); next.delete(attachmentId); return next; });
      setPinIdMap((prev) => { const next = new Map(prev); next.delete(attachmentId); return next; });
      await removeOverviewPin(pinId);
    } else {
      setPinnedAttachmentIds((prev) => new Set([...prev, attachmentId]));
      const { id } = await addOverviewPin({ entityType, entityId, itemType: "attachment", itemId: attachmentId });
      setPinIdMap((prev) => new Map([...prev, [attachmentId, id]]));
    }
  }, [entityType, entityId, pinnedAttachmentIds, pinIdMap]);

  const handleCaptionUpdate = useCallback(async (id: string, caption: string) => {
    const updated = await updateAttachment(householdId, id, { caption });
    setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setLightbox((prev) =>
      prev
        ? { ...prev, images: prev.images.map((img) => (img.id === id ? { ...img, caption } : img)) }
        : prev
    );
    onUpdate?.(updated);
  }, [householdId, onUpdate]);

  const handleDragStart = useCallback((index: number) => {
    setDragSrc(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOver(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragSrc(null);
    setDragOver(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragSrc === null || dragSrc === targetIndex) {
      setDragSrc(null);
      setDragOver(null);
      return;
    }
    const newItems = [...items];
    const [moved] = newItems.splice(dragSrc, 1);
    newItems.splice(targetIndex, 0, moved);
    const withOrder = newItems.map((a, i) => ({ ...a, sortOrder: i }));
    setItems(withOrder);
    setDragSrc(null);
    setDragOver(null);
    onReorder?.(withOrder);
    await Promise.all(
      withOrder.map((a) => updateAttachment(householdId, a.id, { sortOrder: a.sortOrder! }))
    );
  }, [dragSrc, items, householdId, onReorder]);

  if (items.length === 0) return null;

  return (
    <>
      <div className={`attachment-gallery${compact ? " attachment-gallery--compact" : ""}`}>
        {items.map((attachment, i) => {
          const isImage = IMAGE_TYPES.has(attachment.mimeType);
          const isDragging = dragSrc === i;
          const isTarget = dragOver === i && dragSrc !== null && dragSrc !== i;

          return (
            <div
              key={attachment.id}
              className={[
                "attachment-gallery__item",
                !isImage ? "attachment-gallery__item--pdf" : "",
                isDragging ? "attachment-gallery__item--dragging" : "",
                isTarget ? "attachment-gallery__item--drag-target" : "",
              ].filter(Boolean).join(" ")}
              draggable={!readonly}
              onDragStart={() => !readonly && handleDragStart(i)}
              onDragOver={(e) => !readonly && handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => !readonly && handleDrop(e, i)}
              onClick={() => isImage ? handleImageClick(attachment) : handlePdfClick(attachment)}
            >
              {isImage ? (
                <GalleryImage attachment={attachment} getUrl={getUrl} />
              ) : (
                <>
                  <span className="attachment-gallery__icon">📄</span>
                  <span className="attachment-gallery__filename">{attachment.originalFilename}</span>
                </>
              )}

              {entityType && entityId && (
                <button
                  type="button"
                  className={`attachment-gallery__pin${pinnedAttachmentIds.has(attachment.id) ? " attachment-gallery__pin--active" : ""}`}
                  onClick={(e) => { void handlePinToggle(attachment.id, e); }}
                  title={pinnedAttachmentIds.has(attachment.id) ? "Unpin from overview" : "Pin to overview"}
                >
                  📌
                </button>
              )}

              {!readonly && (
                <button
                  type="button"
                  className="attachment-gallery__remove"
                  onClick={(e) => { e.stopPropagation(); handleDelete(attachment.id); }}
                  title="Remove"
                >
                  ×
                </button>
              )}

              {attachment.caption && (
                <div className="attachment-gallery__caption-badge" title={attachment.caption}>
                  ✎
                </div>
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
          onCaptionUpdate={readonly ? undefined : handleCaptionUpdate}
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
