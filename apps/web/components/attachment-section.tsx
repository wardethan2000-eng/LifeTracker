"use client";

import { useState, useEffect, useCallback } from "react";
import type { Attachment, AttachmentEntityType } from "@lifekeeper/types";
import { fetchAttachments } from "../lib/api";
import { AttachmentGallery } from "./attachment-gallery";
import { AttachmentUploader } from "./attachment-uploader";

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

  if (!loaded) return null;

  return (
    <div className="attachment-section">
      <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", fontWeight: 600 }}>{label}</h4>

      <AttachmentGallery
        householdId={householdId}
        attachments={attachments}
        onDelete={handleDelete}
        compact={compact}
        readonly={readonly}
      />

      {!readonly && (
        <div style={{ marginTop: attachments.length > 0 ? 10 : 0 }}>
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
