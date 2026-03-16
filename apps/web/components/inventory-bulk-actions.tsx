"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  exportHouseholdInventory,
  importHouseholdInventory,
  type ImportInventoryResult
} from "../lib/api";
import { generateCSVDownload, parseCSV } from "../lib/csv";

type InventoryBulkActionsProps = {
  householdId: string;
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

export function InventoryBulkActions({ householdId }: InventoryBulkActionsProps): JSX.Element {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportInventoryResult | null>(null);

  const resultTone = useMemo(() => {
    if (!importResult) {
      return null;
    }

    return importResult.skipped > 0 || importResult.errors.length > 0 ? "warning" : "success";
  }, [importResult]);

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
        router.refresh();
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

  return (
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

      {errorMessage && (
        <div className="inventory-bulk-actions__result inventory-bulk-actions__result--warning">
          <p>{errorMessage}</p>
        </div>
      )}

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
    </div>
  );
}