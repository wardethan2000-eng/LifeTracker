"use client";

import type { ReactElement } from "react";
import { LkBarChart } from "./charts";
import { formatCurrencyTick } from "../lib/chart-theme";

type AssetCostChartsProps = {
  costByYear: Array<{ year: string; totalCost: number; logCount: number }>;
  forecast: { total3m: number; total6m: number; total12m: number } | null;
  mode?: "all" | "history" | "forecast";
};

export function AssetCostCharts({ costByYear, forecast, mode = "all" }: AssetCostChartsProps): ReactElement {
  const forecastData = forecast
    ? [
        { horizon: "3 Months", totalCost: forecast.total3m },
        { horizon: "6 Months", totalCost: forecast.total6m },
        { horizon: "12 Months", totalCost: forecast.total12m }
      ]
    : [];

  return (
    <>
      {(mode === "all" || mode === "history") ? (
        <LkBarChart
          data={costByYear.map((entry) => ({ year: entry.year, totalCost: entry.totalCost }))}
          xKey="year"
          bars={[{ dataKey: "totalCost", label: "Total Cost" }]}
          yTickFormatter={formatCurrencyTick}
          emptyMessage="No maintenance cost history yet."
          height={260}
        />
      ) : null}
      {(mode === "all" || mode === "forecast") ? (
        <LkBarChart
          data={forecastData}
          xKey="horizon"
          bars={[{ dataKey: "totalCost", label: "Projected Cost" }]}
          yTickFormatter={formatCurrencyTick}
          emptyMessage="No forecast data is available yet."
          height={240}
        />
      ) : null}
    </>
  );
}