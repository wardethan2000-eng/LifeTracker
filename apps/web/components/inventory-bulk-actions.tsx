"use client";

import type { InventoryItemSummary, SpaceResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { addItemToSpace } from "../app/actions";
import {
  ApiError,
  bulkDeleteInventoryItems,
  exportHouseholdInventory,
  importHouseholdInventory,
  type ImportInventoryResult
} from "../lib/api";
import { generateCSVDownload, parseCSV } from "../lib/csv";
import { InlineError } from "./inline-error";
import { SpacePickerField } from "./space-picker-field";
import { useToast } from "./toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useCoalescedRefresh } from "./use-coalesced-refresh";

type InventoryBulkActionsProps = {
  householdId: string;
  selectedItems: InventoryItemSummary[];
  spaces: SpaceResponse[];
  onBulkAssigned?: () => void;
};

type AssignResult = {
  completed: number;
  failed: Array<{ itemName: string; message: string }>;
  spaceName: string;
};

const expectedFields = [
  "name",
  "itemtype",
  "partnumber",
  "description",
  "category",
  "manufacturer",
  "quantityonhand",
  "unit",
  "reorderthreshold",
  "reorderquantity",
  "preferredsupplier",
  "supplierurl",
  "unitcost",
  "storagelocation",
  "conditionstatus",
  "notes"
] as const;

const readFileAsText = async (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    resolve(typeof reader.result === "string" ? reader.result : "");
  };

  reader.onerror = () => {
    reject(reader.error ?? new Error("Unable to read CSV file."));
  };

  reader.readAsText(file);
});

const normalizeImportItems = (rows: Array<Record<string, string>>): Array<Record<string, unknown>> => rows.map((row) => {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase().replace(/\s+/g, ""),
    value.trim()
  ] as const);

  const normalizedRow = normalizedEntries.reduce<Record<string, string>>((record, [key, value]) => {
    record[key] = value;
    return record;
  }, {});

  return expectedFields.reduce<Record<string, unknown>>((record, field) => {
    const rawValue = normalizedRow[field] ?? "";

    if (rawValue === "") {
      return record;
    }

    switch (field) {
      case "itemtype":
        record.itemType = rawValue;
        break;
      case "partnumber":
        record.partNumber = rawValue;
        break;
      case "quantityonhand":
        record.quantityOnHand = rawValue;
        break;
      case "reorderthreshold":
        record.reorderThreshold = rawValue;
        break;
      case "reorderquantity":
        record.reorderQuantity = rawValue;
        break;
      case "preferredsupplier":
        record.preferredSupplier = rawValue;
        break;
      case "supplierurl":
        record.supplierUrl = rawValue;
        break;
      case "unitcost":
        record.unitCost = rawValue;
        break;
      case "storagelocation":
        record.storageLocation = rawValue;
        break;
      case "conditionstatus":
        record.conditionStatus = rawValue;
        break;
      default:
        record[field] = rawValue;
        break;
    }

    return record;
  }, {});
});

export function InventoryBulkActions({ householdId, selectedItems, spaces, onBulkAssigned }: InventoryBulkActionsProps): JSX.Element {
  const requestRefresh = useCoalescedRefresh();
  const { pushToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignProgress, setAssignProgress] = useState<{ completed: number; total: number } | null>(null);
  const [assignResult, setAssignResult] = useState<AssignResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportInventoryResult | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resultTone = useMemo(() => {
    if (!importResult) {
      return null;
    }

    return importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success";
  }, [importResult]);

  const assignResultTone = useMemo(() => {
    if (!assignResult) {
      return null;
    }

    return assignResult.failed.length > 0 ? "warning" : "success";
  }, [assignResult]);

  const handleExport = async (): Promise<void> => {
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const csvText = await exportHouseholdInventory(householdId);
      generateCSVDownload(csvText, "inventory-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export inventory CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!selectedFile) {
      return;
    }

    try {
      setIsImporting(true);
      setErrorMessage(null);
      setImportResult(null);

      const fileText = await readFileAsText(selectedFile);
      const parsedRows = parseCSV(fileText);

      if (parsedRows.length === 0) {
        throw new Error("The selected CSV file does not contain any inventory rows.");
      }

      const result = await importHouseholdInventory(householdId, normalizeImportItems(parsedRows));
      setImportResult(result);

      if (result.created > 0) {
        requestRefresh();
      }
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : "Unable to import inventory CSV.";
      setErrorMessage(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAssign = async (): Promise<void> => {
    if (!selectedSpaceId) {
      setErrorMessage("Choose a destination space.");
      return;
    }

    const destinationSpace = spaces.flatMap((space) => [space, ...(space.children ?? [])]).find((space) => space.id === selectedSpaceId)
      ?? spaces.find((space) => space.id === selectedSpaceId)
      ?? null;

    try {
      setIsAssigning(true);
      setErrorMessage(null);
      setAssignResult(null);
      setAssignProgress({ completed: 0, total: selectedItems.length });

      const failed: AssignResult["failed"] = [];

      for (const [index, item] of selectedItems.entries()) {
        try {
          await addItemToSpace(householdId, selectedSpaceId, {
            inventoryItemId: item.id,
            quantity: item.quantityOnHand,
          });
        } catch (error) {
          failed.push({
            itemName: item.name,
            message: error instanceof Error ? error.message : "Unable to assign item to the selected space.",
          });
        } finally {
          setAssignProgress({ completed: index + 1, total: selectedItems.length });
        }
      }

      setAssignResult({
        completed: selectedItems.length - failed.length,
        failed,
        spaceName: destinationSpace?.name ?? "the selected space",
      });
      requestRefresh();

      if (failed.length === 0) {
        pushToast({ message: `Assigned ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} to ${destinationSpace?.name ?? "the selected space"}.` });
        onBulkAssigned?.();
      } else {
        pushToast({ message: `Assigned ${selectedItems.length - failed.length} item${selectedItems.length - failed.length === 1 ? "" : "s"}; ${failed.length} failed.`, tone: "danger" });
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedItems.length === 0) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await bulkDeleteInventoryItems(householdId, { itemIds: selectedItems.map((item) => item.id) });
      pushToast({ message: `Moved ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} to trash.` });
      onBulkAssigned?.();
      requestRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete items.";
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="inventory-bulk-actions">
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => {
            void handleExport();
          }}
          disabled={isExporting}
        >
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>

        <button
          type="button"
          className="button button--secondary button--sm"
          disabled={selectedItems.length === 0}
          onClick={() => {
            setAssignOpen(true);
            setErrorMessage(null);
          }}
        >
          Assign to Space{selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}
        </button>

        <button
          type="button"
          className="button button--danger button--sm"
          disabled={selectedItems.length === 0 || isDeleting}
          onClick={() => { void handleBulkDelete(); }}
        >
          {isDeleting ? "Deleting..." : `Delete${selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}`}
        </button>

        {(() => {
          const barcodeItems = selectedItems.filter((item) => item.partNumber && item.partNumber.trim().length > 0);
          const href = `/api/households/${householdId}/inventory/barcode-labels?itemIds=${barcodeItems.map((item) => item.id).join(",")}`;
          return (
            <a
              href={barcodeItems.length > 0 ? href : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={barcodeItems.length === 0}
              className={`button button--secondary button--sm${barcodeItems.length === 0 ? " button--disabled" : ""}`}
              onClick={barcodeItems.length === 0 ? (event) => event.preventDefault() : undefined}
            >
              Print Barcode Labels{barcodeItems.length > 0 ? ` (${barcodeItems.length})` : ""}
            </a>
          );
        })()}

        <div className="inventory-bulk-actions__import">
          <input
            className="inventory-bulk-actions__file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setErrorMessage(null);
              setImportResult(null);
            }}
          />
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => {
              void handleImport();
            }}
            disabled={!selectedFile || isImporting}
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>

        <InlineError message={errorMessage} className="inventory-bulk-actions__error" />

        {importResult && resultTone && (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${resultTone}`}>
            <p>
              Created {importResult.created} items, skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? "" : "s"}
              {importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}
            </p>
            {importResult.errors.length > 0 && (
              <ul>
                {importResult.errors.map((entry: ImportInventoryResult["errors"][number]) => (
                  <li key={`${entry.index}-${entry.message}`}>Row {entry.index + 2}: {entry.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {assignResult && assignResultTone && (
          <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${assignResultTone}`}>
            <p>
              Assigned {assignResult.completed} item{assignResult.completed === 1 ? "" : "s"} to {assignResult.spaceName}
              {assignResult.failed.length === 0 ? "." : `, with ${assignResult.failed.length} failure${assignResult.failed.length === 1 ? "" : "s"}.`}
            </p>
            {assignResult.failed.length > 0 ? (
              <ul>
                {assignResult.failed.map((entry) => (
                  <li key={`${entry.itemName}-${entry.message}`}>{entry.itemName}: {entry.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent style={{ width: "min(560px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>Assign to Space</DialogTitle>
            <DialogDescription>
              Assign {selectedItems.length} selected inventory item{selectedItems.length === 1 ? "" : "s"} to a single destination space.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "grid", gap: 16 }}>
            <SpacePickerField
              label="Destination Space"
              spaces={spaces}
              value={selectedSpaceId}
              onChange={setSelectedSpaceId}
              placeholder="Choose a space"
              fullWidth
              disabled={isAssigning}
            />

            {assignProgress ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="data-table__secondary">Progress: {assignProgress.completed} of {assignProgress.total}</div>
                <progress value={assignProgress.completed} max={assignProgress.total} />
              </div>
            ) : null}

            {assignResult ? (
              <div style={{ display: "grid", gap: 6, padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-alt)" }}>
                <strong>Latest run</strong>
                <span>{assignResult.completed} assigned successfully.</span>
                <span>{assignResult.failed.length} failed.</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button type="button" className="button button--ghost" disabled={isAssigning} onClick={() => setAssignOpen(false)}>Close</button>
            <button type="button" className="button button--primary" disabled={isAssigning || selectedItems.length === 0 || !selectedSpaceId} onClick={() => { void handleAssign(); }}>
              {isAssigning ? "Assigning..." : "Assign Selected Items"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}