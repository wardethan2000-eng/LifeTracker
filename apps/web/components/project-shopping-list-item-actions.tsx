"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import type { ProjectShoppingListItem } from "@lifekeeper/types";
import {
  allocateSupplyFromInventoryAction,
  updateProjectPhaseSupplyAction
} from "../app/actions";
import { ExpandableCard } from "./expandable-card";

type ProjectShoppingListItemActionsProps = {
  householdId: string;
  item: ProjectShoppingListItem;
};

function getPhaseFocusHref(householdId: string, projectId: string, phaseId: string): string {
  return `/projects/${projectId}?householdId=${householdId}&focusPhaseId=${phaseId}#phase-${phaseId}`;
}

export function ProjectShoppingListItemActions({ householdId, item }: ProjectShoppingListItemActionsProps): JSX.Element {
  const [isProcurementOpen, setIsProcurementOpen] = useState(false);
  const [actualUnitCost, setActualUnitCost] = useState(item.estimatedUnitCost?.toString() ?? "");
  const [receivedQuantity, setReceivedQuantity] = useState(item.quantityRemaining.toString());
  const [notes, setNotes] = useState("");

  const allocatableQuantity = Math.min(item.quantityRemaining, item.inventoryItem?.quantityOnHand ?? 0);
  const parsedReceivedQuantity = Number(receivedQuantity);
  const safeReceivedQuantity = Number.isFinite(parsedReceivedQuantity) && parsedReceivedQuantity > 0
    ? parsedReceivedQuantity
    : 0;
  const nextQuantityOnHand = Math.min(item.quantityOnHand + safeReceivedQuantity, item.quantityNeeded);
  const willBeProcured = nextQuantityOnHand >= item.quantityNeeded;
  const projectedLineCost = safeReceivedQuantity > 0 && actualUnitCost
    ? safeReceivedQuantity * Number(actualUnitCost)
    : null;

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link href={getPhaseFocusHref(householdId, item.projectId, item.phaseId)} className="button button--ghost button--sm">
          Open Phase
        </Link>
        {allocatableQuantity > 0 ? (
          <form action={allocateSupplyFromInventoryAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={item.projectId} />
            <input type="hidden" name="phaseId" value={item.phaseId} />
            <input type="hidden" name="supplyId" value={item.id} />
            <input type="hidden" name="quantity" value={String(allocatableQuantity)} />
            <button type="submit" className="button button--ghost button--sm" title={`Allocate ${allocatableQuantity} ${item.unit} from inventory`}>
              Use Stock
            </button>
          </form>
        ) : null}
        <button type="button" className="button button--ghost button--sm" onClick={() => setIsProcurementOpen((current) => !current)}>
          {isProcurementOpen ? "Close Procurement" : "Procure"}
        </button>
      </div>

      {isProcurementOpen ? (
        <div style={{ marginTop: 12, minWidth: 340 }}>
          <ExpandableCard
            title={`Procure ${item.name}`}
            modalTitle={`Procure ${item.name}`}
            open={isProcurementOpen}
            onOpenChange={setIsProcurementOpen}
            previewContent={(
              <div className="compact-preview">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <span className="compact-preview__pill">{item.quantityRemaining} {item.unit} remaining</span>
                  <span className="compact-preview__pill">{item.quantityOnHand}/{item.quantityNeeded} on hand</span>
                  {item.estimatedLineCost != null ? (
                    <span className="compact-preview__pill">~${item.estimatedLineCost.toFixed(2)} estimated</span>
                  ) : null}
                </div>
                <p className="compact-preview__overflow">Record partial receipts, actual pricing, and procurement notes inline.</p>
              </div>
            )}
          >
          <form action={updateProjectPhaseSupplyAction} className="workbench-form">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={item.projectId} />
            <input type="hidden" name="phaseId" value={item.phaseId} />
            <input type="hidden" name="supplyId" value={item.id} />
            <input type="hidden" name="name" value={item.name} />
            <input type="hidden" name="quantityOnHand" value={String(nextQuantityOnHand)} />
            <input type="hidden" name="isProcured" value={willBeProcured ? "true" : "false"} />
            <div className="workbench-grid">
              <label className="field field--full">
                <span>Received Quantity</span>
                <input
                  name="receivedQuantityDisplay"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={item.quantityRemaining}
                  value={receivedQuantity}
                  onChange={(event) => setReceivedQuantity(event.target.value)}
                  required
                />
                <small>
                  Remaining need: {item.quantityRemaining} {item.unit}. This updates on-hand to {nextQuantityOnHand} {item.unit}.
                </small>
              </label>
              <label className="field field--full">
                <span>Actual Unit Cost</span>
                <input
                  name="actualUnitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualUnitCost}
                  onChange={(event) => setActualUnitCost(event.target.value)}
                  required
                />
                <small>
                  {projectedLineCost !== null
                    ? `Captured line cost: $${projectedLineCost.toFixed(2)}`
                    : "Enter the actual checkout price per unit."}
                </small>
              </label>
              <label className="field field--full">
                <span>Procurement Notes</span>
                <textarea
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Receipt reference, order number, substitution notes, or delivery timing."
                />
              </label>
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="button">
                {willBeProcured ? "Record Purchase" : "Record Partial Purchase"}
              </button>
              <button type="button" className="button button--ghost" onClick={() => setIsProcurementOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
          </ExpandableCard>
        </div>
      ) : null}
    </>
  );
}