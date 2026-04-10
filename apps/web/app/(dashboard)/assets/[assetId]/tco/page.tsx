import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getAssetTco } from "../../../../../lib/api";
import { getMe } from "../../../../../lib/api";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

async function TcoContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  let tco;
  try {
    tco = await getAssetTco(assetId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load TCO: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  const { breakdown, timeline, failureSummary } = tco;

  return (
    <>
      <section className="panel">
        <div className="panel__header"><h2>Cost Breakdown</h2></div>
        <div className="panel__body--padded">
          <div className="kv-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            <div className="kv-card">
              <span className="kv-card__label">Total Cost of Ownership</span>
              <span className="kv-card__value">{formatCurrency(breakdown.totalCost)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Purchase Price</span>
              <span className="kv-card__value">{formatCurrency(breakdown.purchasePrice)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Maintenance</span>
              <span className="kv-card__value">{formatCurrency(breakdown.maintenanceCost)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Parts</span>
              <span className="kv-card__value">{formatCurrency(breakdown.partsCost)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Labor</span>
              <span className="kv-card__value">{formatCurrency(breakdown.laborCost)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Project Expenses</span>
              <span className="kv-card__value">{formatCurrency(breakdown.projectExpenses)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Cost / Month</span>
              <span className="kv-card__value">{formatCurrency(breakdown.costPerMonth)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Cost / Year</span>
              <span className="kv-card__value">{formatCurrency(breakdown.costPerYear)}</span>
            </div>
            <div className="kv-card">
              <span className="kv-card__label">Months Owned</span>
              <span className="kv-card__value">{breakdown.monthsOwned}</span>
            </div>
          </div>
        </div>
      </section>

      {timeline.length > 0 && (
        <section className="panel">
          <div className="panel__header"><h2>Cost Timeline</h2></div>
          <div className="panel__body">
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                    <td><span className="pill pill--muted">{entry.source}</span></td>
                    <td>{entry.label}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(entry.amount)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(entry.cumulativeCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {failureSummary.length > 0 && (
        <section className="panel">
          <div className="panel__header"><h2>Failure Cost Analysis</h2></div>
          <div className="panel__body">
            <table className="workbench-table">
              <thead>
                <tr>
                  <th>Failure Mode</th>
                  <th style={{ textAlign: "right" }}>Occurrences</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  <th>Last Occurrence</th>
                </tr>
              </thead>
              <tbody>
                {failureSummary.map((fs) => (
                  <tr key={fs.failureMode}>
                    <td>{fs.failureMode}</td>
                    <td style={{ textAlign: "right" }}>{fs.count}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(fs.totalCost)}</td>
                    <td>{new Date(fs.lastOccurrence).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export default async function AssetTcoPage({ params }: { params: Promise<{ assetId: string }> }): Promise<JSX.Element> {
  const { assetId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) return <p>No household found.</p>;

  return (
    <div className="page-body">
      <Suspense fallback={<div className="panel"><div className="panel__body--padded"><p className="note">Loading TCO data…</p></div></div>}>
        <TcoContent assetId={assetId} />
      </Suspense>
    </div>
  );
}
