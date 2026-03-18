"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { deleteInventoryItemAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

type InventoryDangerActionsProps = {
  householdId: string;
  inventoryItemId: string;
  redirectTo: string;
};

export function InventoryDangerActions({ householdId, inventoryItemId, redirectTo }: InventoryDangerActionsProps): JSX.Element {
  const router = useRouter();

  return (
    <ConfirmDestructiveAction
      action={async () => undefined}
      triggerLabel="Delete Item"
      title="Delete inventory item"
      message="Remove this item from household inventory?"
      confirmLabel="Delete"
      triggerClassName="button button--danger"
      confirmClassName="button button--danger"
      cancelClassName="button button--ghost"
      className="inline-actions inline-actions--end"
      deferredAction={async () => {
        const formData = new FormData();
        formData.set("householdId", householdId);
        formData.set("inventoryItemId", inventoryItemId);
        formData.set("redirectTo", "none");
        await deleteInventoryItemAction(formData);
      }}
      onOptimisticAction={() => router.push(redirectTo)}
      onUndoRestore={() => router.push(`/inventory/${inventoryItemId}?householdId=${householdId}`)}
      toastMessage="Inventory item deleted."
    />
  );
}