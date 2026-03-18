"use client";

import type {
  ImportSpaceRow,
  ImportSpacesResult,
  InventoryItemSummary,
  SpaceRecentScanEntry,
  SpaceResponse,
  SpaceUtilizationEntry,
  SpaceType
} from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { addItemToSpace } from "../app/actions";
import {
  ApiError,
  exportHouseholdSpaces,
  getHouseholdSpaces,
  getSpaceByShortCode,
  getSpaceOrphans,
  importHouseholdSpaces,
} from "../lib/api";
import { generateCSVDownload, parseCSV } from "../lib/csv";
import { formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";
import { SpaceForm } from "./space-form";
import { SpacePickerField } from "./space-picker-field";
import { SpaceQuickPlace } from "./space-quick-place";
import { SpaceTreeMap } from "./space-tree-map";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog";

type SpacesSectionClientProps = {
  householdId: string;
  spaces: SpaceResponse[];
  orphanCount: number;
  utilization: SpaceUtilizationEntry[];
  recentScans: SpaceRecentScanEntry[];
};

type SpaceViewMode = "tree" | "utilization" | "map";

type AssignTargetState = {
  item: InventoryItemSummary;
  spaceId: string;
};

const importableTypes = new Set<SpaceType>([
  "building",
  "room",
  "area",
  "shelf",
  "cabinet",
  "drawer",
  "tub",
  "bin",
  "other"
]);

const collectSpaceIds = (nodes: SpaceResponse[]): string[] => nodes.flatMap((space) => [
  space.id,
  ...(space.children ? collectSpaceIds(space.children) : [])
]);

const flattenSpaces = (nodes: SpaceResponse[]): SpaceResponse[] => nodes.flatMap((space) => [
  space,
  ...(space.children ? flattenSpaces(space.children) : [])
]);

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

const normalizeImportRows = (rows: Array<Record<string, string>>): {
  spaces: ImportSpaceRow[];
  errors: string[];
} => {
  const spaces: ImportSpaceRow[] = [];
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const normalized = Object.entries(row).reduce<Record<string, string>>((record, [key, value]) => {
      record[key.trim().toLowerCase().replace(/\s+/g, "")] = value.trim();
      return record;
    }, {});

    const name = normalized.name ?? "";
    const type = normalized.type?.toLowerCase() as SpaceType | undefined;
    const parentName = normalized.parentname || undefined;
    const parentShortCode = normalized.parentshortcode || undefined;
    const description = normalized.description || undefined;
    const notes = normalized.notes || undefined;

    if (!name) {
      errors.push(`Row ${index + 2}: name is required.`);
      continue;
    }

    if (!type || !importableTypes.has(type)) {
      errors.push(`Row ${index + 2}: type must be one of ${[...importableTypes].join(", ")}.`);
      continue;
    }

    spaces.push({
      name,
      type,
      ...(parentName ? { parentName } : {}),
      ...(parentShortCode ? { parentShortCode: parentShortCode.toUpperCase() } : {}),
      ...(description ? { description } : {}),
      ...(notes ? { notes } : {})
    });
  }

  return { spaces, errors };
};

async function openBatchLabelPdf(householdId: string, spaceIds: string[]): Promise<void> {
  const response = await fetch(`/api/households/${householdId}/spaces/labels/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ spaceIds })
  });

  if (!response.ok) {
    throw new Error(`Print failed with status ${response.status}.`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const popup = window.open(objectUrl, "_blank", "noopener");

  if (!popup) {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

const formatRelativeScanTime = (value: string): string => {
  const timestamp = new Date(value).getTime();
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absoluteSeconds < 60) {
    return formatter.format(Math.round(deltaSeconds), "second");
  }

  const minutes = Math.round(deltaSeconds / 60);

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
};

const formatActivityMethod = (method: SpaceRecentScanEntry["method"]): string => {
  switch (method) {
    case "qr_scan":
      return "QR Scan";
    case "manual_lookup":
      return "Manual Lookup";
    case "direct_navigation":
      return "Direct View";
    default:
      return method;
  }
};

const SpaceTreeNode = ({
  householdId,
  space,
  selectedIds,
  onToggleSelected
}: {
  householdId: string;
  space: SpaceResponse;
  selectedIds: Set<string>;
  onToggleSelected: (spaceId: string) => void;
}): JSX.Element => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (space.children?.length ?? 0) > 0;

  return (
    <li style={{ display: "grid", gap: 10 }}>
      <article className="schedule-card" style={{ gap: 12 }}>
        <div className="schedule-card__summary" style={{ alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label className="space-tree__check" aria-label={`Select ${space.name}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(space.id)}
                  onChange={() => onToggleSelected(space.id)}
                />
              </label>
              {hasChildren ? (
                <button type="button" className="button button--ghost button--xs" onClick={() => setExpanded((current) => !current)}>
                  {expanded ? "Hide" : "Show"}
                </button>
              ) : null}
              <span className="pill">{getSpaceTypeBadge(space.type)}</span>
              <Link href={`/inventory/spaces/${space.id}?householdId=${householdId}`} className="data-table__link">{space.name}</Link>
              <span className="pill">{space.shortCode}</span>
              <span className="data-table__secondary">{getSpaceTypeLabel(space.type)}</span>
            </div>
            <div className="data-table__secondary">{formatSpaceBreadcrumb(space)}</div>
          </div>
          <div className="data-table__secondary">{space.totalItemCount ?? 0} items</div>
        </div>
      </article>
      {expanded && hasChildren ? (
        <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 20px", display: "grid", gap: 10, borderLeft: "1px solid var(--border)" }}>
          {space.children?.map((child) => (
            <SpaceTreeNode
              key={child.id}
              householdId={householdId}
              space={child}
              selectedIds={selectedIds}
              onToggleSelected={onToggleSelected}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

export function SpacesSectionClient({
  householdId,
  spaces,
  orphanCount,
  utilization,
  recentScans
}: SpacesSectionClientProps): JSX.Element {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<SpaceViewMode>("tree");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupResults, setLookupResults] = useState<SpaceResponse[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [orphanDialogOpen, setOrphanDialogOpen] = useState(false);
  const [orphanItems, setOrphanItems] = useState<InventoryItemSummary[]>([]);
  const [orphanNextCursor, setOrphanNextCursor] = useState<string | null>(null);
  const [orphanSearch, setOrphanSearch] = useState("");
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanError, setOrphanError] = useState<string | null>(null);
  const [orphanCountValue, setOrphanCountValue] = useState(orphanCount);
  const [assignTarget, setAssignTarget] = useState<AssignTargetState | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [spacesCsvExporting, setSpacesCsvExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportSpaceRow[]>([]);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportSpacesResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const allSpaceIds = collectSpaceIds(spaces);
  const allSpaces = flattenSpaces(spaces);
  const maxUtilization = utilization.reduce((max, entry) => Math.max(max, entry.totalItemCount), 0);

  const handleToggleSelected = (spaceId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }

      return next;
    });
  };

  const handleLookup = async (): Promise<void> => {
    const normalized = lookupValue.trim().toUpperCase();

    if (!normalized) {
      setLookupResults([]);
      setLookupError(null);
      return;
    }

    try {
      setLookupLoading(true);
      setLookupError(null);

      try {
        const space = await getSpaceByShortCode(householdId, normalized);
        router.push(`/inventory/spaces/${space.id}?householdId=${householdId}`);
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
      }

      const response = await getHouseholdSpaces(householdId, { search: normalized, limit: 12 });
      const [onlyMatch] = response.items;

      if (onlyMatch && response.items.length === 1) {
        router.push(`/inventory/spaces/${onlyMatch.id}?householdId=${householdId}`);
        return;
      }

      setLookupResults(response.items);
      setLookupError(response.items.length === 0 ? "No spaces matched that code." : null);
    } catch (error) {
      setLookupResults([]);
      setLookupError(error instanceof Error ? error.message : "Lookup failed.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePrint = async (spaceIds: string[]): Promise<void> => {
    if (spaceIds.length === 0) {
      return;
    }

    try {
      setPrinting(true);
      await openBatchLabelPdf(householdId, spaceIds);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to open the label PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const loadOrphans = async (mode: "replace" | "append" = "replace"): Promise<void> => {
    try {
      setOrphanLoading(true);
      setOrphanError(null);
      const options: {
        search?: string;
        limit: number;
        cursor?: string;
      } = {
        limit: 25
      };

      const search = orphanSearch.trim();

      if (search) {
        options.search = search;
      }

      if (mode === "append" && orphanNextCursor) {
        options.cursor = orphanNextCursor;
      }

      const response = await getSpaceOrphans(householdId, options);

      setOrphanItems((current) => mode === "append" ? [...current, ...response.items] : response.items);
      setOrphanNextCursor(response.nextCursor);
    } catch (error) {
      setOrphanError(error instanceof Error ? error.message : "Unable to load unplaced items.");
    } finally {
      setOrphanLoading(false);
    }
  };

  const handleExportSpaces = async (): Promise<void> => {
    try {
      setSpacesCsvExporting(true);
      const csv = await exportHouseholdSpaces(householdId);
      generateCSVDownload(csv, "spaces-export.csv");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export spaces CSV.");
    } finally {
      setSpacesCsvExporting(false);
    }
  };

  const handleImportFileChange = async (file: File | null): Promise<void> => {
    if (!file) {
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        throw new Error("The selected CSV file does not contain any spaces.");
      }

      const normalized = normalizeImportRows(parsedRows);
      setImportRows(normalized.spaces);
      setImportPreviewErrors(normalized.errors);
      setImportFileName(file.name);
      setImportResult(null);
      setImportError(null);
      setImportDialogOpen(true);
    } catch (error) {
      setImportRows([]);
      setImportPreviewErrors([]);
      setImportFileName(null);
      setImportResult(null);
      setImportError(error instanceof Error ? error.message : "Unable to read that CSV file.");
      setImportDialogOpen(true);
    }
  };

  const handleImportSpaces = async (): Promise<void> => {
    if (importRows.length === 0) {
      setImportError("No valid rows are ready to import.");
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      const result = await importHouseholdSpaces(householdId, importRows);
      setImportResult(result);

      if (result.created > 0 || result.updated > 0) {
        router.refresh();
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import spaces CSV.");
    } finally {
      setImporting(false);
    }
  };

  const handleAssignOrphan = async (): Promise<void> => {
    if (!assignTarget?.spaceId) {
      setAssignError("Choose a destination space.");
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      await addItemToSpace(householdId, assignTarget.spaceId, {
        inventoryItemId: assignTarget.item.id,
        quantity: assignTarget.item.quantityOnHand
      });
      setOrphanItems((current) => current.filter((item) => item.id !== assignTarget.item.id));
      setOrphanCountValue((current) => Math.max(0, current - 1));
      setAssignTarget(null);
      router.refresh();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Unable to assign that item.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Spaces</h2>
          <div className="data-table__secondary">Track buildings, rooms, bins, and other storage locations in a household hierarchy.</div>
        </div>
        <div className="panel__header-actions">
          <SpaceQuickPlace householdId={householdId} spaces={spaces} triggerLabel="Quick Place Items" triggerClassName="button button--ghost button--sm" />
          <Dialog open={orphanDialogOpen} onOpenChange={(open) => {
            setOrphanDialogOpen(open);
            if (open && orphanItems.length === 0) {
              void loadOrphans("replace");
            }
          }}>
            <DialogTrigger asChild>
              <button type="button" className="button button--ghost button--sm">
                Unplaced Items
                <span className="spaces-badge">{orphanCountValue}</span>
              </button>
            </DialogTrigger>
            <DialogContent style={{ width: "min(940px, calc(100vw - 32px))" }}>
              <DialogHeader>
                <DialogTitle>Unplaced Items</DialogTitle>
                <DialogDescription>
                  Inventory items with no assigned space. Use this list to place orphaned inventory into the household hierarchy.
                </DialogDescription>
              </DialogHeader>

              <div className="spaces-orphans__toolbar">
                <input
                  type="text"
                  value={orphanSearch}
                  className="space-lookup__input"
                  placeholder="Search by item name, part number, or description"
                  onChange={(event) => setOrphanSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void loadOrphans("replace");
                    }
                  }}
                />
                <button type="button" className="button button--ghost button--sm" disabled={orphanLoading} onClick={() => { void loadOrphans("replace"); }}>
                  {orphanLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {orphanError ? <p className="form-error">{orphanError}</p> : null}

              <div className="spaces-orphans__list">
                {orphanItems.length === 0 && !orphanLoading ? (
                  <p className="panel__empty">Every tracked inventory item is already assigned to a space.</p>
                ) : (
                  orphanItems.map((item) => (
                    <article key={item.id} className="spaces-orphans__item">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="data-table__secondary">
                          {item.partNumber ?? item.category ?? "No category"} • {item.quantityOnHand} {item.unit}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button button--primary button--sm"
                        onClick={() => {
                          setAssignTarget({ item, spaceId: "" });
                          setAssignError(null);
                        }}
                      >
                        Assign to Space
                      </button>
                    </article>
                  ))
                )}
              </div>

              <DialogFooter>
                <button type="button" className="button button--ghost button--sm" onClick={() => setOrphanDialogOpen(false)}>Close</button>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  disabled={!orphanNextCursor || orphanLoading}
                  onClick={() => { void loadOrphans("append"); }}
                >
                  {orphanLoading ? "Loading..." : orphanNextCursor ? "Load More" : "No More Items"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <button type="button" className="button button--ghost button--sm" disabled={spacesCsvExporting} onClick={() => { void handleExportSpaces(); }}>
            {spacesCsvExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button type="button" className="button button--ghost button--sm" onClick={() => importInputRef.current?.click()}>
            Import CSV
          </button>
          <button
            type="button"
            className="button button--ghost button--sm"
            disabled={printing || allSpaceIds.length === 0}
            onClick={() => {
              setSelectedIds(new Set(allSpaceIds));
              void handlePrint(allSpaceIds);
            }}
          >
            {printing ? "Preparing..." : "Print All Labels"}
          </button>
          <button type="button" className="button button--primary button--sm" onClick={() => setShowCreate((current) => !current)}>
            {showCreate ? "Close Form" : "Add Space"}
          </button>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(event) => {
          void handleImportFileChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      <div className="panel__body--padded space-lookup">
        <div className="space-lookup__field">
          <span className="space-lookup__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            className="space-lookup__input"
            value={lookupValue}
            onChange={(event) => {
              setLookupValue(event.target.value.toUpperCase());
              setLookupError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleLookup();
              }
            }}
            placeholder="Lookup by code, e.g. A3K7"
          />
          <button type="button" className="button button--ghost button--sm" onClick={() => { void handleLookup(); }} disabled={lookupLoading}>
            {lookupLoading ? "Looking up..." : "Lookup"}
          </button>
        </div>
        {lookupError ? <p className="space-lookup__error">{lookupError}</p> : null}
        {lookupResults.length > 1 ? (
          <div className="space-lookup__results">
            {lookupResults.map((space) => (
              <button
                key={space.id}
                type="button"
                className="space-lookup__result"
                onClick={() => router.push(`/inventory/spaces/${space.id}?householdId=${householdId}`)}
              >
                <strong>{space.shortCode}</strong>
                <span>{space.name}</span>
                <span>{formatSpaceBreadcrumb(space)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel__body--padded spaces-view-switcher">
        <div className="spaces-view-switcher__group" role="tablist" aria-label="Spaces views">
          {[
            { id: "tree", label: "Tree View" },
            { id: "utilization", label: "Space Utilization" },
            { id: "map", label: "Tree Map" }
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={activeView === option.id}
              className={`button button--sm ${activeView === option.id ? "button--primary" : "button--ghost"}`}
              onClick={() => setActiveView(option.id as SpaceViewMode)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {showCreate ? (
        <div className="panel__body--padded" style={{ borderBottom: "1px solid var(--border)" }}>
          <SpaceForm
            householdId={householdId}
            spaces={spaces}
            onSaved={() => {
              setShowCreate(false);
              router.refresh();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      <div className="panel__body">
        {activeView === "tree" ? (
          spaces.length === 0 ? (
            <p className="panel__empty">No spaces have been added yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {spaces.map((space) => (
                <SpaceTreeNode
                  key={space.id}
                  householdId={householdId}
                  space={space}
                  selectedIds={selectedIds}
                  onToggleSelected={handleToggleSelected}
                />
              ))}
            </ul>
          )
        ) : null}

        {activeView === "utilization" ? (
          utilization.length === 0 ? (
            <p className="panel__empty">Add spaces to see utilization analytics.</p>
          ) : (
            <div className="spaces-utilization">
              {utilization.map((entry) => {
                const width = maxUtilization > 0 ? `${Math.max(8, (entry.totalItemCount / maxUtilization) * 100)}%` : "8%";

                return (
                  <Link key={entry.spaceId} href={`/inventory/spaces/${entry.spaceId}?householdId=${householdId}`} className={`spaces-utilization__row${entry.isEmpty ? " spaces-utilization__row--empty" : ""}`}>
                    <div className="spaces-utilization__row-topline">
                      <div>
                        <strong>{entry.name}</strong>
                        <div className="data-table__secondary">{entry.breadcrumb.map((segment) => segment.name).join(" / ")}</div>
                      </div>
                      <div className="spaces-utilization__metrics">
                        <span className="pill">{entry.shortCode}</span>
                        <span>{entry.totalItemCount} total</span>
                      </div>
                    </div>
                    <div className="spaces-utilization__bar-track">
                      <span className="spaces-utilization__bar-fill" style={{ width }} />
                    </div>
                    <div className="spaces-utilization__summary">
                      <span>{entry.itemCount} inventory</span>
                      <span>{entry.generalItemCount} general</span>
                      <span>{entry.lastActivityAt ? `Last activity ${formatRelativeScanTime(entry.lastActivityAt)}` : "No activity yet"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : null}

        {activeView === "map" ? (
          spaces.length === 0 ? (
            <p className="panel__empty">Add spaces to see the hierarchy map.</p>
          ) : (
            <SpaceTreeMap householdId={householdId} spaces={spaces} />
          )
        ) : null}
      </div>

      <div className="panel__body--padded" style={{ borderTop: "1px solid var(--border)", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Recent Activity</h3>
          <span className="data-table__secondary">Last {recentScans.length} scan and view events</span>
        </div>

        {recentScans.length === 0 ? (
          <p className="panel__empty">No scan or view events have been recorded yet.</p>
        ) : (
          <div className="spaces-activity-feed">
            {recentScans.map((entry) => (
              <Link key={entry.id} href={`/inventory/spaces/${entry.spaceId}?householdId=${householdId}`} className="spaces-activity-feed__entry">
                <div>
                  <strong>{entry.space.name}</strong>
                  <div className="data-table__secondary">{entry.space.breadcrumb.map((segment) => segment.name).join(" / ")}</div>
                </div>
                <div className="spaces-activity-feed__meta">
                  <span className="pill">{formatActivityMethod(entry.method)}</span>
                  <span>{entry.actor.displayName ?? "Unknown member"}</span>
                  <span>{formatRelativeScanTime(entry.scannedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {selectedIds.size > 0 ? (
        <div className="space-selection-bar">
          <span>{selectedIds.size} selected</span>
          <div className="space-selection-bar__actions">
            <button type="button" className="button button--ghost button--sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
            <button
              type="button"
              className="button button--primary button--sm"
              disabled={printing}
              onClick={() => {
                void handlePrint([...selectedIds]);
              }}
            >
              {printing ? "Preparing..." : `Print Labels (${selectedIds.size})`}
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={assignTarget !== null} onOpenChange={(open) => {
        if (!open) {
          setAssignTarget(null);
          setAssignError(null);
        }
      }}>
        <DialogContent style={{ width: "min(560px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>Assign to Space</DialogTitle>
            <DialogDescription>
              {assignTarget ? `Place ${assignTarget.item.name} into a household space.` : "Choose a destination space."}
            </DialogDescription>
          </DialogHeader>

          {assignTarget ? (
            <div style={{ display: "grid", gap: 16 }}>
              <SpacePickerField
                label="Destination Space"
                spaces={spaces}
                value={assignTarget.spaceId}
                onChange={(value) => setAssignTarget((current) => current ? { ...current, spaceId: value } : current)}
                placeholder="Choose a space"
                fullWidth
              />
              {assignError ? <p className="form-error">{assignError}</p> : null}
            </div>
          ) : null}

          <DialogFooter>
            <button type="button" className="button button--ghost button--sm" onClick={() => setAssignTarget(null)}>Cancel</button>
            <button type="button" className="button button--primary button--sm" disabled={assigning} onClick={() => { void handleAssignOrphan(); }}>
              {assigning ? "Assigning..." : "Assign Item"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent style={{ width: "min(940px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>Import Spaces CSV</DialogTitle>
            <DialogDescription>
              Review the parsed rows from {importFileName ?? "the selected CSV"} before creating or updating spaces.
            </DialogDescription>
          </DialogHeader>

          {importError ? <p className="form-error">{importError}</p> : null}
          {importPreviewErrors.length > 0 ? (
            <div className="spaces-import__errors">
              {importPreviewErrors.map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
            </div>
          ) : null}

          <div className="spaces-import__summary">
            <span>{importRows.length} valid row{importRows.length === 1 ? "" : "s"}</span>
            <span>{importPreviewErrors.length} preview issue{importPreviewErrors.length === 1 ? "" : "s"}</span>
          </div>

          <div className="spaces-import__table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Parent</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {importRows.slice(0, 20).map((row, index) => (
                  <tr key={`${row.name}-${index}`}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.parentShortCode ?? row.parentName ?? "Top level"}</td>
                    <td>{row.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importRows.length > 20 ? <p className="data-table__secondary">Showing the first 20 parsed rows.</p> : null}

          {importResult ? (
            <div className="spaces-import__result">
              <p>
                Created {importResult.created} spaces, updated {importResult.updated}
                {importResult.errors.length === 0 ? "." : `, with ${importResult.errors.length} error${importResult.errors.length === 1 ? "" : "s"}.`}
              </p>
              {importResult.errors.length > 0 ? (
                <ul>
                  {importResult.errors.map((entry) => (
                    <li key={`${entry.index}-${entry.message}`}>Row {entry.index + 2}: {entry.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <button type="button" className="button button--ghost button--sm" onClick={() => setImportDialogOpen(false)}>Close</button>
            <button
              type="button"
              className="button button--primary button--sm"
              disabled={importing || importRows.length === 0}
              onClick={() => { void handleImportSpaces(); }}
            >
              {importing ? "Importing..." : "Confirm Import"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
