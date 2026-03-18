"use client";

import type { InventoryItemDetail, SpaceResponse } from "@lifekeeper/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { addItemToSpace, removeItemFromSpace } from "../app/actions";
import { formatSpaceBreadcrumb, getSpaceTypeBadge, getSpaceTypeLabel } from "../lib/spaces";
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

type InventoryItemLocationsPanelProps = {
  householdId: string;
  item: InventoryItemDetail;
  spaces: SpaceResponse[];
};

const flattenSpaceChoices = (nodes: SpaceResponse[], depth = 0): Array<{ id: string; label: string }> => nodes.flatMap((space) => [
  { id: space.id, label: `${"— ".repeat(depth)}${space.name}` },
  ...(space.children ? flattenSpaceChoices(space.children, depth + 1) : []),
]);

export function InventoryItemLocationsPanel({ householdId, item, spaces }: InventoryItemLocationsPanelProps): JSX.Element {
  const router = useRouter();
  const { pushToast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<{ mode: "move" | "split"; linkId: string } | null>(null);
  const [destinationSpaceId, setDestinationSpaceId] = useState("");
  const [splitQuantity, setSplitQuantity] = useState("");
  const assignOptions = flattenSpaceChoices(spaces);

  const activeLink = operation ? item.spaceLinks.find((link) => link.id === operation.linkId) ?? null : null;

  const closeOperation = (): void => {
    setOperation(null);
    setDestinationSpaceId("");
    setSplitQuantity("");
    setError(null);
  };

  const applyMoveOrSplit = async (): Promise<void> => {
    if (!activeLink || !operation) {
      return;
    }

    if (!destinationSpaceId) {
      setError("Choose a destination space.");
      return;
    }

    if (destinationSpaceId === activeLink.spaceId) {
      setError("Choose a different destination space.");
      return;
    }

    const destinationExistingLink = item.spaceLinks.find((link) => link.spaceId === destinationSpaceId && link.id !== activeLink.id) ?? null;

    try {
      setSaving(true);
      setError(null);

      if (operation.mode === "move") {
        if (activeLink.quantity === null) {
          if (destinationExistingLink) {
            throw new Error("Cannot move an unspecified quantity into a space that already has this item linked.");
          }

          await removeItemFromSpace(householdId, activeLink.spaceId, item.id);
          await addItemToSpace(householdId, destinationSpaceId, { inventoryItemId: item.id });
        } else {
          if (destinationExistingLink?.quantity === null) {
            throw new Error("Cannot move into a destination whose quantity is currently unspecified.");
          }

          await removeItemFromSpace(householdId, activeLink.spaceId, item.id);
          await addItemToSpace(householdId, destinationSpaceId, {
            inventoryItemId: item.id,
            quantity: activeLink.quantity + (destinationExistingLink?.quantity ?? 0),
          });
        }

        pushToast({ message: `${item.name} moved to the new space.` });
      }

      if (operation.mode === "split") {
        if (activeLink.quantity === null) {
          throw new Error("You can only split locations that already have a numeric quantity.");
        }

        const parsedQuantity = Number(splitQuantity);

        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
          throw new Error("Enter a split quantity greater than zero.");
        }

        if (parsedQuantity > activeLink.quantity) {
          throw new Error("Split quantity cannot exceed the quantity currently in this space.");
        }

        if (destinationExistingLink?.quantity === null) {
          throw new Error("Cannot split into a destination whose quantity is currently unspecified.");
        }

        const sourceRemaining = activeLink.quantity - parsedQuantity;

        await removeItemFromSpace(householdId, activeLink.spaceId, item.id);

        if (sourceRemaining > 0) {
          await addItemToSpace(householdId, activeLink.spaceId, {
            inventoryItemId: item.id,
            quantity: sourceRemaining,
          });
        }

        await addItemToSpace(householdId, destinationSpaceId, {
          inventoryItemId: item.id,
          quantity: parsedQuantity + (destinationExistingLink?.quantity ?? 0),
        });

        pushToast({ message: `${parsedQuantity} ${item.unit} moved into the new space.` });
      }

      closeOperation();
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to update item locations.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
                  pushToast({ message: `${item.name} assigned to the selected space.` });
                  router.refresh();
                } catch (submissionError) {
                  setError(submissionError instanceof Error ? submissionError.message : "Failed to assign item to space.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label className="field field--full">
                <span>Space</span>
                <select name="spaceId" defaultValue="">
                  <option value="" disabled>Select a space</option>
                  {assignOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
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
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        disabled={saving}
                        onClick={() => {
                          setOperation({ mode: "move", linkId: link.id });
                          setDestinationSpaceId("");
                          setSplitQuantity("");
                          setError(null);
                        }}
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        disabled={saving || link.quantity === null}
                        onClick={() => {
                          setOperation({ mode: "split", linkId: link.id });
                          setDestinationSpaceId("");
                          setSplitQuantity(link.quantity ? String(Math.min(link.quantity, 1)) : "");
                          setError(null);
                        }}
                        title={link.quantity === null ? "Set a quantity on this location before splitting it." : undefined}
                      >
                        Split
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--sm"
                        onClick={async () => {
                          setSaving(true);
                          setError(null);

                          try {
                            await removeItemFromSpace(householdId, link.spaceId, item.id);
                            pushToast({ message: `${item.name} removed from ${link.space.name}.` });
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
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={Boolean(operation && activeLink)} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeOperation();
        }
      }}>
        <DialogContent style={{ width: "min(560px, calc(100vw - 32px))" }}>
          <DialogHeader>
            <DialogTitle>{operation?.mode === "move" ? "Move Item Between Spaces" : "Split Item Between Spaces"}</DialogTitle>
            <DialogDescription>
              {operation?.mode === "move"
                ? "Move the current location entry into a new destination space."
                : "Move part of the current quantity into a different destination space while keeping the remainder here."}
            </DialogDescription>
          </DialogHeader>

          {activeLink ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface-alt)" }}>
                <strong>{activeLink.space.name}</strong>
                <div className="data-table__secondary">Current quantity: {activeLink.quantity ?? "Not specified"}</div>
              </div>

              <SpacePickerField
                label="Destination Space"
                spaces={spaces}
                value={destinationSpaceId}
                onChange={setDestinationSpaceId}
                placeholder="Choose a destination space"
                excludedSpaceIds={[activeLink.spaceId]}
                fullWidth
                disabled={saving}
              />

              {operation?.mode === "split" ? (
                <label className="field field--full">
                  <span>Quantity to Move</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={splitQuantity}
                    disabled={saving}
                    onChange={(event) => setSplitQuantity(event.target.value)}
                  />
                </label>
              ) : null}

              {error ? <p className="form-error">{error}</p> : null}
            </div>
          ) : null}

          <DialogFooter>
            <button type="button" className="button button--ghost" disabled={saving} onClick={closeOperation}>Cancel</button>
            <button type="button" className="button button--primary" disabled={saving || !activeLink} onClick={() => { void applyMoveOrSplit(); }}>
              {saving ? "Saving…" : operation?.mode === "move" ? "Move" : "Split"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}