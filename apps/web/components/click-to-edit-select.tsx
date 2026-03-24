"use client";

import { useCallback, useRef, useState, type JSX, type KeyboardEvent } from "react";

type Option = {
  label: string;
  value: string;
};

type ClickToEditSelectProps = {
  value: string;
  options: Option[];
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  renderValue?: (value: string) => React.ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

export function ClickToEditSelect({
  value,
  options,
  onSave,
  className,
  placeholder = "Select…",
  renderValue,
  disabled = false,
  "aria-label": ariaLabel,
}: ClickToEditSelectProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  const startEditing = useCallback(() => {
    if (disabled) return;
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value;
      setEditing(false);
      if (newValue !== value) {
        onSave(newValue);
      }
    },
    [value, onSave],
  );

  const handleBlur = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditing(false);
    }
  }, []);

  const displayContent = renderValue
    ? renderValue(value)
    : ((options.find((o) => o.value === value)?.label ?? value) || placeholder);

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
        <span className="click-to-edit__value">{displayContent}</span>
        {!disabled && <span className="click-to-edit__hint">✎</span>}
      </div>
    );
  }

  return (
    <select
      ref={ref}
      className="click-to-edit__input click-to-edit__input--select"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
