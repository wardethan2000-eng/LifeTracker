import type {
  AssetMetricCorrelationMatrix,
  AssetDetailResponse,
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  createMetricAction,
  createMetricEntryAction,
  deleteMetricAction,
  updateMetricAction
} from "../app/actions";
import { AssetMetricCharts } from "./asset-metric-charts";
import {
  formatCurrency,
  formatDate,
  formatDateTime
} from "../lib/formatters";
import {
  getCorrelationStrengthLabel,
  getDivergencePillClass,
  getUsageRateStatusClass,
  getUsageRateStatusLabel,
  type MetricInsight
} from "../app/assets/[assetId]/shared";

type AssetMetricsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  metricInsights: Record<string, MetricInsight>;
  metricCorrelations: AssetMetricCorrelationMatrix | null;
};

const METRIC_ANALYTICS_LOOKBACK_DAYS = 365;

export async function AssetMetricsTab({ detail, assetId, metricInsights, metricCorrelations }: AssetMetricsTabProps): Promise<JSX.Element> {

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>Add Usage Metric</h2>
        </div>
        <div className="panel__body--padded">
          <form action={createMetricAction} className="form-grid">
            <input type="hidden" name="assetId" value={detail.asset.id} />
            <label className="field">
              <span>Name</span>
              <input type="text" name="name" placeholder="Odometer" required />
            </label>
            <label className="field">
              <span>Unit</span>
              <input type="text" name="unit" placeholder="miles" required />
            </label>
            <label className="field">
              <span>Starting Value</span>
              <input type="number" name="currentValue" min="0" step="0.1" defaultValue="0" />
            </label>
            <label className="field">
              <span>Recorded At</span>
              <input type="datetime-local" name="lastRecordedAt" />
            </label>
            <button type="submit" className="button button--primary">Create Metric</button>
          </form>
        </div>
      </section>

      {detail.metrics.length === 0 ? (
        <section className="panel">
          <div className="panel__body">
            <p className="panel__empty">No usage metrics yet.</p>
          </div>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          {detail.metrics.map((metric) => {
            const insight = metricInsights[metric.id];
            const enhancedProjection = insight?.enhancedProjection ?? null;

            return (
              <section key={metric.id} className="panel">
                <div className="panel__header">
                  <div>
                    <h2>{metric.name}</h2>
                    <p style={{ margin: "6px 0 0 0", color: "var(--ink-muted)" }}>
                      {metric.currentValue} {metric.unit} • Last recorded {formatDateTime(metric.lastRecordedAt, "never")}
                    </p>
                  </div>
                  <form action={deleteMetricAction}>
                    <input type="hidden" name="assetId" value={detail.asset.id} />
                    <input type="hidden" name="metricId" value={metric.id} />
                    <button type="submit" className="button button--danger button--sm">Delete Metric</button>
                  </form>
                </div>
                <div className="panel__body--padded" style={{ display: "grid", gap: "24px" }}>
                  <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    <form action={updateMetricAction} className="form-grid">
                      <input type="hidden" name="assetId" value={detail.asset.id} />
                      <input type="hidden" name="metricId" value={metric.id} />
                      <label className="field">
                        <span>Current Value</span>
                        <input type="number" name="currentValue" min="0" step="0.1" defaultValue={metric.currentValue} required />
                      </label>
                      <label className="field">
                        <span>Recorded At</span>
                        <input type="datetime-local" name="lastRecordedAt" />
                      </label>
                      <button type="submit" className="button button--ghost">Update Snapshot</button>
                    </form>

                    <form action={createMetricEntryAction} className="form-grid">
                      <input type="hidden" name="assetId" value={detail.asset.id} />
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
                        <textarea name="notes" rows={2} placeholder="Trip complete, service visit, seasonal reading" />
                      </label>
                      <button type="submit" className="button button--primary">Add Entry</button>
                    </form>
                  </div>

                  <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    <section>
                      <div className="eyebrow">Enhanced Projections</div>
                      {enhancedProjection ? (
                        <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                          <div className="pill">Rate {enhancedProjection.currentRate.toFixed(2)} {enhancedProjection.rateUnit}</div>
                          {enhancedProjection.scheduleProjections.length === 0 ? (
                            <p className="panel__empty">No active schedules with usage thresholds are linked to this metric.</p>
                          ) : (
                            <div className="schedule-stack">
                              {enhancedProjection.scheduleProjections.map((projection) => (
                                <article key={projection.scheduleId} className="schedule-card">
                                  <div className="schedule-card__summary">
                                    <div>
                                      <h3>{projection.scheduleName}</h3>
                                      <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                                        {projection.humanLabel}
                                      </p>
                                      <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "4px" }}>
                                        Rate used: {enhancedProjection.currentRate.toFixed(2)} {enhancedProjection.rateUnit}
                                      </p>
                                    </div>
                                    <span className="pill">
                                      {projection.projectedDate ? formatDate(projection.projectedDate) : projection.humanLabel}
                                    </span>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : insight?.projection ? (
                        <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                          <div className="pill">Rate {insight.projection.currentRate.toFixed(2)} {insight.projection.rateUnit}</div>
                          {insight.projection.projectedValues.length === 0 ? (
                            <p className="panel__empty">No projected values available.</p>
                          ) : (
                            <div className="schedule-stack">
                              {insight.projection.projectedValues.map((projection) => (
                                <article key={projection.date} className="schedule-card">
                                  <div className="schedule-card__summary">
                                    <div>
                                      <h3>{projection.value.toFixed(1)} {metric.unit}</h3>
                                    </div>
                                    <span className="pill">{formatDate(projection.date)}</span>
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
                      {insight?.entries.length ? (
                        <div className="schedule-stack" style={{ marginTop: "10px" }}>
                          {insight.entries.slice(0, 8).map((entry) => (
                            <article key={entry.id} className="schedule-card">
                              <div className="schedule-card__summary">
                                <div>
                                  <h3>{entry.value} {metric.unit}</h3>
                                  <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                                    {entry.source}
                                    {entry.notes ? ` • ${entry.notes}` : ""}
                                  </p>
                                </div>
                                <span className="pill">{formatDateTime(entry.recordedAt)}</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="panel__empty" style={{ marginTop: "10px" }}>No metric entries recorded yet.</p>
                      )}
                    </section>
                  </div>

                  <section>
                    <div className="eyebrow">Usage Rate Trend</div>
                    {insight?.rateAnalytics ? (
                      <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                        <p>
                          Averaging {insight.rateAnalytics.mean.toFixed(2)} {metric.unit}/day over the last {METRIC_ANALYTICS_LOOKBACK_DAYS} days
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
                            {insight.rateAnalytics.buckets.map((bucket) => (
                              <tr key={bucket.bucketStart}>
                                <td>{formatDate(bucket.bucketStart)} - {formatDate(bucket.bucketEnd)}</td>
                                <td>{bucket.deltaValue.toFixed(1)}</td>
                                <td>{bucket.rate.toFixed(2)}</td>
                                <td>
                                  <span className={getUsageRateStatusClass(bucket.insufficientData, bucket.isAnomaly, bucket.deviationFactor)}>
                                    {getUsageRateStatusLabel(bucket.insufficientData, bucket.isAnomaly, bucket.deviationFactor)}
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

                  {insight?.costNormalization && insight.costNormalization.entries.length > 0 ? (
                    <section>
                      <div className="eyebrow">Cost per {metric.unit}</div>
                      <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                        <AssetMetricCharts
                          costNormalizationEntries={insight.costNormalization.entries}
                          projectionData={insight.projection}
                          metricUnit={metric.unit}
                        />
                        <p>
                          Average cost: {formatCurrency(insight.costNormalization.averageCostPerUnit)} per {metric.unit} across {insight.costNormalization.totalUsage.toFixed(0)} {metric.unit} of tracked usage
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
                            {insight.costNormalization.entries.map((entry) => (
                              <tr key={`${entry.completedAt}-${entry.logTitle}`}>
                                <td>{formatDate(entry.completedAt)}</td>
                                <td>{entry.logTitle}</td>
                                <td>{entry.incrementalUsage.toFixed(1)}</td>
                                <td>{formatCurrency(entry.cost)}</td>
                                <td>{formatCurrency(entry.costPerUnit)}</td>
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
          })}

          {detail.metrics.length >= 2 && metricCorrelations ? (
            <section className="panel">
              <div className="panel__header">
                <h2>Metric Correlations</h2>
                <span className="pill">{metricCorrelations.pairs.length}</span>
              </div>
              <div className="panel__body--padded">
                {metricCorrelations.pairs.length === 0 ? (
                  <p className="panel__empty">Not enough metric history is available to compare usage patterns yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    {metricCorrelations.pairs.map((pair) => (
                      <article key={`${pair.metricA.id}-${pair.metricB.id}`} className="schedule-card">
                        <div style={{ display: "grid", gap: "12px" }}>
                          <div>
                            <h3>{pair.metricA.name} vs {pair.metricB.name}</h3>
                            <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", marginTop: "4px" }}>
                              {pair.correlation.toFixed(2)} • {getCorrelationStrengthLabel(pair.correlation)}
                            </p>
                          </div>
                          <dl className="data-list">
                            <div>
                              <dt>Mean ratio</dt>
                              <dd>{pair.meanRatio.toFixed(2)}x</dd>
                            </div>
                            <div>
                              <dt>Divergence</dt>
                              <dd><span className={getDivergencePillClass(pair.divergenceTrend)}>{pair.divergenceTrend}</span></dd>
                            </div>
                            <div>
                              <dt>Samples</dt>
                              <dd>{pair.ratioSeries.length}</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}