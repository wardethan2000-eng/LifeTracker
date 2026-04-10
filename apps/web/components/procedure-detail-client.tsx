"use client";

import type { Procedure, ProcedureStep } from "@aegis/types";
import type { JSX } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  addProcedureStep,
  updateProcedureStep,
  deleteProcedureStep,
  reorderProcedureSteps
} from "../lib/api";

type ProcedureDetailClientProps = {
  householdId: string;
  procedureId: string;
  procedure: Procedure;
};

export function ProcedureDetailClient({ householdId, procedureId, procedure }: ProcedureDetailClientProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // New step form state
  const [newInstruction, setNewInstruction] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newWarning, setNewWarning] = useState("");
  const [newMinutes, setNewMinutes] = useState("");

  // Edit step form state
  const [editInstruction, setEditInstruction] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editWarning, setEditWarning] = useState("");
  const [editMinutes, setEditMinutes] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleAddStep = useCallback(() => {
    if (!newInstruction.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addProcedureStep(householdId, procedureId, {
          instruction: newInstruction.trim(),
          notes: newNotes.trim() || undefined,
          warningText: newWarning.trim() || undefined,
          estimatedMinutes: newMinutes ? Number(newMinutes) : undefined
        });
        setNewInstruction("");
        setNewNotes("");
        setNewWarning("");
        setNewMinutes("");
        setAddingStep(false);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add step");
      }
    });
  }, [householdId, procedureId, newInstruction, newNotes, newWarning, newMinutes, startTransition, refresh]);

  const startEditStep = useCallback((step: ProcedureStep) => {
    setEditingStepId(step.id);
    setEditInstruction(step.instruction);
    setEditNotes(step.notes ?? "");
    setEditWarning(step.warningText ?? "");
    setEditMinutes(step.estimatedMinutes?.toString() ?? "");
  }, []);

  const handleUpdateStep = useCallback(() => {
    if (!editingStepId || !editInstruction.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateProcedureStep(householdId, procedureId, editingStepId, {
          instruction: editInstruction.trim(),
          notes: editNotes.trim() || undefined,
          warningText: editWarning.trim() || undefined,
          estimatedMinutes: editMinutes ? Number(editMinutes) : undefined
        });
        setEditingStepId(null);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update step");
      }
    });
  }, [householdId, procedureId, editingStepId, editInstruction, editNotes, editWarning, editMinutes, startTransition, refresh]);

  const handleDeleteStep = useCallback((stepId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProcedureStep(householdId, procedureId, stepId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete step");
      }
    });
  }, [householdId, procedureId, startTransition, refresh]);

  const handleDragStart = useCallback((event: React.DragEvent, stepId: string) => {
    event.dataTransfer.setData("text/plain", stepId);
    (event.target as HTMLElement).classList.add("dragging");
  }, []);

  const handleDragEnd = useCallback((event: React.DragEvent) => {
    (event.target as HTMLElement).classList.remove("dragging");
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add("drag-over");
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    (event.currentTarget as HTMLElement).classList.remove("drag-over");
  }, []);

  const handleDrop = useCallback((event: React.DragEvent, targetStepId: string) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove("drag-over");
    const draggedId = event.dataTransfer.getData("text/plain");
    if (draggedId === targetStepId) return;

    const currentOrder = procedure.steps.map((s) => s.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetStepId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    setError(null);
    startTransition(async () => {
      try {
        await reorderProcedureSteps(householdId, procedureId, { orderedIds: newOrder });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reorder steps");
      }
    });
  }, [householdId, procedureId, procedure.steps, startTransition, refresh]);

  return (
    <>
      {error && <p style={{ color: "var(--tone-danger, red)", padding: "8px 16px" }}>{error}</p>}

      {/* Steps */}
      <section className="panel">
        <div className="panel__header">
          <h2>Steps ({procedure.steps.length})</h2>
          <button type="button" className="button button--ghost button--xs" onClick={() => setAddingStep(!addingStep)} disabled={isPending}>
            {addingStep ? "Cancel" : "+ Add Step"}
          </button>
        </div>
        <div className="panel__body">
          {procedure.steps.length === 0 && !addingStep ? (
            <div className="panel__empty">No steps defined yet.</div>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {procedure.steps.map((step, idx) => (
                <li
                  key={step.id}
                  draggable={editingStepId !== step.id}
                  onDragStart={(e) => handleDragStart(e, step.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, step.id)}
                  style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-start" }}
                >
                  <span className="drag-handle" style={{ cursor: "grab", color: "var(--ink-muted)" }}>⠿</span>
                  <span style={{ fontWeight: 600, color: "var(--ink-muted)", minWidth: 28 }}>{idx + 1}.</span>
                  {editingStepId === step.id ? (
                    <div style={{ flex: 1 }}>
                      <div className="form-grid">
                        <label className="field field--full">
                          <span>Instruction</span>
                          <textarea rows={2} value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} />
                        </label>
                        <label className="field field--full">
                          <span>Notes</span>
                          <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional notes" />
                        </label>
                        <label className="field">
                          <span>Warning</span>
                          <input type="text" value={editWarning} onChange={(e) => setEditWarning(e.target.value)} placeholder="Safety warning" />
                        </label>
                        <label className="field">
                          <span>Est. Minutes</span>
                          <input type="number" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} min="0" />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="button" className="button button--primary button--sm" onClick={handleUpdateStep} disabled={isPending}>
                          {isPending ? "Saving…" : "Save"}
                        </button>
                        <button type="button" className="button button--ghost button--sm" onClick={() => setEditingStepId(null)} disabled={isPending}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <strong>{step.instruction}</strong>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button type="button" className="button button--ghost button--xs" onClick={() => startEditStep(step)} disabled={isPending}>
                            Edit
                          </button>
                          <button type="button" className="button button--ghost button--xs" onClick={() => handleDeleteStep(step.id)} disabled={isPending} style={{ color: "var(--tone-danger, red)" }}>
                            Remove
                          </button>
                        </div>
                      </div>
                      {step.notes && <p className="note" style={{ marginTop: 4 }}>{step.notes}</p>}
                      {step.warningText && (
                        <p style={{ color: "var(--tone-danger, red)", marginTop: 4, fontSize: "0.85em" }}>⚠ {step.warningText}</p>
                      )}
                      {step.estimatedMinutes != null && (
                        <span className="note" style={{ marginTop: 4, display: "inline-block" }}>~{step.estimatedMinutes} min</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {addingStep && (
            <div style={{ padding: "12px 16px", borderTop: procedure.steps.length > 0 ? "1px solid var(--border)" : undefined }}>
              <div className="form-grid">
                <label className="field field--full">
                  <span>Instruction</span>
                  <textarea rows={2} value={newInstruction} onChange={(e) => setNewInstruction(e.target.value)} placeholder="Describe what to do in this step" />
                </label>
                <label className="field field--full">
                  <span>Notes</span>
                  <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" />
                </label>
                <label className="field">
                  <span>Warning</span>
                  <input type="text" value={newWarning} onChange={(e) => setNewWarning(e.target.value)} placeholder="Safety warning" />
                </label>
                <label className="field">
                  <span>Est. Minutes</span>
                  <input type="number" value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)} min="0" />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="button button--primary button--sm" onClick={handleAddStep} disabled={isPending || !newInstruction.trim()}>
                  {isPending ? "Adding…" : "Add Step"}
                </button>
                <button type="button" className="button button--ghost button--sm" onClick={() => setAddingStep(false)} disabled={isPending}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Linked Assets */}
      <section className="panel">
        <div className="panel__header"><h2>Linked Assets</h2></div>
        <div className="panel__body">
          {procedure.assetLinks.length === 0 ? (
            <div className="panel__empty">No assets linked to this procedure.</div>
          ) : (
            procedure.assetLinks.map((pa) => (
              <div key={pa.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                <Link href={`/assets/${pa.assetId}`} className="text-link">{pa.asset?.name ?? pa.assetId}</Link>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Required Tools & Supplies */}
      <section className="panel">
        <div className="panel__header"><h2>Required Tools &amp; Supplies</h2></div>
        <div className="panel__body">
          {procedure.toolItems.length === 0 ? (
            <div className="panel__empty">No tools or supplies linked.</div>
          ) : (
            procedure.toolItems.map((pt) => (
              <div key={pt.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span>{pt.inventoryItem?.name ?? pt.inventoryItemId}</span>
                {pt.quantity > 0 && <span className="note">Qty: {pt.quantity} {pt.inventoryItem?.unit ?? ""}</span>}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
