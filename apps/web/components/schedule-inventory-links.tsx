"use client";

import type { InventoryItemSummary, ScheduleInventoryLinkDetail } from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import {
  createScheduleInventoryItem,
  deleteScheduleInventoryItem,
  getHouseholdInventory,
  getScheduleInventoryItems,
  updateScheduleInventoryItem
} from "../lib/api";

type ScheduleInventoryLinksProps = {
  assetId: string;
  scheduleId: string;
  householdId: string;
};

const toQuantityInput = (value: number): string => String(value);

export function ScheduleInventoryLinks({
  assetId,
  scheduleId,
  householdId
}: ScheduleInventoryLinksProps): JSX.Element {
  const [links, setLinks] = useState<ScheduleInventoryLinkDetail[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemSummary[]>([]);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [updatingInventoryItemId, setUpdatingInventoryItemId] = useState<string | null>(null);
  const [removingInventoryItemId, setRemovingInventoryItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [scheduleLinks, inventoryResult] = await Promise.all([
          getScheduleInventoryItems(assetId, scheduleId),
          getHouseholdInventory(householdId, { limit: 100 })
        ]);

        if (cancelled) {
          return;
        }

        setLinks(scheduleLinks);
        setInventoryItems(inventoryResult.items);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLinks([]);
        setInventoryItems([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load required parts.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [assetId, householdId, scheduleId]);

  useEffect(() => {
    setDraftQuantities(Object.fromEntries(links.map((link) => [link.inventoryItemId, toQuantityInput(link.quantityPerService)])));
  }, [links]);

  const availableInventoryItems = inventoryItems.filter(
    (item) => !links.some((link) => link.inventoryItemId === item.id)
  );

  useEffect(() => {
    if (availableInventoryItems.length === 0) {
      setSelectedInventoryItemId("");
      return;
    }

    const [firstAvailableItem] = availableInventoryItems;

    if (!firstAvailableItem) {
      return;
    }

    if (!selectedInventoryItemId || !availableInventoryItems.some((item) => item.id === selectedInventoryItemId)) {
      setSelectedInventoryItemId(firstAvailableItem.id);
    }
  }, [availableInventoryItems, selectedInventoryItemId]);

  const handleAdd = async (): Promise<void> => {
    const quantityPerService = Number(newQuantity);

    if (!selectedInventoryItemId || !Number.isFinite(quantityPerService) || quantityPerService <= 0) {
      setErrorMessage("Select an inventory item and enter a quantity greater than zero.");
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);

    try {
      const link = await createScheduleInventoryItem(assetId, scheduleId, {
        inventoryItemId: selectedInventoryItemId,
        quantityPerService
      });

      setLinks((current) => [...current, link].sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      setNewQuantity("1");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add required part.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleQuantityCommit = async (link: ScheduleInventoryLinkDetail): Promise<void> => {
    const nextRawValue = draftQuantities[link.inventoryItemId] ?? toQuantityInput(link.quantityPerService);
    const nextValue = Number(nextRawValue);

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setDraftQuantities((current) => ({
        ...current,
        [link.inventoryItemId]: toQuantityInput(link.quantityPerService)
      }));
      setErrorMessage("Quantity per service must be greater than zero.");
      return;
    }

    if (nextValue === link.quantityPerService) {
      return;
    }

    setUpdatingInventoryItemId(link.inventoryItemId);
    setErrorMessage(null);

    try {
      const updated = await updateScheduleInventoryItem(assetId, scheduleId, link.inventoryItemId, {
        quantityPerService: nextValue
      });

      setLinks((current) => current.map((entry) => entry.inventoryItemId === updated.inventoryItemId ? updated : entry));
    } catch (error) {
      setDraftQuantities((current) => ({
        ...current,
        [link.inventoryItemId]: toQuantityInput(link.quantityPerService)
      }));
      setErrorMessage(error instanceof Error ? error.message : "Failed to update quantity per service.");
    } finally {
      setUpdatingInventoryItemId(null);
    }
  };

  const handleRemove = async (inventoryItemId: string): Promise<void> => {
    setRemovingInventoryItemId(inventoryItemId);
    setErrorMessage(null);

    try {
      await deleteScheduleInventoryItem(assetId, scheduleId, inventoryItemId);
      setLinks((current) => current.filter((link) => link.inventoryItemId !== inventoryItemId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove required part.");
    } finally {
      setRemovingInventoryItemId(null);
    }
  };

  return (
    <section className="schedule-inventory-links" aria-label="Required parts">
      <div className="schedule-inventory-links__header">
        <div>
          <h4>Required Parts</h4>
          <p>Link inventory items this schedule consumes each time it is completed.</p>
        </div>
      </div>

      {isLoading ? (
        <p className="schedule-inventory-links__empty">Loading required parts…</p>
      ) : (
        <>
          {links.length === 0 ? (
            <p className="schedule-inventory-links__empty">No required parts linked yet.</p>
          ) : (
            <div className="schedule-inventory-links__table-wrap">
              <table className="data-table schedule-inventory-links__table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity per Service</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const isUpdating = updatingInventoryItemId === link.inventoryItemId;
                    const isRemoving = removingInventoryItemId === link.inventoryItemId;

                    return (
                      <tr key={link.id}>
                        <td>
                          <div className="data-table__primary">{link.inventoryItem.name}</div>
                          <div className="data-table__secondary">{link.inventoryItem.partNumber ?? "No part number"}</div>
                        </td>
                        <td>
                          <label className="schedule-inventory-links__quantity-field">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={draftQuantities[link.inventoryItemId] ?? toQuantityInput(link.quantityPerService)}
                              disabled={isUpdating || isRemoving}
                              onChange={(event) => setDraftQuantities((current) => ({
                                ...current,
                                [link.inventoryItemId]: event.target.value
                              }))}
                              onBlur={() => void handleQuantityCommit(link)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleQuantityCommit(link);
                                }
                              }}
                            />
                            <span>{link.inventoryItem.unit}</span>
                          </label>
                        </td>
                        <td className="schedule-inventory-links__actions-cell">
                          <button
                            type="button"
                            className="button button--secondary button--sm"
                            disabled={isRemoving || isUpdating}
                            onClick={() => void handleRemove(link.inventoryItemId)}
                          >
                            {isRemoving ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="schedule-inventory-links__controls">
            <label className="field">
              <span>Add Part</span>
              <select
                value={selectedInventoryItemId}
                disabled={availableInventoryItems.length === 0 || isAdding}
                onChange={(event) => setSelectedInventoryItemId(event.target.value)}
              >
                {availableInventoryItems.length === 0 ? (
                  <option value="">All household inventory items are already linked</option>
                ) : (
                  availableInventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.partNumber ? ` (${item.partNumber})` : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="field schedule-inventory-links__add-quantity">
              <span>Quantity per Service</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={newQuantity}
                disabled={isAdding || availableInventoryItems.length === 0}
                onChange={(event) => setNewQuantity(event.target.value)}
              />
            </label>
            <div className="schedule-inventory-links__add-action">
              <button
                type="button"
                className="button button--secondary"
                disabled={isAdding || availableInventoryItems.length === 0}
                onClick={() => void handleAdd()}
              >
                {isAdding ? "Adding…" : "Add Part"}
              </button>
            </div>
          </div>

          {errorMessage ? <p className="schedule-inventory-links__error">{errorMessage}</p> : null}
        </>
      )}
    </section>
  );
}