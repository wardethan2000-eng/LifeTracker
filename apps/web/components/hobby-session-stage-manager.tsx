"use client";

import type {
  HobbyDetail,
  HobbySession,
  HobbySessionDetail,
  HobbySessionStageDetail,
} from "@aegis/types";
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import {
  advanceHobbySession,
  createHobbySessionStageChecklistItem,
  deleteHobbySessionStageChecklistItem,
  updateHobbySession,
  updateHobbySessionStage,
  updateHobbySessionStageChecklistItem,
} from "../lib/api";
import { Card } from "./card";

type HobbySessionStageManagerProps = {
  householdId: string;
  hobbyId: string;
  hobby: HobbyDetail;
  session: HobbySessionDetail;
  onSessionChange: (updated: HobbySession) => void;
  onError: (message: string | null) => void;
};

function toDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function inferFieldValue(type: string, value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (type === "number" || type === "currency") {
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }

  if (type === "boolean") {
    return trimmed === "true";
  }

  return trimmed;
}

export function HobbySessionStageManager({
  householdId,
  hobbyId,
  hobby,
  session,
  onSessionChange,
  onError,
}: HobbySessionStageManagerProps): JSX.Element {
  const [stages, setStages] = useState(session.stages);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(session.stages[0]?.id ?? null);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    setStages(session.stages);
    const activeStage = session.stages.find((stage) => stage.stageTemplateId === session.pipelineStepId) ?? session.stages[0] ?? null;
    setSelectedStageId(activeStage?.id ?? null);
  }, [session.id, session.pipelineStepId, session.stages]);

  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0] ?? null;
  const currentStage = stages.find((stage) => stage.stageTemplateId === session.pipelineStepId) ?? null;
  const selectedStageIndex = selectedStage ? stages.findIndex((stage) => stage.id === selectedStage.id) : -1;
  const nextStage = selectedStageIndex >= 0 ? stages[selectedStageIndex + 1] ?? null : null;

  const stageCompletionSummary = useMemo(() => {
    if (!selectedStage) {
      return { checklistCompleted: 0, checklistTotal: 0, requiredSuppliesReady: 0, requiredSuppliesTotal: 0 };
    }

    const checklistCompleted = selectedStage.checklistItems.filter((item) => item.isCompleted).length;
    const requiredSupplies = selectedStage.supplies.filter((supply) => supply.isRequired);
    const requiredSuppliesReady = requiredSupplies.filter((supply) => supply.hasSufficientInventory || !supply.inventoryItemId).length;

    return {
      checklistCompleted,
      checklistTotal: selectedStage.checklistItems.length,
      requiredSuppliesReady,
      requiredSuppliesTotal: requiredSupplies.length,
    };
  }, [selectedStage]);

  const updateLocalStage = (stageId: string, updater: (stage: HobbySessionStageDetail) => HobbySessionStageDetail) => {
    setStages((current) => current.map((stage) => stage.id === stageId ? updater(stage) : stage));
  };

  const saveSelectedStage = async () => {
    if (!selectedStage || isSavingStage) {
      return;
    }

    setIsSavingStage(true);
    onError(null);

    try {
      const updated = await updateHobbySessionStage(householdId, hobbyId, session.id, selectedStage.id, {
        notes: selectedStage.notes,
        completedAt: selectedStage.completedAt,
        customFieldValues: selectedStage.customFieldValues,
      });

      updateLocalStage(selectedStage.id, (stage) => ({
        ...stage,
        notes: updated.notes,
        completedAt: updated.completedAt,
        customFieldValues: updated.customFieldValues,
        updatedAt: updated.updatedAt,
      }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save stage details.");
    } finally {
      setIsSavingStage(false);
    }
  };

  const toggleChecklistItem = async (checklistItemId: string, isCompleted: boolean) => {
    if (!selectedStage) {
      return;
    }

    onError(null);
    try {
      const updated = await updateHobbySessionStageChecklistItem(
        householdId,
        hobbyId,
        session.id,
        selectedStage.id,
        checklistItemId,
        { isCompleted: !isCompleted },
      );

      updateLocalStage(selectedStage.id, (stage) => ({
        ...stage,
        checklistItems: stage.checklistItems.map((item) => item.id === checklistItemId ? updated : item),
      }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update checklist item.");
    }
  };

  const addChecklistItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedStage || !newChecklistTitle.trim()) {
      return;
    }

    onError(null);
    try {
      const created = await createHobbySessionStageChecklistItem(householdId, hobbyId, session.id, selectedStage.id, {
        title: newChecklistTitle.trim(),
      });
      updateLocalStage(selectedStage.id, (stage) => ({
        ...stage,
        checklistItems: [...stage.checklistItems, created],
      }));
      setNewChecklistTitle("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to add checklist item.");
    }
  };

  const removeChecklistItem = async (checklistItemId: string) => {
    if (!selectedStage) {
      return;
    }

    onError(null);
    try {
      await deleteHobbySessionStageChecklistItem(householdId, hobbyId, session.id, selectedStage.id, checklistItemId);
      updateLocalStage(selectedStage.id, (stage) => ({
        ...stage,
        checklistItems: stage.checklistItems.filter((item) => item.id !== checklistItemId),
      }));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to remove checklist item.");
    }
  };

  const advanceSelectedStage = async () => {
    if (!selectedStage || !currentStage || selectedStage.id !== currentStage.id || isAdvancing) {
      return;
    }

    setIsAdvancing(true);
    onError(null);

    try {
      const updatedSession = await advanceHobbySession(householdId, hobbyId, session.id);
      onSessionChange(updatedSession);
      updateLocalStage(selectedStage.id, (stage) => ({
        ...stage,
        completedAt: stage.completedAt ?? new Date().toISOString(),
      }));
      if (nextStage) {
        updateLocalStage(nextStage.id, (stage) => ({
          ...stage,
          startedAt: stage.startedAt ?? new Date().toISOString(),
        }));
        setSelectedStageId(nextStage.id);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to advance session stage.");
    } finally {
      setIsAdvancing(false);
    }
  };

  const updateBinaryStatus = async (status: "active" | "completed") => {
    onError(null);
    try {
      const updated = await updateHobbySession(householdId, hobbyId, session.id, { status });
      onSessionChange(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update session status.");
    }
  };

  return (
    <Card title={hobby.lifecycleMode === "pipeline" ? "Workflow Stages" : "Status"}>
      {hobby.lifecycleMode === "binary" ? (
        <div className="session-status-toggle">
          <button type="button" className={session.status === "active" ? "button" : "button button--secondary"} onClick={() => void updateBinaryStatus("active")}>Active</button>
          <button type="button" className={session.status === "completed" ? "button" : "button button--secondary"} onClick={() => void updateBinaryStatus("completed")}>Completed</button>
        </div>
      ) : (
        <div className="session-stage-workspace">
          <div className="session-stage-nav">
            {stages.map((stage) => {
              const isCurrent = stage.stageTemplateId === session.pipelineStepId;
              const isCompleted = Boolean(stage.completedAt);
              const isSelected = stage.id === selectedStage?.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  className={`session-stage-nav__button${isSelected ? " is-selected" : ""}${isCurrent ? " is-current" : ""}${isCompleted ? " is-completed" : ""}`}
                  onClick={() => setSelectedStageId(stage.id)}
                >
                  <span>{stage.name}</span>
                  <small>{isCompleted ? "Completed" : isCurrent ? "Current" : "Upcoming"}</small>
                </button>
              );
            })}
          </div>

          {selectedStage ? (
            <div className="session-stage-detail-stack">
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <h2>{selectedStage.name}</h2>
                    <p className="workbench-section__hint">{selectedStage.description || "No stage summary yet."}</p>
                  </div>
                  <div className="inline-actions">
                    {selectedStage.completedAt ? <span className="pill pill--success">Completed</span> : null}
                    {selectedStage.stageTemplateId === session.pipelineStepId ? <span className="pill pill--accent">Current stage</span> : null}
                  </div>
                </div>
                <div className="panel__body--padded session-stage-detail-grid">
                  <div>
                    <dt>Started</dt>
                    <dd>{toDateTimeLabel(selectedStage.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{toDateTimeLabel(selectedStage.completedAt)}</dd>
                  </div>
                  <div>
                    <dt>Checklist</dt>
                    <dd>{stageCompletionSummary.checklistCompleted} of {stageCompletionSummary.checklistTotal}</dd>
                  </div>
                  <div>
                    <dt>Required supplies ready</dt>
                    <dd>{stageCompletionSummary.requiredSuppliesReady} of {stageCompletionSummary.requiredSuppliesTotal}</dd>
                  </div>
                </div>
              </section>

              <div className="session-stage-detail-grid--two">
                <section className="panel">
                  <div className="panel__header"><h2>Instructions</h2></div>
                  <div className="panel__body--padded">
                    <p>{selectedStage.instructions || "No instructions defined for this stage."}</p>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel__header"><h2>Future Notes</h2></div>
                  <div className="panel__body--padded">
                    <p>{selectedStage.futureNotes || "No future-run notes captured for this stage yet."}</p>
                  </div>
                </section>
              </div>

              <section className="panel">
                <div className="panel__header"><h2>Stage Checklist</h2></div>
                <div className="panel__body--padded">
                  {selectedStage.checklistItems.length === 0 ? <p className="panel__empty">No stage to-dos yet.</p> : null}
                  <div className="schedule-stack">
                    {selectedStage.checklistItems.map((item) => (
                      <div key={item.id} className="schedule-card" style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                            <input type="checkbox" checked={item.isCompleted} onChange={() => void toggleChecklistItem(item.id, item.isCompleted)} />
                            <span style={{ textDecoration: item.isCompleted ? "line-through" : "none" }}>{item.title}</span>
                          </label>
                          <button type="button" className="button button--ghost button--sm" onClick={() => void removeChecklistItem(item.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form className="inline-actions" style={{ marginTop: 12 }} onSubmit={(event) => void addChecklistItem(event)}>
                    <input className="field" style={{ flex: 1, minWidth: 240 }} value={newChecklistTitle} onChange={(event) => setNewChecklistTitle(event.target.value)} placeholder="Add a stage-specific to-do" />
                    <button type="submit" className="button">+</button>
                  </form>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header"><h2>Needed Inventory</h2></div>
                <div className="panel__body--padded">
                  {selectedStage.supplies.length === 0 ? <p className="panel__empty">No stage supplies defined.</p> : null}
                  <div className="schedule-stack">
                    {selectedStage.supplies.map((supply) => (
                      <div key={supply.id} className="schedule-card" style={{ padding: "12px 16px" }}>
                        <div className="session-stage-supply-row">
                          <div>
                            <strong>{supply.name}</strong>
                            <p className="workbench-section__hint">Need {supply.quantityNeeded} {supply.unit}{supply.notes ? ` · ${supply.notes}` : ""}</p>
                            {supply.inventoryItem ? (
                              <p className="workbench-section__hint">Linked inventory: {supply.inventoryItem.name} · {supply.inventoryItem.quantityOnHand} {supply.inventoryItem.unit} on hand</p>
                            ) : null}
                          </div>
                          <div className="inline-actions">
                            {supply.isRequired ? <span className="pill pill--muted">Required</span> : <span className="pill">Optional</span>}
                            <span className={supply.hasSufficientInventory || !supply.inventoryItemId ? "pill pill--success" : "pill pill--warning"}>
                              {supply.inventoryItemId ? (supply.hasSufficientInventory ? "On hand" : "Short") : "Unlinked"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header"><h2>Stage Logging</h2></div>
                <div className="panel__body--padded">
                  {selectedStage.fieldDefinitions.length === 0 ? <p className="panel__empty">No stage-specific logging fields defined.</p> : null}
                  <div className="workbench-grid">
                    {selectedStage.fieldDefinitions.map((field) => {
                      const rawValue = selectedStage.customFieldValues[field.key];
                      if (field.type === "boolean") {
                        return (
                          <label key={field.key} className="workbench-field hobby-stage-editor-card__checkbox">
                            <span className="workbench-field__label">{field.label}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(rawValue)}
                              onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({
                                ...stage,
                                customFieldValues: { ...stage.customFieldValues, [field.key]: event.target.checked },
                              }))}
                            />
                          </label>
                        );
                      }

                      if (field.type === "select") {
                        return (
                          <label key={field.key} className={`workbench-field${field.wide ? " workbench-field--wide" : ""}`}>
                            <span className="workbench-field__label">{field.label}</span>
                            <select className="workbench-field__input" value={typeof rawValue === "string" ? rawValue : ""} onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({
                              ...stage,
                              customFieldValues: { ...stage.customFieldValues, [field.key]: event.target.value },
                            }))}>
                              <option value="">Select</option>
                              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          </label>
                        );
                      }

                      if (field.type === "multiselect") {
                        const selectedValues = Array.isArray(rawValue) ? rawValue.map(String) : [];
                        return (
                          <label key={field.key} className={`workbench-field${field.wide ? " workbench-field--wide" : ""}`}>
                            <span className="workbench-field__label">{field.label}</span>
                            <select multiple size={Math.min(Math.max(field.options.length, 2), 6)} className="workbench-field__input" value={selectedValues} onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({
                              ...stage,
                              customFieldValues: {
                                ...stage.customFieldValues,
                                [field.key]: Array.from(event.target.selectedOptions).map((option) => option.value),
                              },
                            }))}>
                              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          </label>
                        );
                      }

                      return (
                        <label key={field.key} className={`workbench-field${field.wide ? " workbench-field--wide" : ""}`}>
                          <span className="workbench-field__label">{field.label}</span>
                          {field.type === "textarea" ? (
                            <textarea className="workbench-field__input" rows={3} value={rawValue == null ? "" : String(rawValue)} onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({
                              ...stage,
                              customFieldValues: { ...stage.customFieldValues, [field.key]: event.target.value },
                            }))} placeholder={field.helpText ?? undefined} />
                          ) : (
                            <input className="workbench-field__input" type={field.type === "date" ? "date" : field.type === "url" ? "url" : field.type === "number" || field.type === "currency" ? "number" : "text"} step={field.type === "number" || field.type === "currency" ? "0.01" : undefined} value={rawValue == null ? "" : String(rawValue)} onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({
                              ...stage,
                              customFieldValues: { ...stage.customFieldValues, [field.key]: inferFieldValue(field.type, event.target.value) },
                            }))} placeholder={field.helpText ?? undefined} />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <label className="workbench-field workbench-field--wide" style={{ marginTop: 12 }}>
                    <span className="workbench-field__label">Stage Notes</span>
                    <textarea className="workbench-field__input" rows={4} value={selectedStage.notes ?? ""} onChange={(event) => updateLocalStage(selectedStage.id, (stage) => ({ ...stage, notes: event.target.value }))} placeholder="Capture stage-specific observations, blockers, substitutions, or learnings." />
                  </label>

                  <div className="inline-actions" style={{ marginTop: 16 }}>
                    <button type="button" className="button button--ghost" onClick={() => void saveSelectedStage()} disabled={isSavingStage}>
                      {isSavingStage ? "Saving..." : "Save Stage Details"}
                    </button>
                    {selectedStage.stageTemplateId === session.pipelineStepId && !selectedStage.completedAt ? (
                      <button type="button" className="button" onClick={() => void advanceSelectedStage()} disabled={isAdvancing}>
                        {isAdvancing ? "Advancing..." : nextStage ? `Advance to ${nextStage.name}` : "Complete Session"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}