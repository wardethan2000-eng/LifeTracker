"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProjectAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";
import { getProjectDeleteImpact } from "../lib/api";
import type { ProjectDeleteImpact } from "@aegis/types";

type ProjectDangerActionsProps = {
  householdId: string;
  projectId: string;
};

function formatDeleteImpactMessage(impact: ProjectDeleteImpact): ReactNode {
  const parts: string[] = [];
  if (impact.tasks > 0) parts.push(`${impact.tasks} task${impact.tasks !== 1 ? "s" : ""}`);
  if (impact.phases > 0) parts.push(`${impact.phases} phase${impact.phases !== 1 ? "s" : ""}`);
  if (impact.expenses > 0) parts.push(`${impact.expenses} expense${impact.expenses !== 1 ? "s" : ""}`);
  if (impact.budgetCategories > 0) parts.push(`${impact.budgetCategories} budget categor${impact.budgetCategories !== 1 ? "ies" : "y"}`);
  if (impact.linkedAssets > 0) parts.push(`${impact.linkedAssets} linked asset${impact.linkedAssets !== 1 ? "s" : ""}`);
  if (impact.linkedInventoryItems > 0) parts.push(`${impact.linkedInventoryItems} linked inventory item${impact.linkedInventoryItems !== 1 ? "s" : ""}`);
  if (impact.comments > 0) parts.push(`${impact.comments} comment${impact.comments !== 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return <>This project has no related records. You have 8 seconds to undo.</>;
  }
  const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return <>Moving to Trash will also remove <strong>{joined}</strong>. You have 8\u00a0seconds to undo.</>;
}

export function ProjectDangerActions({ householdId, projectId }: ProjectDangerActionsProps): JSX.Element {
  const router = useRouter();
  const [deletePhase, setDeletePhase] = useState<"idle" | "loading" | "confirm">("idle");
  const [impactMessage, setImpactMessage] = useState<ReactNode>("");

  async function handleDeleteClick(): Promise<void> {
    setDeletePhase("loading");
    try {
      const impact = await getProjectDeleteImpact(householdId, projectId);
      setImpactMessage(formatDeleteImpactMessage(impact));
    } catch {
      setImpactMessage(<>You have 8 seconds to undo after confirming.</>);
    }
    setDeletePhase("confirm");
  }

  if (deletePhase === "confirm") {
    return (
      <ConfirmDestructiveAction
        action={async () => undefined}
        triggerLabel="Delete Project"
        title="Move to Trash"
        message={impactMessage}
        confirmLabel="Move to Trash"
        triggerClassName="button button--danger"
        confirmClassName="button button--danger"
        cancelClassName="button button--ghost"
        className="inline-actions inline-actions--end"
        defaultOpen
        deferredAction={async () => {
          const formData = new FormData();
          formData.set("householdId", householdId);
          formData.set("projectId", projectId);
          formData.set("redirectTo", "none");
          await deleteProjectAction(formData);
        }}
        onOptimisticAction={() => router.push(`/projects?householdId=${householdId}`)}
        onUndoRestore={() => router.push(`/projects/${projectId}?householdId=${householdId}`)}
        toastMessage="Project moved to Trash."
      />
    );
  }

  return (
    <button
      type="button"
      className="button button--danger"
      disabled={deletePhase === "loading"}
      onClick={() => { void handleDeleteClick(); }}
    >
      {deletePhase === "loading" ? "Loading\u2026" : "Delete Project"}
    </button>
  );
}