import type { JSX } from "react";

type AssetTcoPanelProps = {
  breakdown: {
    totalCost: number;
    purchasePrice: number;
    maintenanceCost: number;
    partsCost: number;
    laborCost: number;
    projectExpenses: number;
    costPerMonth: number;
    costPerYear: number;
    monthsOwned: number;
  };
  timeline: Array<{
    date: string;
    source: string;
    label: string;
    amount: number;
    cumulativeCost: number;
  }>;
  failureSummary: Array<{
    failureMode: string;
    count: number;
    totalCost: number;
    lastOccurrence: string;
  }>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function AssetTcoPanel({ breakdown, timeline, failureSummary }: AssetTcoPanelProps): JSX.Element {
  return (
    <section className="panel" id="asset-tco">
      <div className="panel__header">
        <div>
          <h2>Total Cost of Ownership</h2>
          <p className="data-table__secondary">Lifetime ownership cost, trendline, and failure cost concentration.</p>
        </div>
      </div>
      <div className="panel__body--padded" style={{ display: "grid", gap: 24 }}>
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

        {timeline.length > 0 ? (
          <section>
            <div className="panel__header" style={{ paddingInline: 0, paddingTop: 0 }}>
              <h3>Cost Timeline</h3>
            </div>
            <div className="panel__body" style={{ paddingInline: 0, paddingBottom: 0 }}>
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
        ) : null}

        {failureSummary.length > 0 ? (
          <section>
            <div className="panel__header" style={{ paddingInline: 0, paddingTop: 0 }}>
              <h3>Failure Cost Analysis</h3>
            </div>
            <div className="panel__body" style={{ paddingInline: 0, paddingBottom: 0 }}>
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
                  {failureSummary.map((item) => (
                    <tr key={item.failureMode}>
                      <td>{item.failureMode}</td>
                      <td style={{ textAlign: "right" }}>{item.count}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(item.totalCost)}</td>
                      <td>{new Date(item.lastOccurrence).toLocaleDateString()}</td>
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
