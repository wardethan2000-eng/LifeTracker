"use client";

import type { InventoryItemDetail, SpaceResponse } from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { addItemToSpace, removeItemFromSpace } from "../app/actions";
import { flattenSpaceOptions, formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";

type InventoryItemLocationsPanelProps = {
  householdId: string;
  item: InventoryItemDetail;
  spaces: SpaceResponse[];
};

export function InventoryItemLocationsPanel({ householdId, item, spaces }: InventoryItemLocationsPanelProps): JSX.Element {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = flattenSpaceOptions(spaces);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Locations</h2>
        <button type="button" className="button button--ghost button--sm" onClick={() => setShowAssign((current) => !current)}>
          {showAssign ? "Close" : "Assign to Space"}
        </button>
      </div>
      {showAssign ? (
        <div className="panel__body--padded" style={{ borderBottom: "1px solid var(--border)" }}>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const spaceId = String(formData.get("spaceId") ?? "").trim();
              const quantityRaw = String(formData.get("quantity") ?? "").trim();

              if (!spaceId) {
                setError("Choose a space.");
                return;
              }

              setSaving(true);
              setError(null);

              try {
                await addItemToSpace(householdId, spaceId, {
                  inventoryItemId: item.id,
                  ...(quantityRaw ? { quantity: Number(quantityRaw) } : {})
                });
                setShowAssign(false);
                router.refresh();
              } catch (submissionError) {
                setError(submissionError instanceof Error ? submissionError.message : "Failed to assign item to space.");
                setSaving(false);
              }
            }}
          >
            <label className="field field--full">
              <span>Space</span>
              <select name="spaceId" defaultValue="">
                <option value="" disabled>Select a space</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.space.name}`}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity in This Space</span>
              <input type="number" name="quantity" min="0" step="0.01" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="inline-actions inline-actions--end field field--full">
              <button type="button" className="button button--ghost" onClick={() => setShowAssign(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Assign"}</button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="panel__body">
        {item.spaceLinks.length === 0 ? (
          <p className="panel__empty">This item is not assigned to any spaces yet.</p>
        ) : (
          <div className="schedule-stack">
            {item.spaceLinks.map((link) => (
              <article key={link.id} className="schedule-card">
                <div className="schedule-card__summary">
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="pill">{getSpaceTypeBadge(link.space.type)}</span>
                      <Link href={`/inventory/spaces/${link.space.id}?householdId=${householdId}`} className="data-table__link">{link.space.name}</Link>
                      <span className="pill">{link.space.shortCode}</span>
                      <span className="data-table__secondary">{getSpaceTypeLabel(link.space.type)}</span>
                    </div>
                    <div className="data-table__secondary">{formatSpaceBreadcrumb(link.space)}</div>
                    <div className="data-table__secondary">Quantity in this space: {link.quantity ?? "Not specified"}</div>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={async () => {
                      setSaving(true);
                      setError(null);

                      try {
                        await removeItemFromSpace(householdId, link.spaceId, item.id);
                        router.refresh();
                      } catch (submissionError) {
                        setError(submissionError instanceof Error ? submissionError.message : "Failed to remove location.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}