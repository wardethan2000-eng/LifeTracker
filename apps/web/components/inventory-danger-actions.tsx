"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteInventoryItemAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";
import { getInventoryItemDeleteImpact } from "../lib/api";
import type { InventoryDeleteImpact } from "@lifekeeper/types";

type InventoryDangerActionsProps = {
  householdId: string;
  inventoryItemId: string;
  redirectTo: string;
};

function formatDeleteImpactMessage(impact: InventoryDeleteImpact): ReactNode {
  const parts: string[] = [];
  if (impact.maintenanceLogParts > 0) parts.push(`${impact.maintenanceLogParts} maintenance log part${impact.maintenanceLogParts !== 1 ? "s" : ""}`);
  if (impact.projectPhaseSupplies > 0) parts.push(`${impact.projectPhaseSupplies} project supply reference${impact.projectPhaseSupplies !== 1 ? "s" : ""}`);
  if (impact.hobbyRecipeIngredients > 0) parts.push(`${impact.hobbyRecipeIngredients} hobby recipe ingredient${impact.hobbyRecipeIngredients !== 1 ? "s" : ""}`);
  if (impact.hobbySessionIngredients > 0) parts.push(`${impact.hobbySessionIngredients} session material reference${impact.hobbySessionIngredients !== 1 ? "s" : ""}`);
  if (impact.assetLinks > 0) parts.push(`${impact.assetLinks} asset link${impact.assetLinks !== 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return <>This item has no related records. You have 8 seconds to undo.</>;
  }
  const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return <>Moving to Trash will also remove <strong>{joined}</strong>. You have 8\u00a0seconds to undo.</>;
}

export function InventoryDangerActions({ householdId, inventoryItemId, redirectTo }: InventoryDangerActionsProps): JSX.Element {
  const router = useRouter();
  const [deletePhase, setDeletePhase] = useState<"idle" | "loading" | "confirm">("idle");
  const [impactMessage, setImpactMessage] = useState<ReactNode>("");

  async function handleDeleteClick(): Promise<void> {
    setDeletePhase("loading");
    try {
      const impact = await getInventoryItemDeleteImpact(householdId, inventoryItemId);
      setImpactMessage(formatDeleteImpactMessage(impact));
    } catch {
      setImpactMessage(<>You have 8 seconds to undo after confirming.</>);
    }
    setDeletePhase("confirm");
  }

  if (deletePhase === "confirm") {
    return (
      <ConfirmDestructiveAction
        action={async () => undefined}
        triggerLabel="Delete Item"
        title="Move to Trash"
        message={impactMessage}
        confirmLabel="Move to Trash"
        triggerClassName="button button--danger"
        confirmClassName="button button--danger"
        cancelClassName="button button--ghost"
        className="inline-actions inline-actions--end"
        defaultOpen
        deferredAction={async () => {
          const formData = new FormData();
          formData.set("householdId", householdId);
          formData.set("inventoryItemId", inventoryItemId);
          formData.set("redirectTo", "none");
          await deleteInventoryItemAction(formData);
        }}
        onOptimisticAction={() => router.push(redirectTo)}
        onUndoRestore={() => router.push(`/inventory/${inventoryItemId}?householdId=${householdId}`)}
        toastMessage="Inventory item moved to Trash."
      />
    );
  }

  return (
    <button
      type="button"
      className="button button--danger"
      disabled={deletePhase === "loading"}
      onClick={() => { void handleDeleteClick(); }}
    >
      {deletePhase === "loading" ? "Loading\u2026" : "Delete Item"}
    </button>
  );
}