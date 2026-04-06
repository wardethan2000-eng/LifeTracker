"use client";

import type { JSX } from "react";
import { useState } from "react";
import { restoreInventoryItemAction, purgeInventoryItemAction } from "../app/actions";
import { useCoalescedRefresh } from "./use-coalesced-refresh";
import { useToast } from "./toast-provider";

type InventoryTrashActionsProps = {
  householdId: string;
  itemId: string;
  itemName: string;
};

export function InventoryTrashActions({ householdId, itemId, itemName }: InventoryTrashActionsProps): JSX.Element {
  const [status, setStatus] = useState<"idle" | "restoring" | "purging">("idle");
  const [confirmPurge, setConfirmPurge] = useState(false);
  const requestRefresh = useCoalescedRefresh();
  const { pushToast } = useToast();

  const handleRestore = async (): Promise<void> => {
    setStatus("restoring");
    try {
      await restoreInventoryItemAction(householdId, itemId);
      pushToast({ message: `"${itemName}" restored to inventory`, tone: "success" });
      requestRefresh();
    } catch {
      pushToast({ message: "Failed to restore item", tone: "danger" });
      setStatus("idle");
    }
  };

  const handlePurge = async (): Promise<void> => {
    setStatus("purging");
    try {
      await purgeInventoryItemAction(householdId, itemId);
      pushToast({ message: `"${itemName}" permanently deleted`, tone: "success" });
      requestRefresh();
    } catch {
      pushToast({ message: "Failed to permanently delete item", tone: "danger" });
      setStatus("idle");
    }
    setConfirmPurge(false);
  };

  if (status !== "idle") {
    return <span className="data-table__secondary">{status === "restoring" ? "Restoring…" : "Deleting…"}</span>;
  }

  if (confirmPurge) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="data-table__secondary" style={{ fontSize: "0.8rem" }}>Permanently delete?</span>
        <button
          type="button"
          className="button button--sm button--danger"
          onClick={() => { void handlePurge(); }}
        >
          Yes, delete
        </button>
        <button
          type="button"
          className="button button--sm button--ghost"
          onClick={() => setConfirmPurge(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        className="button button--sm button--primary"
        onClick={() => { void handleRestore(); }}
      >
        Restore
      </button>
      <button
        type="button"
        className="button button--sm button--ghost"
        style={{ color: "var(--danger)" }}
        onClick={() => setConfirmPurge(true)}
      >
        Delete permanently
      </button>
    </div>
  );
}
