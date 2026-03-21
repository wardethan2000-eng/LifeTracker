"use client";

import { useEffect, useState, useTransition } from "react";
import { SortableList, type DragHandleProps } from "./ui/sortable-list";

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
  onReorder?: (orderedIds: string[]) => void;
};

function ChecklistRow({
  item,
  householdId,
  projectId,
  parentFieldName,
  parentId,
  toggleAction,
  deleteAction,
  dragHandleProps,
}: {
  item: ChecklistItem;
  householdId: string;
  projectId: string;
  parentFieldName: "phaseId" | "taskId";
  parentId: string;
  toggleAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  dragHandleProps?: DragHandleProps;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="checklist__row">
      {dragHandleProps && (
        <span
          ref={(el: HTMLSpanElement | null) => dragHandleProps.ref(el)}
          role={dragHandleProps.role}
          tabIndex={dragHandleProps.tabIndex}
          aria-roledescription={dragHandleProps["aria-roledescription"]}
          aria-describedby={dragHandleProps["aria-describedby"]}
          aria-pressed={dragHandleProps["aria-pressed"]}
          aria-disabled={dragHandleProps["aria-disabled"]}
          onKeyDown={dragHandleProps.onKeyDown}
          onPointerDown={dragHandleProps.onPointerDown}
          className="drag-handle"
          style={{ fontSize: "0.75rem" }}
        />
      )}
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
  );
}

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
  emptyMessage,
  onReorder,
}: ProjectChecklistProps) {
  const [orderedItems, setOrderedItems] = useState<ChecklistItem[]>(items);
  useEffect(() => { setOrderedItems(items); }, [items]);

  return (
    <div className={`checklist${onReorder ? " checklist--sortable" : ""}`}>
      {items.length === 0 ? <p className="checklist__empty">{emptyMessage}</p> : null}

      {onReorder ? (
        <SortableList
          items={orderedItems}
          onReorder={(newIds) => {
            const reordered = newIds.map((id) => orderedItems.find((i) => i.id === id)!);
            setOrderedItems(reordered);
            onReorder(newIds);
          }}
          renderItem={(item, dragHandleProps) => (
            <ChecklistRow
              item={item}
              householdId={householdId}
              projectId={projectId}
              parentFieldName={parentFieldName}
              parentId={parentId}
              toggleAction={toggleAction}
              deleteAction={deleteAction}
              dragHandleProps={dragHandleProps}
            />
          )}
        />
      ) : (
        items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            householdId={householdId}
            projectId={projectId}
            parentFieldName={parentFieldName}
            parentId={parentId}
            toggleAction={toggleAction}
            deleteAction={deleteAction}
          />
        ))
      )}

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