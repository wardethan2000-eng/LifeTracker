"use client";

import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { deleteProjectAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";

type ProjectDangerActionsProps = {
  householdId: string;
  projectId: string;
};

export function ProjectDangerActions({ householdId, projectId }: ProjectDangerActionsProps): JSX.Element {
  const router = useRouter();

  return (
    <ConfirmDestructiveAction
      action={async () => undefined}
      triggerLabel="Delete Project"
      title="Delete project"
      message="Delete this project and all related records?"
      confirmLabel="Yes, delete"
      triggerClassName="button button--danger"
      confirmClassName="button button--danger"
      cancelClassName="button button--ghost"
      className="inline-actions inline-actions--end"
      deferredAction={async () => {
        const formData = new FormData();
        formData.set("householdId", householdId);
        formData.set("projectId", projectId);
        formData.set("redirectTo", "none");
        await deleteProjectAction(formData);
      }}
      onOptimisticAction={() => router.push(`/projects?householdId=${householdId}`)}
      onUndoRestore={() => router.push(`/projects/${projectId}?householdId=${householdId}`)}
      toastMessage="Project deleted."
    />
  );
}