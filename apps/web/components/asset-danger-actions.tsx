"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveAssetAction, softDeleteAssetAction, unarchiveAssetAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";
import { getAssetDeleteImpact } from "../lib/api";
import type { AssetDeleteImpact } from "@lifekeeper/types";

type AssetDangerActionsProps = {
  householdId: string;
  assetId: string;
  isArchived: boolean;
};

function formatDeleteImpactMessage(impact: AssetDeleteImpact): ReactNode {
  const parts: string[] = [];
  if (impact.schedules > 0) parts.push(`${impact.schedules} maintenance schedule${impact.schedules !== 1 ? "s" : ""}`);
  if (impact.logs > 0) parts.push(`${impact.logs} maintenance log${impact.logs !== 1 ? "s" : ""}`);
  if (impact.entries > 0) parts.push(`${impact.entries} journal entr${impact.entries !== 1 ? "ies" : "y"}`);
  if (impact.comments > 0) parts.push(`${impact.comments} comment${impact.comments !== 1 ? "s" : ""}`);
  if (impact.transfers > 0) parts.push(`${impact.transfers} transfer record${impact.transfers !== 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return <>This asset has no related records. You have 8 seconds to undo.</>;
  }
  const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return <>Moving to Trash will also remove <strong>{joined}</strong>. You have 8\u00a0seconds to undo.</>;
}

export function AssetDangerActions({
  householdId,
  assetId,
  isArchived,
}: AssetDangerActionsProps): JSX.Element {
  const router = useRouter();
  const [deletePhase, setDeletePhase] = useState<"idle" | "loading" | "confirm">("idle");
  const [impactMessage, setImpactMessage] = useState<ReactNode>("");

  async function handleDeleteClick(): Promise<void> {
    setDeletePhase("loading");
    try {
      const impact = await getAssetDeleteImpact(assetId);
      setImpactMessage(formatDeleteImpactMessage(impact));
    } catch {
      setImpactMessage(<>You have 8 seconds to undo after confirming.</>);
    }
    setDeletePhase("confirm");
  }

  return (
    <div className="asset-danger-actions">
      {isArchived ? (
        <form
          action={async () => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("householdId", householdId);
            await unarchiveAssetAction(formData);
            router.refresh();
          }}
        >
          <button type="submit" className="button button--ghost button--sm">
            Unarchive
          </button>
        </form>
      ) : (
        <ConfirmDestructiveAction
          action={async () => undefined}
          triggerLabel="Archive"
          title="Archive asset"
          message="Archive this asset and remove it from the active workspace?"
          confirmLabel="Archive"
          triggerClassName="button button--ghost button--sm"
          confirmClassName="button button--ghost button--sm"
          deferredAction={async () => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("householdId", householdId);
            formData.set("redirectTo", "none");
            await archiveAssetAction(formData);
          }}
          onOptimisticAction={() => router.push("/assets")}
          onUndoRestore={() => router.push(`/assets/${assetId}`)}
          toastMessage="Asset archived."
        />
      )}

      {deletePhase === "confirm" ? (
        <ConfirmDestructiveAction
          action={async () => undefined}
          triggerLabel="Delete"
          title="Move to Trash"
          message={impactMessage}
          confirmLabel="Move to Trash"
          defaultOpen
          deferredAction={async () => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("householdId", householdId);
            formData.set("redirectTo", "none");
            await softDeleteAssetAction(formData);
          }}
          onOptimisticAction={() => router.push("/assets")}
          onUndoRestore={() => router.push(`/assets/${assetId}`)}
          toastMessage="Asset moved to Trash."
        />
      ) : (
        <button
          type="button"
          className="button button--danger button--sm"
          disabled={deletePhase === "loading"}
          onClick={() => { void handleDeleteClick(); }}
        >
          {deletePhase === "loading" ? "Loading\u2026" : "Delete"}
        </button>
      )}
    </div>
  );
}
