"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import type { IdeaMaterialItem } from "@aegis/types";
import { updateIdeaAction } from "../app/actions";
import { Card } from "./card";

type IdeaMaterialsCardProps = {
  householdId: string;
  ideaId: string;
  materials: IdeaMaterialItem[];
};

export function IdeaMaterialsCard({ householdId, ideaId, materials }: IdeaMaterialsCardProps): JSX.Element {
  const [localMaterials, setLocalMaterials] = useState<IdeaMaterialItem[]>(materials);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const saveDebounced = useCallback(
    (updated: IdeaMaterialItem[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const timer = setTimeout(() => {
        startTransition(async () => {
          await updateIdeaAction(householdId, ideaId, { materials: updated });
        });
      }, 500);
      debounceRef.current = timer;
    },
    [householdId, ideaId]
  );

  const handleChange = useCallback(
    (id: string, field: keyof Omit<IdeaMaterialItem, "id">, value: string) => {
      setLocalMaterials((prev) => {
        const updated = prev.map((m) => (m.id === id ? { ...m, [field]: value } : m));
        saveDebounced(updated);
        return updated;
      });
    },
    [saveDebounced]
  );

  const handleAdd = useCallback(() => {
    const newItem: IdeaMaterialItem = {
      id: crypto.randomUUID(),
      name: "",
      quantity: "",
      notes: "",
    };
    setLocalMaterials((prev) => {
      const updated = [...prev, newItem];
      saveDebounced(updated);
      return updated;
    });
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [saveDebounced]);

  const handleRemove = useCallback(
    (id: string) => {
      setLocalMaterials((prev) => {
        const updated = prev.filter((m) => m.id !== id);
        saveDebounced(updated);
        return updated;
      });
    },
    [saveDebounced]
  );

  return (
    <Card
      title={`Materials & Resources (${localMaterials.length})`}
      actions={
        <button
          type="button"
          className="button button--ghost button--xs"
          onClick={handleAdd}
          disabled={isPending}
        >
          + Add
        </button>
      }
    >
      {localMaterials.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          No materials listed. Add items you might need.{" "}
          <button type="button" className="button button--ghost button--xs" onClick={handleAdd}>
            Add one
          </button>
        </p>
      ) : (
        <table className="workbench-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: 100 }}>Quantity</th>
              <th>Notes</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {localMaterials.map((material, idx) => (
              <tr key={material.id}>
                <td>
                  <input
                    ref={idx === localMaterials.length - 1 ? nameInputRef : undefined}
                    type="text"
                    className="input input--sm"
                    value={material.name}
                    onChange={(e) => handleChange(material.id, "name", e.target.value)}
                    placeholder="Item name"
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="input input--sm"
                    value={material.quantity}
                    onChange={(e) => handleChange(material.id, "quantity", e.target.value)}
                    placeholder="Qty"
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="input input--sm"
                    value={material.notes}
                    onChange={(e) => handleChange(material.id, "notes", e.target.value)}
                    placeholder="Notes"
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button--ghost button--xs"
                    onClick={() => handleRemove(material.id)}
                    aria-label="Remove material"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
