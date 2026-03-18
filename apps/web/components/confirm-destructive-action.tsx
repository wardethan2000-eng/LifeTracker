"use client";

import type { JSX } from "react";
import { useId, useState } from "react";

type ConfirmDestructiveActionTone = "danger" | "warning";

type ConfirmDestructiveActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  triggerLabel: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDestructiveActionTone;
  triggerClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  className?: string;
};

export function ConfirmDestructiveAction({
  action,
  hiddenFields = [],
  triggerLabel,
  title,
  message,
  confirmLabel = "Yes, delete",
  cancelLabel = "Cancel",
  tone = "danger",
  triggerClassName = "button button--danger button--sm",
  confirmClassName = "button button--danger button--sm",
  cancelClassName = "button button--ghost button--sm",
  className = "asset-danger-actions__confirm",
}: ConfirmDestructiveActionProps): JSX.Element {
  const [isConfirming, setIsConfirming] = useState(false);
  const titleId = useId();
  const messageId = useId();

  if (!isConfirming) {
    return (
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setIsConfirming(true)}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div
      className={`${className} ${className}--${tone}`}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="asset-danger-actions__confirm-copy">
        <strong id={titleId} className="asset-danger-actions__confirm-title">{title}</strong>
        <span id={messageId}>{message}</span>
      </div>
      <form action={action}>
        {hiddenFields.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <button type="submit" className={confirmClassName}>
          {confirmLabel}
        </button>
      </form>
      <button
        type="button"
        className={cancelClassName}
        onClick={() => setIsConfirming(false)}
      >
        {cancelLabel}
      </button>
    </div>
  );
}