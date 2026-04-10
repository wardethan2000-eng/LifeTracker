import type { AssetDetailResponse } from "@aegis/types";
import type { JSX } from "react";
import {
  createMetricEntryAction,
  deleteMetricAction,
  updateMetricAction,
} from "../app/actions";
import { AssetMetricCharts } from "./asset-metric-charts";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "../lib/formatters";
import {
  getDisplayPreferences,
  getEnhancedProjections,
  getMetricCostNormalization,
  getMetricEntries,
  getMetricProjection,
  getMetricRateAnalytics,
} from "../lib/api";
import {
  getDivergencePillClass,
  getUsageRateStatusClass,
  getUsageRateStatusLabel,
} from "../app/(dashboard)/assets/[assetId]/shared";

type Metric = AssetDetailResponse["metrics"][number];

type AssetMetricPanelProps = {
  assetId: string;
  metric: Metric;
};

const METRIC_ANALYTICS_LOOKBACK_DAYS = 365;

export async function AssetMetricPanel({ assetId, metric }: AssetMetricPanelProps): Promise<JSX.Element> {
  const [prefs, entries, projection, rateAnalytics, costNormalization, enhancedProjection] = await Promise.all([
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
    getMetricEntries(assetId, metric.id),
    getMetricProjection(assetId, metric.id).catch(() => null),
    getMetricRateAnalytics(assetId, metric.id).catch(() => null),
    getMetricCostNormalization(assetId, metric.id).catch(() => null),
    getEnhancedProjections(assetId, metric.id).catch(() => null),
  ]);

  const activeEnhancedProjection = enhancedProjection ?? null;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>{metric.name}</h2>
          <p style={{ margin: "6px 0 0 0", color: "var(--ink-muted)" }}>
            {metric.currentValue} {metric.unit} • Last recorded{" "}
            {formatDateTime(metric.lastRecordedAt, "never", undefined, prefs.dateFormat)}
          </p>
        </div>
        <form action={deleteMetricAction}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="metricId" value={metric.id} />
          <button type="submit" className="button button--danger button--sm">
            Delete Metric
          </button>
        </form>
      </div>

      <div className="panel__body--padded" style={{ display: "grid", gap: "24px" }}>
        <div
          style={{
            display: "grid",
            gap: "24px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <form action={updateMetricAction} className="form-grid">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="metricId" value={metric.id} />
            <label className="field">
              <span>Current Value</span>
              <input
                type="number"
                name="currentValue"
                min="0"
                step="0.1"
                defaultValue={metric.currentValue}
                required
              />
            </label>
            <label className="field">
              <span>Recorded At</span>
              <input type="datetime-local" name="lastRecordedAt" />
            </label>
            <button type="submit" className="button button--ghost">
              Update Snapshot
            </button>
          </form>

          <form action={createMetricEntryAction} className="form-grid">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="metricId" value={metric.id} />
            <label className="field">
              <span>New Reading</span>
              <input type="number" name="value" min="0" step="0.1" required />
            </label>
            <label className="field">
              <span>Recorded At</span>
              <input type="datetime-local" name="recordedAt" />
            </label>
            <label className="field">
              <span>Source</span>
              <input type="text" name="source" defaultValue="manual" />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea
                name="notes"
                rows={2}
                placeholder="Trip complete, service visit, seasonal reading"
              />
            </label>
            <label className="field">
              <span>Cost per Unit</span>
              <input type="number" name="costPerUnit" min="0" step="0.01" placeholder="0.00" />
            </label>
            <label className="field">
              <span>Total Cost</span>
              <input type="number" name="totalCost" min="0" step="0.01" placeholder="0.00" />
            </label>
            <button type="submit" className="button button--primary">
              Add Entry
            </button>
          </form>
        </div>

        <div
          style={{
            display: "grid",
            gap: "24px",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <section>
            <div className="eyebrow">Enhanced Projections</div>
            {activeEnhancedProjection ? (
              <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                <div className="pill">
                  Rate {activeEnhancedProjection.currentRate.toFixed(2)}{" "}
                  {activeEnhancedProjection.rateUnit}
                </div>
                {activeEnhancedProjection.scheduleProjections.length === 0 ? (
                  <p className="panel__empty">
                    No active schedules with usage thresholds are linked to this metric.
                  </p>
                ) : (
                  <div className="schedule-stack">
                    {activeEnhancedProjection.scheduleProjections.map((sp) => (
                      <article key={sp.scheduleId} className="schedule-card">
                        <div className="schedule-card__summary">
                          <div>
                            <h3>{sp.scheduleName}</h3>
                            <p
                              style={{
                                color: "var(--ink-muted)",
                                fontSize: "0.88rem",
                              }}
                            >
                              {sp.humanLabel}
                            </p>
                            <p
                              style={{
                                color: "var(--ink-muted)",
                                fontSize: "0.8rem",
                                marginTop: "4px",
                              }}
                            >
                              Rate used: {activeEnhancedProjection.currentRate.toFixed(2)}{" "}
                              {activeEnhancedProjection.rateUnit}
                            </p>
                          </div>
                          <span className="pill">
                            {sp.projectedDate
                              ? formatDate(sp.projectedDate, undefined, undefined, prefs.dateFormat)
                              : sp.humanLabel}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : projection ? (
              <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                <div className="pill">
                  Rate {projection.currentRate.toFixed(2)} {projection.rateUnit}
                </div>
                {projection.projectedValues.length === 0 ? (
                  <p className="panel__empty">No projected values available.</p>
                ) : (
                  <div className="schedule-stack">
                    {projection.projectedValues.map((pv) => (
                      <article key={pv.date} className="schedule-card">
                        <div className="schedule-card__summary">
                          <div>
                            <h3>
                              {pv.value.toFixed(1)} {metric.unit}
                            </h3>
                          </div>
                          <span className="pill">
                            {formatDate(pv.date, undefined, undefined, prefs.dateFormat)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="panel__empty" style={{ marginTop: "10px" }}>
                Not enough entry history to compute a projection yet.
              </p>
            )}
          </section>

          <section>
            <div className="eyebrow">Recent Entries</div>
            {entries.length ? (
              <div className="schedule-stack" style={{ marginTop: "10px" }}>
                {entries.slice(0, 8).map((entry) => (
                  <article key={entry.id} className="schedule-card">
                    <div className="schedule-card__summary">
                      <div>
                        <h3>
                          {entry.value} {metric.unit}
                        </h3>
                        <p
                          style={{
                            color: "var(--ink-muted)",
                            fontSize: "0.88rem",
                          }}
                        >
                          {entry.source}
                          {entry.notes ? ` • ${entry.notes}` : ""}
                        </p>
                      </div>
                      <span className="pill">
                        {formatDateTime(entry.recordedAt, undefined, undefined, prefs.dateFormat)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel__empty" style={{ marginTop: "10px" }}>
                No metric entries recorded yet.
              </p>
            )}
          </section>
        </div>

        <section>
          <div className="eyebrow">Usage Rate Trend</div>
          {rateAnalytics ? (
            <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
              <p>
                Averaging {rateAnalytics.mean.toFixed(2)} {metric.unit}/day over the last{" "}
                {METRIC_ANALYTICS_LOOKBACK_DAYS} days
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Usage Delta</th>
                    <th>Rate ({metric.unit}/day)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rateAnalytics.buckets.map((bucket) => (
                    <tr key={bucket.bucketStart}>
                      <td>
                        {formatDate(bucket.bucketStart, undefined, undefined, prefs.dateFormat)} -{" "}
                        {formatDate(bucket.bucketEnd, undefined, undefined, prefs.dateFormat)}
                      </td>
                      <td>{bucket.deltaValue.toFixed(1)}</td>
                      <td>{bucket.rate.toFixed(2)}</td>
                      <td>
                        <span
                          className={getUsageRateStatusClass(
                            bucket.insufficientData,
                            bucket.isAnomaly,
                            bucket.deviationFactor,
                          )}
                        >
                          {getUsageRateStatusLabel(
                            bucket.insufficientData,
                            bucket.isAnomaly,
                            bucket.deviationFactor,
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel__empty" style={{ marginTop: "10px" }}>
              Usage rate analytics are unavailable for this metric right now.
            </p>
          )}
        </section>

        {costNormalization && costNormalization.entries.length > 0 ? (
          <section>
            <div className="eyebrow">Cost per {metric.unit}</div>
            <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
              <AssetMetricCharts
                costNormalizationEntries={costNormalization.entries}
                projectionData={projection}
                metricUnit={metric.unit}
              />
              <p>
                Average cost:{" "}
                {formatCurrency(
                  costNormalization.averageCostPerUnit,
                  undefined,
                  prefs.currencyCode,
                )}{" "}
                per {metric.unit} across {costNormalization.totalUsage.toFixed(0)}{" "}
                {metric.unit} of tracked usage
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Maintenance</th>
                    <th>Usage Increment</th>
                    <th>Cost</th>
                    <th>Cost/{metric.unit}</th>
                  </tr>
                </thead>
                <tbody>
                  {costNormalization.entries.map((entry) => (
                    <tr key={`${entry.completedAt}-${entry.logTitle}`}>
                      <td>
                        {formatDate(entry.completedAt, undefined, undefined, prefs.dateFormat)}
                      </td>
                      <td>{entry.logTitle}</td>
                      <td>{entry.incrementalUsage.toFixed(1)}</td>
                      <td>{formatCurrency(entry.cost, undefined, prefs.currencyCode)}</td>
                      <td>{formatCurrency(entry.costPerUnit, undefined, prefs.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
