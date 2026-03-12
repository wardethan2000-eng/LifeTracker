"use client";

import type { JSX } from "react";
import { useState } from "react";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

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

      {!confirmDelete ? (
        <button
          type="button"
          className="button button--danger button--sm"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      ) : (
        <div className="asset-danger-actions__confirm">
          <span>Are you sure?</span>
          <form action={deleteAction}>
            <input type="hidden" name="assetId" value={assetId} />
            <button type="submit" className="button button--danger button--sm">
              Yes, delete
            </button>
          </form>
          <button
            type="button"
            className="button button--ghost button--sm"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
