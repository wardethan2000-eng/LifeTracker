import type {
  AssetMetricCorrelationMatrix,
  AssetDetailResponse,
} from "@lifekeeper/types";
import type { JSX } from "react";
import { Suspense } from "react";
import { createMetricAction } from "../app/actions";
import { AssetMetricPanel } from "./asset-metric-panel";
import {
  getCorrelationStrengthLabel,
  getDivergencePillClass,
} from "../app/(dashboard)/assets/[assetId]/shared";

type AssetMetricsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  metricCorrelations: AssetMetricCorrelationMatrix | null;
};

export function AssetMetricsTab({ detail, assetId, metricCorrelations }: AssetMetricsTabProps): JSX.Element {
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
          {detail.metrics.map((metric) => (
            <Suspense
              key={metric.id}
              fallback={
                <section className="panel">
                  <div className="panel__header">
                    <div>
                      <h2>{metric.name}</h2>
                      <p style={{ margin: "6px 0 0 0", color: "var(--ink-muted)" }}>
                        {metric.currentValue} {metric.unit}
                      </p>
                    </div>
                  </div>
                  <div className="panel__body--padded">
                    <p className="panel__empty">Loading analytics…</p>
                  </div>
                </section>
              }
            >
              <AssetMetricPanel assetId={assetId} metric={metric} />
            </Suspense>
          ))}

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