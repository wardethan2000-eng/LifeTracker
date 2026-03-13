"use client";

import { useTransition } from "react";

type ChecklistItem = {
  id: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number | null;
};

type ProjectChecklistProps = {
  items: ChecklistItem[];
  householdId: string;
  projectId: string;
  parentFieldName: "phaseId" | "taskId";
  parentId: string;
  addAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  addPlaceholder: string;
  emptyMessage: string;
};

export function ProjectChecklist({
  items,
  householdId,
  projectId,
  parentFieldName,
  parentId,
  addAction,
  toggleAction,
  deleteAction,
  addPlaceholder,
  emptyMessage
}: ProjectChecklistProps) {
  const [, startTransition] = useTransition();

  return (
    <div className="schedule-stack">
      {items.length === 0 ? <p className="panel__empty">{emptyMessage}</p> : null}

      {items.map((item) => (
        <div key={item.id} className="schedule-card" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
            <form action={toggleAction} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name={parentFieldName} value={parentId} />
              <input type="hidden" name="checklistItemId" value={item.id} />
              <input type="hidden" name="title" value={item.title} />
              <input type="hidden" name="sortOrder" value={item.sortOrder ?? ""} />
              <input type="hidden" name="isCompleted" value={item.isCompleted ? "false" : "true"} />
              <input
                type="checkbox"
                defaultChecked={item.isCompleted}
                onChange={(event) => {
                  startTransition(() => {
                    event.currentTarget.form?.requestSubmit();
                  });
                }}
              />
              <span style={{ textDecoration: item.isCompleted ? "line-through" : "none", color: item.isCompleted ? "var(--ink-muted)" : undefined }}>
                {item.title}
              </span>
            </form>

            <form action={deleteAction}>
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name={parentFieldName} value={parentId} />
              <input type="hidden" name="checklistItemId" value={item.id} />
              <button type="submit" className="button button--ghost button--sm">Delete</button>
            </form>
          </div>
        </div>
      ))}

      <form action={addAction} className="inline-actions" style={{ marginTop: 12 }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name={parentFieldName} value={parentId} />
        <input
          name="title"
          placeholder={addPlaceholder}
          className="field"
          style={{ flex: 1, minWidth: 240 }}
          required
        />
        <button type="submit" className="button">+</button>
      </form>
    </div>
  );
}