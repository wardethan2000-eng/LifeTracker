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
    <div className="checklist">
      {items.length === 0 ? <p className="checklist__empty">{emptyMessage}</p> : null}

      {items.map((item) => (
        <div key={item.id} className="checklist__row">
          <form action={toggleAction} className="checklist__toggle">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name={parentFieldName} value={parentId} />
            <input type="hidden" name="checklistItemId" value={item.id} />
            <input type="hidden" name="title" value={item.title} />
            <input type="hidden" name="sortOrder" value={item.sortOrder ?? ""} />
            <input type="hidden" name="isCompleted" value={item.isCompleted ? "false" : "true"} />
            <input
              type="checkbox"
              className="checklist__checkbox"
              defaultChecked={item.isCompleted}
              onChange={(event) => {
                startTransition(() => {
                  event.currentTarget.form?.requestSubmit();
                });
              }}
            />
            <span className={item.isCompleted ? "checklist__label checklist__label--done" : "checklist__label"}>
              {item.title}
            </span>
          </form>

          <form action={deleteAction} className="checklist__delete-form">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name={parentFieldName} value={parentId} />
            <input type="hidden" name="checklistItemId" value={item.id} />
            <button type="submit" className="checklist__delete" title="Delete">×</button>
          </form>
        </div>
      ))}

      <form action={addAction} className="checklist__add">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name={parentFieldName} value={parentId} />
        <input
          name="title"
          placeholder={addPlaceholder}
          className="checklist__add-input"
          required
        />
        <button type="submit" className="checklist__add-btn">+</button>
      </form>
    </div>
  );
}