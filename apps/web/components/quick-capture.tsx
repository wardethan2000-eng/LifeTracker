"use client";

import type { JSX } from "react";
import { useCallback, useState } from "react";

type QuickCaptureProps = {
  onCapture: (body: string) => Promise<void>;
};

export function QuickCapture({ onCapture }: QuickCaptureProps): JSX.Element {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onCapture(trimmed);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }, [value, submitting, onCapture]);

  return (
    <div className="quick-capture">
      <input
        className="quick-capture__input"
        type="text"
        placeholder="Quick note… press Enter to save"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        disabled={submitting}
      />
      <button
        className="quick-capture__btn button button--primary button--small"
        onClick={handleSubmit}
        disabled={!value.trim() || submitting}
      >
        {submitting ? "…" : "Capture"}
      </button>
    </div>
  );
}
