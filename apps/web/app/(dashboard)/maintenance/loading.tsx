import type { JSX } from "react";

import { RouteLoading } from "../../../components/route-loading";

export default function MaintenanceLoading(): JSX.Element {
  return (
    <RouteLoading>
      <div className="skeleton-page">
        <header className="page-header">
          <div className="skeleton-bar" style={{ width: 200, height: 28 }} />
        </header>
        <div className="page-body">
          <section className="stats-row">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <div className="skeleton-bar" style={{ width: 80, height: 14 }} />
                <div className="skeleton-bar" style={{ width: 48, height: 36, marginTop: 8 }} />
              </div>
            ))}
          </section>
          <div className="panel">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 180, height: 20 }} />
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div className="skeleton-bar" style={{ width: 70, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 160, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 120, height: 18 }} />
                  <div className="skeleton-bar" style={{ width: 100, height: 18 }} />
                  <div className="skeleton-bar" style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoading>
  );
}
