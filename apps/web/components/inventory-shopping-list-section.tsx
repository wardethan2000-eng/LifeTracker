import type { InventoryShoppingListSummary } from "@lifekeeper/types";
import type { JSX } from "react";
import { generateInventoryShoppingListAction } from "../app/actions";
import { formatCurrency } from "../lib/formatters";
import { InventoryPurchaseLineActions } from "./inventory-purchase-line-actions";

type InventoryShoppingListSectionProps = {
  householdId: string;
  shoppingList: InventoryShoppingListSummary;
  redirectTo: string;
};

const formatQuantity = (value: number, unit: string): string => `${value} ${unit}`;

export function InventoryShoppingListSection({ householdId, shoppingList, redirectTo }: InventoryShoppingListSectionProps): JSX.Element {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Shopping List / Reorder Cart</h2>
          <div className="data-table__secondary">
            {shoppingList.lineCount} line{shoppingList.lineCount === 1 ? "" : "s"} across {shoppingList.supplierCount} supplier{shoppingList.supplierCount === 1 ? "" : "s"}
            {shoppingList.totalEstimatedCost !== null ? ` • ${formatCurrency(shoppingList.totalEstimatedCost, "$0.00")} estimated` : ""}
          </div>
        </div>
        <div className="panel__header-actions">
          <form action={generateInventoryShoppingListAction}>
            <input type="hidden" name="householdId" value={householdId} />
            <button type="submit" className="button button--primary button--sm">Generate Shopping List</button>
          </form>
        </div>
      </div>
      <div className="panel__body">
        {shoppingList.purchaseCount === 0 ? (
          <p className="panel__empty">No active reorder carts yet. Generate one from the low-stock watchlist or use Quick Restock below.</p>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {shoppingList.purchases.map((purchase) => (
              <section key={purchase.id} style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 16px", background: "var(--surface-alt)" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{purchase.supplierName ?? "No supplier specified"}</strong>
                      <span className={`status-chip status-chip--${purchase.status === "ordered" ? "due" : "upcoming"}`}>{purchase.status}</span>
                    </div>
                    <div className="data-table__secondary">
                      {purchase.lineCount} line{purchase.lineCount === 1 ? "" : "s"}
                      {purchase.totalEstimatedCost !== null ? ` • ${formatCurrency(purchase.totalEstimatedCost, "$0.00")}` : ""}
                    </div>
                  </div>
                  {purchase.supplierUrl ? (
                    <a href={purchase.supplierUrl} target="_blank" rel="noreferrer" className="button button--ghost button--sm">Open Supplier</a>
                  ) : null}
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Current Stock</th>
                      <th>Planned Buy</th>
                      <th>Unit Cost</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.lines.map((line) => (
                      <tr key={line.id} className={line.inventoryItem.lowStock ? "row--due" : ""}>
                        <td>
                          <div className="data-table__primary">{line.inventoryItem.name}</div>
                          <div className="data-table__secondary">{line.inventoryItem.partNumber ?? "No part number"}</div>
                        </td>
                        <td>{formatQuantity(line.inventoryItem.quantityOnHand, line.inventoryItem.unit)}</td>
                        <td>{formatQuantity(line.plannedQuantity, line.inventoryItem.unit)}</td>
                        <td>{formatCurrency(line.unitCost, "—")}</td>
                        <td>
                          <span className={`status-chip status-chip--${line.status === "received" ? "upcoming" : line.status === "ordered" ? "due" : "warning"}`}>
                            {line.status}
                          </span>
                        </td>
                        <td>
                          <InventoryPurchaseLineActions householdId={householdId} purchaseId={purchase.id} line={line} redirectTo={redirectTo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}