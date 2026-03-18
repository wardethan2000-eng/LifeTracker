"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { archiveAssetAction, softDeleteAssetAction, unarchiveAssetAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

type AssetDangerActionsProps = {
  householdId: string;
  assetId: string;
  isArchived: boolean;
};

export function AssetDangerActions({
  householdId,
  assetId,
  isArchived,
}: AssetDangerActionsProps): JSX.Element {
  const router = useRouter();

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

      <ConfirmDestructiveAction
        action={async () => undefined}
        triggerLabel="Delete"
        title="Delete asset"
        message="Are you sure?"
        deferredAction={async () => {
          const formData = new FormData();
          formData.set("assetId", assetId);
          formData.set("householdId", householdId);
          formData.set("redirectTo", "none");
          await softDeleteAssetAction(formData);
        }}
        onOptimisticAction={() => router.push("/assets")}
        onUndoRestore={() => router.push(`/assets/${assetId}`)}
        toastMessage="Asset removed from the workspace."
      />
    </div>
  );
}
