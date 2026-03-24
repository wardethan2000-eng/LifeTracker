"use client";

import { useState, useTransition } from "react";
import type { DisplayPreferences, UpdateDisplayPreferencesInput } from "@lifekeeper/types";
import { updateDisplayPreferencesAction } from "../app/actions";
import { formatDate, formatCurrency } from "../lib/formatters";

const PAGE_SIZE_OPTIONS = [
  { value: 25, label: "25 per page" },
  { value: 50, label: "50 per page" },
  { value: 100, label: "100 per page" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "US", label: "US — 12/31/2024" },
  { value: "ISO", label: "ISO — 2024-12-31" },
  { value: "locale", label: "Locale — Dec 31, 2024" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "CHF", label: "CHF — Swiss Franc" },
];

const PREVIEW_DATE = "2024-09-15T00:00:00.000Z";
const PREVIEW_AMOUNT = 1234.56;

interface DisplayPreferencesFormProps {
  initialPreferences: DisplayPreferences;
}

export function DisplayPreferencesForm({ initialPreferences }: DisplayPreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [dateFormat, setDateFormat] = useState(initialPreferences.dateFormat);
  const [currencyCode, setCurrencyCode] = useState(initialPreferences.currencyCode);

  const handleChange = (patch: Partial<UpdateDisplayPreferencesInput>) => {
    setSaved(false);
    startTransition(async () => {
      await updateDisplayPreferencesAction(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="workbench-grid">
      <div className="workbench-section">
        <label className="field">
          <span>Date format</span>
          <select
            value={dateFormat}
            disabled={isPending}
            onChange={(e) => {
              const value = e.target.value as DisplayPreferences["dateFormat"];
              setDateFormat(value);
              handleChange({ dateFormat: value });
            }}
          >
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="workbench-section">
        <label className="field">
          <span>Currency</span>
          <select
            value={currencyCode}
            disabled={isPending}
            onChange={(e) => {
              const value = e.target.value;
              setCurrencyCode(value);
              handleChange({ currencyCode: value });
            }}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="workbench-section">
        <label className="field">
          <span>Default page size</span>
          <select
            value={pageSize}
            disabled={isPending}
            onChange={(e) => {
              const value = Number(e.target.value);
              setPageSize(value);
              handleChange({ pageSize: value });
            }}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="workbench-section display-preferences-preview">
        <p className="eyebrow">Preview</p>
        <dl className="data-list">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(PREVIEW_DATE, "—", undefined, dateFormat)}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{formatCurrency(PREVIEW_AMOUNT, "—", currencyCode)}</dd>
          </div>
        </dl>
        {saved && <p className="display-preferences-saved" role="status">Saved</p>}
      </div>
    </div>
  );
}
