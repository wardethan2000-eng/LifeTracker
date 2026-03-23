"use client";

import type { BulkScheduleOperationResult, DueWorkItem } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  bulkCompleteSchedules,
  bulkPauseSchedules,
  bulkSnoozeSchedules,
  exportHouseholdSchedulesCSV,
  importHouseholdSchedules,
  type ImportSchedulesResult,
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

const readFileAsText = async (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(typeof reader.result === "string" ? reader.result : ""); };
  reader.onerror = () => { reject(reader.error ?? new Error("Unable to read CSV file.")); };
  reader.readAsText(file);
});

const normalizeScheduleImportItems = (rows: Array<Record<string, string>>): Array<Record<string, unknown>> =>
  rows.map((row) => {
    const norm = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, ""), v.trim()])
    );
    const out: Record<string, unknown> = {};
    if (norm.assetid) out.assetId = norm.assetid;
    if (norm.name) out.name = norm.name;
    if (norm.description) out.description = norm.description;
    if (norm.intervaldays) out.intervalDays = norm.intervaldays;
    if (norm.estimatedcost) out.estimatedCost = norm.estimatedcost;
    if (norm.estimatedminutes) out.estimatedMinutes = norm.estimatedminutes;
    return out;
  });

type MaintenanceBulkActionsProps = {
  householdId: string;
  selectedItems: DueWorkItem[];
  onBulkComplete?: () => void;
};

const SNOOZE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

export function MaintenanceBulkActions({
  householdId,
  selectedItems,
  onBulkComplete,
}: MaintenanceBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const scheduleIds = selectedItems.map((item) => item.scheduleId);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeResult, setCompleteResult] = useState<BulkScheduleOperationResult | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSchedulesResult | null>(null);

  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [isSnoozeing, setIsSnoozeing] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(14);
  const [snoozeResult, setSnoozeResult] = useState<BulkScheduleOperationResult | null>(null);

  const [pauseOpen, setPauseOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseResult, setPauseResult] = useState<BulkScheduleOperationResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const completeResultTone = useMemo(() => {
    if (!completeResult) return null;
    return completeResult.failed.length > 0 ? "warning" : "success";
  }, [completeResult]);

  const snoozeResultTone = useMemo(() => {
    if (!snoozeResult) return null;
    return snoozeResult.failed.length > 0 ? "warning" : "success";
  }, [snoozeResult]);

  const pauseResultTone = useMemo(() => {
    if (!pauseResult) return null;
    return pauseResult.failed.length > 0 ? "warning" : "success";
  }, [pauseResult]);

  const handleComplete = async (): Promise<void> => {
    try {
      setIsCompleting(true);
      setErrorMessage(null);
      setCompleteResult(null);

      const result = await bulkCompleteSchedules(
        householdId,
        scheduleIds,
        completeNotes.trim() || undefined
      );
      setCompleteResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Completed ${result.succeeded} schedule${result.succeeded === 1 ? "" : "s"}.` });
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Completed ${result.succeeded} schedule${result.succeeded === 1 ? "" : "s"}; ${result.failed.length} failed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to complete schedules.";
      setErrorMessage(message);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSnooze = async (): Promise<void> => {
    try {
      setIsSnoozeing(true);
      setErrorMessage(null);
      setSnoozeResult(null);

      const result = await bulkSnoozeSchedules(householdId, scheduleIds, snoozeDays);
      setSnoozeResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Snoozed ${result.succeeded} schedule${result.succeeded === 1 ? "" : "s"} for ${snoozeDays} days.` });
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Snoozed ${result.succeeded - result.failed.length > 0 ? result.succeeded : 0}; ${result.failed.length} could not be snoozed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to snooze schedules.";
      setErrorMessage(message);
    } finally {
      setIsSnoozeing(false);
    }
  };

  const handlePause = async (): Promise<void> => {
    try {
      setIsPausing(true);
      setErrorMessage(null);
      setPauseResult(null);

      const result = await bulkPauseSchedules(householdId, scheduleIds);
      setPauseResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Paused ${result.succeeded} schedule${result.succeeded === 1 ? "" : "s"}.` });
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Paused ${result.succeeded} schedule${result.succeeded === 1 ? "" : "s"}; ${result.failed.length} failed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to pause schedules.";
      setErrorMessage(message);
    } finally {
      setIsPausing(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      const csvText = await exportHouseholdSchedulesCSV(householdId);
      generateCSVDownload(csvText, "schedules-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export schedules CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!selectedImportFile) return;
    try {
      setIsImporting(true);
      setErrorMessage(null);
      setImportResult(null);
      const fileText = await readFileAsText(selectedImportFile);
      const parsedRows = parseCSV(fileText);
      if (parsedRows.length === 0) throw new Error("The CSV file does not contain any rows.");
      const result = await importHouseholdSchedules(householdId, normalizeScheduleImportItems(parsedRows));
      setImportResult(result);
      if (result.created > 0) router.refresh();
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "Unable to import schedules CSV.";
      setErrorMessage(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="inventory-bulk-actions">
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => {
            setCompleteNotes("");
            setCompleteResult(null);
            setCompleteOpen(true);
          }}
          disabled={selectedItems.length === 0}
        >
          Mark Complete
        </button>
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => {
            setSnoozeResult(null);
            setSnoozeOpen(true);
          }}
          disabled={selectedItems.length === 0}
        >
          Snooze
        </button>
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => {
            setPauseResult(null);
            setPauseOpen(true);
          }}
          disabled={selectedItems.length === 0}
        >
          Pause
        </button>
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => { void handleExport(); }}
          disabled={isExporting}
        >
          {isExporting ? "Exporting..." : "Export CSV"}
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
            className="button button--secondary button--sm"
            onClick={() => { void handleImport(); }}
            disabled={!selectedImportFile || isImporting}
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>

        {importResult ? (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success"}`}>
            <p>Created {importResult.created} schedule{importResult.created === 1 ? "" : "s"}, skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? "" : "s"}{importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}</p>
            {importResult.errors.length > 0 ? (
              <ul>{importResult.errors.map((e) => <li key={`${e.index}-${e.message}`}>Row {e.index + 2}: {e.message}</li>)}</ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Complete Dialog ── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {selectedItems.length} schedule{selectedItems.length === 1 ? "" : "s"} complete</DialogTitle>
            <DialogDescription>
              This will log a completion entry for each selected schedule, timestamped to now.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", maxHeight: 160, overflowY: "auto" }}>
              {selectedItems.slice(0, 10).map((item) => (
                <li key={item.scheduleId}>{item.scheduleName} — {item.assetName}</li>
              ))}
              {selectedItems.length > 10 && (
                <li style={{ color: "var(--ink-muted)" }}>…and {selectedItems.length - 10} more</li>
              )}
            </ul>

            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={completeNotes}
                onChange={(e) => { setCompleteNotes(e.target.value); }}
                placeholder="Add a note for all completions…"
              />
            </label>

            {isCompleting && (
              <div>
                <progress style={{ width: "100%" }} />
              </div>
            )}

            {errorMessage && (
              <p className="inventory-bulk-actions__result inventory-bulk-actions__result--warning">{errorMessage}</p>
            )}

            {completeResult && completeResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${completeResultTone}`}>
                <p>
                  {completeResult.succeeded} completed
                  {completeResult.failed.length > 0 && `, ${completeResult.failed.length} failed`}.
                </p>
                {completeResult.failed.length > 0 && (
                  <ul>
                    {completeResult.failed.map((f) => (
                      <li key={f.scheduleId}>{f.name ?? f.scheduleId}: {f.message}</li>
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
              onClick={() => { setCompleteOpen(false); }}
            >
              {completeResult ? "Close" : "Cancel"}
            </button>
            {!completeResult && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => { void handleComplete(); }}
                disabled={isCompleting}
              >
                {isCompleting ? "Completing…" : `Complete ${selectedItems.length} schedule${selectedItems.length === 1 ? "" : "s"}`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Snooze Dialog ── */}
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze {selectedItems.length} schedule{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Push the due date forward for each selected schedule. Only works for interval-based schedules.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <label className="field">
              <span>Snooze duration</span>
              <select
                value={snoozeDays}
                onChange={(e) => { setSnoozeDays(Number(e.target.value)); }}
              >
                {SNOOZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            {isSnoozeing && (
              <div>
                <progress style={{ width: "100%" }} />
              </div>
            )}

            {errorMessage && (
              <p className="inventory-bulk-actions__result inventory-bulk-actions__result--warning">{errorMessage}</p>
            )}

            {snoozeResult && snoozeResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${snoozeResultTone}`}>
                <p>
                  {snoozeResult.succeeded} snoozed
                  {snoozeResult.failed.length > 0 && `, ${snoozeResult.failed.length} could not be snoozed`}.
                </p>
                {snoozeResult.failed.length > 0 && (
                  <ul>
                    {snoozeResult.failed.map((f) => (
                      <li key={f.scheduleId}>{f.name ?? f.scheduleId}: {f.message}</li>
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
              onClick={() => { setSnoozeOpen(false); }}
            >
              {snoozeResult ? "Close" : "Cancel"}
            </button>
            {!snoozeResult && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => { void handleSnooze(); }}
                disabled={isSnoozeing}
              >
                {isSnoozeing ? "Snoozing…" : `Snooze ${snoozeDays} days`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pause Dialog ── */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause {selectedItems.length} schedule{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Paused schedules stop generating due notifications. You can re-enable them individually from each asset.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", maxHeight: 160, overflowY: "auto" }}>
              {selectedItems.slice(0, 10).map((item) => (
                <li key={item.scheduleId}>{item.scheduleName} — {item.assetName}</li>
              ))}
              {selectedItems.length > 10 && (
                <li style={{ color: "var(--ink-muted)" }}>…and {selectedItems.length - 10} more</li>
              )}
            </ul>

            {isPausing && (
              <div>
                <progress style={{ width: "100%" }} />
              </div>
            )}

            {errorMessage && (
              <p className="inventory-bulk-actions__result inventory-bulk-actions__result--warning">{errorMessage}</p>
            )}

            {pauseResult && pauseResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${pauseResultTone}`}>
                <p>
                  {pauseResult.succeeded} paused
                  {pauseResult.failed.length > 0 && `, ${pauseResult.failed.length} failed`}.
                </p>
                {pauseResult.failed.length > 0 && (
                  <ul>
                    {pauseResult.failed.map((f) => (
                      <li key={f.scheduleId}>{f.name ?? f.scheduleId}: {f.message}</li>
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
              onClick={() => { setPauseOpen(false); }}
            >
              {pauseResult ? "Close" : "Cancel"}
            </button>
            {!pauseResult && (
              <button
                type="button"
                className="button button--danger button--sm"
                onClick={() => { void handlePause(); }}
                disabled={isPausing}
              >
                {isPausing ? "Pausing…" : `Pause ${selectedItems.length} schedule${selectedItems.length === 1 ? "" : "s"}`}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
