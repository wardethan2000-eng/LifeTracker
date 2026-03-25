"use client";

import type { InventoryItemConsumption, InventoryItemSummary, SpaceResponse } from "@lifekeeper/types";
import type { JSX } from "react";
import { useCallback, useMemo, useState } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import { BulkActionBar } from "./bulk-action-bar";
import { InventoryBulkActions } from "./inventory-bulk-actions";
import { InventoryEditableRow } from "./inventory-editable-row";
import { InventorySection } from "./inventory-section";
import { ClickToEdit } from "./click-to-edit";
import { QuantityStepper } from "./quantity-stepper";
import { useToast } from "./toast-provider";
import { updateInventoryItemFieldAction } from "../app/actions";

type InventoryGroup = {
  label: string;
  items: InventoryItemSummary[];
};

type InventoryListWorkspaceProps = {
  householdId: string;
  totalCount: number;
  categoryOptions: string[];
  groupedItems: InventoryGroup[];
  isEquipmentView: boolean;
  highlightId: string | undefined;
  highlightedAnalytics: InventoryItemConsumption | null;
  spaces: SpaceResponse[];
};

const normalizeUnit = (unit: string): string => unit.trim().toLowerCase();

export function InventoryListWorkspace({
  householdId,
  totalCount,
  categoryOptions,
  groupedItems,
  isEquipmentView,
  highlightId,
  highlightedAnalytics,
  spaces,
}: InventoryListWorkspaceProps): JSX.Element {
  const { selectedIds, selectedCount, isSelected, toggleItem, toggleGroup, clearSelection } = useMultiSelect();
  const { pushToast } = useToast();

  type OptimisticItemFields = {
    name?: string;
    quantityOnHand?: number;
    unitCost?: number | null;
    storageLocation?: string | null;
  };
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticItemFields>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const handleSave = useCallback(
    async (
      itemId: string,
      field: "name" | "quantityOnHand" | "unitCost" | "storageLocation",
      value: string | number | null,
    ) => {
      const key = `${itemId}:${field}`;
      setSaving((prev) => new Set([...prev, key]));
      setOptimistic((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [field]: value },
      }));

      const result = await updateInventoryItemFieldAction(householdId, itemId, {
        [field]: value,
      });

      if (!result.success) {
        setOptimistic((prev) => {
          const next = { ...prev };
          if (next[itemId]) {
            const fields = { ...next[itemId] };
            delete (fields as Record<string, unknown>)[field];
            next[itemId] = fields;
          }
          return next;
        });
        pushToast({ message: result.message ?? "Update failed", tone: "danger" });
      }

      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [householdId, pushToast],
  );

  const allItems = useMemo(() => groupedItems.flatMap((group) => group.items), [groupedItems]);
  const selectedItems = useMemo(() => allItems.filter((item) => selectedIds.has(item.id)), [allItems, selectedIds]);

  return (
    <InventorySection
      householdId={householdId}
      totalCount={totalCount}
      categoryOptions={categoryOptions}
      actions={(
        <InventoryBulkActions
          householdId={householdId}
          selectedItems={selectedItems}
          spaces={spaces}
          onBulkAssigned={clearSelection}
        />
      )}
    >
      {allItems.length === 0 ? (
        <p className="panel__empty">No inventory items found for this household yet.</p>
      ) : (
        <div className="inventory-groups">
          <BulkActionBar selectedCount={selectedCount} onClearSelection={clearSelection} />

          {groupedItems.map((group) => {
            const groupSelectedCount = group.items.filter((item) => isSelected(item.id)).length;
            const allGroupItemsSelected = group.items.length > 0 && groupSelectedCount === group.items.length;

            return (
              <section key={group.label} className="inventory-group">
                <div className="inventory-group__header">
                  <div>
                    <h3>{group.label}</h3>
                    <p>{group.items.length} item{group.items.length === 1 ? "" : "s"} in this category</p>
                  </div>
                </div>
                <table className="data-table inventory-table--sticky">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>
                        <input
                          type="checkbox"
                          aria-label={`Select all ${group.label} items`}
                          checked={allGroupItemsSelected}
                          onChange={(event) => toggleGroup(group.items.map((item) => item.id), event.target.checked)}
                        />
                      </th>
                      <th>Item</th>
                      <th>{isEquipmentView ? "Count" : "Stock"}</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const ov = optimistic[item.id] ?? {};
                      const name = ov.name ?? item.name;
                      const quantityOnHand = ov.quantityOnHand !== undefined ? ov.quantityOnHand : item.quantityOnHand;
                      const storageLocation = ov.storageLocation !== undefined ? ov.storageLocation : item.storageLocation;

                      return (
                      <InventoryEditableRow
                        key={item.id}
                        householdId={householdId}
                        item={item}
                        columnCount={6}
                        className={[item.lowStock ? "row--due" : null, item.id === highlightId ? "row--highlight" : null].filter(Boolean).join(" ") || ""}
                        defaultOpen={item.id === highlightId && highlightedAnalytics !== null}
                        analytics={item.id === highlightId ? highlightedAnalytics : null}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.name}`}
                            checked={isSelected(item.id)}
                            onChange={() => toggleItem(item.id)}
                          />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <ClickToEdit
                            value={name}
                            required
                            disabled={saving.has(`${item.id}:name`)}
                            aria-label={`Edit name of ${item.name}`}
                            onSave={(v) => { void handleSave(item.id, "name", v); }}
                          />
                          <div className="data-table__secondary">
                            {[item.partNumber, item.manufacturer].filter(Boolean).join(" • ") || "No part number or maker recorded"}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <QuantityStepper
                            value={quantityOnHand}
                            min={0}
                            suffix={item.unit !== "each" ? item.unit : undefined}
                            disabled={saving.has(`${item.id}:quantityOnHand`)}
                            aria-label={`Edit quantity of ${item.name}`}
                            onSave={(v) => { void handleSave(item.id, "quantityOnHand", v); }}
                          />
                        </td>
                        <td>
                          <span className={`status-chip status-chip--${item.lowStock ? "due" : "upcoming"}`}>
                            {item.lowStock ? "Low" : "OK"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <ClickToEdit
                            value={storageLocation ?? ""}
                            placeholder="—"
                            disabled={saving.has(`${item.id}:storageLocation`)}
                            aria-label={`Edit storage location of ${item.name}`}
                            onSave={(v) => { void handleSave(item.id, "storageLocation", v || null as unknown as string); }}
                          />
                        </td>
                        <td>
                          <button type="button" className="button button--ghost button--sm" aria-label="More actions" style={{ padding: "2px 6px", fontSize: "1.1rem", lineHeight: 1 }}>⋮</button>
                        </td>
                      </InventoryEditableRow>
                    );})}

                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </InventorySection>
  );
}