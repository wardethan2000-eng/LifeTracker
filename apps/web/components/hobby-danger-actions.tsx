"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { archiveHobbyAction, deleteHobbyAction, restoreHobbyAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

type HobbyDangerActionsProps = {
  householdId: string;
  hobbyId: string;
  isArchived: boolean;
};

export function HobbyDangerActions({
  householdId,
  hobbyId,
  isArchived,
}: HobbyDangerActionsProps): JSX.Element {
  const router = useRouter();

  return (
    <div className="asset-danger-actions">
      {isArchived ? (
        <form
          action={async () => {
            const formData = new FormData();
            formData.set("householdId", householdId);
            formData.set("hobbyId", hobbyId);
            await restoreHobbyAction(formData);
            router.refresh();
          }}
        >
          <button type="submit" className="button button--ghost button--sm">
            Restore to Active
          </button>
        </form>
      ) : (
        <ConfirmDestructiveAction
          action={async () => undefined}
          triggerLabel="Archive Hobby"
          title="Archive hobby"
          message="Archive this hobby and hide it from the active workspace?"
          confirmLabel="Archive"
          triggerClassName="button button--ghost button--sm"
          confirmClassName="button button--ghost button--sm"
          deferredAction={async () => {
            const formData = new FormData();
            formData.set("householdId", householdId);
            formData.set("hobbyId", hobbyId);
            formData.set("redirectTo", "none");
            await archiveHobbyAction(formData);
          }}
          onOptimisticAction={() => router.push("/hobbies")}
          onUndoRestore={() => router.push(`/hobbies/${hobbyId}`)}
          toastMessage="Hobby archived."
        />
      )}

      <ConfirmDestructiveAction
        action={async () => undefined}
        triggerLabel="Delete Hobby"
        title="Delete hobby"
        message="Delete this hobby and all related records?"
        deferredAction={async () => {
          const formData = new FormData();
          formData.set("householdId", householdId);
          formData.set("hobbyId", hobbyId);
          formData.set("redirectTo", "none");
          await deleteHobbyAction(formData);
        }}
        onOptimisticAction={() => router.push("/hobbies")}
        onUndoRestore={() => router.push(`/hobbies/${hobbyId}`)}
        toastMessage="Hobby deleted."
      />
    </div>
  );
}