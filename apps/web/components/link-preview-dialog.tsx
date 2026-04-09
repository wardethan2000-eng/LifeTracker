"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { LinkPreviewField, LinkPreviewResponse } from "@aegis/types";
import { fetchLinkPreview } from "../lib/api";
import { normalizeExternalUrl } from "../lib/url";
import { InlineError } from "./inline-error";

type LinkPreviewConfirmData = {
  fields: Record<string, string>;
  imageUrl: string | null;
  sourceUrl: string;
  retailer: string | null;
};

type LinkPreviewDialogProps = {
  householdId: string;
  onConfirm: (data: LinkPreviewConfirmData) => void;
  onCancel: () => void;
  initialUrl?: string;
  autoFetchOnOpen?: boolean;
};

type DialogState =
  | { phase: "input" }
  | { phase: "loading" }
  | { phase: "review"; data: LinkPreviewResponse; editedValues: Record<string, string> };

export function LinkPreviewDialog({
  householdId,
  onConfirm,
  onCancel,
  initialUrl = "",
  autoFetchOnOpen = false,
}: LinkPreviewDialogProps): JSX.Element {
  const [state, setState] = useState<DialogState>({ phase: "input" });
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const autoFetchStartedRef = useRef(false);

  const close = () => {
    onCancel();
  };

  const handleFetch = useCallback(async (value = url) => {
    const normalizedUrl = normalizeExternalUrl(value);

    if (!normalizedUrl) {
      setError("Enter a valid product URL.");
      setState({ phase: "input" });
      return;
    }

    setUrl(normalizedUrl);
    setError(null);
    setState({ phase: "loading" });

    try {
      const data = await fetchLinkPreview(householdId, normalizedUrl);
      const initialValues: Record<string, string> = {};
      for (const field of data.fields) {
        if (field.value) {
          initialValues[field.key] = field.value;
        }
      }
      setState({ phase: "review", data, editedValues: initialValues });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch link preview.";
      setError(message);
      setState({ phase: "input" });
    }
  }, [householdId, url]);

  useEffect(() => {
    if (!autoFetchOnOpen || autoFetchStartedRef.current) {
      return;
    }

    autoFetchStartedRef.current = true;
    void handleFetch(initialUrl);
  }, [autoFetchOnOpen, handleFetch, initialUrl]);

  const handleFieldChange = (key: string, value: string) => {
    if (state.phase !== "review") return;
    setState({
      ...state,
      editedValues: { ...state.editedValues, [key]: value },
    });
  };

  const handleConfirm = () => {
    if (state.phase !== "review") return;
    const { data, editedValues } = state;

    // Filter out empty values
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(editedValues)) {
      if (value.trim()) {
        fields[key] = value.trim();
      }
    }

    onConfirm({
      fields,
      imageUrl: data.imageUrls[0] ?? null,
      sourceUrl: data.canonicalUrl ?? data.url,
      retailer: data.retailer,
    });
  };

  const confidenceClass = (c: LinkPreviewField["confidence"]): string =>
    `link-preview--confidence link-preview--confidence-${c}`;

  const useMultilineField = (field: LinkPreviewField): boolean =>
    field.key === "description"
    || field.key === "features"
    || field.key === "fitment"
    || (state.phase === "review" && (state.editedValues[field.key] ?? "").length > 140);

  return (
    <div className="link-preview--overlay" role="dialog" aria-modal="true" onMouseDown={(e) => {
      if (e.target === e.currentTarget) close();
    }}>
      <div className="link-preview--panel">
        <div className="link-preview--header">
          <h2>Add from Product Link</h2>
          <button type="button" className="button button--ghost" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {(state.phase === "input" || state.phase === "loading") && (
          <>
            <div className="link-preview--url-row">
              <input
                type="url"
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a product URL (Home Depot, Amazon, Lowes, etc.)"
                aria-label="Product URL"
                disabled={state.phase === "loading"}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetch(); } }}
                autoFocus
              />
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  void handleFetch();
                }}
                disabled={state.phase === "loading" || !url.trim()}
              >
                {state.phase === "loading" ? "Fetching…" : "Fetch"}
              </button>
            </div>
            <InlineError message={error} className="link-preview--error" />
            {state.phase === "loading" && (
              <div className="link-preview--loading">
                <span className="search-palette__spinner" aria-hidden="true" />
                <span>Extracting product information…</span>
              </div>
            )}
          </>
        )}

        {state.phase === "review" && (
          <>
            {state.data.warningMessage && (
              <div className="link-preview--warning">
                {state.data.warningMessage}
              </div>
            )}
            <div className="link-preview--review">
              <div className="link-preview--image-col">
                {state.data.imageUrls[0] ? (
                  <img
                    className="link-preview--thumb"
                    src={state.data.imageUrls[0]}
                    alt="Product preview"
                  />
                ) : (
                  <div className="link-preview--thumb link-preview--thumb-placeholder">
                    No image
                  </div>
                )}
                {state.data.retailer && (
                  <div className="link-preview--retailer">{state.data.retailer}</div>
                )}
                <a
                  className="link-preview--source-url"
                  href={state.data.canonicalUrl ?? state.data.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {new URL(state.data.canonicalUrl ?? state.data.url).hostname}
                </a>
              </div>
              <div className="link-preview--fields-col">
                {state.data.fields.map((field) => (
                  <div key={field.key} className="link-preview--field-row">
                    <span className="link-preview--field-label">
                      <span className={confidenceClass(field.confidence)} title={`${field.confidence} confidence (${field.source})`} />
                      {field.label}
                    </span>
                    {useMultilineField(field) ? (
                      <textarea
                        className="input"
                        rows={field.key === "fitment" ? 5 : 4}
                        value={state.editedValues[field.key] ?? ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className="input"
                        value={state.editedValues[field.key] ?? ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                {state.data.fields.length === 0 && (
                  <p className="link-preview--empty-copy">
                    {state.data.extractionMode === "fallback"
                      ? "Only limited details could be inferred from the link."
                      : "No product metadata could be extracted from this page."}
                  </p>
                )}
              </div>
            </div>
            <div className="link-preview--actions">
              <button type="button" className="button button--ghost" onClick={close}>
                Cancel
              </button>
              <button type="button" className="button button--primary" onClick={handleConfirm}>
                Use This Information
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
