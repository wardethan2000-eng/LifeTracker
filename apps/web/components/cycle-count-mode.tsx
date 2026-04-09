"use client";

import type { InventoryItemSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkAdjustInventoryItems } from "../lib/api";
import { useToast } from "./toast-provider";

type CycleCountModeProps = {
  householdId: string;
  items: InventoryItemSummary[];
  onExit: () => void;
};

const lastCountedKey = (householdId: string): string => `cycle-count:${householdId}:lastAt`;

export function CycleCountMode({ householdId, items, onExit }: CycleCountModeProps): JSX.Element {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastCountedAt, setLastCountedAt] = useState<string | null>(null);
  const router = useRouter();
  const { pushToast } = useToast();

  useEffect(() => {
    try {
      setLastCountedAt(localStorage.getItem(lastCountedKey(householdId)));
    } catch {
      // localStorage unavailable (e.g. SSR or private browsing)
    }
  }, [householdId]);

  const setCount = useCallback((itemId: string, value: string) => {
    setCounts((prev) => ({ ...prev, [itemId]: value }));
  }, []);

  const changedItems = items.filter((item) => {
    const raw = counts[item.id];
    if (raw === undefined || raw === "") return false;
    const parsed = parseFloat(raw);
    return !isNaN(parsed) && parsed !== item.quantityOnHand;
  });

  const handleSubmit = useCallback(async () => {
    if (changedItems.length === 0) return;

    setSubmitting(true);
    try {
      await bulkAdjustInventoryItems(householdId, {
        adjustments: changedItems.map((item) => ({
          inventoryItemId: item.id,
          newQuantity: parseFloat(counts[item.id] ?? "0"),
        })),
      });
      try {
        localStorage.setItem(lastCountedKey(householdId), new Date().toISOString());
      } catch {
        // ignore
      }
      pushToast({ message: `Updated ${changedItems.length} item${changedItems.length === 1 ? "" : "s"} from cycle count.` });
      router.refresh();
      onExit();
    } catch {
      pushToast({ message: "Failed to submit cycle count adjustments.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [householdId, changedItems, counts, pushToast, router, onExit]);

  return (
    <div className="cycle-count">
      <div className="cycle-count__header">
        <div>
          <h3>Cycle Count Mode</h3>
          <p className="data-table__secondary">
            Enter actual quantities. {changedItems.length} item{changedItems.length === 1 ? "" : "s"} changed.
            {lastCountedAt ? ` • Last counted ${new Date(lastCountedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Recorded</th>
            <th>Actual</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const raw = counts[item.id] ?? "";
            const parsed = raw !== "" ? parseFloat(raw) : null;
            const diff = parsed !== null && !isNaN(parsed) ? parsed - item.quantityOnHand : null;

            return (
              <tr key={item.id} className={diff !== null && diff !== 0 ? "row--due" : ""}>
                <td>
                  <div className="data-table__primary">{item.name}</div>
                  <div className="data-table__secondary">{item.partNumber ?? "—"}</div>
                </td>
                <td>{item.category}</td>
                <td>{item.quantityOnHand} {item.unit}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    className="cycle-count__input"
                    min={0}
                    step="0.01"
                    placeholder={String(item.quantityOnHand)}
                    value={raw}
                    onChange={(e) => setCount(item.id, e.target.value)}
                  />
                </td>
                <td>
                  {diff !== null && diff !== 0 ? (
                    <span className={diff > 0 ? "cycle-count__diff--plus" : "cycle-count__diff--minus"}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="cycle-count__footer">
        <button type="button" className="button button--ghost" onClick={onExit}>Cancel</button>
        <button
          type="button"
          className="button button--primary"
          disabled={changedItems.length === 0 || submitting}
          onClick={() => { void handleSubmit(); }}
        >
          {submitting ? "Saving..." : `Submit ${changedItems.length} Adjustment${changedItems.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
