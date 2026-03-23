"use client";

import type { Asset, AssetCategory, BulkAssetOperationResult } from "@lifekeeper/types";
import { assetCategoryValues } from "@lifekeeper/types";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  bulkArchiveAssets,
  bulkReassignAssetCategory,
  exportHouseholdAssets,
} from "../lib/api";
import { formatCategoryLabel, formatDate } from "../lib/formatters";
import { generateCSVDownload } from "../lib/csv";
import { useToast } from "./toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type AssetBulkActionsProps = {
  householdId: string;
  selectedItems: Asset[];
  allItems: Asset[];
  onBulkComplete?: () => void;
};

const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const csvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return csvEscape(String(value));
};

const buildAssetCsv = (assets: Asset[]): string => {
  const headers = ["assetTag", "name", "category", "visibility", "purchaseDate", "purchasePrice", "warrantyExpiration", "location"];

  const rows = assets.map((asset) => {
    const purchase = (asset.purchaseDetails as Record<string, unknown> | null) ?? {};
    const warranty = (asset.warrantyDetails as Record<string, unknown> | null) ?? {};
    const location = (asset.locationDetails as Record<string, unknown> | null) ?? {};
    const locationStr = [location.propertyName, location.room].filter(Boolean).join(", ");
    const purchaseDate = asset.purchaseDate ? formatDate(asset.purchaseDate) : null;
    const warrantyEnd = typeof warranty.endDate === "string" ? warranty.endDate.split("T")[0] : null;

    return [
      csvCell(asset.assetTag),
      csvCell(asset.name),
      csvCell(asset.category),
      csvCell(asset.visibility),
      csvCell(purchaseDate),
      csvCell(typeof purchase.price === "number" ? purchase.price : null),
      csvCell(warrantyEnd),
      csvCell(locationStr || null),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
};

export function AssetBulkActions({
  householdId,
  selectedItems,
  allItems,
  onBulkComplete,
}: AssetBulkActionsProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();

  const [isExporting, setIsExporting] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveResult, setArchiveResult] = useState<BulkAssetOperationResult | null>(null);

  const [reassignOpen, setReassignOpen] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<BulkAssetOperationResult | null>(null);
  const [targetCategory, setTargetCategory] = useState<AssetCategory>("other");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const archiveResultTone = useMemo(() => {
    if (!archiveResult) return null;
    return archiveResult.failed.length > 0 ? "warning" : "success";
  }, [archiveResult]);

  const reassignResultTone = useMemo(() => {
    if (!reassignResult) return null;
    return reassignResult.failed.length > 0 ? "warning" : "success";
  }, [reassignResult]);

  const handleExport = async (): Promise<void> => {
    const itemsToExport = selectedItems.length > 0 ? selectedItems : allItems;

    try {
      setIsExporting(true);
      setErrorMessage(null);
      const csvText = buildAssetCsv(itemsToExport);
      generateCSVDownload(csvText, "assets-export.csv");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export assets CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async (): Promise<void> => {
    try {
      setIsArchiving(true);
      setErrorMessage(null);
      setArchiveResult(null);

      const result = await bulkArchiveAssets(householdId, selectedItems.map((a) => a.id));
      setArchiveResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Archived ${result.succeeded} asset${result.succeeded === 1 ? "" : "s"}.` });
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Archived ${result.succeeded} asset${result.succeeded === 1 ? "" : "s"}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : "Unable to archive assets.";
      setErrorMessage(message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleReassign = async (): Promise<void> => {
    try {
      setIsReassigning(true);
      setErrorMessage(null);
      setReassignResult(null);

      const result = await bulkReassignAssetCategory(householdId, selectedItems.map((a) => a.id), targetCategory);
      setReassignResult(result);
      router.refresh();

      if (result.failed.length === 0) {
        pushToast({ message: `Reassigned ${result.succeeded} asset${result.succeeded === 1 ? "" : "s"} to ${formatCategoryLabel(targetCategory)}.` });
        onBulkComplete?.();
      } else {
        pushToast({
          message: `Reassigned ${result.succeeded}; ${result.failed.length} failed.`,
          tone: "danger"
        });
      }
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : "Unable to reassign category.";
      setErrorMessage(message);
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <>
      <div className="inventory-bulk-actions">
        <button
          type="button"
          className="button button--secondary button--sm"
          onClick={() => { void handleExport(); }}
          disabled={isExporting}
        >
          {isExporting ? "Exporting..." : selectedItems.length > 0 ? `Export Selected (${selectedItems.length})` : "Export All CSV"}
        </button>

        <button
          type="button"
          className="button button--secondary button--sm"
          disabled={selectedItems.length === 0}
          onClick={() => {
            setArchiveOpen(true);
            setArchiveResult(null);
            setErrorMessage(null);
          }}
        >
          Archive{selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}
        </button>

        <button
          type="button"
          className="button button--secondary button--sm"
          disabled={selectedItems.length === 0}
          onClick={() => {
            setReassignOpen(true);
            setReassignResult(null);
            setErrorMessage(null);
          }}
        >
          Reassign Category{selectedItems.length > 0 ? ` (${selectedItems.length})` : ""}
        </button>

        {errorMessage ? (
          <p className="inventory-bulk-actions__result inventory-bulk-actions__result--warning">{errorMessage}</p>
        ) : null}
      </div>

      {/* Archive confirmation dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent style={{ width: "min(560px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>Archive Assets</DialogTitle>
            <DialogDescription>
              This will soft-delete {selectedItems.length} asset{selectedItems.length === 1 ? "" : "s"}. They can be restored later.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "grid", gap: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.875rem", color: "var(--ink-light)" }}>
              {selectedItems.slice(0, 10).map((asset) => (
                <li key={asset.id}>{asset.name}{asset.assetTag ? ` (${asset.assetTag})` : ""}</li>
              ))}
              {selectedItems.length > 10 ? (
                <li>…and {selectedItems.length - 10} more</li>
              ) : null}
            </ul>

            {isArchiving ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="data-table__secondary">Archiving…</div>
                <progress />
              </div>
            ) : null}

            {archiveResult && archiveResultTone ? (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${archiveResultTone}`}>
                <p>
                  Archived {archiveResult.succeeded} asset{archiveResult.succeeded === 1 ? "" : "s"}
                  {archiveResult.failed.length === 0 ? "." : `, with ${archiveResult.failed.length} failure${archiveResult.failed.length === 1 ? "" : "s"}.`}
                </p>
                {archiveResult.failed.length > 0 ? (
                  <ul>
                    {archiveResult.failed.map((entry) => (
                      <li key={entry.assetId}>{entry.name ?? entry.assetId}: {entry.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button type="button" className="button button--ghost" disabled={isArchiving} onClick={() => setArchiveOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={isArchiving || selectedItems.length === 0}
              onClick={() => { void handleArchive(); }}
            >
              {isArchiving ? "Archiving…" : `Archive ${selectedItems.length} Asset${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category reassignment dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent style={{ width: "min(480px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>Reassign Category</DialogTitle>
            <DialogDescription>
              Change the category for {selectedItems.length} selected asset{selectedItems.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "grid", gap: 16 }}>
            <div className="workbench-grid" style={{ "--wg-cols": 1 } as React.CSSProperties}>
              <label className="field">
                <span className="field__label">Target Category</span>
                <select
                  className="field__input"
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value as AssetCategory)}
                  disabled={isReassigning}
                >
                  {assetCategoryValues.map((cat) => (
                    <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
                  ))}
                </select>
              </label>
            </div>

            {isReassigning ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="data-table__secondary">Reassigning…</div>
                <progress />
              </div>
            ) : null}

            {reassignResult && reassignResultTone ? (
              <div className={`inventory-bulk-actions__result inventory-bulk-actions__result--${reassignResultTone}`}>
                <p>
                  Reassigned {reassignResult.succeeded} asset{reassignResult.succeeded === 1 ? "" : "s"} to {formatCategoryLabel(targetCategory)}
                  {reassignResult.failed.length === 0 ? "." : `, with ${reassignResult.failed.length} failure${reassignResult.failed.length === 1 ? "" : "s"}.`}
                </p>
                {reassignResult.failed.length > 0 ? (
                  <ul>
                    {reassignResult.failed.map((entry) => (
                      <li key={entry.assetId}>{entry.name ?? entry.assetId}: {entry.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <button type="button" className="button button--ghost" disabled={isReassigning} onClick={() => setReassignOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={isReassigning || selectedItems.length === 0}
              onClick={() => { void handleReassign(); }}
            >
              {isReassigning ? "Reassigning…" : `Reassign ${selectedItems.length} Asset${selectedItems.length === 1 ? "" : "s"}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
