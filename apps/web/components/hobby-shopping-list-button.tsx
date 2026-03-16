"use client";

import type { JSX } from "react";
import { useState } from "react";
import { getHobbyRecipeShoppingList } from "../lib/api";
import type { HobbyRecipeShoppingList } from "@lifekeeper/types";

type HobbyShoppingListButtonProps = {
  householdId: string;
  hobbyId: string;
  recipeId: string;
  recipeName: string;
};

type LoadState = "idle" | "loading" | "loaded";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatQuantity(value: number, unit: string): string {
  return `${value} ${unit}`;
}

function formatCost(value: number | null): string {
  return value == null ? "-" : currencyFormatter.format(value);
}

export function HobbyShoppingListButton({
  householdId,
  hobbyId,
  recipeId,
  recipeName,
}: HobbyShoppingListButtonProps): JSX.Element {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [shoppingList, setShoppingList] = useState<HobbyRecipeShoppingList | null>(null);
  const [error, setError] = useState(false);

  const loadShoppingList = async (): Promise<void> => {
    setLoadState("loading");
    setError(false);

    try {
      const nextShoppingList = await getHobbyRecipeShoppingList(householdId, hobbyId, recipeId);
      setShoppingList(nextShoppingList);
      setLoadState("loaded");
    } catch {
      setShoppingList(null);
      setError(true);
      setLoadState("loaded");
    }
  };

  const closePanel = (): void => {
    setLoadState("idle");
    setShoppingList(null);
    setError(false);
  };

  const itemsNeedingPurchase = shoppingList?.items.filter((item) => item.deficit > 0).length ?? 0;

  return (
    <div style={{ width: "100%" }}>
      <button
        type="button"
        className="button button--secondary button--sm"
        onClick={loadShoppingList}
        disabled={loadState === "loading"}
      >
        {loadState === "loading" ? "Loading..." : "Shopping List"}
      </button>

      {loadState === "loaded" ? (
        <div className="shopping-list-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <strong>{shoppingList?.recipeName ?? recipeName}</strong>
            <button type="button" className="button button--ghost button--sm" onClick={closePanel}>Close</button>
          </div>

          {error ? (
            <div style={{ display: "grid", gap: "10px" }}>
              <p>Failed to load shopping list. Try again.</p>
              <div>
                <button type="button" className="button button--ghost button--sm" onClick={loadShoppingList}>Retry</button>
              </div>
            </div>
          ) : shoppingList && shoppingList.items.length === 0 ? (
            <p>This recipe has no ingredients.</p>
          ) : shoppingList ? (
            <>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Needed</th>
                    <th>On Hand</th>
                    <th>Deficit</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {shoppingList.items.map((item) => (
                    <tr key={item.ingredientId} className={item.deficit > 0 ? "shopping-list-row--deficit" : undefined}>
                      <td>{item.ingredientName}</td>
                      <td>{formatQuantity(item.quantityNeeded, item.unit)}</td>
                      <td>{formatQuantity(item.quantityOnHand, item.unit)}</td>
                      <td>{formatQuantity(item.deficit, item.unit)}</td>
                      <td>{formatCost(item.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="shopping-list-footer">
                <span>
                  Total Estimated Cost:{" "}
                  <strong className="shopping-list-footer__value">
                    {shoppingList.totalEstimatedCost == null ? "N/A" : currencyFormatter.format(shoppingList.totalEstimatedCost)}
                  </strong>
                </span>
                <span>{itemsNeedingPurchase} of {shoppingList.items.length} items need purchasing</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}