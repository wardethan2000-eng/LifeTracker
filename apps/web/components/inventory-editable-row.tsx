"use client";

import type { InventoryItemSummary } from "@lifekeeper/types";
import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";
import { ExpandModal } from "./expand-modal";
import { InventoryItemEditForm } from "./inventory-item-edit-form";

type InventoryEditableRowProps = {
  householdId: string;
  item: InventoryItemSummary;
  className?: string;
  children: ReactNode;
};

export function InventoryEditableRow({ householdId, item, className, children }: InventoryEditableRowProps): JSX.Element {
  const [editing, setEditing] = useState(false);

  const handleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleSaved = useCallback(() => {
    setEditing(false);
    window.location.reload();
  }, []);

  return (
    <>
      <tr
        className={className}
        style={{ cursor: "pointer" }}
        onClick={handleClick}
        title="Click to edit"
      >
        {children}
      </tr>
      {editing && (
        <ExpandModal title={`Edit: ${item.name}`} onClose={() => setEditing(false)}>
          <InventoryItemEditForm
            householdId={householdId}
            item={item}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        </ExpandModal>
      )}
    </>
  );
}
