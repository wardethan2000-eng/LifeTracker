"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Card } from "./card";

type PipelineStep = {
  id: string;
  label: string;
  sortOrder: number;
  isFinal: boolean;
  color: string | null;
};

type SessionPhaseManagerProps = {
  householdId: string;
  hobbyId: string;
  sessionId: string;
  lifecycleMode: "pipeline" | "binary";
  pipelineSteps: PipelineStep[];
  currentPipelineIndex: number;
  currentPipelineStep: PipelineStep | null | undefined;
  sessionStatus: string;
  completedDate: string | null;
  onAdvance: (formData: FormData) => Promise<void>;
  onStatusChange: (status: "active" | "completed") => Promise<void>;
  onError: (message: string | null) => void;
};

export function SessionPhaseManager({
  householdId,
  hobbyId,
  sessionId,
  lifecycleMode,
  pipelineSteps,
  currentPipelineIndex,
  currentPipelineStep,
  sessionStatus,
  completedDate,
  onAdvance,
  onStatusChange,
  onError,
}: SessionPhaseManagerProps): JSX.Element {
  const [statusPending, setStatusPending] = useState(false);
  const [isAdvancePending, startAdvanceTransition] = useTransition();

  const handleBinaryStatusChange = async (status: "active" | "completed") => {
    if (statusPending || sessionStatus === status) {
      return;
    }

    setStatusPending(true);
    onError(null);

    try {
      await onStatusChange(status);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update session status.");
    } finally {
      setStatusPending(false);
    }
  };

  const handleAdvance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPipelineStep || currentPipelineStep.isFinal) {
      return;
    }

    onError(null);
    const formData = new FormData(event.currentTarget);
    startAdvanceTransition(async () => {
      try {
        await onAdvance(formData);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to advance session.");
      }
    });
  };

  return (
    <Card title={lifecycleMode === "pipeline" ? "Pipeline" : "Status"}>
      <div className="session-flow-stack">
        {lifecycleMode === "pipeline" ? (
          <>
            <div className="hobby-pipeline-indicator">
              {pipelineSteps.map((step, index) => {
                const variant = index < currentPipelineIndex
                  ? "completed"
                  : index === currentPipelineIndex
                    ? "active"
                    : "upcoming";
                return (
                  <div
                    key={step.id}
                    className={`hobby-pipeline-step hobby-pipeline-step--${variant}`}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>

            {completedDate ? (
              <p className="session-flow-caption">Session Completed</p>
            ) : (
              <form onSubmit={handleAdvance}>
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="hobbyId" value={hobbyId} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <button
                  type="submit"
                  className="button"
                  disabled={isAdvancePending || currentPipelineStep?.isFinal}
                >
                  {isAdvancePending ? "Advancing..." : "Advance to Next Step"}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="session-status-toggle">
            <button
              type="button"
              className={sessionStatus === "active" ? "button" : "button button--secondary"}
              onClick={() => void handleBinaryStatusChange("active")}
              disabled={statusPending}
            >
              Active
            </button>
            <button
              type="button"
              className={sessionStatus === "completed" ? "button" : "button button--secondary"}
              onClick={() => void handleBinaryStatusChange("completed")}
              disabled={statusPending}
            >
              {statusPending && sessionStatus !== "completed" ? "Saving..." : "Completed"}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}