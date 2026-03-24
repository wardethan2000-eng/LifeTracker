"use client";

import { useCallback, useRef, useState, type ChangeEvent, type JSX, type KeyboardEvent } from "react";

type ClickToEditNumberProps = {
  value: number | null;
  onSave: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function ClickToEditNumber({
  value,
  onSave,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  className,
  placeholder = "—",
  disabled = false,
  "aria-label": ariaLabel,
}: ClickToEditNumberProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value !== null ? String(value) : "");
  const ref = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setDraft(value !== null ? String(value) : "");
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  }, [disabled, value]);

  const commitEdit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      const clamped =
        min !== undefined && max !== undefined
          ? Math.min(max, Math.max(min, parsed))
          : min !== undefined
            ? Math.max(min, parsed)
            : max !== undefined
              ? Math.min(max, parsed)
              : parsed;
      if (clamped !== value) {
        onSave(clamped);
      }
    }
    setEditing(false);
  }, [draft, value, onSave, min, max]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(value !== null ? String(value) : "");
        setEditing(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      }
    },
    [value, commitEdit],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  }, []);

  const displayValue =
    value !== null
      ? `${prefix ?? ""}${value}${suffix ? ` ${suffix}` : ""}`
      : placeholder;

  if (!editing) {
    return (
      <div
        className={`click-to-edit ${disabled ? "click-to-edit--disabled" : ""} ${className ?? ""}`.trim()}
        onClick={startEditing}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") startEditing();
        }}
      >
        <span className={value !== null ? "click-to-edit__value" : "click-to-edit__placeholder"}>
          {displayValue}
        </span>
        {!disabled && <span className="click-to-edit__hint">✎</span>}
      </div>
    );
  }

  return (
    <div className="click-to-edit__number-wrap">
      {prefix && <span className="click-to-edit__affix">{prefix}</span>}
      <input
        ref={ref}
        className="click-to-edit__input click-to-edit__input--number"
        type="number"
        value={draft}
        onChange={handleChange}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
      />
      {suffix && <span className="click-to-edit__affix">{suffix}</span>}
    </div>
  );
}
