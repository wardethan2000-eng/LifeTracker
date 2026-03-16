"use client";

import type { UsageProjection, UsageCostNormalization } from "@lifekeeper/types";
import type { ReactElement } from "react";
import { LkAreaChart, LkLineChart, formatCurrencyTick, formatDateTick } from "./charts";

type AssetMetricChartsProps = {
  costNormalizationEntries: UsageCostNormalization["entries"];
  projectionData: UsageProjection | null;
  metricUnit: string;
};

export function AssetMetricCharts({
  costNormalizationEntries,
  projectionData,
  metricUnit
}: AssetMetricChartsProps): ReactElement | null {
  if (costNormalizationEntries.length === 0 && !projectionData?.projectedValues.length) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {costNormalizationEntries.length > 0 ? (
        <LkLineChart
          data={costNormalizationEntries.map((entry) => ({
            completedAt: entry.completedAt,
            costPerUnit: entry.costPerUnit
          }))}
          xKey="completedAt"
          xTickFormatter={formatDateTick}
          yTickFormatter={formatCurrencyTick}
          lines={[{ dataKey: "costPerUnit", label: `Cost per ${metricUnit}` }]}
          emptyMessage="No cost normalization trend is available yet."
          height={240}
        />
      ) : null}
      {projectionData?.projectedValues.length ? (
        <LkAreaChart
          data={projectionData.projectedValues.map((entry) => ({ date: entry.date, value: entry.value }))}
          xKey="date"
          xTickFormatter={formatDateTick}
          areas={[{ dataKey: "value", label: `Projected ${metricUnit}` }]}
          emptyMessage="No projected usage values are available."
          height={240}
        />
      ) : null}
    </div>
  );
}