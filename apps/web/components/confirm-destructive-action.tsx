"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useToast } from "./toast-provider";

type ConfirmDestructiveActionTone = "danger" | "warning";

type ConfirmDestructiveActionProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Array<{ name: string; value: string }>;
  triggerLabel: string;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDestructiveActionTone;
  triggerClassName?: string;
  confirmClassName?: string;
  cancelClassName?: string;
  className?: string;
  deferredAction?: () => Promise<void>;
  onOptimisticAction?: () => void;
  onUndoRestore?: () => void;
  toastMessage?: string;
  toastDuration?: number;
  defaultOpen?: boolean;
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
  deferredAction,
  onOptimisticAction,
  onUndoRestore,
  toastMessage,
  toastDuration,
  defaultOpen = false,
}: ConfirmDestructiveActionProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(defaultOpen);
  const titleId = useId();
  const messageId = useId();

  const runDeferredAction = (): void => {
    if (!deferredAction) {
      return;
    }

    setIsConfirming(false);
    onOptimisticAction?.();
    pushToast({
      actionLabel: "Undo",
      duration: toastDuration ?? 8000,
      message: toastMessage ?? title,
      tone: tone === "danger" ? "danger" : "info",
      onAction: () => {
        onUndoRestore?.();
        router.refresh();
      },
      onExpire: async () => {
        await deferredAction();
        router.refresh();
      }
    });
  };

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
      {deferredAction ? (
        <button type="button" className={confirmClassName} onClick={runDeferredAction}>
          {confirmLabel}
        </button>
      ) : (
        <form action={action}>
          {hiddenFields.map((field) => (
            <input key={field.name} type="hidden" name={field.name} value={field.value} />
          ))}
          <button type="submit" className={confirmClassName}>
            {confirmLabel}
          </button>
        </form>
      )}
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