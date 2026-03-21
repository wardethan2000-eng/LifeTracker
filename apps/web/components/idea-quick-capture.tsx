"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createIdeaAction } from "../app/actions";

type IdeaQuickCaptureProps = {
  householdId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
};

export function IdeaQuickCapture({ householdId, triggerRef, onClose }: IdeaQuickCaptureProps): JSX.Element {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position the popover below the trigger button
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
    // Auto-focus title
    setTimeout(() => titleRef.current?.focus(), 0);
  }, [triggerRef]);

  // Focus trap
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = popover.querySelectorAll<HTMLElement>(
        'input, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    popover.addEventListener("keydown", handleFocusTrap);
    return () => popover.removeEventListener("keydown", handleFocusTrap);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    startTransition(async () => {
      await createIdeaAction(householdId, {
        title: title.trim(),
        description: notes.trim() || undefined,
        stage: "spark",
      });
      setShowToast(true);
      onClose();
      // Return focus to trigger
      triggerRef.current?.focus();
      // Toast auto-hides via CSS animation
      setTimeout(() => setShowToast(false), 2400);
    });
  }, [title, notes, householdId, onClose, triggerRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [onClose, handleSubmit, triggerRef]
  );

  return (
    <>
      {/* Backdrop */}
      <div className="quick-capture-popover__backdrop" onClick={onClose} />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="quick-capture-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture an idea"
        style={{ top: position.top, left: position.left }}
        onKeyDown={handleKeyDown}
      >
        <h3>Quick Capture</h3>
        <div className="field">
          <span>Title</span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the idea?"
            disabled={isPending}
          />
        </div>
        <div className="field">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quick context…"
            rows={3}
            disabled={isPending}
          />
        </div>
        <div className="quick-capture-popover__actions">
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary button--sm"
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="quick-capture-toast">Idea captured</div>
      )}
    </>
  );
}
