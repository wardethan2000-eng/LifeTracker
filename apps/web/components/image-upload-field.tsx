"use client";

import type { AttachmentEntityType } from "@aegis/types";
import { useId, useState, type ChangeEvent, type JSX } from "react";
import { buildAttachmentDownloadPath } from "../lib/url";
import { AttachmentUploader } from "./attachment-uploader";
import { InlineError } from "./inline-error";

type ImageUploadFieldProps = {
  householdId: string;
  entityType?: AttachmentEntityType;
  entityId?: string;
  fieldName?: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  previewAlt?: string;
  containerClassName?: string;
  labelClassName?: string;
  labelTextClassName?: string;
  inputClassName?: string;
  helperClassName?: string;
  errorMessage?: string | undefined;
};

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export function ImageUploadField({
  householdId,
  entityType = "household",
  entityId,
  fieldName,
  label,
  value,
  defaultValue = "",
  onChange,
  placeholder,
  hint,
  previewAlt,
  containerClassName = "field field--full",
  labelClassName,
  labelTextClassName,
  inputClassName,
  helperClassName,
  errorMessage,
}: ImageUploadFieldProps): JSX.Element {
  const inputId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  const handleChange = (nextValue: string): void => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    handleChange(event.target.value);
  };

  return (
    <div className={containerClassName}>
      <label className={labelClassName} htmlFor={inputId}>
        <span className={labelTextClassName}>{label}</span>
      </label>
      <input
        id={inputId}
        className={inputClassName}
        name={fieldName}
        type="text"
        value={currentValue}
        onChange={handleInputChange}
        placeholder={placeholder}
      />
      <div className="inline-actions" style={{ marginTop: 8 }}>
        <AttachmentUploader
          householdId={householdId}
          entityType={entityType}
          entityId={entityId ?? householdId}
          onUploadComplete={(attachment) => handleChange(buildAttachmentDownloadPath(householdId, attachment.id))}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          allowedMimeTypes={IMAGE_MIME_TYPES}
          allowedFileTypeLabel="JPEG, PNG, WebP, HEIC, or HEIF"
          multiple={false}
          compact
          label={<strong>Upload image</strong>}
        />
        {currentValue ? (
          <button type="button" className="button button--ghost button--sm" onClick={() => handleChange("")}>
            Clear image
          </button>
        ) : null}
      </div>
      <InlineError message={errorMessage} size="sm" />
      {hint ? <small className={helperClassName}>{hint}</small> : null}
      {currentValue ? (
        <img
          src={currentValue}
          alt={previewAlt ?? label}
          style={{ display: "block", marginTop: 12, maxWidth: 220, maxHeight: 220, objectFit: "cover", borderRadius: 12 }}
        />
      ) : null}
    </div>
  );
}
