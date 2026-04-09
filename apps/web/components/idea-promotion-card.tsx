"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { IdeaPromotionTarget } from "@aegis/types";
import { promoteIdeaAction, updateIdeaAction } from "../app/actions";
import { Card } from "./card";
import { useFormattedDate } from "../lib/formatted-date";

const targetLabels: Record<string, string> = {
  project: "Project",
  asset: "Asset",
  hobby: "Hobby",
};

const targetRoutes: Record<string, string> = {
  project: "/projects",
  asset: "/assets",
  hobby: "/hobbies",
};

const targetDescriptions: Record<string, string> = {
  project: "Plan with phases, tasks, budget, and a timeline",
  asset: "Something to track and maintain over time",
  hobby: "A pursuit to log sessions and progress for",
};

type IdeaPromotionCardProps = {
  householdId: string;
  ideaId: string;
  title: string;
  description: string | null;
  stepCount: number;
  promotionTarget: IdeaPromotionTarget | null;
  promotedAt: string | null;
  promotedToType: IdeaPromotionTarget | null;
  promotedToId: string | null;
  demotedFromType: IdeaPromotionTarget | null;
  demotedFromId: string | null;
};

function getCarryOverPreview(target: IdeaPromotionTarget, stepCount: number, convertSteps: boolean): string {
  switch (target) {
    case "project":
      if (stepCount > 0 && convertSteps) {
        return `${stepCount} step${stepCount === 1 ? "" : "s"} will be created as unphased project tasks.`;
      }
      return "Title and description will be set on the new project.";
    case "asset":
      return "Title and description will be set. Category will default to 'other'.";
    case "hobby":
      return "Title and description will be set. Activity mode defaults to 'session'.";
  }
}

export function IdeaPromotionCard({
  householdId,
  ideaId,
  title,
  description,
  stepCount,
  promotionTarget,
  promotedAt,
  promotedToType,
  promotedToId,
  demotedFromType,
  demotedFromId,
}: IdeaPromotionCardProps): JSX.Element {
  const router = useRouter();
  const { formatDate } = useFormattedDate();
  const [localTarget, setLocalTarget] = useState<IdeaPromotionTarget | null>(promotionTarget);
  const [showPromoteForm, setShowPromoteForm] = useState(false);
  const [promoteName, setPromoteName] = useState(title);
  const [promoteDescription, setPromoteDescription] = useState(description ?? "");
  const [convertStepsToTasks, setConvertStepsToTasks] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleTargetSelect = useCallback(
    (value: IdeaPromotionTarget) => {
      setLocalTarget(value);
      startTransition(async () => {
        await updateIdeaAction(householdId, ideaId, { promotionTarget: value });
      });
    },
    [householdId, ideaId]
  );

  const handlePromote = useCallback(() => {
    if (!localTarget) return;
    startTransition(async () => {
      const result = await promoteIdeaAction(householdId, ideaId, {
        target: localTarget,
        name: promoteName.trim() || undefined,
        description: promoteDescription.trim() || undefined,
        ...(localTarget === "project" && stepCount > 0 ? { convertStepsToTasks } : {}),
      });
      const route = targetRoutes[result.type];
      if (route) {
        router.push(`${route}/${result.id}`);
      }
    });
  }, [localTarget, householdId, ideaId, promoteName, promoteDescription, router]);

  // Already promoted
  if (promotedAt && promotedToType && promotedToId) {
    const formattedDate = formatDate(promotedAt);
    return (
      <Card title="Promotion">
        <div style={{ fontSize: "0.85rem" }}>
          <p>
            Promoted to{" "}
            <Link
              href={`${targetRoutes[promotedToType]}/${promotedToId}`}
              className="text-link"
            >
              {targetLabels[promotedToType]}
            </Link>{" "}
            on {formattedDate}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Promotion Target">
      <div style={{ display: "grid", gap: 10, opacity: isPending ? 0.7 : 1 }}>
        {/* Demoted from note */}
        {demotedFromType && demotedFromId && (
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)", padding: "6px 8px", background: "var(--surface-alt)", borderRadius: "var(--radius-lg)" }}>
            Demoted from{" "}
            <Link
              href={`${targetRoutes[demotedFromType]}/${demotedFromId}`}
              className="text-link"
            >
              {targetLabels[demotedFromType]}
            </Link>
          </div>
        )}

        {!showPromoteForm && (
          <>
            <div className="promotion-targets" role="radiogroup" aria-label="Promotion target">
              {(["project", "asset", "hobby"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={localTarget === t}
                  className={`promotion-target-option${localTarget === t ? " promotion-target-option--selected" : ""}`}
                  onClick={() => handleTargetSelect(t)}
                  disabled={isPending}
                >
                  <div>
                    <div className="promotion-target-option__title">{targetLabels[t]}</div>
                    <div className="promotion-target-option__desc">{targetDescriptions[t]}</div>
                  </div>
                </button>
              ))}
            </div>

            {localTarget && (
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => setShowPromoteForm(true)}
                disabled={isPending}
                style={{ width: "100%" }}
              >
                Promote Now
              </button>
            )}
          </>
        )}

        {showPromoteForm && localTarget && (
          <div className="idea-promote-form">
            <input
              type="text"
              className="input input--sm"
              placeholder="Name"
              value={promoteName}
              onChange={(e) => setPromoteName(e.target.value)}
              disabled={isPending}
            />
            <textarea
              className="input input--sm"
              placeholder="Description (optional)"
              value={promoteDescription}
              onChange={(e) => setPromoteDescription(e.target.value)}
              disabled={isPending}
              rows={2}
              style={{ resize: "vertical" }}
            />

            {localTarget === "project" && stepCount > 0 && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={convertStepsToTasks}
                  onChange={(e) => setConvertStepsToTasks(e.target.checked)}
                  disabled={isPending}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  Convert {stepCount} idea step{stepCount === 1 ? "" : "s"} to project tasks
                  <span style={{ display: "block", color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 1 }}>
                    {convertStepsToTasks
                      ? "Steps will be added as unphased tasks on the new project."
                      : "Steps will stay on the idea only — not imported."}
                  </span>
                </span>
              </label>
            )}

            {(localTarget !== "project" || stepCount === 0) && (
              <p className="promotion-preview">{getCarryOverPreview(localTarget, stepCount, convertStepsToTasks)}</p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={handlePromote}
                disabled={isPending}
              >
                {isPending ? "Promoting…" : `Create ${targetLabels[localTarget]}`}
              </button>
              <button
                type="button"
                className="button button--ghost button--sm"
                onClick={() => setShowPromoteForm(false)}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
