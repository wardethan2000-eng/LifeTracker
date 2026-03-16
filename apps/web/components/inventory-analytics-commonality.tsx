import type { JSX } from "react";
import { getPartCommonality } from "../lib/api";
import { formatCurrency } from "../lib/formatters";

type InventoryAnalyticsCommonalityProps = {
  householdId: string;
};

export async function InventoryAnalyticsCommonality({ householdId }: InventoryAnalyticsCommonalityProps): Promise<JSX.Element> {
  const parts = await getPartCommonality(householdId);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Shared Parts Across Assets</h2>
        <span className="data-table__secondary">{parts.length} shared parts</span>
      </div>
      <div className="panel__body">
        {parts.length === 0 ? (
          <p className="panel__empty">This view highlights parts used by multiple assets and will populate as more maintenance is logged.</p>
        ) : (
          parts.map((part) => (
            <div key={`${part.partName}-${part.partNumber ?? "none"}`} className="commonality-row">
              <div>
                <div className="data-table__primary">{part.partName}</div>
                <div className="data-table__secondary">{part.partNumber ?? "No part number"}</div>
              </div>
              <div className="commonality-row__assets">
                {part.assets.map((asset) => (
                  <span key={asset.assetId} className="commonality-row__asset-chip">
                    {asset.assetName} • {asset.timesUsed}x
                  </span>
                ))}
              </div>
              <div className="data-table__secondary">
                Total quantity: {part.totalQuantityAcrossAssets} • Total cost: {formatCurrency(part.totalCostAcrossAssets, "—")}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}