"use client";

import type { ReactElement } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { chartColors } from "../../lib/chart-theme";

const getSeriesColor = (index: number): string => chartColors.series[index % chartColors.series.length] ?? chartColors.primary;

export type LkDonutChartProps = {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  emptyMessage?: string;
};

export function LkDonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 90,
  centerLabel,
  centerValue,
  emptyMessage = "No data available"
}: LkDonutChartProps): ReactElement {
  if (data.length === 0) {
    return (
      <div className="lk-chart-container lk-chart-container--empty">
        <p className="panel__empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="lk-chart-container" style={{ height, position: "relative" }}>
      {(centerLabel || centerValue) ? (
        <div className="lk-chart-center-label">
          {centerValue ? <div className="lk-chart-center-label__value">{centerValue}</div> : null}
          {centerLabel ? <div className="lk-chart-center-label__label">{centerLabel}</div> : null}
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2}>
            {data.map((entry, index) => {
              const color = entry.color ?? getSeriesColor(index);

              return <Cell key={`${entry.name}-${index}`} fill={color} />;
            })}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}