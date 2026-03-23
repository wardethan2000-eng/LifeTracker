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
} from "../lib/api";
import { useToast } from "./toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

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
