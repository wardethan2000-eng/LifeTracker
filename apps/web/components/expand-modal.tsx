"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ExpandModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function ExpandModal({ title, onClose, children }: ExpandModalProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus trap: move focus into the modal
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="expand-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="expand-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expand-modal-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="expand-modal__header">
          <h2 id="expand-modal-title">{title}</h2>
          <button
            type="button"
            className="expand-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="expand-modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
