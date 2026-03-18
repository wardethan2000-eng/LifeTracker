"use client";

import type { JSX } from "react";
import { useState } from "react";
import {
  downloadAnnualCostPdf,
  downloadInventoryValuationPdf
} from "../lib/api";

type AnnualCostReportButtonProps = {
  householdId: string;
};

type InventoryValuationReportButtonProps = {
  householdId: string;
};

export function AnnualCostReportButton({ householdId }: AnnualCostReportButtonProps): JSX.Element {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsDownloading(true);
      await downloadAnnualCostPdf(householdId, year);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to download the annual cost report.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
          <span>Year</span>
          <select className="form-select" value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button type="button" className="button button--primary button--sm" onClick={() => { void handleDownload(); }} disabled={isDownloading}>
          {isDownloading ? "Downloading..." : "Download Annual Report"}
        </button>
      </div>
      {errorMessage ? <p style={{ margin: 0, color: "var(--danger)", textAlign: "right" }}>{errorMessage}</p> : null}
    </div>
  );
}

export function InventoryValuationReportButton({ householdId }: InventoryValuationReportButtonProps): JSX.Element {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      setIsDownloading(true);
      await downloadInventoryValuationPdf(householdId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to download the valuation report.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" className="button button--ghost button--sm" onClick={() => { void handleDownload(); }} disabled={isDownloading}>
        {isDownloading ? "Downloading..." : "Valuation Report"}
      </button>
      {errorMessage ? <p style={{ margin: 0, color: "var(--danger)", textAlign: "right" }}>{errorMessage}</p> : null}
    </div>
  );
}