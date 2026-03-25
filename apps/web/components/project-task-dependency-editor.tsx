"use client";

import type { JSX } from "react";
import type { ProjectTaskDependency, ProjectTask, TaskDependencyType } from "@lifekeeper/types";
import { useState, useEffect, useCallback } from "react";
import { getProjectDependencies } from "../lib/api";
import { createTaskDependencyAction, deleteTaskDependencyAction } from "../app/actions";

const DEP_TYPE_LABELS: Record<TaskDependencyType, string> = {
  finish_to_start: "Finish → Start",
  start_to_start: "Start → Start",
  finish_to_finish: "Finish → Finish",
  start_to_finish: "Start → Finish",
};

type Props = {
  householdId: string;
  projectId: string;
  taskId: string;
  allTasks: ProjectTask[];
};

export function ProjectTaskDependencyEditor({ householdId, projectId, taskId, allTasks }: Props): JSX.Element {
  const [deps, setDeps] = useState<ProjectTaskDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [predTaskId, setPredTaskId] = useState("");
  const [succTaskId, setSuccTaskId] = useState("");
  const [depType, setDepType] = useState<TaskDependencyType>("finish_to_start");
  const [lagDays, setLagDays] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getProjectDependencies(householdId, projectId);
      setDeps(all.filter((d) => d.predecessorTaskId === taskId || d.successorTaskId === taskId));
    } finally {
      setLoading(false);
    }
  }, [householdId, projectId, taskId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const predecessors = deps.filter((d) => d.successorTaskId === taskId);
  const successors = deps.filter((d) => d.predecessorTaskId === taskId);

  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  // Candidates: all tasks except this one
  const candidates = allTasks.filter((t) => t.id !== taskId);
  // Already-linked predecessor IDs (to avoid duplicates)
  const existingPredIds = new Set(predecessors.map((d) => d.predecessorTaskId));
  const existingSuccIds = new Set(successors.map((d) => d.successorTaskId));

  async function handleAddPredecessor(e: React.FormEvent) {
    e.preventDefault();
    if (!predTaskId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("projectId", projectId);
      formData.set("predecessorTaskId", predTaskId);
      formData.set("successorTaskId", taskId);
      formData.set("dependencyType", depType);
      if (lagDays > 0) formData.set("lagDays", String(lagDays));
      await createTaskDependencyAction(formData);
      setPredTaskId("");
      setLagDays(0);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddSuccessor(e: React.FormEvent) {
    e.preventDefault();
    if (!succTaskId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("projectId", projectId);
      formData.set("predecessorTaskId", taskId);
      formData.set("successorTaskId", succTaskId);
      formData.set("dependencyType", depType);
      if (lagDays > 0) formData.set("lagDays", String(lagDays));
      await createTaskDependencyAction(formData);
      setSuccTaskId("");
      setLagDays(0);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(dependencyId: string) {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("householdId", householdId);
      formData.set("projectId", projectId);
      formData.set("dependencyId", dependencyId);
      await deleteTaskDependencyAction(formData);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="dep-editor"><p className="dep-editor__empty">Loading dependencies…</p></div>;
  }

  const predCandidates = candidates.filter((t) => !existingPredIds.has(t.id));
  const succCandidates = candidates.filter((t) => !existingSuccIds.has(t.id));

  return (
    <div className="dep-editor">
      <p className="dep-editor__title">Task Dependencies</p>

      {/* Predecessors */}
      <div className="dep-editor__section">
        <div className="dep-editor__section-label">Depends On (predecessors)</div>
        {predecessors.length === 0 ? (
          <p className="dep-editor__empty">No prerequisites.</p>
        ) : (
          <div className="dep-editor__list">
            {predecessors.map((dep) => {
              const t = taskById.get(dep.predecessorTaskId);
              return (
                <div key={dep.id} className="dep-editor__row">
                  <span className="dep-editor__row-task">{t?.title ?? dep.predecessorTaskId}</span>
                  <span className="dep-editor__row-type">{DEP_TYPE_LABELS[dep.dependencyType as TaskDependencyType] ?? dep.dependencyType}</span>
                  {dep.lagDays > 0 && <span className="dep-editor__row-lag">+{dep.lagDays}d</span>}
                  <button
                    type="button"
                    className="dep-editor__remove-btn"
                    onClick={() => void handleRemove(dep.id)}
                    disabled={submitting}
                    aria-label="Remove dependency"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {predCandidates.length > 0 && (
          <form onSubmit={(e) => void handleAddPredecessor(e)} className="dep-editor__add-form">
            <div>
              <div className="dep-editor__add-label">Add predecessor</div>
              <select value={predTaskId} onChange={(e) => setPredTaskId(e.target.value)} required>
                <option value="">— select task —</option>
                {predCandidates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="dep-editor__add-label">Type</div>
              <select value={depType} onChange={(e) => setDepType(e.target.value as TaskDependencyType)}>
                {(Object.keys(DEP_TYPE_LABELS) as TaskDependencyType[]).map((key) => (
                  <option key={key} value={key}>{DEP_TYPE_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="dep-editor__add-label">Lag (days)</div>
              <input
                type="number"
                min={0}
                value={lagDays}
                onChange={(e) => setLagDays(parseInt(e.target.value, 10) || 0)}
                style={{ width: 60 }}
              />
            </div>
            <button type="submit" className="dep-editor__add-btn" disabled={submitting || !predTaskId}>
              Add
            </button>
          </form>
        )}
      </div>

      {/* Successors */}
      <div className="dep-editor__section">
        <div className="dep-editor__section-label">Required By (successors)</div>
        {successors.length === 0 ? (
          <p className="dep-editor__empty">No tasks depend on this one.</p>
        ) : (
          <div className="dep-editor__list">
            {successors.map((dep) => {
              const t = taskById.get(dep.successorTaskId);
              return (
                <div key={dep.id} className="dep-editor__row">
                  <span className="dep-editor__row-task">{t?.title ?? dep.successorTaskId}</span>
                  <span className="dep-editor__row-type">{DEP_TYPE_LABELS[dep.dependencyType as TaskDependencyType] ?? dep.dependencyType}</span>
                  {dep.lagDays > 0 && <span className="dep-editor__row-lag">+{dep.lagDays}d</span>}
                  <button
                    type="button"
                    className="dep-editor__remove-btn"
                    onClick={() => void handleRemove(dep.id)}
                    disabled={submitting}
                    aria-label="Remove dependency"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {succCandidates.length > 0 && (
          <form onSubmit={(e) => void handleAddSuccessor(e)} className="dep-editor__add-form">
            <div>
              <div className="dep-editor__add-label">Add successor</div>
              <select value={succTaskId} onChange={(e) => setSuccTaskId(e.target.value)} required>
                <option value="">— select task —</option>
                {succCandidates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="dep-editor__add-label">Type</div>
              <select value={depType} onChange={(e) => setDepType(e.target.value as TaskDependencyType)}>
                {(Object.keys(DEP_TYPE_LABELS) as TaskDependencyType[]).map((key) => (
                  <option key={key} value={key}>{DEP_TYPE_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="dep-editor__add-label">Lag (days)</div>
              <input
                type="number"
                min={0}
                value={lagDays}
                onChange={(e) => setLagDays(parseInt(e.target.value, 10) || 0)}
                style={{ width: 60 }}
              />
            </div>
            <button type="submit" className="dep-editor__add-btn" disabled={submitting || !succTaskId}>
              Add
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
