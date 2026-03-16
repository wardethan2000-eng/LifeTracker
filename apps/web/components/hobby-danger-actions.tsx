"use client";

import type { JSX } from "react";
import { useState } from "react";

type HobbyDangerActionsProps = {
  householdId: string;
  hobbyId: string;
  isArchived: boolean;
  archiveAction: (formData: FormData) => void | Promise<void>;
  restoreAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

export function HobbyDangerActions({
  householdId,
  hobbyId,
  isArchived,
  archiveAction,
  restoreAction,
  deleteAction,
}: HobbyDangerActionsProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="asset-danger-actions">
      {isArchived ? (
        <form action={restoreAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="hobbyId" value={hobbyId} />
          <button type="submit" className="button button--ghost button--sm">
            Restore to Active
          </button>
        </form>
      ) : (
        <form action={archiveAction}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="hobbyId" value={hobbyId} />
          <button type="submit" className="button button--ghost button--sm">
            Archive Hobby
          </button>
        </form>
      )}

      {!confirmDelete ? (
        <button type="button" className="button button--danger button--sm" onClick={() => setConfirmDelete(true)}>
          Delete Hobby
        </button>
      ) : (
        <div className="asset-danger-actions__confirm">
          <span>Delete this hobby and all related records?</span>
          <form action={deleteAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="hobbyId" value={hobbyId} />
            <button type="submit" className="button button--danger button--sm">
              Yes, delete
            </button>
          </form>
          <button type="button" className="button button--ghost button--sm" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}