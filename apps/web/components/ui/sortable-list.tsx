"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

// ---------- SortableItem ----------

export interface SortableItemProps {
  id: string;
  children: (dragHandleProps: DragHandleProps) => ReactNode;
}

export interface DragHandleProps {
  ref: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  role: string;
  tabIndex: number;
  "aria-roledescription": string;
  "aria-describedby": string | undefined;
  "aria-pressed": boolean | undefined;
  "aria-disabled": boolean | undefined;
  onKeyDown: React.KeyboardEventHandler;
  onPointerDown: React.PointerEventHandler;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const itemStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const dragHandleProps: DragHandleProps = {
    ref: setActivatorNodeRef,
    role: "button",
    tabIndex: 0,
    "aria-roledescription": "sortable",
    "aria-describedby": attributes["aria-describedby"],
    "aria-pressed": undefined,
    "aria-disabled": undefined,
    onKeyDown: listeners?.onKeyDown as React.KeyboardEventHandler,
    onPointerDown: listeners?.onPointerDown as React.PointerEventHandler,
  };

  return (
    <div ref={setNodeRef} style={itemStyle} {...attributes}>
      {children(dragHandleProps)}
    </div>
  );
}

// ---------- SortableList ----------

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (newOrder: string[]) => void;
  renderItem: (item: T, dragHandleProps: DragHandleProps) => ReactNode;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((item) => item.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {(dragHandleProps) => renderItem(item, dragHandleProps)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
