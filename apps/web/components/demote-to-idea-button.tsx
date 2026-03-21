"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { demoteToIdeaAction } from "../app/actions";

type DemoteToIdeaButtonProps = {
  householdId: string;
  sourceType: "project" | "asset" | "hobby";
  sourceId: string;
  sourceName: string;
};

const sourceLabels: Record<string, string> = {
  project: "project",
  asset: "asset",
  hobby: "hobby",
};

export function DemoteToIdeaButton({
  householdId,
  sourceType,
  sourceId,
  sourceName,
}: DemoteToIdeaButtonProps): JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDemote = useCallback(() => {
    startTransition(async () => {
      const result = await demoteToIdeaAction(householdId, {
        sourceType,
        sourceId,
      });
      setShowConfirm(false);
      setToast(result);
      setTimeout(() => setToast(null), 6000);
    });
  }, [householdId, sourceType, sourceId]);

  return (
    <div>
      {!showConfirm && !toast && (
        <button
          type="button"
          className="button button--ghost button--sm"
          onClick={() => setShowConfirm(true)}
        >
          Demote to Idea
        </button>
      )}

      {showConfirm && (
        <div className="demote-confirm">
          <p>
            This will create a new idea from <strong>{sourceName}</strong>&apos;s name and description.
            The {sourceLabels[sourceType]} itself will not be changed.
          </p>
          <div className="demote-confirm__actions">
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={handleDemote}
              disabled={isPending}
            >
              {isPending ? "Creating…" : "Confirm"}
            </button>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="demote-confirm" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
          <p>
            Idea created from {sourceLabels[sourceType]}.{" "}
            <Link href={`/ideas/${toast.id}`} className="text-link">
              View idea →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
