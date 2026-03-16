import type { JSX } from "react";
import { getInventoryReorderForecast } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/formatters";

type InventoryAnalyticsReorderProps = {
  householdId: string;
};

const urgencyLabels: Record<"critical" | "soon" | "planned" | "healthy", string> = {
  critical: "Critical",
  soon: "Soon",
  planned: "Planned",
  healthy: "Healthy"
};

const getProgressWidth = (quantityOnHand: number, reorderThreshold: number | null, reorderQuantity: number | null): string => {
  const reference = Math.max(1, (reorderThreshold ?? 0) + (reorderQuantity ?? 0), quantityOnHand);
  return `${Math.min(100, (quantityOnHand / reference) * 100)}%`;
};

const formatConsumptionRate = (value: number): string => `~${value.toFixed(1)} units/month`;

export async function InventoryAnalyticsReorder({ householdId }: InventoryAnalyticsReorderProps): Promise<JSX.Element> {
  const forecast = await getInventoryReorderForecast(householdId);

  if (forecast.length === 0) {
    return (
      <section className="panel">
        <div className="panel__body">
          <p className="panel__empty">Reorder forecasting requires consumable inventory items with a reorder threshold.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="analytics-grid">
      {forecast.map((item) => {
        const fillToneClass = item.urgency === "critical"
          ? "analytics-chart-bar__fill--danger"
          : item.urgency === "soon"
            ? "analytics-chart-bar__fill--warning"
            : item.urgency === "healthy"
              ? "analytics-chart-bar__fill--success"
              : "";

        return (
          <section key={item.inventoryItemId} className="forecast-card">
            <div className="forecast-card__header">
              <div>
                <div className="data-table__primary">{item.itemName}</div>
                <div className="data-table__secondary">{item.partNumber ?? "No part number"}</div>
              </div>
              <span className={`urgency-badge urgency-badge--${item.urgency}`}>{urgencyLabels[item.urgency]}</span>
            </div>

            <div className="forecast-card__progress">
              <div className={`analytics-chart-bar__fill ${fillToneClass}`.trim()} style={{ width: getProgressWidth(item.quantityOnHand, item.reorderThreshold, item.reorderQuantity) }} />
            </div>

            <div className="forecast-card__dates">
              <span>Reorder by: {formatDate(item.projectedReorderDate, "—")}</span>
              <span>Depletes: {formatDate(item.projectedDepletionDate, "—")}</span>
            </div>

            <div className="data-table__secondary">{formatConsumptionRate(item.averageConsumptionPerMonth)}</div>
            <div className="data-table__secondary">Estimated reorder cost: {formatCurrency(item.estimatedReorderCost, "—")}</div>
            <div className="data-table__secondary">Preferred supplier: {item.preferredSupplier ?? "—"}</div>

            {item.supplierUrl ? (
              <a href={item.supplierUrl} target="_blank" rel="noreferrer noopener" className="data-table__link">
                Buy
              </a>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}