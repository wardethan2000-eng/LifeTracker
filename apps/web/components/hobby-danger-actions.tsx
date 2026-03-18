"use client";

import type { JSX } from "react";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

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

      <ConfirmDestructiveAction
        action={deleteAction}
        hiddenFields={[
          { name: "householdId", value: householdId },
          { name: "hobbyId", value: hobbyId },
        ]}
        triggerLabel="Delete Hobby"
        title="Delete hobby"
        message="Delete this hobby and all related records?"
      />
    </div>
  );
}