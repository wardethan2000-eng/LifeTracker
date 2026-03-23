"use client";

import type { InventoryItemConsumption, InventoryItemSummary, SpaceResponse } from "@lifekeeper/types";
import Link from "next/link";
import type { JSX } from "react";
import { useMemo } from "react";
import { useMultiSelect } from "../lib/use-multi-select";
import { formatCurrency } from "../lib/formatters";
import { BulkActionBar } from "./bulk-action-bar";
import { InventoryBulkActions } from "./inventory-bulk-actions";
import { InventoryEditableRow } from "./inventory-editable-row";
import { InventorySection } from "./inventory-section";

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

const formatStockAmount = (value: number, unit: string): string => {
  const normalizedUnit = normalizeUnit(unit);

  if (value === 0) {
    return "Out of stock";
  }

  if (normalizedUnit === "each") {
    return `${value} item${value === 1 ? "" : "s"}`;
  }

  return `${value} ${unit}`;
};

const formatReorderPoint = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No reorder trigger";
  }

  const normalizedUnit = normalizeUnit(unit);

  if (normalizedUnit === "each") {
    return `Reorder when ${value} item${value === 1 ? "" : "s"} remain`;
  }

  return `Reorder when ${value} ${unit} remain`;
};

const formatRestockPlan = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No restock amount set";
  }

  const normalizedUnit = normalizeUnit(unit);

  if (normalizedUnit === "each") {
    return `Usually buy ${value} item${value === 1 ? "" : "s"}`;
  }

  return `Usually buy ${value} ${unit}`;
};

const buildInventoryItemHref = (householdId: string, inventoryItemId: string): string => `/inventory/${inventoryItemId}?householdId=${householdId}`;

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
                <table className="data-table">
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
                      <th>{isEquipmentView ? "Count" : "On Hand"}</th>
                      <th>{isEquipmentView ? "Condition" : "Reorder Rule"}</th>
                      <th>Last Price</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <InventoryEditableRow
                        key={item.id}
                        householdId={householdId}
                        item={item}
                        columnCount={8}
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
                        <td>
                          <div className="data-table__primary">
                            <Link href={buildInventoryItemHref(householdId, item.id)} className="data-table__link">{item.name}</Link>
                          </div>
                          <div className="data-table__secondary">
                            {[item.partNumber, item.manufacturer].filter(Boolean).join(" • ") || "No part number or maker recorded"}
                          </div>
                        </td>
                        <td>{item.itemType === "equipment" ? `${item.quantityOnHand} unit${item.quantityOnHand === 1 ? "" : "s"}` : formatStockAmount(item.quantityOnHand, item.unit)}</td>
                        <td>
                          {item.itemType === "equipment" ? (
                            <div className="data-table__primary">{item.conditionStatus ? item.conditionStatus.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()) : "No condition set"}</div>
                          ) : (
                            <>
                              <div className="data-table__primary">{formatReorderPoint(item.reorderThreshold, item.unit)}</div>
                              <div className="data-table__secondary">{formatRestockPlan(item.reorderQuantity, item.unit)}</div>
                            </>
                          )}
                        </td>
                        <td>{formatCurrency(item.unitCost, "No recent price")}</td>
                        <td>{item.preferredSupplier ?? "—"}</td>
                        <td>
                          <span className={`status-chip status-chip--${item.lowStock ? "due" : "upcoming"}`}>
                            {item.lowStock ? "Needs reorder" : "OK"}
                          </span>
                        </td>
                        <td>{item.storageLocation ?? "—"}</td>
                      </InventoryEditableRow>
                    ))}
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