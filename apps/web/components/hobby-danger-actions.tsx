"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveHobbyAction, deleteHobbyAction, restoreHobbyAction } from "../app/actions";
import { ConfirmDestructiveAction } from "./confirm-destructive-action";
import { getHobbyDeleteImpact } from "../lib/api";
import type { HobbyDeleteImpact } from "@aegis/types";

type HobbyDangerActionsProps = {
  householdId: string;
  hobbyId: string;
  isArchived: boolean;
};

function formatDeleteImpactMessage(impact: HobbyDeleteImpact): ReactNode {
  const parts: string[] = [];
  if (impact.sessions > 0) parts.push(`${impact.sessions} session${impact.sessions !== 1 ? "s" : ""}`);
  if (impact.recipes > 0) parts.push(`${impact.recipes} recipe${impact.recipes !== 1 ? "s" : ""}`);
  if (impact.series > 0) parts.push(`${impact.series} series`);
  if (impact.practiceGoals > 0) parts.push(`${impact.practiceGoals} practice goal${impact.practiceGoals !== 1 ? "s" : ""}`);
  if (impact.practiceRoutines > 0) parts.push(`${impact.practiceRoutines} practice routine${impact.practiceRoutines !== 1 ? "s" : ""}`);
  if (impact.metricDefinitions > 0) parts.push(`${impact.metricDefinitions} metric definition${impact.metricDefinitions !== 1 ? "s" : ""}`);
  if (impact.collectionItems > 0) parts.push(`${impact.collectionItems} collection item${impact.collectionItems !== 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return <>This hobby has no related records. <strong>This action cannot be undone.</strong></>;
  }
  const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return <>This will permanently delete the hobby and <strong>{joined}</strong>. <strong>This action cannot be undone.</strong></>;
}

export function HobbyDangerActions({
  householdId,
  hobbyId,
  isArchived,
}: HobbyDangerActionsProps): JSX.Element {
  const router = useRouter();
  const [deletePhase, setDeletePhase] = useState<"idle" | "loading" | "confirm">("idle");
  const [impactMessage, setImpactMessage] = useState<ReactNode>("");

  async function handleDeleteClick(): Promise<void> {
    setDeletePhase("loading");
    try {
      const impact = await getHobbyDeleteImpact(householdId, hobbyId);
      setImpactMessage(formatDeleteImpactMessage(impact));
    } catch {
      setImpactMessage(<><strong>This action cannot be undone.</strong></>);
    }
    setDeletePhase("confirm");
  }

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

      {deletePhase === "confirm" ? (
        <ConfirmDestructiveAction
          action={deleteHobbyAction}
          hiddenFields={[
            { name: "householdId", value: householdId },
            { name: "hobbyId", value: hobbyId },
          ]}
          triggerLabel="Delete Hobby"
          title="Delete hobby permanently"
          message={impactMessage}
          confirmLabel="Delete Permanently"
          triggerClassName="button button--danger button--sm"
          confirmClassName="button button--danger button--sm"
          defaultOpen
          tone="danger"
        />
      ) : (
        <button
          type="button"
          className="button button--danger button--sm"
          disabled={deletePhase === "loading"}
          onClick={() => { void handleDeleteClick(); }}
        >
          {deletePhase === "loading" ? "Loading\u2026" : "Delete Hobby"}
        </button>
      )}
    </div>
  );
}