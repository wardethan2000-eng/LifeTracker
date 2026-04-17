"use client";

import type { BulkHobbySessionOperationResult, HobbySessionSummary } from "@aegis/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  bulkArchiveHobbySessions,
  bulkLogHobbySessions,
  exportHouseholdHobbiesCSV,
  importHouseholdHobbies,
  type ImportHobbiesResult,
} from "../lib/api";
import { generateCSVDownload, parseCSV } from "../lib/csv";
import { useToast } from "./toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type HobbyBulkActionsProps = {
  householdId: string;
  hobbyId: string;
  selectedItems: HobbySessionSummary[];
  onBulkComplete?: () => void;
};

export function HobbyBulkActions({
  householdId,
  hobbyId,
  selectedItems,
  onBulkComplete,
}: HobbyBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  // Bulk Log dialog state
  const [logOpen, setLogOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logResult, setLogResult] = useState<BulkHobbySessionOperationResult | null>(null);
  const [logCount, setLogCount] = useState(1);
  const [logBaseName, setLogBaseName] = useState("Practice session");
  const [logDuration, setLogDuration] = useState("");
  const [logNotes, setLogNotes] = useState("");

  // Bulk Archive dialog state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<BulkHobbySessionOperationResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportHobbiesResult | null>(null);

  const logResultTone = useMemo(() => {
    if (!logResult) return null;
    return logResult.failed.length > 0 ? "warning" : "success";
  }, [logResult]);

  const archiveResultTone = useMemo(() => {
    if (!archiveResult) return null;
    return archiveResult.failed.length > 0 ? "warning" : "success";
  }, [archiveResult]);

  const handleLogSessions = async (): Promise<void> => {
    try {
      setIsLogging(true);
      setErrorMessage(null);
      setLogResult(null);

      const durationMinutes = logDuration.trim() !== "" ? parseInt(logDuration, 10) : null;
      const notes = logNotes.trim() !== "" ? logNotes.trim() : null;
      const parsedDuration = durationMinutes !== null && !Number.isNaN(durationMinutes) ? durationMinutes : null;
      const sessions = Array.from({ length: logCount }, (_, i) => ({
        name: logCount === 1 ? logBaseName : `${logBaseName} ${i + 1}`,
        durationMinutes: parsedDuration,
        notes: notes,
      }));

      const result = await bulkLogHobbySessions(householdId, hobbyId, sessions);
      setLogResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Logged ${result.succeeded} session${result.succeeded === 1 ? "" : "s"}.` });
        setLogOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Logged ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to log sessions."
      );
    } finally {
      setIsLogging(false);
    }
  };

  const handleArchive = async (): Promise<void> => {
    try {
      setIsArchiving(true);
      setErrorMessage(null);
      setArchiveResult(null);

      const result = await bulkArchiveHobbySessions(
        householdId,
        hobbyId,
        selectedItems.map((s) => s.id)
      );
      setArchiveResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Archived ${result.succeeded} session${result.succeeded === 1 ? "" : "s"}.` });
        setArchiveOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Archived ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to archive sessions."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      const csvText = await exportHouseholdHobbiesCSV(householdId);
      generateCSVDownload(csvText, "hobbies-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export hobbies CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const readFileAsText = async (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve(typeof reader.result === "string" ? reader.result : ""); };
    reader.onerror = () => { reject(reader.error ?? new Error("Unable to read CSV file.")); };
    reader.readAsText(file);
  });

  const normalizeHobbyImportItems = (rows: Array<Record<string, string>>): Array<Record<string, unknown>> =>
    rows.map((row) => {
      const norm = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, ""), v.trim()])
      );
      const out: Record<string, unknown> = {};
      if (norm.name) out.name = norm.name;
      if (norm.status) out.status = norm.status;
      if (norm.activitymode) out.activityMode = norm.activitymode;
      if (norm.hobbytype) out.hobbyType = norm.hobbytype;
      if (norm.description) out.description = norm.description;
      if (norm.notes) out.notes = norm.notes;
      return out;
    });

  const handleImport = async (): Promise<void> => {
    if (!selectedImportFile) return;
    try {
      setIsImporting(true);
      setErrorMessage(null);
      setImportResult(null);
      const fileText = await readFileAsText(selectedImportFile);
      const parsedRows = parseCSV(fileText);
      if (parsedRows.length === 0) throw new Error("The CSV file does not contain any rows.");
      const result = await importHouseholdHobbies(householdId, normalizeHobbyImportItems(parsedRows));
      setImportResult(result);
      if (result.created > 0) router.refresh();
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "Unable to import hobbies CSV.";
      setErrorMessage(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="bulk-action-bar__actions">
        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => { setLogResult(null); setErrorMessage(null); setLogOpen(true); }}
        >
          Log Sessions
        </button>
        <button
          type="button"
          className="button button--sm button--ghost button--danger"
          disabled={selectedItems.length === 0}
          onClick={() => { setArchiveResult(null); setErrorMessage(null); setArchiveOpen(true); }}
        >
          Archive Selected
        </button>

        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => { void handleExport(); }}
          disabled={isExporting}
        >
          {isExporting ? "Exporting…" : "Export Hobbies CSV"}
        </button>

        <div className="inventory-bulk-actions__import">
          <input
            className="inventory-bulk-actions__file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setSelectedImportFile(event.target.files?.[0] ?? null);
              setErrorMessage(null);
              setImportResult(null);
            }}
          />
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => { void handleImport(); }}
            disabled={!selectedImportFile || isImporting}
          >
            {isImporting ? "Importing…" : "Import Hobbies"}
          </button>
        </div>

        {importResult ? (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success"}`}>
            <p>Created {importResult.created} hobb{importResult.created === 1 ? "y" : "ies"}, skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? "" : "s"}{importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}</p>
            {importResult.errors.length > 0 ? (
              <ul>{importResult.errors.map((e) => <li key={`${e.index}-${e.message}`}>Row {e.index + 2}: {e.message}</li>)}</ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {errorMessage && <p className="bulk-action-bar__error">{errorMessage}</p>}

      {/* ── Bulk Log Dialog ── */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Multiple Sessions</DialogTitle>
            <DialogDescription>
              Quickly log one or more completed sessions for this hobby.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <div className="workbench-grid">
              <label className="field">
                <span>Number of Sessions</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={logCount}
                  onChange={(e) => setLogCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                  disabled={isLogging}
                />
              </label>

              <label className="field">
                <span>Session Name{logCount > 1 ? " (base)" : ""}</span>
                <input
                  type="text"
                  value={logBaseName}
                  onChange={(e) => setLogBaseName(e.target.value)}
                  maxLength={200}
                  placeholder="Practice session"
                  disabled={isLogging}
                />
              </label>

              <label className="field">
                <span>Duration (minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={logDuration}
                  onChange={(e) => setLogDuration(e.target.value)}
                  placeholder="Optional"
                  disabled={isLogging}
                />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                maxLength={2000}
                placeholder="Optional notes for all sessions"
                rows={3}
                disabled={isLogging}
              />
            </label>

            {logResult && logResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${logResultTone}`}>
                {logResult.succeeded > 0 && <p>Logged {logResult.succeeded} session{logResult.succeeded === 1 ? "" : "s"}.</p>}
                {logResult.failed.length > 0 && (
                  <ul>
                    {logResult.failed.map((f, i) => (
                      <li key={f.id ?? i}>{f.label ?? "(unknown)"}: {f.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setLogOpen(false)}
              disabled={isLogging}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleLogSessions()}
              disabled={isLogging || logBaseName.trim().length === 0}
            >
              {isLogging ? "Logging…" : `Log ${logCount} Session${logCount === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive Dialog ── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {selectedItems.length} Session{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Archived sessions are hidden from the session list but their data is preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <ul className="bulk-action-bar__preview-list">
              {selectedItems.slice(0, 10).map((session) => (
                <li key={session.id}>{session.name}</li>
              ))}
              {selectedItems.length > 10 && <li>…and {selectedItems.length - 10} more</li>}
            </ul>

            {archiveResult && archiveResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${archiveResultTone}`}>
                {archiveResult.succeeded > 0 && <p>Archived {archiveResult.succeeded} session{archiveResult.succeeded === 1 ? "" : "s"}.</p>}
                {archiveResult.failed.length > 0 && (
                  <ul>
                    {archiveResult.failed.map((f, i) => (
                      <li key={f.id ?? i}>{f.label ?? "(unknown)"}: {f.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setArchiveOpen(false)}
              disabled={isArchiving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void handleArchive()}
              disabled={isArchiving || selectedItems.length === 0}
            >
              {isArchiving ? "Archiving…" : `Archive ${selectedItems.length} Session${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
