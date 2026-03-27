"use client";

import type { FormEvent, JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeSchedule } from "../lib/api";
import { useCompletionSlideOver } from "./completion-slide-over-context";

export function CompletionSlideOver(): JSX.Element {
  const { slideOverData, closeSlideOver } = useCompletionSlideOver();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = slideOverData !== null;

  // Reset form state each time a new schedule is opened
  useEffect(() => {
    if (isOpen) {
      setError(null);
      formRef.current?.reset();
    }
  }, [isOpen, slideOverData?.scheduleId]);

  // Close on Escape
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && isOpen) {
        closeSlideOver();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeSlideOver]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!slideOverData || isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const notes = formData.get("notes") as string | null;
    const completedAtRaw = formData.get("completedAt") as string | null;

    setIsSubmitting(true);
    setError(null);

    try {
      await completeSchedule(slideOverData.assetId, slideOverData.scheduleId, {
        notes: notes?.trim() || undefined,
        completedAt: completedAtRaw ? new Date(completedAtRaw).toISOString() : undefined,
        applyLinkedParts: true,
        metadata: {},
      });
      closeSlideOver();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log completion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <>
      {isOpen && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="slide-over__backdrop"
          onClick={closeSlideOver}
          aria-hidden="true"
        />
      )}
      <aside
        className={`slide-over${isOpen ? " slide-over--open" : ""}`}
        aria-modal={isOpen}
        role="dialog"
        aria-label={isOpen ? `Log completion: ${slideOverData?.scheduleName ?? ""}` : undefined}
      >
        <div className="slide-over__header">
          <div className="slide-over__header-info">
            <p className="eyebrow">{slideOverData?.assetName ?? ""}</p>
            <h2 className="slide-over__title">{slideOverData?.scheduleName ?? "Log Completion"}</h2>
          </div>
          <button
            type="button"
            className="slide-over__close"
            onClick={closeSlideOver}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="slide-over__body">
          <form
            ref={formRef}
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="slide-over__form"
          >
            <label className="field">
              <span>Completion date</span>
              <input type="date" name="completedAt" defaultValue={today} />
            </label>

            <label className="field">
              <span>Notes <span className="field__optional">(optional)</span></span>
              <textarea
                name="notes"
                rows={4}
                placeholder="What was done? Any observations?"
                className="slide-over__textarea"
              />
            </label>

            {error && <p className="inline-error" role="alert">{error}</p>}

            <div className="slide-over__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={closeSlideOver}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Log Completion"}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
