"use client";

import { useState, useRef, useCallback } from "react";
import type { Attachment, AttachmentEntityType } from "@lifekeeper/types";
import { requestAttachmentUpload, confirmAttachmentUpload } from "../lib/api";

type AttachmentUploaderProps = {
  householdId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  onUploadComplete: (attachment: Attachment) => void;
  onError?: (message: string) => void;
  accept?: string;
  maxFileSizeMb?: number;
  multiple?: boolean;
  compact?: boolean;
  label?: string;
};

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const ALLOWED_MIME_SET = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

type UploadProgress = {
  filename: string;
  percent: number;
};

export function AttachmentUploader({
  householdId,
  entityType,
  entityId,
  onUploadComplete,
  onError,
  accept = DEFAULT_ACCEPT,
  maxFileSizeMb = 50,
  multiple = true,
  compact = false,
  label,
}: AttachmentUploaderProps) {
  const [dragover, setDragover] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxFileSizeMb * 1_048_576;

  const uploadFile = useCallback(async (file: File) => {
    if (!ALLOWED_MIME_SET.has(file.type)) {
      const msg = `"${file.name}" has an unsupported file type.`;
      setError(msg);
      onError?.(msg);
      return;
    }
    if (file.size > maxBytes) {
      const msg = `"${file.name}" exceeds the ${maxFileSizeMb} MB limit.`;
      setError(msg);
      onError?.(msg);
      return;
    }

    setError(null);
    setProgress({ filename: file.name, percent: 0 });

    try {
      const { attachment, uploadUrl } = await requestAttachmentUpload(householdId, {
        entityType,
        entityId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // Use XMLHttpRequest for upload progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress({ filename: file.name, percent: Math.round((e.loaded / e.total) * 100) });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.send(file);
      });

      const confirmed = await confirmAttachmentUpload(householdId, attachment.id);
      onUploadComplete(confirmed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      onError?.(msg);
    } finally {
      setProgress(null);
    }
  }, [householdId, entityType, entityId, maxBytes, maxFileSizeMb, onUploadComplete, onError]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div
      className={`attachment-upload${dragover ? " attachment-upload--dragover" : ""}${compact ? " attachment-upload--compact" : ""}`}
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {progress ? (
        <div className="attachment-upload__progress">
          <div className="attachment-upload__progress-text">{progress.filename}</div>
          <div className="attachment-upload__progress-bar">
            <div
              className="attachment-upload__progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="attachment-upload__progress-text">{progress.percent}%</div>
        </div>
      ) : (
        <>
          <div className="attachment-upload__label">
            {label ?? <><strong>Click to upload</strong> or drag and drop</>}
          </div>
          <div className="attachment-upload__hint">
            JPEG, PNG, WebP, HEIC, or PDF — up to {maxFileSizeMb} MB
          </div>
        </>
      )}

      {error && <div className="attachment-upload__error">{error}</div>}
    </div>
  );
}
