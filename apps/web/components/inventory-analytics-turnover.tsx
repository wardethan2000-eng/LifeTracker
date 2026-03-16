import type { JSX } from "react";
import { getInventoryTurnover } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type InventoryAnalyticsTurnoverProps = {
  householdId: string;
};

const velocityLabels: Record<"fast" | "moderate" | "slow" | "stale", string> = {
  fast: "Fast",
  moderate: "Moderate",
  slow: "Slow",
  stale: "Stale"
};

const formatDaysAgo = (value: number | null): string => {
  if (value === null) {
    return "Never";
  }

  if (value === 0) {
    return "Today";
  }

  return `${value} days ago`;
};

const formatTurnoverRate = (value: number | null): string => value === null ? "—" : value.toFixed(1);

const getRowClassName = (velocity: "fast" | "moderate" | "slow" | "stale"): string => {
  if (velocity === "stale") {
    return "row--overdue";
  }

  if (velocity === "slow") {
    return "row--due";
  }

  return "";
};

export async function InventoryAnalyticsTurnover({ householdId }: InventoryAnalyticsTurnoverProps): Promise<JSX.Element> {
  const turnover = await getInventoryTurnover(householdId);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Inventory Turnover</h2>
        <span className="data-table__secondary">{turnover.length} items</span>
      </div>
      <div className="panel__body">
        {turnover.length === 0 ? (
          <p className="panel__empty">No inventory items are available for turnover analysis yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>On Hand</th>
                <th>Last Consumed</th>
                <th>Turnover Rate</th>
                <th>Velocity</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {turnover.map((item) => (
                <tr key={item.inventoryItemId} className={getRowClassName(item.velocityCategory)}>
                  <td>
                    <div className="data-table__primary">{item.itemName}</div>
                    <div className="data-table__secondary">{item.partNumber ?? "No part number"}</div>
                  </td>
                  <td>{item.category ?? "Uncategorized"}</td>
                  <td>{item.quantityOnHand} {item.unit}</td>
                  <td>{formatDaysAgo(item.daysSinceLastConsumption)}</td>
                  <td>{formatTurnoverRate(item.turnoverRate)}</td>
                  <td>
                    <span className={`velocity-badge velocity-badge--${item.velocityCategory}`}>
                      {velocityLabels[item.velocityCategory]}
                    </span>
                  </td>
                  <td>{formatCurrency(item.totalValue, "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}