"use client";

import type { ReactElement } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors } from "../../lib/chart-theme";

export type LkLineChartProps = {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{ dataKey: string; label: string; color?: string }>;
  xTickFormatter?: (value: string) => string;
  yTickFormatter?: (value: number) => string;
  height?: number;
  emptyMessage?: string;
};

const toNumber = (value: unknown): number => typeof value === "number" ? value : Number(value ?? 0);
const getSeriesColor = (index: number): string => chartColors.series[index % chartColors.series.length] ?? chartColors.primary;

export function LkLineChart({
  data,
  xKey,
  lines,
  xTickFormatter,
  yTickFormatter,
  height = 300,
  emptyMessage = "No data available"
}: LkLineChartProps): ReactElement {
  if (data.length === 0) {
    return (
      <div className="lk-chart-container lk-chart-container--empty">
        <p className="panel__empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="lk-chart-container" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...(xTickFormatter ? { tickFormatter: xTickFormatter } : {})} tick={{ fill: chartColors.muted, fontSize: 12 }} />
          <YAxis {...(yTickFormatter ? { tickFormatter: yTickFormatter } : {})} tick={{ fill: chartColors.muted, fontSize: 12 }} />
          <Tooltip {...(yTickFormatter ? { formatter: (value: unknown) => yTickFormatter(toNumber(value)) } : {})} />
          <Legend verticalAlign="bottom" />
          {lines.map((line, index) => {
            const color = line.color ?? getSeriesColor(index);

            return (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                name={line.label}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}