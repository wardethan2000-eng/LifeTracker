"use client";

import type { ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTimezone } from "../../lib/timezone-context";
import { chartColors, createDateTickFormatter, formatCurrencyTick, formatMonthTick, formatPercentTick } from "../../lib/chart-theme";

type ChartStringFormatterKey = "date" | "month";
type ChartNumberFormatterKey = "currency" | "percent";

export type LkBarChartProps = {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: Array<{ dataKey: string; label: string; color?: string; stackId?: string; colorKey?: string }>;
  xTickFormatter?: ((value: string) => string) | ChartStringFormatterKey;
  yTickFormatter?: ((value: number) => string) | ChartNumberFormatterKey;
  height?: number;
  layout?: "horizontal" | "vertical";
  emptyMessage?: string;
};

const toNumber = (value: unknown): number => typeof value === "number" ? value : Number(value ?? 0);
const getSeriesColor = (index: number): string => chartColors.series[index % chartColors.series.length] ?? chartColors.primary;
const resolveNumberFormatter = (formatter: LkBarChartProps["yTickFormatter"]): ((value: number) => string) | undefined => {
  if (!formatter) {
    return undefined;
  }

  if (typeof formatter === "function") {
    return formatter;
  }

  return formatter === "percent" ? formatPercentTick : formatCurrencyTick;
};

export function LkBarChart({
  data,
  xKey,
  bars,
  xTickFormatter,
  yTickFormatter,
  height = 300,
  layout = "horizontal",
  emptyMessage = "No data available"
}: LkBarChartProps): ReactElement {
  const { timezone } = useTimezone();
  const resolvedXTickFormatter = xTickFormatter == null
    ? undefined
    : typeof xTickFormatter === "function"
      ? xTickFormatter
      : xTickFormatter === "month"
        ? formatMonthTick
        : createDateTickFormatter(timezone);
  const resolvedYTickFormatter = resolveNumberFormatter(yTickFormatter);

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
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          {layout === "vertical" ? (
            <>
              <XAxis type="number" {...(resolvedYTickFormatter ? { tickFormatter: resolvedYTickFormatter } : {})} tick={{ fill: chartColors.muted, fontSize: 12 }} />
              <YAxis type="category" dataKey={xKey} {...(resolvedXTickFormatter ? { tickFormatter: resolvedXTickFormatter } : {})} width={160} tick={{ fill: chartColors.muted, fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...(resolvedXTickFormatter ? { tickFormatter: resolvedXTickFormatter } : {})} tick={{ fill: chartColors.muted, fontSize: 12 }} />
              <YAxis {...(resolvedYTickFormatter ? { tickFormatter: resolvedYTickFormatter } : {})} tick={{ fill: chartColors.muted, fontSize: 12 }} />
            </>
          )}
          <Tooltip {...(resolvedYTickFormatter ? { formatter: (value: unknown) => resolvedYTickFormatter(toNumber(value)) } : {})} />
          <Legend verticalAlign="bottom" />
          {bars.map((bar, index) => {
            const defaultColor = bar.color ?? getSeriesColor(index);

            return (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.label}
                fill={defaultColor}
                {...(bar.stackId ? { stackId: bar.stackId } : {})}
                radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              >
                {bar.colorKey ? data.map((entry, entryIndex) => {
                  const colorValue = entry[bar.colorKey ?? ""];
                  const fill = typeof colorValue === "string" ? colorValue : defaultColor;

                  return <Cell key={`${bar.dataKey}-${entryIndex}`} fill={fill} />;
                }) : null}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}