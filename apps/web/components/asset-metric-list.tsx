"use client";

import type { AssetDetailResponse, UsageMetricEntry, UsageProjection } from "@lifekeeper/types";
import type { JSX } from "react";
import { Card } from "./card";
import { SectionFilterBar, SectionFilterChildren, SectionFilterProvider, SectionFilterToggle } from "./section-filter";
import { formatDate, formatDateTime } from "../lib/formatters";

type MetricInsight = {
  metricId: string;
  entries: UsageMetricEntry[];
  projection: UsageProjection | null;
};

type AssetMetricListProps = {
  assetId: string;
  metrics: AssetDetailResponse["metrics"];
  metricInsights: Record<string, MetricInsight>;
  updateMetricAction: (formData: FormData) => void | Promise<void>;
  createMetricEntryAction: (formData: FormData) => void | Promise<void>;
  deleteMetricAction: (formData: FormData) => void | Promise<void>;
};

export function AssetMetricList({
  assetId,
  metrics,
  metricInsights,
  updateMetricAction,
  createMetricEntryAction,
  deleteMetricAction
}: AssetMetricListProps): JSX.Element {
  return (
    <SectionFilterProvider items={metrics} keys={["name", "unit"]} placeholder="Filter metrics by name or unit">
      <Card
        title="Tracked Metrics"
        actions={<SectionFilterToggle />}
        headerContent={<SectionFilterBar />}
      >
        <SectionFilterChildren<AssetDetailResponse["metrics"][number]>>
          {(filteredMetrics) => (
            <>
              {metrics.length === 0 ? <p className="panel__empty">No usage metrics yet.</p> : null}
              {metrics.length > 0 && filteredMetrics.length === 0 ? <p className="panel__empty">No usage metrics match that search.</p> : null}
              {filteredMetrics.length > 0 ? (
                <div style={{ display: "grid", gap: "24px" }}>
                  {filteredMetrics.map((metric) => {
                    const insight = metricInsights[metric.id];

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
                            <input type="hidden" name="assetId" value={assetId} />
                            <input type="hidden" name="metricId" value={metric.id} />
                            <button type="submit" className="button button--danger button--sm">Delete Metric</button>
                          </form>
                        </div>
                        <div className="panel__body--padded" style={{ display: "grid", gap: "24px" }}>
                          <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                            <form action={updateMetricAction} className="form-grid">
                              <input type="hidden" name="assetId" value={assetId} />
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
                                <textarea name="notes" rows={2} placeholder="Trip complete, service visit, seasonal reading" />
                              </label>
                              <button type="submit" className="button button--primary">Add Entry</button>
                            </form>
                          </div>

                          <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                            <section>
                              <div className="eyebrow">Projection</div>
                              {insight?.projection ? (
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
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </SectionFilterChildren>
      </Card>
    </SectionFilterProvider>
  );
}
