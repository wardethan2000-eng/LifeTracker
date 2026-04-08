"use client";

import type { BarcodeLookupResult } from "@aegis/types";
import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { lookupBarcode } from "../lib/api";

type BarcodeLookupFieldProps = {
  onResult: (result: BarcodeLookupResult) => void;
  disabled?: boolean;
  className?: string;
};

type StatusState = {
  message: string;
  variant: "success" | "error" | "neutral";
} | null;

type BarcodePreview = {
  value: string;
  format: string;
} | null;

export function BarcodeLookupField({ onResult, disabled, className }: BarcodeLookupFieldProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);
  const [barcodePreview, setBarcodePreview] = useState<BarcodePreview>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((message: string, variant: "success" | "error" | "neutral") => {
    setStatus({ message, variant });

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }

    dismissTimer.current = setTimeout(() => setStatus(null), 4000);
  }, []);

  const handleLookup = useCallback(async () => {
    const barcode = inputRef.current?.value.trim();

    if (!barcode) {
      return;
    }

    setLoading(true);
    setStatus(null);
    setBarcodePreview(null);

    try {
      const result = await lookupBarcode(barcode);
      onResult(result);
      setBarcodePreview({ value: result.barcode, format: result.barcodeFormat });

      if (result.found) {
        showStatus(`Found: ${result.productName ?? barcode}`, "success");
      } else {
        showStatus("No product match — barcode copied to part number", "neutral");
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      showStatus("Lookup failed — try again", "error");
    } finally {
      setLoading(false);
    }
  }, [onResult, showStatus]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLookup();
    }
  }, [handleLookup]);

  const barcodeImageSrc = barcodePreview
    ? `/api/v1/barcode/image?value=${encodeURIComponent(barcodePreview.value)}&format=${encodeURIComponent(barcodePreview.format)}&output=png`
    : null;

  return (
    <div className={`barcode-lookup${className ? ` ${className}` : ""}`}>
      <input
        ref={inputRef}
        type="text"
        className="barcode-lookup__input"
        placeholder="Scan or type barcode / UPC"
        disabled={disabled || loading}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="button button--sm"
        disabled={disabled || loading}
        onClick={handleLookup}
      >
        {loading ? "Looking up…" : "Lookup"}
      </button>
      {status && (
        <span className={`barcode-lookup__status barcode-lookup__status--${status.variant}`}>
          {status.message}
        </span>
      )}
      {barcodeImageSrc && barcodePreview && (
        <figure className="barcode-lookup__preview">
          <img
            src={barcodeImageSrc}
            alt={`Barcode for ${barcodePreview.value}`}
            className="barcode-lookup__image"
          />
          <figcaption className="barcode-lookup__format">{barcodePreview.format}</figcaption>
        </figure>
      )}
    </div>
  );
}

