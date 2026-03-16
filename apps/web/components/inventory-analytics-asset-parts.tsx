import type { JSX } from "react";
import { getAssetPartsConsumption } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type InventoryAnalyticsAssetPartsProps = {
  householdId: string;
};

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short"
});

const getBarWidth = (value: number, max: number): string => {
  if (max <= 0 || value <= 0) {
    return "0%";
  }

  return `${Math.max((value / max) * 100, 4)}%`;
};

const formatMonthLabel = (month: string): string => {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart ?? "1970");
  const monthValue = Number(monthPart ?? "1");
  const date = new Date(Date.UTC(year, monthValue - 1, 1));
  return `${monthFormatter.format(date)} '${String(year).slice(-2)}`;
};

const formatAverageInterval = (value: number | null): string => value === null ? "—" : `Every ${Math.round(value)} days`;

export async function InventoryAnalyticsAssetParts({ householdId }: InventoryAnalyticsAssetPartsProps): Promise<JSX.Element> {
  const assets = await getAssetPartsConsumption(householdId);

  if (assets.length === 0) {
    return (
      <section className="panel">
        <div className="panel__body">
          <p className="panel__empty">No maintenance log parts have been recorded for household assets yet.</p>
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {assets.map((asset) => {
        const monthlyMax = Math.max(...asset.monthlyPartsCost.map((entry) => entry.totalCost), 0);

        return (
          <section key={asset.assetId} className="panel">
            <div className="panel__header">
              <div>
                <h2>{asset.assetName}</h2>
                <span className="pill">{asset.assetCategory}</span>
              </div>
              <span className="data-table__secondary">{formatCurrency(asset.totalPartsCost, "—")}</span>
            </div>
            <div className="panel__body" style={{ display: "grid", gap: 16 }}>
              <div className="analytics-inline-metrics">
                <div className="analytics-inline-metric">
                  <span>Parts used</span>
                  <strong>{asset.totalPartsUsed}</strong>
                </div>
                <div className="analytics-inline-metric">
                  <span>Total units</span>
                  <strong>{asset.totalPartsQuantity}</strong>
                </div>
                <div className="analytics-inline-metric">
                  <span>Total cost</span>
                  <strong>{formatCurrency(asset.totalPartsCost, "—")}</strong>
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Times Used</th>
                    <th>Total Qty</th>
                    <th>Total Cost</th>
                    <th>Avg Interval</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.topParts.map((part) => (
                    <tr key={`${asset.assetId}-${part.partName}-${part.partNumber ?? "none"}`}>
                      <td>
                        <div className="data-table__primary">{part.partName}</div>
                        <div className="data-table__secondary">{part.partNumber ?? "No part number"}</div>
                      </td>
                      <td>{part.occurrences}</td>
                      <td>{part.totalQuantity}</td>
                      <td>{formatCurrency(part.totalCost, "—")}</td>
                      <td>{formatAverageInterval(part.averageInterval)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div>
                <div className="data-table__primary" style={{ marginBottom: 8 }}>Monthly Parts Spending</div>
                {asset.monthlyPartsCost.map((entry) => (
                  <div key={`${asset.assetId}-${entry.month}`} className="analytics-chart-bar">
                    <div className="analytics-chart-bar__label">{formatMonthLabel(entry.month)}</div>
                    <div className="analytics-chart-bar__track">
                      <div className="analytics-chart-bar__fill" style={{ width: getBarWidth(entry.totalCost, monthlyMax) }} />
                    </div>
                    <div className="analytics-chart-bar__value">{formatCurrency(entry.totalCost, "—")} • {entry.partCount}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}