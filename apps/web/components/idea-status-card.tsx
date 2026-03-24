"use client";

import type { JSX } from "react";
import { useCallback, useState, useTransition } from "react";
import type { IdeaCategory, IdeaPriority, IdeaStage } from "@lifekeeper/types";
import { updateIdeaAction, updateIdeaStageAction } from "../app/actions";
import { useTimezone } from "../lib/timezone-context";
import { Card } from "./card";

const stageLabels: Record<IdeaStage, string> = {
  spark: "Spark",
  developing: "Developing",
  ready: "Ready",
};

const stageOrder: IdeaStage[] = ["spark", "developing", "ready"];

const priorityLabels: Record<IdeaPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const priorityOrder: IdeaPriority[] = ["low", "medium", "high"];

const categoryLabels: Record<IdeaCategory, string> = {
  home_improvement: "Home Improvement",
  vehicle: "Vehicle",
  outdoor: "Outdoor",
  technology: "Technology",
  hobby_craft: "Hobby / Craft",
  financial: "Financial",
  health: "Health",
  travel: "Travel",
  learning: "Learning",
  other: "Other",
};

const categoryKeys: IdeaCategory[] = [
  "home_improvement", "vehicle", "outdoor", "technology",
  "hobby_craft", "financial", "health", "travel", "learning", "other",
];

type IdeaStatusCardProps = {
  householdId: string;
  ideaId: string;
  stage: IdeaStage;
  priority: IdeaPriority;
  category: IdeaCategory | null;
  createdAt: string;
  updatedAt: string;
};

export function IdeaStatusCard({
  householdId,
  ideaId,
  stage,
  priority,
  category,
  createdAt,
  updatedAt,
}: IdeaStatusCardProps): JSX.Element {
  const { timezone } = useTimezone();

  const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  };

  const [localStage, setLocalStage] = useState<IdeaStage>(stage);
  const [localPriority, setLocalPriority] = useState<IdeaPriority>(priority);
  const [localCategory, setLocalCategory] = useState<IdeaCategory | null>(category);
  const [isPending, startTransition] = useTransition();

  const handleStageChange = useCallback(
    (newStage: IdeaStage) => {
      if (newStage === localStage) return;
      setLocalStage(newStage);
      startTransition(async () => {
        await updateIdeaStageAction(householdId, ideaId, newStage);
      });
    },
    [localStage, householdId, ideaId]
  );

  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPriority = e.target.value as IdeaPriority;
      setLocalPriority(newPriority);
      startTransition(async () => {
        await updateIdeaAction(householdId, ideaId, { priority: newPriority });
      });
    },
    [householdId, ideaId]
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCategory = e.target.value === "" ? null : (e.target.value as IdeaCategory);
      setLocalCategory(newCategory);
      startTransition(async () => {
        await updateIdeaAction(householdId, ideaId, { category: newCategory });
      });
    },
    [householdId, ideaId]
  );

  return (
    <Card title="Status &amp; Meta">
      <div style={{ display: "grid", gap: 14, opacity: isPending ? 0.7 : 1 }}>
        {/* Stage selector */}
        <div>
          <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--ink-muted)", marginBottom: 6, display: "block" }}>
            Stage
          </label>
          <div className="stage-selector" role="radiogroup" aria-label="Idea stage">
            {stageOrder.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={localStage === s}
                className={`stage-selector__option${localStage === s ? " stage-selector__option--active" : ""}`}
                onClick={() => handleStageChange(s)}
                disabled={isPending}
              >
                {stageLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Priority dropdown */}
        <div>
          <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--ink-muted)", marginBottom: 6, display: "block" }}>
            Priority
          </label>
          <select
            className="input input--sm"
            value={localPriority}
            onChange={handlePriorityChange}
            disabled={isPending}
            style={{ width: "100%" }}
          >
            {priorityOrder.map((p) => (
              <option key={p} value={p}>{priorityLabels[p]}</option>
            ))}
          </select>
        </div>

        {/* Category dropdown */}
        <div>
          <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--ink-muted)", marginBottom: 6, display: "block" }}>
            Category
          </label>
          <select
            className="input input--sm"
            value={localCategory ?? ""}
            onChange={handleCategoryChange}
            disabled={isPending}
            style={{ width: "100%" }}
          >
            <option value="">No category</option>
            {categoryKeys.map((c) => (
              <option key={c} value={c}>{categoryLabels[c]}</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>Created</span>
            <span>{formatRelativeDate(createdAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
            <span style={{ color: "var(--ink-muted)" }}>Updated</span>
            <span>{formatRelativeDate(updatedAt)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
