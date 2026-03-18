"use client";

import type { InventoryItemSummary, SpaceResponse } from "@lifekeeper/types";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { addGeneralItemToSpace, addItemToSpace } from "../app/actions";
import { SpaceForm } from "./space-form";

type SpaceDetailActionsProps = {
  householdId: string;
  space: SpaceResponse;
  spaces: SpaceResponse[];
  inventoryItems: InventoryItemSummary[];
};

type PanelMode = "edit" | "item" | "general" | "subspace" | null;

export function SpaceDetailActions({ householdId, space, spaces, inventoryItems }: SpaceDetailActionsProps): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode(null);
    setSaving(false);
    setError(null);
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Actions</h2>
      </div>
      <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="button button--primary button--sm" onClick={() => setMode("edit")}>Edit</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setMode("item")}>Add Item</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setMode("general")}>Add General Item</button>
          <button type="button" className="button button--ghost button--sm" onClick={() => setMode("subspace")}>Add Sub-Space</button>
          <button type="button" className="button button--ghost button--sm" disabled>Print QR</button>
        </div>

        {mode === "edit" ? (
          <SpaceForm
            householdId={householdId}
            spaces={spaces}
            initialSpace={space}
            onSaved={() => {
              close();
              router.refresh();
            }}
            onCancel={close}
          />
        ) : null}

        {mode === "subspace" ? (
          <SpaceForm
            householdId={householdId}
            spaces={spaces}
            initialParentSpaceId={space.id}
            onSaved={() => {
              close();
              router.refresh();
            }}
            onCancel={close}
          />
        ) : null}

        {mode === "item" ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const inventoryItemId = String(formData.get("inventoryItemId") ?? "").trim();
              const quantityRaw = String(formData.get("quantity") ?? "").trim();
              const notes = String(formData.get("notes") ?? "").trim();

              if (!inventoryItemId) {
                setError("Choose an inventory item.");
                return;
              }

              setSaving(true);
              setError(null);

              try {
                await addItemToSpace(householdId, space.id, {
                  inventoryItemId,
                  ...(quantityRaw ? { quantity: Number(quantityRaw) } : {}),
                  ...(notes ? { notes } : {})
                });
                close();
                router.refresh();
              } catch (submissionError) {
                setError(submissionError instanceof Error ? submissionError.message : "Failed to add the item to this space.");
                setSaving(false);
              }
            }}
          >
            <label className="field field--full">
              <span>Inventory Item</span>
              <select name="inventoryItemId" defaultValue="">
                <option value="" disabled>Select an item</option>
                {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Quantity in This Space</span>
              <input type="number" name="quantity" min="0" step="0.01" />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea name="notes" rows={3} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="inline-actions inline-actions--end field field--full">
              <button type="button" className="button button--ghost" onClick={close} disabled={saving}>Cancel</button>
              <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Add Item"}</button>
            </div>
          </form>
        ) : null}

        {mode === "general" ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const name = String(formData.get("name") ?? "").trim();
              const description = String(formData.get("description") ?? "").trim();
              const notes = String(formData.get("notes") ?? "").trim();

              if (!name) {
                setError("Name is required.");
                return;
              }

              setSaving(true);
              setError(null);

              try {
                await addGeneralItemToSpace(householdId, space.id, {
                  name,
                  ...(description ? { description } : {}),
                  ...(notes ? { notes } : {})
                });
                close();
                router.refresh();
              } catch (submissionError) {
                setError(submissionError instanceof Error ? submissionError.message : "Failed to add the general item.");
                setSaving(false);
              }
            }}
          >
            <label className="field field--full">
              <span>Name</span>
              <input type="text" name="name" required />
            </label>
            <label className="field field--full">
              <span>Description</span>
              <textarea name="description" rows={2} />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea name="notes" rows={3} />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="inline-actions inline-actions--end field field--full">
              <button type="button" className="button button--ghost" onClick={close} disabled={saving}>Cancel</button>
              <button type="submit" className="button button--primary" disabled={saving}>{saving ? "Saving…" : "Add General Item"}</button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}