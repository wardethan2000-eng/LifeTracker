"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useState, useTransition } from "react";
import type { Idea, IdeaCategory, IdeaPriority, IdeaPromotionTarget, IdeaStage } from "@lifekeeper/types";
import { createIdeaAction, updateIdeaAction } from "../app/actions";

type MaterialDraft = {
  name: string;
  quantity: string;
  notes: string;
};

type TaskDraft = {
  label: string;
};

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

type IdeaWorkbenchProps = {
  householdId: string;
  idea?: Idea;
};

export function IdeaWorkbench({ householdId, idea }: IdeaWorkbenchProps): JSX.Element {
  const router = useRouter();
  const isEditMode = !!idea;
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [materials, setMaterials] = useState<MaterialDraft[]>(
    idea?.materials.map((m) => ({ name: m.name, quantity: m.quantity, notes: m.notes })) ?? []
  );
  const [tasks, setTasks] = useState<TaskDraft[]>(
    idea?.steps.map((s) => ({ label: s.label })) ?? []
  );
  const [promotionTarget, setPromotionTarget] = useState<IdeaPromotionTarget | "">(
    idea?.promotionTarget ?? ""
  );
  const [priority, setPriority] = useState<IdeaPriority>(idea?.priority ?? "medium");
  const [category, setCategory] = useState<IdeaCategory | "">(idea?.category ?? "");
  const [stage, setStage] = useState<IdeaStage>(idea?.stage ?? "spark");

  const addMaterial = useCallback(() => {
    setMaterials((prev) => [...prev, { name: "", quantity: "", notes: "" }]);
  }, []);

  const updateMaterial = useCallback(
    (index: number, field: keyof MaterialDraft, value: string) => {
      setMaterials((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
      );
    },
    [],
  );

  const removeMaterial = useCallback((index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addTask = useCallback(() => {
    setTasks((prev) => [...prev, { label: "" }]);
  }, []);

  const updateTask = useCallback((index: number, value: string) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { label: value } : t)),
    );
  }, []);

  const removeTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!title.trim()) return;

    const filteredMaterials = materials.filter((m) => m.name.trim());
    const filteredTasks = tasks.filter((t) => t.label.trim());

    startTransition(async () => {
      if (isEditMode) {
        await updateIdeaAction(householdId, idea.id, {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          category: category || null,
          promotionTarget: promotionTarget || null,
          materials: filteredMaterials.map((m) => ({
            id: crypto.randomUUID(),
            name: m.name.trim(),
            quantity: m.quantity.trim(),
            notes: m.notes.trim(),
          })),
          steps: filteredTasks.map((t) => ({
            id: crypto.randomUUID(),
            label: t.label.trim(),
            done: false,
          })),
        });
        router.push(`/ideas/${idea.id}`);
      } else {
        const newId = await createIdeaAction(householdId, {
          title: title.trim(),
          description: description.trim() || undefined,
          stage,
          priority,
          category: category || undefined,
          promotionTarget: promotionTarget || undefined,
          materials: filteredMaterials.map((m) => ({
            name: m.name.trim(),
            quantity: m.quantity.trim(),
            notes: m.notes.trim(),
          })),
          steps: filteredTasks.map((t) => ({
            label: t.label.trim(),
          })),
        });
        router.push(`/ideas/${newId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="workbench-layout">
      <div className="workbench-layout__main">
        <section className="card">
          <div className="card__header">
            <h2>Idea</h2>
          </div>
          <div className="card__body">
            <div className="form-grid">
              <label className="field field--span-2">
                <span>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's the idea?"
                  required
                  autoFocus
                />
              </label>
              <label className="field field--span-2">
                <span>Notes &amp; Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Flesh out the concept, add context, paste links..."
                  rows={5}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2>Materials &amp; Resources</h2>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={addMaterial}
            >
              + Add Item
            </button>
          </div>
          <div className="card__body">
            {materials.length === 0 ? (
              <p className="panel__empty">
                No materials yet. Add items you might need for this idea.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          value={mat.name}
                          onChange={(e) =>
                            updateMaterial(i, "name", e.target.value)
                          }
                          placeholder="Material name"
                          className="inline-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={mat.quantity}
                          onChange={(e) =>
                            updateMaterial(i, "quantity", e.target.value)
                          }
                          placeholder="e.g. 2"
                          className="inline-input"
                          style={{ width: 70 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={mat.notes}
                          onChange={(e) =>
                            updateMaterial(i, "notes", e.target.value)
                          }
                          placeholder="Optional notes"
                          className="inline-input"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => removeMaterial(i)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2>Tasks &amp; Steps</h2>
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={addTask}
            >
              + Add Task
            </button>
          </div>
          <div className="card__body">
            {tasks.length === 0 ? (
              <p className="panel__empty">
                No tasks yet. Break this idea into rough steps.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {tasks.map((task, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--ink-muted)",
                        fontSize: "0.85rem",
                        minWidth: 22,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={task.label}
                      onChange={(e) => updateTask(i, e.target.value)}
                      placeholder="What needs to happen?"
                      className="inline-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="button button--ghost button--sm"
                      onClick={() => removeTask(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="workbench-layout__aside">
        <section className="card">
          <div className="card__header">
            <h2>Priority &amp; Category</h2>
          </div>
          <div className="card__body">
            <label className="field">
              <span>Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IdeaPriority)}
              >
                {priorityOrder.map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IdeaCategory | "")}
              >
                <option value="">No category</option>
                {categoryKeys.map((c) => (
                  <option key={c} value={c}>{categoryLabels[c]}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {!isEditMode && (
          <section className="card">
            <div className="card__header">
              <h2>Initial Stage</h2>
            </div>
            <div className="card__body">
              <div className="stage-selector">
                {stageOrder.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`stage-selector__option${stage === s ? " stage-selector__option--active" : ""}`}
                    onClick={() => setStage(s)}
                  >
                    {stageLabels[s]}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card__header">
            <h2>Promotion Target</h2>
          </div>
          <div className="card__body">
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-light)",
                margin: "0 0 12px",
              }}
            >
              When this idea matures, where should it go?
            </p>
            <label className="field">
              <span>Destination</span>
              <select
                value={promotionTarget}
                onChange={(e) => setPromotionTarget(e.target.value as IdeaPromotionTarget | "")}
              >
                <option value="">Undecided</option>
                <option value="project">Project — plan with phases and budget</option>
                <option value="asset">Asset — something to track and maintain</option>
                <option value="hobby">Hobby — a pursuit to log sessions for</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="workbench-bar">
        <button
          type="submit"
          className="button button--primary"
          disabled={!title.trim() || isPending}
        >
          {isPending ? "Saving…" : isEditMode ? "Save Changes" : "Save Idea"}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => router.push(isEditMode ? `/ideas/${idea.id}` : "/ideas")}
          disabled={isPending}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
