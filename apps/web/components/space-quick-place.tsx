"use client";

import type { InventoryItemDetail, InventoryItemSummary, SpaceResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addItemToSpace, removeItemFromSpace } from "../app/actions";
import {
  ApiError,
  getHouseholdInventory,
  getHouseholdSpaces,
  getScanInventoryItemDetail,
  getSpace,
  resolveScanTag,
} from "../lib/api";
import { formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";
import { useToast } from "./toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { SpacePickerField } from "./space-picker-field";

type SpaceQuickPlaceProps = {
  householdId: string;
  spaces: SpaceResponse[];
  initialSpaceId?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

type QuickPlaceEntry = {
  inventoryItemId: string;
  name: string;
  partNumber: string | null;
  unit: string;
  baseQuantity: number | null | undefined;
  sessionQuantity: number;
  inputValue: string;
};

type QuickPlaceItem = {
  id: string;
  name: string;
  partNumber: string | null;
  unit: string;
};

type DestinationState = {
  space: SpaceResponse;
  baseQuantityByItemId: Map<string, number | null>;
};

const normalizeLookup = (value: string): string => value.trim();

const getExactMatches = (items: InventoryItemSummary[], query: string): InventoryItemSummary[] => {
  const normalized = query.trim().toLowerCase();

  return items.filter((item) => {
    const exactPartNumber = item.partNumber?.trim().toLowerCase() === normalized;
    const exactName = item.name.trim().toLowerCase() === normalized;
    return exactPartNumber || exactName;
  });
};

export function SpaceQuickPlace({
  householdId,
  spaces,
  initialSpaceId,
  triggerLabel = "Quick Place Items",
  triggerClassName = "button button--ghost button--sm",
}: SpaceQuickPlaceProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"destination" | "scan" | "summary">(initialSpaceId ? "scan" : "destination");
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId ?? "");
  const [destinationLookup, setDestinationLookup] = useState("");
  const [destinationMatches, setDestinationMatches] = useState<SpaceResponse[]>([]);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationState, setDestinationState] = useState<DestinationState | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanCandidates, setScanCandidates] = useState<InventoryItemSummary[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [entries, setEntries] = useState<QuickPlaceEntry[]>([]);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);

  const totalPlacedCount = useMemo(() => entries.reduce((sum, entry) => sum + entry.sessionQuantity, 0), [entries]);

  const resetState = (): void => {
    setStep(initialSpaceId ? "scan" : "destination");
    setSelectedSpaceId(initialSpaceId ?? "");
    setDestinationLookup("");
    setDestinationMatches([]);
    setDestinationError(null);
    setDestinationLoading(false);
    setDestinationState(null);
    setScanValue("");
    setScanCandidates([]);
    setScanError(null);
    setScanLoading(false);
    setEntries([]);
    setSavingEntryId(null);
  };

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    if (initialSpaceId) {
      void (async () => {
        setSelectedSpaceId(initialSpaceId);
        await activateDestination(initialSpaceId);
      })();
    }
  }, [initialSpaceId, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (step === "scan") {
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    }

    if (step === "destination") {
      window.setTimeout(() => destinationInputRef.current?.focus(), 0);
    }
  }, [open, step]);

  const activateDestination = async (spaceId: string): Promise<void> => {
    try {
      setDestinationLoading(true);
      setDestinationError(null);

      const space = await getSpace(householdId, spaceId);
      const baseQuantityByItemId = new Map<string, number | null>();

      for (const link of space.spaceItems ?? []) {
        baseQuantityByItemId.set(link.inventoryItemId, link.quantity ?? null);
      }

      setDestinationState({ space, baseQuantityByItemId });
      setEntries([]);
      setScanCandidates([]);
      setSelectedSpaceId(spaceId);
      setStep("scan");
      setScanError(null);
      setDestinationMatches([]);
    } catch (error) {
      setDestinationError(error instanceof Error ? error.message : "Unable to load that space.");
    } finally {
      setDestinationLoading(false);
    }
  };

  const lookupDestination = async (): Promise<void> => {
    const query = normalizeLookup(destinationLookup);

    if (!query) {
      setDestinationMatches([]);
      setDestinationError(null);
      return;
    }

    try {
      setDestinationLoading(true);
      setDestinationError(null);

      const resolved = await resolveScanTag(query);

      if (resolved.type === "space") {
        await activateDestination(resolved.id);
        return;
      }

      setDestinationError("That scan belongs to something other than a space.");
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        setDestinationError(error instanceof Error ? error.message : "Unable to resolve that destination.");
        setDestinationLoading(false);
        return;
      }

      try {
        const response = await getHouseholdSpaces(householdId, { search: query.toUpperCase(), limit: 8 });
        const onlyMatch = response.items[0];

        if (response.items.length === 1 && onlyMatch) {
          await activateDestination(onlyMatch.id);
          return;
        }

        setDestinationMatches(response.items);
        setDestinationError(response.items.length === 0 ? "No spaces matched that scan or code." : null);
      } catch (searchError) {
        setDestinationError(searchError instanceof Error ? searchError.message : "Unable to search spaces.");
      }
    } finally {
      setDestinationLoading(false);
    }
  };

  const syncEntryQuantity = async (entry: QuickPlaceEntry, nextSessionQuantity: number): Promise<void> => {
    if (!destinationState) {
      return;
    }

    if (nextSessionQuantity <= 0) {
      if (entry.baseQuantity === undefined) {
        await removeItemFromSpace(householdId, destinationState.space.id, entry.inventoryItemId);
        return;
      }

      if (entry.baseQuantity === null) {
        await addItemToSpace(householdId, destinationState.space.id, { inventoryItemId: entry.inventoryItemId });
        return;
      }

      await addItemToSpace(householdId, destinationState.space.id, {
        inventoryItemId: entry.inventoryItemId,
        quantity: entry.baseQuantity,
      });
      return;
    }

    await addItemToSpace(householdId, destinationState.space.id, {
      inventoryItemId: entry.inventoryItemId,
      quantity: (entry.baseQuantity ?? 0) + nextSessionQuantity,
    });
  };

  const toQuickPlaceItem = (item: Pick<InventoryItemSummary, "id" | "name" | "partNumber" | "unit">): QuickPlaceItem => ({
    id: item.id,
    name: item.name,
    partNumber: item.partNumber ?? null,
    unit: item.unit,
  });

  const upsertEntry = (item: QuickPlaceItem): QuickPlaceEntry => {
    const baseQuantity = destinationState?.baseQuantityByItemId.get(item.id);

    return {
      inventoryItemId: item.id,
      name: item.name,
      partNumber: item.partNumber ?? null,
      unit: item.unit,
      baseQuantity,
      sessionQuantity: 1,
      inputValue: "1",
    };
  };

  const placeItem = async (item: QuickPlaceItem): Promise<void> => {
    if (!destinationState) {
      return;
    }

    const existing = entries.find((entry) => entry.inventoryItemId === item.id);
    const nextQuantity = (existing?.sessionQuantity ?? 0) + 1;
    const nextEntry = existing ?? upsertEntry(item);

    try {
      setScanLoading(true);
      setScanError(null);
      await syncEntryQuantity(nextEntry, nextQuantity);
      setEntries((current) => {
        const entryIndex = current.findIndex((entry) => entry.inventoryItemId === item.id);

        if (entryIndex === -1) {
          return [{ ...nextEntry, sessionQuantity: nextQuantity, inputValue: String(nextQuantity) }, ...current];
        }

        return current.map((entry) => entry.inventoryItemId === item.id
          ? { ...entry, sessionQuantity: nextQuantity, inputValue: String(nextQuantity) }
          : entry);
      });
      setScanValue("");
      setScanCandidates([]);
      pushToast({ message: `${item.name} placed in ${destinationState.space.name}.` });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unable to place that item.");
      pushToast({ message: error instanceof Error ? error.message : "Unable to place that item.", tone: "danger" });
    } finally {
      setScanLoading(false);
      window.setTimeout(() => scanInputRef.current?.focus(), 0);
    }
  };

  const resolveInventoryFromScan = async (query: string): Promise<{ single?: QuickPlaceItem; multiple?: InventoryItemSummary[] }> => {
    try {
      const resolved = await resolveScanTag(query);

      if (resolved.type === "inventory_item") {
        const item = await getScanInventoryItemDetail(query, { transactionLimit: 1 });
        return {
          single: {
            id: item.id,
            name: item.name,
            partNumber: item.partNumber,
            unit: item.unit,
          },
        };
      }

      throw new Error(resolved.type === "space"
        ? "That code belongs to a space. Scan an inventory item instead."
        : "That code belongs to a different record type.");
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }

    const response = await getHouseholdInventory(householdId, { search: query, limit: 8 });
    const exactMatches = getExactMatches(response.items, query);
    const exactSingleMatch = exactMatches[0];
    const onlyMatch = response.items[0];

    if (exactMatches.length === 1 && exactSingleMatch) {
      return { single: toQuickPlaceItem(exactSingleMatch) };
    }

    if (response.items.length === 1 && onlyMatch) {
      return { single: toQuickPlaceItem(onlyMatch) };
    }

    return { multiple: response.items };
  };

  const handleScan = async (): Promise<void> => {
    const query = normalizeLookup(scanValue);

    if (!query) {
      return;
    }

    try {
      setScanLoading(true);
      setScanError(null);
      setScanCandidates([]);

      const result = await resolveInventoryFromScan(query);

      if (result.single) {
        await placeItem(result.single);
        return;
      }

      if (result.multiple && result.multiple.length > 0) {
        setScanCandidates(result.multiple);
        setScanError("Multiple inventory items matched that code. Choose the correct item below.");
        return;
      }

      setScanError("No inventory items matched that code.");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unable to place that item.");
    } finally {
      setScanLoading(false);
    }
  };

  const commitEntryQuantity = async (entry: QuickPlaceEntry, rawValue: string): Promise<void> => {
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      setScanError("Enter a valid quantity of zero or more.");
      return;
    }

    try {
      setSavingEntryId(entry.inventoryItemId);
      setScanError(null);
      await syncEntryQuantity(entry, parsedValue);
      setEntries((current) => current.map((currentEntry) => currentEntry.inventoryItemId === entry.inventoryItemId
        ? {
            ...currentEntry,
            sessionQuantity: parsedValue,
            inputValue: String(parsedValue),
          }
        : currentEntry).filter((currentEntry) => currentEntry.sessionQuantity > 0));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Unable to update that quantity.");
    } finally {
      setSavingEntryId(null);
    }
  };

  const destinationSummary = destinationState?.space ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>{triggerLabel}</button>
      </DialogTrigger>
      <DialogContent style={{ width: "min(780px, calc(100vw - 32px))" }}>
        <DialogHeader>
          <DialogTitle>Quick Place</DialogTitle>
          <DialogDescription>
            {step === "destination"
              ? "Scan or choose the destination space, then keep scanning items into it."
              : step === "scan"
                ? "Each scan updates the selected space immediately and adds it to the running session list."
                : "Session complete. Review the items placed before closing this workflow."}
          </DialogDescription>
        </DialogHeader>

        {step === "destination" ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <label className="field field--full">
                <span>Scan Destination Space</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    ref={destinationInputRef}
                    type="text"
                    value={destinationLookup}
                    placeholder="Scan space QR or type the short code"
                    onChange={(event) => {
                      setDestinationLookup(event.target.value);
                      setDestinationError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void lookupDestination();
                      }
                    }}
                  />
                  <button type="button" className="button button--primary button--sm" disabled={destinationLoading} onClick={() => { void lookupDestination(); }}>
                    {destinationLoading ? "Resolving..." : "Use Scan"}
                  </button>
                </div>
              </label>

              <SpacePickerField
                label="Or Select a Destination"
                spaces={spaces}
                value={selectedSpaceId}
                onChange={(value) => setSelectedSpaceId(value)}
                placeholder="Choose a space"
                fullWidth
              />

              {destinationMatches.length > 1 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {destinationMatches.map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      className="button button--ghost"
                      style={{ justifyContent: "flex-start", textAlign: "left" }}
                      onClick={() => { void activateDestination(space.id); }}
                    >
                      {space.shortCode} • {space.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {destinationError ? <p className="form-error">{destinationError}</p> : null}
            </div>
          </div>
        ) : null}

        {step === "scan" && destinationSummary ? (
          <div style={{ display: "grid", gap: 18 }}>
            <section style={{ display: "grid", gap: 8, padding: 14, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-alt)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="pill">{getSpaceTypeBadge(destinationSummary.type)}</span>
                    <strong>{destinationSummary.name}</strong>
                    <span className="pill">{destinationSummary.shortCode}</span>
                  </div>
                  <div className="data-table__secondary">{formatSpaceBreadcrumb(destinationSummary)}</div>
                </div>
                {!initialSpaceId ? (
                  <button type="button" className="button button--ghost button--sm" onClick={() => setStep("destination")}>Change Destination</button>
                ) : null}
              </div>
            </section>

            <label className="field field--full">
              <span>Scan Inventory Item</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanValue}
                  placeholder="Scan an inventory QR or barcode"
                  disabled={scanLoading}
                  onChange={(event) => {
                    setScanValue(event.target.value);
                    setScanError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleScan();
                    }
                  }}
                />
                <button type="button" className="button button--primary button--sm" disabled={scanLoading} onClick={() => { void handleScan(); }}>
                  {scanLoading ? "Placing..." : "Place Item"}
                </button>
              </div>
            </label>

            {scanError ? <p className="form-error">{scanError}</p> : null}

            {scanCandidates.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {scanCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="button button--ghost"
                    style={{ justifyContent: "flex-start", textAlign: "left" }}
                    onClick={() => { void placeItem(candidate); }}
                  >
                    <span>{candidate.name}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{candidate.partNumber ?? candidate.category ?? candidate.unit}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <section style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>Placed This Session</h3>
                <span className="data-table__secondary">{entries.length} unique item{entries.length === 1 ? "" : "s"} • {totalPlacedCount} placed</span>
              </div>

              {entries.length === 0 ? (
                <div style={{ padding: 18, border: "1px dashed var(--border)", borderRadius: 14, color: "var(--ink-muted)" }}>
                  No items placed yet. Scan the first item to start the session.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {entries.map((entry) => (
                    <article key={entry.inventoryItemId} style={{ display: "grid", gap: 10, padding: 14, border: "1px solid var(--border)", borderRadius: 14 }}>
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong>{entry.name}</strong>
                          <span className="data-table__secondary">
                            {entry.partNumber ?? "No part number"}
                            {entry.baseQuantity !== undefined ? ` • was ${entry.baseQuantity ?? "unspecified"} in this space` : " • new placement"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          disabled={savingEntryId === entry.inventoryItemId}
                          onClick={() => { void commitEntryQuantity(entry, "0"); }}
                        >
                          Remove
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
                        <label className="field" style={{ minWidth: 180 }}>
                          <span>Quantity Placed</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.inputValue}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setEntries((current) => current.map((currentEntry) => currentEntry.inventoryItemId === entry.inventoryItemId
                                ? { ...currentEntry, inputValue: nextValue }
                                : currentEntry));
                            }}
                            onBlur={() => { void commitEntryQuantity(entry, entry.inputValue); }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void commitEntryQuantity(entry, entry.inputValue);
                              }
                            }}
                          />
                        </label>
                        <div className="data-table__secondary">
                          Total stored after this session: {(entry.baseQuantity ?? 0) + entry.sessionQuantity} {entry.unit}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {step === "summary" && destinationSummary ? (
          <div style={{ display: "grid", gap: 14 }}>
            <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-alt)" }}>
              <h3 style={{ margin: "0 0 8px" }}>Session Summary</h3>
              <p style={{ margin: 0 }}>
                Placed {totalPlacedCount} unit{totalPlacedCount === 1 ? "" : "s"} across {entries.length} unique item{entries.length === 1 ? "" : "s"}
                into {destinationSummary.name}.
              </p>
            </section>

            <div style={{ display: "grid", gap: 8 }}>
              {entries.map((entry) => (
                <div key={entry.inventoryItemId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                  <span>{entry.name}</span>
                  <strong>{entry.sessionQuantity}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              if (step === "scan" && entries.length > 0) {
                setStep("summary");
                router.refresh();
                return;
              }

              setOpen(false);
            }}
          >
            {step === "scan" && entries.length > 0 ? "Done" : "Close"}
          </button>
          {step === "destination" ? (
            <button
              type="button"
              className="button button--primary"
              disabled={!selectedSpaceId || destinationLoading}
              onClick={() => { void activateDestination(selectedSpaceId); }}
            >
              Continue to Scanning
            </button>
          ) : null}
          {step === "summary" ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setOpen(false);
                router.refresh();
              }}
            >
              Finish Session
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}