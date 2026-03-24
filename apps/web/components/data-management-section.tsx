"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "../app/actions";
import { downloadHouseholdJson } from "../lib/api";

interface DataManagementSectionProps {
  householdId: string;
}

export function DataManagementSection({ householdId }: DataManagementSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      await downloadHouseholdJson(householdId);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      await deleteAccountAction();
    });
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <h3 style={{ margin: "0 0 6px 0" }}>Export household data</h3>
        <p style={{ margin: "0 0 12px 0", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
          Download a complete JSON archive of all assets, schedules, logs, and household data.
        </p>
        <button
          type="button"
          className="button button--ghost"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? "Exporting…" : "Export all data"}
        </button>
        {exportError && (
          <p style={{ marginTop: "8px", color: "var(--danger)", fontSize: "0.88rem" }} role="alert">
            {exportError}
          </p>
        )}
      </div>

      <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        <h3 style={{ margin: "0 0 6px 0", color: "var(--danger)" }}>Delete account</h3>
        <p style={{ margin: "0 0 12px 0", color: "var(--ink-muted)", fontSize: "0.9rem" }}>
          Permanently deletes your account and any households where you are the only member.
          This action cannot be undone.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            className="button button--danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--danger)" }}>
              Are you sure? This cannot be undone.
            </p>
            <button
              type="button"
              className="button button--danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
