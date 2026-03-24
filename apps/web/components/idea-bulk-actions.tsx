"use client";

import type { BulkIdeaOperationResult, IdeaPriority, IdeaStage, IdeaSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  bulkArchiveIdeas,
  bulkDeleteIdeas,
  bulkMoveIdeas,
  bulkSetIdeaPriority,
  exportHouseholdIdeasCSV,
  importHouseholdIdeas,
  type ImportIdeasResult,
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

const STAGE_LABELS: Record<IdeaStage, string> = {
  spark: "Spark",
  developing: "Developing",
  ready: "Ready"
};

const PRIORITY_LABELS: Record<IdeaPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High"
};

const STAGE_VALUES: IdeaStage[] = ["spark", "developing", "ready"];
const PRIORITY_VALUES: IdeaPriority[] = ["low", "medium", "high"];

const readFileAsText = async (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(typeof reader.result === "string" ? reader.result : ""); };
  reader.onerror = () => { reject(reader.error ?? new Error("Unable to read CSV file.")); };
  reader.readAsText(file);
});

const normalizeIdeaImportItems = (rows: Array<Record<string, string>>): Array<Record<string, unknown>> =>
  rows.map((row) => {
    const norm = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, ""), v.trim()])
    );
    const out: Record<string, unknown> = {};
    if (norm.title) out.title = norm.title;
    if (norm.description) out.description = norm.description;
    if (norm.stage) out.stage = norm.stage;
    if (norm.priority) out.priority = norm.priority;
    if (norm.category) out.category = norm.category;
    return out;
  });

type IdeaBulkActionsProps = {
  householdId: string;
  selectedItems: IdeaSummary[];
  onBulkComplete?: () => void;
};

export function IdeaBulkActions({
  householdId,
  selectedItems,
  onBulkComplete,
}: IdeaBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  const [stageOpen, setStageOpen] = useState(false);
  const [isMovingStage, setIsMovingStage] = useState(false);
  const [targetStage, setTargetStage] = useState<IdeaStage>("developing");
  const [stageResult, setStageResult] = useState<BulkIdeaOperationResult | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<BulkIdeaOperationResult | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<BulkIdeaOperationResult | null>(null);

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [isSettingPriority, setIsSettingPriority] = useState(false);
  const [targetPriority, setTargetPriority] = useState<IdeaPriority>("medium");
  const [priorityResult, setPriorityResult] = useState<BulkIdeaOperationResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportIdeasResult | null>(null);

  const stageResultTone = useMemo(() => {
    if (!stageResult) return null;
    return stageResult.failed.length > 0 ? "warning" : "success";
  }, [stageResult]);

  const archiveResultTone = useMemo(() => {
    if (!archiveResult) return null;
    return archiveResult.failed.length > 0 ? "warning" : "success";
  }, [archiveResult]);

  const deleteResultTone = useMemo(() => {
    if (!deleteResult) return null;
    return deleteResult.failed.length > 0 ? "warning" : "success";
  }, [deleteResult]);

  const priorityResultTone = useMemo(() => {
    if (!priorityResult) return null;
    return priorityResult.failed.length > 0 ? "warning" : "success";
  }, [priorityResult]);

  const handleMoveStage = async (): Promise<void> => {
    try {
      setIsMovingStage(true);
      setErrorMessage(null);
      setStageResult(null);

      const result = await bulkMoveIdeas(
        householdId,
        selectedItems.map((i) => i.id),
        targetStage
      );
      setStageResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Moved ${result.succeeded} idea${result.succeeded === 1 ? "" : "s"} to ${STAGE_LABELS[targetStage]}.` });
        setStageOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Moved ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to move ideas."
      );
    } finally {
      setIsMovingStage(false);
    }
  };

  const handleArchive = async (): Promise<void> => {
    try {
      setIsArchiving(true);
      setErrorMessage(null);
      setArchiveResult(null);

      const result = await bulkArchiveIdeas(
        householdId,
        selectedItems.map((i) => i.id)
      );
      setArchiveResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Archived ${result.succeeded} idea${result.succeeded === 1 ? "" : "s"}.` });
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
          : "Unable to archive ideas."
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handlePermanentDelete = async (): Promise<void> => {
    try {
      setIsDeleting(true);
      setErrorMessage(null);
      setDeleteResult(null);

      const result = await bulkDeleteIdeas(
        householdId,
        selectedItems.map((i) => i.id)
      );
      setDeleteResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Permanently deleted ${result.succeeded} idea${result.succeeded === 1 ? "" : "s"}.` });
        setDeleteOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Deleted ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to delete ideas."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPriority = async (): Promise<void> => {
    try {
      setIsSettingPriority(true);
      setErrorMessage(null);
      setPriorityResult(null);

      const result = await bulkSetIdeaPriority(
        householdId,
        selectedItems.map((i) => i.id),
        targetPriority
      );
      setPriorityResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Set ${result.succeeded} idea${result.succeeded === 1 ? "" : "s"} to ${PRIORITY_LABELS[targetPriority]} priority.` });
        setPriorityOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Updated ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to set priority."
      );
    } finally {
      setIsSettingPriority(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      const csvText = await exportHouseholdIdeasCSV(householdId);
      generateCSVDownload(csvText, "ideas-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export ideas CSV.");
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
      const result = await importHouseholdIdeas(householdId, normalizeIdeaImportItems(parsedRows));
      setImportResult(result);
      if (result.created > 0) router.refresh();
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "Unable to import ideas CSV.";
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
          disabled={selectedItems.length === 0}
          onClick={() => { setStageResult(null); setErrorMessage(null); setStageOpen(true); }}
        >
          Move Stage
        </button>
        <button
          type="button"
          className="button button--sm button--ghost"
          disabled={selectedItems.length === 0}
          onClick={() => { setPriorityResult(null); setErrorMessage(null); setPriorityOpen(true); }}
        >
          Set Priority
        </button>
        <button
          type="button"
          className="button button--sm button--ghost button--danger"
          disabled={selectedItems.length === 0}
          onClick={() => { setArchiveResult(null); setErrorMessage(null); setArchiveOpen(true); }}
        >
          Archive
        </button>
        <button
          type="button"
          className="button button--sm button--ghost button--danger"
          disabled={selectedItems.length === 0}
          onClick={() => { setDeleteResult(null); setErrorMessage(null); setDeleteOpen(true); }}
        >
          Delete Permanently
        </button>

        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => { void handleExport(); }}
          disabled={isExporting}
        >
          {isExporting ? "Exporting…" : "Export CSV"}
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
            {isImporting ? "Importing…" : "Import"}
          </button>
        </div>

        {importResult ? (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success"}`}>
            <p>Created {importResult.created} idea{importResult.created === 1 ? "" : "s"}, skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? "" : "s"}{importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}</p>
            {importResult.errors.length > 0 ? (
              <ul>{importResult.errors.map((e) => <li key={`${e.index}-${e.message}`}>Row {e.index + 2}: {e.message}</li>)}</ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {errorMessage && <p className="bulk-action-bar__error">{errorMessage}</p>}

      {/* ── Move Stage Dialog ── */}
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedItems.length} Idea{selectedItems.length === 1 ? "" : "s"} to Stage</DialogTitle>
            <DialogDescription>
              Select the target stage to apply to all selected ideas.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <label className="field">
              <span>Target Stage</span>
              <select
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as IdeaStage)}
                disabled={isMovingStage}
              >
                {STAGE_VALUES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </label>

            <ul className="bulk-action-bar__preview-list">
              {selectedItems.slice(0, 10).map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
              {selectedItems.length > 10 && <li>…and {selectedItems.length - 10} more</li>}
            </ul>

            {stageResult && stageResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${stageResultTone}`}>
                {stageResult.succeeded > 0 && <p>Moved {stageResult.succeeded} idea{stageResult.succeeded === 1 ? "" : "s"}.</p>}
                {stageResult.failed.length > 0 && (
                  <ul>
                    {stageResult.failed.map((f) => (
                      <li key={f.ideaId}>{f.title ?? f.ideaId}: {f.message}</li>
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
              onClick={() => setStageOpen(false)}
              disabled={isMovingStage}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleMoveStage()}
              disabled={isMovingStage || selectedItems.length === 0}
            >
              {isMovingStage ? "Moving…" : `Move ${selectedItems.length} Idea${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive Dialog ── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {selectedItems.length} Idea{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Archived ideas are hidden from the board but not permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <ul className="bulk-action-bar__preview-list">
              {selectedItems.slice(0, 10).map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
              {selectedItems.length > 10 && <li>…and {selectedItems.length - 10} more</li>}
            </ul>

            {archiveResult && archiveResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${archiveResultTone}`}>
                {archiveResult.succeeded > 0 && <p>Archived {archiveResult.succeeded} idea{archiveResult.succeeded === 1 ? "" : "s"}.</p>}
                {archiveResult.failed.length > 0 && (
                  <ul>
                    {archiveResult.failed.map((f) => (
                      <li key={f.ideaId}>{f.title ?? f.ideaId}: {f.message}</li>
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
              {isArchiving ? "Archiving…" : `Archive ${selectedItems.length} Idea${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permanent Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete {selectedItems.length} Idea{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              This cannot be undone. Deleted ideas are gone permanently and cannot be recovered.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <ul className="bulk-action-bar__preview-list">
              {selectedItems.slice(0, 10).map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
              {selectedItems.length > 10 && <li>…and {selectedItems.length - 10} more</li>}
            </ul>

            {deleteResult && deleteResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${deleteResultTone}`}>
                {deleteResult.succeeded > 0 && <p>Deleted {deleteResult.succeeded} idea{deleteResult.succeeded === 1 ? "" : "s"}.</p>}
                {deleteResult.failed.length > 0 && (
                  <ul>
                    {deleteResult.failed.map((f) => (
                      <li key={f.ideaId}>{f.title ?? f.ideaId}: {f.message}</li>
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
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void handlePermanentDelete()}
              disabled={isDeleting || selectedItems.length === 0}
            >
              {isDeleting ? "Deleting…" : `Delete ${selectedItems.length} Idea${selectedItems.length === 1 ? "" : "s"} Permanently`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Priority Dialog ── */}
      <Dialog open={priorityOpen} onOpenChange={setPriorityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Priority for {selectedItems.length} Idea{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Applies the selected priority to all chosen ideas at once.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <label className="field">
              <span>Priority</span>
              <select
                value={targetPriority}
                onChange={(e) => setTargetPriority(e.target.value as IdeaPriority)}
                disabled={isSettingPriority}
              >
                {PRIORITY_VALUES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </label>

            <ul className="bulk-action-bar__preview-list">
              {selectedItems.slice(0, 10).map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
              {selectedItems.length > 10 && <li>…and {selectedItems.length - 10} more</li>}
            </ul>

            {priorityResult && priorityResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${priorityResultTone}`}>
                {priorityResult.succeeded > 0 && <p>Updated {priorityResult.succeeded} idea{priorityResult.succeeded === 1 ? "" : "s"}.</p>}
                {priorityResult.failed.length > 0 && (
                  <ul>
                    {priorityResult.failed.map((f) => (
                      <li key={f.ideaId}>{f.title ?? f.ideaId}: {f.message}</li>
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
              onClick={() => setPriorityOpen(false)}
              disabled={isSettingPriority}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleSetPriority()}
              disabled={isSettingPriority || selectedItems.length === 0}
            >
              {isSettingPriority ? "Updating…" : `Update ${selectedItems.length} Idea${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
