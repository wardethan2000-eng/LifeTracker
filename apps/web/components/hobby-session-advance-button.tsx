"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { advanceHobbySession } from "../lib/api";

type PipelineStep = {
  id: string;
  label: string;
  sortOrder: number;
  isFinal: boolean;
  color: string | null;
};

type HobbySessionAdvanceButtonProps = {
  householdId: string;
  hobbyId: string;
  sessionId: string;
  sessionName: string;
  currentStatus: string;
  pipelineSteps: PipelineStep[];
  currentPipelineStepId: string | null | undefined;
};

export function HobbySessionAdvanceButton({
  householdId,
  hobbyId,
  sessionId,
  sessionName,
  currentStatus: _currentStatus,
  pipelineSteps,
  currentPipelineStepId,
}: HobbySessionAdvanceButtonProps): JSX.Element {
  const [activeStepId, setActiveStepId] = useState<string | null>(currentPipelineStepId ?? null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const sortedSteps = useMemo(
    () => [...pipelineSteps].sort((a, b) => a.sortOrder - b.sortOrder),
    [pipelineSteps]
  );

  const currentStepIndex = sortedSteps.findIndex((step) => step.id === activeStepId);
  const currentStep = currentStepIndex >= 0 ? sortedSteps[currentStepIndex] : null;
  const nextStep = currentStepIndex >= 0 ? sortedSteps[currentStepIndex + 1] ?? null : null;

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setError(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const handleAdvance = async (): Promise<void> => {
    if (!nextStep || isAdvancing) {
      return;
    }

    setIsAdvancing(true);
    setError(false);

    try {
      const updatedSession = await advanceHobbySession(householdId, hobbyId, sessionId);
      const updatedStepId = updatedSession.pipelineStepId ?? nextStep.id;
      const updatedStep = sortedSteps.find((step) => step.id === updatedStepId) ?? nextStep;

      setActiveStepId(updatedStep.id);
      setJustCompleted(updatedStep.isFinal);
    } catch {
      setError(true);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
      <div className="hobby-pipeline-indicator">
        <div style={{ display: "flex", gap: "4px" }}>
          {sortedSteps.map((step) => {
            const variantClass = currentStep
              ? step.sortOrder < currentStep.sortOrder
                ? " hobby-pipeline-step--completed"
                : step.id === currentStep.id
                  ? " hobby-pipeline-step--active"
                  : " hobby-pipeline-step--upcoming"
              : " hobby-pipeline-step--upcoming";

            return <div key={step.id} className={`hobby-pipeline-step${variantClass}`} title={step.label} />;
          })}
        </div>
        <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
          {sortedSteps.map((step) => (
            <div key={step.id} className="hobby-pipeline-label" title={step.label} style={{ flex: 1 }}>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {justCompleted || (activeStepId && currentStep && !currentStep.isFinal) ? (
        <div style={{ display: "grid", gap: "4px", justifyItems: "start" }}>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={isAdvancing || justCompleted || !nextStep}
            onClick={handleAdvance}
            aria-label={`Advance ${sessionName} to the next step`}
          >
            {isAdvancing ? "Advancing..." : justCompleted ? "Session Completed" : "Advance to Next Step →"}
          </button>
          {error ? <p className="advance-error">Failed to advance - try again</p> : null}
        </div>
      ) : null}
    </div>
  );
}