"use client";

import { useState, useEffect, useCallback } from "react";
import type { Attachment, AttachmentEntityType } from "@lifekeeper/types";
import { fetchAttachments } from "../lib/api";
import { AttachmentGallery } from "./attachment-gallery";
import { AttachmentUploader } from "./attachment-uploader";
import { SkeletonBlock, SkeletonTextLine } from "./skeleton";

type AttachmentSectionProps = {
  householdId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  compact?: boolean;
  readonly?: boolean;
  label?: string;
};

export function AttachmentSection({
  householdId,
  entityType,
  entityId,
  compact = false,
  readonly = false,
  label = "Photos & Documents",
}: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAttachments(householdId, entityType, entityId)
      .then((data) => { if (!cancelled) { setAttachments(data); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [householdId, entityType, entityId]);

  const handleUploadComplete = useCallback((attachment: Attachment) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const handleDelete = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const handleUpdate = useCallback((attachment: Attachment) => {
    setAttachments((prev) => prev.map((a) => (a.id === attachment.id ? attachment : a)));
  }, []);

  const handleReorder = useCallback((reorderedAttachments: Attachment[]) => {
    setAttachments(reorderedAttachments);
  }, []);

  if (!loaded) {
    return (
      <div className="attachment-section">
        {label ? <SkeletonTextLine size="md" width="sm" className="attachment-section__label-skeleton" /> : null}
        <div className="attachment-section__skeleton-grid">
          <SkeletonBlock variant="panel" />
          <SkeletonBlock variant="panel" />
        </div>
        {!readonly ? <SkeletonBlock variant="input" /> : null}
      </div>
    );
  }

  return (
    <div className="attachment-section">
      {label ? <h4 className="attachment-section__label">{label}</h4> : null}

      <AttachmentGallery
        householdId={householdId}
        attachments={attachments}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onReorder={handleReorder}
        compact={compact}
        readonly={readonly}
      />

      {!readonly && (
        <div className={attachments.length > 0 ? "attachment-section__uploader attachment-section__uploader--spaced" : "attachment-section__uploader"}>
          <AttachmentUploader
            householdId={householdId}
            entityType={entityType}
            entityId={entityId}
            onUploadComplete={handleUploadComplete}
            compact={compact}
          />
        </div>
      )}

      {loaded && attachments.length === 0 && readonly && (
        <div className="attachment-empty">No attachments yet.</div>
      )}
    </div>
  );
}
