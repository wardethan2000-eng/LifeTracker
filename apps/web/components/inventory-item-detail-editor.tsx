"use client";

import type { InventoryItemSummary } from "@aegis/types";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { InventoryItemEditForm } from "./inventory-item-edit-form";

type InventoryItemDetailEditorProps = {
  householdId: string;
  item: InventoryItemSummary;
};

export function InventoryItemDetailEditor({ householdId, item }: InventoryItemDetailEditorProps): JSX.Element {
  const router = useRouter();

  return (
    <InventoryItemEditForm
      householdId={householdId}
      item={item}
      onSaved={() => {
        router.refresh();
      }}
      onCancel={() => {
        router.back();
      }}
    />
  );
}