"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useState } from "react";

type MaterialItem = {
  name: string;
  quantity: string;
  notes: string;
};

type TaskItem = {
  label: string;
};

const STORAGE_KEY = "lifekeeper_ideas";

type StoredIdea = {
  id: string;
  title: string;
  description: string;
  materials: MaterialItem[];
  tasks: TaskItem[];
  escalateTo: string;
  createdAt: string;
};

function saveIdea(idea: Omit<StoredIdea, "id" | "createdAt">): void {
  const existing: StoredIdea[] = JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "[]",
  );
  existing.unshift({
    ...idea,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function IdeaWorkbench(): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [escalateTo, setEscalateTo] = useState("");

  const addMaterial = useCallback(() => {
    setMaterials((prev) => [...prev, { name: "", quantity: "", notes: "" }]);
  }, []);

  const updateMaterial = useCallback(
    (index: number, field: keyof MaterialItem, value: string) => {
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

    saveIdea({
      title: title.trim(),
      description: description.trim(),
      materials: materials.filter((m) => m.name.trim()),
      tasks: tasks.filter((t) => t.label.trim()),
      escalateTo,
    });

    router.push("/ideas");
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
            <h2>Escalate Later</h2>
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
                value={escalateTo}
                onChange={(e) => setEscalateTo(e.target.value)}
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
          disabled={!title.trim()}
        >
          Save Idea
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => router.push("/ideas")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
