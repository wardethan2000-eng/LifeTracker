"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type QuantityStepperProps = {
  value: number;
  onSave: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

const DEBOUNCE_MS = 600;

export function QuantityStepper({
  value,
  onSave,
  min = 0,
  step = 1,
  suffix,
  disabled = false,
  "aria-label": ariaLabel,
}: QuantityStepperProps): JSX.Element {
  const [pendingValue, setPendingValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSave = useRef(onSave);
  latestSave.current = onSave;

  // Sync when external value changes (e.g. after save confirmed)
  useEffect(() => {
    setPendingValue(value);
  }, [value]);

  const scheduleCommit = useCallback((next: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      latestSave.current(next);
    }, DEBOUNCE_MS);
  }, []);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const adjust = useCallback((delta: number) => {
    setPendingValue((current) => {
      const next = Math.max(min, Math.round((current + delta) * 100) / 100);
      scheduleCommit(next);
      return next;
    });
  }, [min, scheduleCommit]);

  const hasPending = pendingValue !== value;

  return (
    <div className={`qty-stepper${disabled ? " qty-stepper--disabled" : ""}${hasPending ? " qty-stepper--pending" : ""}`} aria-label={ariaLabel}>
      <button
        type="button"
        className="qty-stepper__btn"
        onClick={(e) => { e.stopPropagation(); adjust(-step); }}
        disabled={disabled || pendingValue <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="qty-stepper__value">
        {pendingValue}{suffix ? ` ${suffix}` : ""}
      </span>
      <button
        type="button"
        className="qty-stepper__btn"
        onClick={(e) => { e.stopPropagation(); adjust(step); }}
        disabled={disabled}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
