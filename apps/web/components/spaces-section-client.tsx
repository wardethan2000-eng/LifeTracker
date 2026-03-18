"use client";

import type { SpaceResponse } from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { getHouseholdSpaces } from "../lib/api";
import { formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";
import { SpaceForm } from "./space-form";

type SpacesSectionClientProps = {
  householdId: string;
  spaces: SpaceResponse[];
};

const collectSpaceIds = (nodes: SpaceResponse[]): string[] => nodes.flatMap((space) => [
  space.id,
  ...(space.children ? collectSpaceIds(space.children) : [])
]);

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

export function SpacesSectionClient({ householdId, spaces }: SpacesSectionClientProps): JSX.Element {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [lookupValue, setLookupValue] = useState("");
  const [lookupResults, setLookupResults] = useState<SpaceResponse[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const allSpaceIds = collectSpaceIds(spaces);

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

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Spaces</h2>
          <div className="data-table__secondary">Track buildings, rooms, bins, and other storage locations in a household hierarchy.</div>
        </div>
        <div className="panel__header-actions">
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
        {spaces.length === 0 ? (
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
    </section>
  );
}