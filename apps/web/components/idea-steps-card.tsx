"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import type { IdeaStepItem } from "@lifekeeper/types";
import { updateIdeaAction } from "../app/actions";
import { Card } from "./card";

type IdeaStepsCardProps = {
  householdId: string;
  ideaId: string;
  steps: IdeaStepItem[];
};

export function IdeaStepsCard({ householdId, ideaId, steps }: IdeaStepsCardProps): JSX.Element {
  const [localSteps, setLocalSteps] = useState<IdeaStepItem[]>(steps);
  const [isPending, startTransition] = useTransition();
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const completedCount = localSteps.filter((s) => s.done).length;

  const save = useCallback(
    (updated: IdeaStepItem[]) => {
      startTransition(async () => {
        await updateIdeaAction(householdId, ideaId, { steps: updated });
      });
    },
    [householdId, ideaId]
  );

  const handleToggle = useCallback(
    (id: string) => {
      setLocalSteps((prev) => {
        const updated = prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
        save(updated);
        return updated;
      });
    },
    [save]
  );

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      setLocalSteps((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
    },
    []
  );

  const handleLabelBlur = useCallback(
    (id: string) => {
      setLocalSteps((prev) => {
        const step = prev.find((s) => s.id === id);
        if (!step) return prev;
        const original = steps.find((s) => s.id === id);
        if (original && original.label === step.label) return prev;
        save(prev);
        return prev;
      });
    },
    [steps, save]
  );

  const handleAdd = useCallback(() => {
    const newStep: IdeaStepItem = {
      id: crypto.randomUUID(),
      label: "",
      done: false,
    };
    setLocalSteps((prev) => {
      const updated = [...prev, newStep];
      save(updated);
      return updated;
    });
    setTimeout(() => labelInputRef.current?.focus(), 0);
  }, [save]);

  const handleRemove = useCallback(
    (id: string) => {
      setLocalSteps((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        save(updated);
        return updated;
      });
    },
    [save]
  );

  // Drag-and-drop reordering
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      const sourceIdx = dragIdx;
      setDragIdx(null);
      if (sourceIdx === null || sourceIdx === targetIdx) return;

      setLocalSteps((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(sourceIdx, 1);
        if (!moved) return prev;
        updated.splice(targetIdx, 0, moved);
        save(updated);
        return updated;
      });
    },
    [dragIdx, save]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  return (
    <Card
      title={localSteps.length > 0 ? `Steps (${completedCount}/${localSteps.length} completed)` : "Steps"}
      actions={
        <button
          type="button"
          className="button button--ghost button--xs"
          onClick={handleAdd}
          disabled={isPending}
        >
          + Add step
        </button>
      }
    >
      {localSteps.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          No steps defined. Break this idea into rough actions.{" "}
          <button type="button" className="button button--ghost button--xs" onClick={handleAdd}>
            Add one
          </button>
        </p>
      ) : (
        <div role="list" style={{ display: "grid", gap: 2, opacity: isPending ? 0.8 : 1 }}>
          {localSteps.map((step, idx) => (
            <div
              key={step.id}
              className={`idea-step-item${step.done ? " idea-step-item--done" : ""}`}
              role="listitem"
              draggable
              aria-label={`Reorder step ${step.label || `Step ${idx + 1}`}`}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              style={{ cursor: "grab", opacity: dragIdx === idx ? 0.5 : 1 }}
            >
              <span className="idea-step-item__number">{idx + 1}.</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => handleToggle(step.id)}
                />
                <input
                  ref={idx === localSteps.length - 1 ? labelInputRef : undefined}
                  type="text"
                  className="idea-step-item__label"
                  value={step.label}
                  onChange={(e) => handleLabelChange(step.id, e.target.value)}
                  onBlur={() => handleLabelBlur(step.id)}
                  placeholder="Step description"
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    font: "inherit",
                  }}
                />
              </label>
              <button
                type="button"
                className="button button--ghost button--xs idea-step-item__remove"
                onClick={() => handleRemove(step.id)}
                aria-label={`Remove step ${step.label || `Step ${idx + 1}`}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
