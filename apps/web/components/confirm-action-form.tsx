"use client";

import type { JSX } from "react";
import { useState } from "react";

type ConfirmActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{ name: string; value: string }>;
  prompt: string;
  triggerLabel: string;
  confirmLabel: string;
  className?: string;
  triggerClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
};

export function ConfirmActionForm({
  action,
  hiddenFields,
  prompt,
  triggerLabel,
  confirmLabel,
  className = "inline-actions inline-actions--end",
  triggerClassName = "button button--danger",
  confirmClassName = "button button--danger",
  cancelClassName = "button button--ghost"
}: ConfirmActionFormProps): JSX.Element {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isConfirming) {
    return (
      <div className={className}>
        <button
          type="button"
          className={triggerClassName}
          onClick={() => setIsConfirming(true)}
        >
          {triggerLabel}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className={className}>
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <span>{prompt}</span>
      <button type="submit" className={confirmClassName}>
        {confirmLabel}
      </button>
      <button type="button" className={cancelClassName} onClick={() => setIsConfirming(false)}>
        Cancel
      </button>
    </form>
  );
}