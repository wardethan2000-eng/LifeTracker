"use client";

import type { HobbySessionStep } from "@lifekeeper/types";
import { useState } from "react";
import { Card } from "./card";

type SessionStepListProps = {
  steps: HobbySessionStep[];
  completedSteps: number;
  progressPercent: number;
  onToggleStep: (step: HobbySessionStep) => Promise<void>;
  onError: (message: string | null) => void;
  formatDateTime: (value: string | null | undefined, fallback?: string) => string;
  titleCase: (value: string) => string;
};

export function SessionStepList({
  steps,
  completedSteps,
  progressPercent,
  onToggleStep,
  onError,
  formatDateTime,
  titleCase,
}: SessionStepListProps): JSX.Element {
  const [pendingStepIds, setPendingStepIds] = useState<string[]>([]);

  const handleToggleStep = async (step: HobbySessionStep) => {
    if (pendingStepIds.includes(step.id)) {
      return;
    }

    setPendingStepIds((previous) => [...previous, step.id]);
    onError(null);

    try {
      await onToggleStep(step);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update session step.");
    } finally {
      setPendingStepIds((previous) => previous.filter((stepId) => stepId !== step.id));
    }
  };

  return (
    <Card
      title="Steps"
      actions={<span className="pill">{completedSteps} / {steps.length}</span>}
    >
      <div className="session-step-stack">
        <div className="session-progress-summary">
          <strong>{completedSteps} of {steps.length} steps completed</strong>
          <div className="session-progress-bar" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {steps.length === 0 ? <p className="panel__empty">No steps in this session.</p> : null}

        <div className="session-step-list">
          {steps.map((step) => {
            const isPending = pendingStepIds.includes(step.id);
            return (
              <div
                key={step.id}
                className={`session-step session-step--clickable${isPending ? " session-step--pending" : ""}`}
              >
                <button
                  type="button"
                  className={`session-step__checkbox${step.isCompleted ? " is-complete" : ""}`}
                  onClick={() => void handleToggleStep(step)}
                  disabled={isPending}
                  aria-label={step.isCompleted ? `Mark ${step.title} incomplete` : `Mark ${step.title} complete`}
                >
                  {step.isCompleted ? "✓" : "○"}
                </button>

                <div className="session-step__content">
                  <div className="session-step__header">
                    <div className="session-step__title-group">
                      <strong className={`session-step__title${step.isCompleted ? " is-complete" : ""}`}>{step.title}</strong>
                      <span className="pill">{titleCase(step.stepType)}</span>
                      {step.durationMinutes != null ? <span className="pill">{step.durationMinutes} min</span> : null}
                    </div>
                    {step.completedAt ? <span className="pill">Completed {formatDateTime(step.completedAt)}</span> : null}
                  </div>

                  {step.description ? (
                    <details>
                      <summary>Description</summary>
                      <p className="session-step__description">{step.description}</p>
                    </details>
                  ) : null}

                  {step.notes ? <p className="session-step__notes">{step.notes}</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}