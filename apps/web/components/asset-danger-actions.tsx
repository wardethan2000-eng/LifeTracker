"use client";

import type { JSX } from "react";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

type AssetDangerActionsProps = {
  assetId: string;
  isArchived: boolean;
  archiveAction: (formData: FormData) => void | Promise<void>;
  unarchiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

export function AssetDangerActions({
  assetId,
  isArchived,
  archiveAction,
  unarchiveAction,
  deleteAction,
}: AssetDangerActionsProps): JSX.Element {
  return (
    <div className="asset-danger-actions">
      {isArchived ? (
        <form action={unarchiveAction}>
          <input type="hidden" name="assetId" value={assetId} />
          <button type="submit" className="button button--ghost button--sm">
            Unarchive
          </button>
        </form>
      ) : (
        <form action={archiveAction}>
          <input type="hidden" name="assetId" value={assetId} />
          <button type="submit" className="button button--ghost button--sm">
            Archive
          </button>
        </form>
      )}

      <ConfirmDestructiveAction
        action={deleteAction}
        hiddenFields={[{ name: "assetId", value: assetId }]}
        triggerLabel="Delete"
        title="Delete asset"
        message="Are you sure?"
      />
    </div>
  );
}
