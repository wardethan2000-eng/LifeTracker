"use client";

import type {
  BulkProjectOperationResult,
  BulkTaskOperationResult,
} from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  bulkChangeProjectsStatus,
  bulkCompleteTasks,
  bulkReassignTasks,
  exportHouseholdProjectsCSV,
  importHouseholdProjects,
  type ImportProjectsResult,
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
import type { PortfolioProject } from "./project-portfolio-shared";

// ── Shared helpers ──────────────────────────────────────────────────────────

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

const PROJECT_STATUS_VALUES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;

const readFileAsText = async (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(typeof reader.result === "string" ? reader.result : ""); };
  reader.onerror = () => { reject(reader.error ?? new Error("Unable to read CSV file.")); };
  reader.readAsText(file);
});

const normalizeProjectImportItems = (rows: Array<Record<string, string>>): Array<Record<string, unknown>> =>
  rows.map((row) => {
    const norm = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, ""), v.trim()])
    );
    const out: Record<string, unknown> = {};
    if (norm.name) out.name = norm.name;
    if (norm.status) out.status = norm.status;
    if (norm.description) out.description = norm.description;
    if (norm.startdate) out.startDate = norm.startdate;
    if (norm.targetenddate) out.targetEndDate = norm.targetenddate;
    if (norm.budgetamount) out.budgetAmount = norm.budgetamount;
    if (norm.notes) out.notes = norm.notes;
    return out;
  });

// ── ProjectBulkActions ───────────────────────────────────────────────────────

type ProjectBulkActionsProps = {
  householdId: string;
  selectedItems: PortfolioProject[];
  allItems: PortfolioProject[];
  onBulkComplete?: () => void;
};

export function ProjectBulkActions({
  householdId,
  selectedItems,
  allItems,
  onBulkComplete,
}: ProjectBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportProjectsResult | null>(null);

  const [statusOpen, setStatusOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("active");
  const [statusResult, setStatusResult] = useState<BulkProjectOperationResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusResultTone = useMemo(() => {
    if (!statusResult) return null;
    return statusResult.failed.length > 0 ? "warning" : "success";
  }, [statusResult]);

  const handleExport = async (): Promise<void> => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      const csvText = await exportHouseholdProjectsCSV(householdId);
      generateCSVDownload(csvText, "projects-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export projects CSV.");
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
      const result = await importHouseholdProjects(householdId, normalizeProjectImportItems(parsedRows));
      setImportResult(result);
      if (result.created > 0) router.refresh();
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "Unable to import projects CSV.";
      setErrorMessage(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleStatusChange = async (): Promise<void> => {
    try {
      setIsChangingStatus(true);
      setErrorMessage(null);
      setStatusResult(null);

      const result = await bulkChangeProjectsStatus(
        householdId,
        selectedItems.map((p) => p.id),
        targetStatus
      );
      setStatusResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Updated ${result.succeeded} project${result.succeeded === 1 ? "" : "s"} to ${PROJECT_STATUS_LABELS[targetStatus] ?? targetStatus}.` });
        setStatusOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Updated ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to change project status.";
      setErrorMessage(message);
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <>
      <div className="bulk-action-bar__actions">
        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => void handleExport()}
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
            onClick={() => void handleImport()}
            disabled={!selectedImportFile || isImporting}
          >
            {isImporting ? "Importing…" : "Import"}
          </button>
        </div>

        {importResult ? (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success"}`}>
            <p>Created {importResult.created} project{importResult.created === 1 ? "" : "s"}, skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? "" : "s"}{importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}</p>
            {importResult.errors.length > 0 ? (
              <ul>{importResult.errors.map((e) => <li key={`${e.index}-${e.message}`}>Row {e.index + 2}: {e.message}</li>)}</ul>
            ) : null}
          </div>
        ) : null}

        {selectedItems.length > 0 && (
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => {
              setTargetStatus("active");
              setStatusResult(null);
              setErrorMessage(null);
              setStatusOpen(true);
            }}
          >
            Change Status
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="bulk-action-bar__error">{errorMessage}</p>
      )}

      {/* ── Status Change Dialog ── */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {selectedItems.length} Project{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Select the new status to apply to the selected projects.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <label className="field">
              <span>New Status</span>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                disabled={isChangingStatus}
              >
                {PROJECT_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </label>

            {selectedItems.length > 0 && (
              <ul className="bulk-action-bar__preview-list">
                {selectedItems.slice(0, 10).map((project) => (
                  <li key={project.id}>{project.name}</li>
                ))}
                {selectedItems.length > 10 && (
                  <li>…and {selectedItems.length - 10} more</li>
                )}
              </ul>
            )}

            {statusResult && statusResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${statusResultTone}`}>
                {statusResult.succeeded > 0 && <p>Updated {statusResult.succeeded} project{statusResult.succeeded === 1 ? "" : "s"}.</p>}
                {statusResult.failed.length > 0 && (
                  <ul>
                    {statusResult.failed.map((f) => (
                      <li key={f.projectId}>{f.name ?? f.projectId}: {f.message}</li>
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
              onClick={() => setStatusOpen(false)}
              disabled={isChangingStatus}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleStatusChange()}
              disabled={isChangingStatus || selectedItems.length === 0}
            >
              {isChangingStatus ? "Updating…" : `Update ${selectedItems.length} Project${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── TaskBulkActions ──────────────────────────────────────────────────────────

type TaskItem = {
  id: string;
  title: string;
  status: string;
  phaseId: string | null;
  assignedToId: string | null;
};

type TaskBulkActionsProps = {
  householdId: string;
  projectId: string;
  selectedItems: TaskItem[];
  phases: { id: string; name: string }[];
  onBulkComplete?: () => void;
};

export function TaskBulkActions({
  householdId,
  projectId,
  selectedItems,
  phases,
  onBulkComplete,
}: TaskBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeResult, setCompleteResult] = useState<BulkTaskOperationResult | null>(null);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignPhaseId, setReassignPhaseId] = useState<string>("__keep");
  const [reassignResult, setReassignResult] = useState<BulkTaskOperationResult | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const completeResultTone = useMemo(() => {
    if (!completeResult) return null;
    return completeResult.failed.length > 0 ? "warning" : "success";
  }, [completeResult]);

  const reassignResultTone = useMemo(() => {
    if (!reassignResult) return null;
    return reassignResult.failed.length > 0 ? "warning" : "success";
  }, [reassignResult]);

  const handleComplete = async (): Promise<void> => {
    try {
      setIsCompleting(true);
      setErrorMessage(null);
      setCompleteResult(null);

      const result = await bulkCompleteTasks(
        householdId,
        projectId,
        selectedItems.map((t) => t.id)
      );
      setCompleteResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Completed ${result.succeeded} task${result.succeeded === 1 ? "" : "s"}.` });
        setCompleteOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Completed ${result.succeeded} task${result.succeeded === 1 ? "" : "s"}; ${result.failed.length} failed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to complete tasks.";
      setErrorMessage(message);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleReassign = async (): Promise<void> => {
    try {
      setIsReassigning(true);
      setErrorMessage(null);
      setReassignResult(null);

      const options: { phaseId?: string | null } = {};

      if (reassignPhaseId !== "__keep") {
        options.phaseId = reassignPhaseId === "__unassign" ? null : reassignPhaseId;
      }

      const result = await bulkReassignTasks(
        householdId,
        projectId,
        selectedItems.map((t) => t.id),
        options
      );
      setReassignResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Reassigned ${result.succeeded} task${result.succeeded === 1 ? "" : "s"}.` });
        setReassignOpen(false);
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Reassigned ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Unable to reassign tasks.";
      setErrorMessage(message);
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <>
      <div className="bulk-action-bar__actions">
        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => {
            setCompleteResult(null);
            setErrorMessage(null);
            setCompleteOpen(true);
          }}
          disabled={selectedItems.length === 0}
        >
          Mark Complete
        </button>

        {phases.length > 0 && (
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => {
              setReassignPhaseId("__keep");
              setReassignResult(null);
              setErrorMessage(null);
              setReassignOpen(true);
            }}
            disabled={selectedItems.length === 0}
          >
            Reassign Phase
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="bulk-action-bar__error">{errorMessage}</p>
      )}

      {/* ── Complete Dialog ── */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {selectedItems.length} Task{selectedItems.length === 1 ? "" : "s"} Complete</DialogTitle>
            <DialogDescription>
              This will mark all selected tasks as completed and update the project progress.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            {selectedItems.length > 0 && (
              <ul className="bulk-action-bar__preview-list">
                {selectedItems.slice(0, 10).map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
                {selectedItems.length > 10 && (
                  <li>…and {selectedItems.length - 10} more</li>
                )}
              </ul>
            )}

            {isCompleting && (
              <progress style={{ width: "100%" }} />
            )}

            {completeResult && completeResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${completeResultTone}`}>
                {completeResult.succeeded > 0 && <p>Completed {completeResult.succeeded} task{completeResult.succeeded === 1 ? "" : "s"}.</p>}
                {completeResult.failed.length > 0 && (
                  <ul>
                    {completeResult.failed.map((f) => (
                      <li key={f.taskId}>{f.title ?? f.taskId}: {f.message}</li>
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
              onClick={() => setCompleteOpen(false)}
              disabled={isCompleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleComplete()}
              disabled={isCompleting || selectedItems.length === 0}
            >
              {isCompleting ? "Marking Complete…" : `Complete ${selectedItems.length} Task${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reassign Phase Dialog ── */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Phase for {selectedItems.length} Task{selectedItems.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Move all selected tasks to a different phase.
            </DialogDescription>
          </DialogHeader>

          <div className="workbench-section">
            <label className="field">
              <span>Target Phase</span>
              <select
                value={reassignPhaseId}
                onChange={(e) => setReassignPhaseId(e.target.value)}
                disabled={isReassigning}
              >
                <option value="__keep">Keep current phase</option>
                <option value="__unassign">No phase (unphased)</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </select>
            </label>

            {selectedItems.length > 0 && (
              <ul className="bulk-action-bar__preview-list">
                {selectedItems.slice(0, 10).map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
                {selectedItems.length > 10 && (
                  <li>…and {selectedItems.length - 10} more</li>
                )}
              </ul>
            )}

            {isReassigning && (
              <progress style={{ width: "100%" }} />
            )}

            {reassignResult && reassignResultTone && (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${reassignResultTone}`}>
                {reassignResult.succeeded > 0 && <p>Reassigned {reassignResult.succeeded} task{reassignResult.succeeded === 1 ? "" : "s"}.</p>}
                {reassignResult.failed.length > 0 && (
                  <ul>
                    {reassignResult.failed.map((f) => (
                      <li key={f.taskId}>{f.title ?? f.taskId}: {f.message}</li>
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
              onClick={() => setReassignOpen(false)}
              disabled={isReassigning}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void handleReassign()}
              disabled={isReassigning || reassignPhaseId === "__keep" || selectedItems.length === 0}
            >
              {isReassigning ? "Reassigning…" : `Reassign ${selectedItems.length} Task${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
