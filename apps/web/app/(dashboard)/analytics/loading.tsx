import type { JSX } from "react";
import { RouteLoading } from "../../../components/route-loading";

export default function AnalyticsLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div className="skeleton-bar" style={{ width: 160, height: 28 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-bar" style={{ width: 80, height: 34, borderRadius: 6 }} />
            ))}
          </div>
        </header>
        <div className="page-body">
          <section className="stats-row">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <div className="skeleton-bar" style={{ width: 80, height: 14 }} />
                <div className="skeleton-bar" style={{ width: 72, height: 36, marginTop: 8 }} />
                <div className="skeleton-bar" style={{ width: 100, height: 14, marginTop: 4 }} />
              </div>
            ))}
          </section>
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 180, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 20 }}>
              <div className="skeleton-bar" style={{ width: "100%", height: 200, borderRadius: 8 }} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 200, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 20 }}>
              <div className="skeleton-bar" style={{ width: "100%", height: 160, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
