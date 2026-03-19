"use client";

import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

type ClickToEditProps = {
  value: string;
  onSave: (value: string) => void;
  as?: "input" | "textarea";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  rows?: number;
  required?: boolean;
};

export function ClickToEdit({
  value,
  onSave,
  as = "input",
  placeholder = "Click to edit",
  className,
  inputClassName,
  rows = 3,
  required = false,
}: ClickToEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  }, [value]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
    if (required && trimmed === "") {
      setDraft(value);
      setEditing(false);
      return;
    }
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }, [draft, value, onSave, required]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
    if (as === "input" && e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    }
  }, [value, as, commitEdit]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  }, []);

  if (!editing) {
    return (
      <div
        className={`click-to-edit ${className ?? ""}`}
        onClick={startEditing}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") startEditing(); }}
      >
        <span className={value ? "click-to-edit__value" : "click-to-edit__placeholder"}>
          {value || placeholder}
        </span>
        <span className="click-to-edit__hint">✎</span>
      </div>
    );
  }

  if (as === "textarea") {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        className={`click-to-edit__input ${inputClassName ?? ""}`}
        value={draft}
        onChange={handleChange}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      className={`click-to-edit__input ${inputClassName ?? ""}`}
      type="text"
      value={draft}
      onChange={handleChange}
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
    />
  );
}
